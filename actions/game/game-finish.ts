"use server";

import "server-only";

import { Redis } from "@upstash/redis";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import type { FinalGameResult, PlayerRole } from "@/lib/game/game-result-types";

const redis = Redis.fromEnv();

function validateRoomId(roomId: unknown): asserts roomId is string {
    if (
        typeof roomId !== "string" ||
        roomId.length < 1 ||
        roomId.length > 128
    ) {
        throw new Error("Invalid roomId");
    }
}

function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error("Supabase admin environment variables are missing");
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

function decodeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value !== "string") {
        return null;
    }

    try {
        const parsed = JSON.parse(value);
        return typeof parsed === "number" && Number.isFinite(parsed)
            ? parsed
            : null;
    } catch {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
}

function roleForUser(
    userId: string,
    blueId: string,
    redId: string
): PlayerRole | null {
    if (userId === blueId) return "blue";
    if (userId === redId) return "red";
    return null;
}

function mapRpcResult(row: any): FinalGameResult {
    return {
        finishReason: row.finish_reason,
        winnerRole: row.winner_role ?? null,
        forfeitedRole: row.forfeited_role ?? null,
        blueScore: Number(row.blue_score ?? 0),
        redScore: Number(row.red_score ?? 0),
        blueXpChange: Number(row.blue_xp_change ?? 0),
        redXpChange: Number(row.red_xp_change ?? 0),
        finishedAt: row.finished_at,
    };
}

async function requireAuthenticatedPlayer(roomId: string) {
    const supabase = await createServerSupabaseClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error("Unauthorized");
    }

    const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select(
            "id, status, player_blue_id, player_red_id, disconnected_player_id, disconnect_deadline"
        )
        .eq("id", roomId)
        .single();

    if (roomError || !room) {
        throw new Error("Game room not found");
    }

    if (!room.player_blue_id || !room.player_red_id) {
        throw new Error("Game room does not have two players");
    }

    const role = roleForUser(
        user.id,
        room.player_blue_id,
        room.player_red_id
    );

    if (!role) {
        throw new Error("You are not a player in this room");
    }

    return {
        supabase,
        user,
        room,
        role,
    };
}

async function readCanonicalRedisProgress(roomId: string) {
    const hash =
        (await redis.hgetall<Record<string, unknown>>(`game_${roomId}`)) ?? {};

    const gameIndex = decodeNumber(hash.gameIndex);
    const blueScore = decodeNumber(hash.blueScore);
    const redScore = decodeNumber(hash.redScore);

    if (blueScore === null || redScore === null) {
        throw new Error("Canonical game score is missing from Redis");
    }

    return {
        gameIndex,
        blueScore,
        redScore,
    };
}

/**
 * Starts a server-authoritative 40 second disconnect claim.
 * The SQL function derives the opponent from auth.uid(); the client never
 * supplies a target player or deadline.
 */
export async function startDisconnectClaimAction(roomId: string) {
    validateRoomId(roomId);

    const { supabase } = await requireAuthenticatedPlayer(roomId);

    const { data, error } = await supabase.rpc(
        "start_game_disconnect_claim",
        { p_room_id: roomId }
    );

    if (error) {
        return { error: error.message };
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
        success: true,
        disconnectedPlayerId: row?.disconnected_player_id ?? null,
        disconnectStartedAt: row?.disconnect_started_at ?? null,
        disconnectDeadline: row?.disconnect_deadline ?? null,
        serverNow: row?.server_now ?? new Date().toISOString(),
    };
}

export type CancelDisconnectClaimResult = {
    success: boolean;
    cancelled: boolean;
    pausedMs: number;
    pauseVersion: number;
    serverNow: string;
    error?: string;
};

/**
 * Called by the player who has reconnected and sees that there is an active
 * claim against their own authenticated account.
 *
 * IMPORTANT: every return path has the SAME shape. This keeps the client-side
 * Server Action type stable, so GameRoomPage can always safely read
 * pausedMs/pauseVersion after checking `cancelled`.
 */
export async function cancelMyDisconnectClaimAction(
    roomId: string
): Promise<CancelDisconnectClaimResult> {
    validateRoomId(roomId);

    const { supabase } = await requireAuthenticatedPlayer(roomId);

    const { data, error } = await supabase.rpc(
        "cancel_my_game_disconnect_claim",
        { p_room_id: roomId }
    );

    if (error) {
        return {
            success: false,
            cancelled: false,
            pausedMs: 0,
            pauseVersion: 0,
            serverNow: new Date().toISOString(),
            error: error.message,
        };
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
        success: true,
        cancelled: row?.cancelled === true,
        pausedMs:
            typeof row?.paused_ms === "number"
                ? row.paused_ms
                : Number(row?.paused_ms ?? 0),
        pauseVersion:
            typeof row?.pause_version === "number"
                ? row.pause_version
                : Number(row?.pause_version ?? 0),
        serverNow: String(row?.server_now ?? new Date().toISOString()),
    };
}

async function finalizeGame(
    roomId: string,
    reason: "normal" | "disconnect"
) {
    validateRoomId(roomId);

    const { user, room, role } = await requireAuthenticatedPlayer(roomId);

    if (room.status === "finished") {
        const admin = createAdminClient();
        const { data: finishedRoom, error } = await admin
            .from("game_rooms")
            .select(
                "finish_reason, winner_id, forfeited_player_id, blue_score, red_score, blue_xp_change, red_xp_change, finished_at, player_blue_id, player_red_id"
            )
            .eq("id", roomId)
            .single();

        if (error || !finishedRoom) {
            return { error: error?.message ?? "Could not read finished game" };
        }

        const winnerRole = finishedRoom.winner_id
            ? roleForUser(
                  finishedRoom.winner_id,
                  finishedRoom.player_blue_id,
                  finishedRoom.player_red_id
              )
            : null;

        const forfeitedRole = finishedRoom.forfeited_player_id
            ? roleForUser(
                  finishedRoom.forfeited_player_id,
                  finishedRoom.player_blue_id,
                  finishedRoom.player_red_id
              )
            : null;

        return {
            success: true,
            result: {
                finishReason: finishedRoom.finish_reason,
                winnerRole,
                forfeitedRole,
                blueScore: Number(finishedRoom.blue_score ?? 0),
                redScore: Number(finishedRoom.red_score ?? 0),
                blueXpChange: Number(finishedRoom.blue_xp_change ?? 0),
                redXpChange: Number(finishedRoom.red_xp_change ?? 0),
                finishedAt: finishedRoom.finished_at,
            } satisfies FinalGameResult,
        };
    }

    if (room.status !== "in_progress") {
        return { error: "Game is not in progress" };
    }

    if (reason === "normal" && role !== "blue") {
        return { error: "Blue player finalizes a normal game" };
    }

    if (reason === "disconnect") {
        if (!room.disconnected_player_id || !room.disconnect_deadline) {
            return { error: "There is no active disconnect claim" };
        }

        if (room.disconnected_player_id === user.id) {
            return { error: "Disconnected player cannot claim the win" };
        }

        const deadlineMs = new Date(room.disconnect_deadline).getTime();
        if (!Number.isFinite(deadlineMs) || Date.now() < deadlineMs) {
            return { error: "Disconnect grace period has not expired" };
        }
    }

    // One Redis read only when the match is actually being finalized.
    const canonical = await readCanonicalRedisProgress(roomId);

    if (reason === "normal" && canonical.gameIndex !== 6) {
        return { error: "Canonical game state has not reached the end screen" };
    }

    const admin = createAdminClient();

    const { data, error } = await admin.rpc(
        "finalize_game_result_server",
        {
            p_room_id: roomId,
            p_reason: reason,
            p_caller_id: user.id,
            p_blue_score: canonical.blueScore,
            p_red_score: canonical.redScore,
        }
    );

    if (error) {
        return { error: error.message };
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
        return { error: "Finalization returned no result" };
    }

    return {
        success: true,
        result: mapRpcResult(row),
    };
}

export async function finalizeNormalGameAction(roomId: string) {
    return finalizeGame(roomId, "normal");
}

export async function finalizeDisconnectGameAction(roomId: string) {
    return finalizeGame(roomId, "disconnect");
}
