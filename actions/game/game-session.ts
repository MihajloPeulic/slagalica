"use server";

import {
    joinGameRoom,
} from "@/actions/game/game";

import {
    clearGameCapability,
    issueBlueGameCapability,
} from "@/lib/game/game-capability";

export type GameEntryKind =
    | "fresh_red_join"
    | "existing_participant";

type BaseJoinGameRoomResult =
    Awaited<ReturnType<typeof joinGameRoom>>;

export type JoinGameRoomWithCapabilityResult =
    BaseJoinGameRoomResult & {
        entryKind: GameEntryKind | null;
    };

/*
    Entry classification sada dolazi iz ISTOG atomic join flow-a.

    Nema preflight room SELECT-a:
    - public RED claim -> joinGameRoom() vraća joinedNow:true
    - friend invite waiting->in_progress -> joinedNow:true
    - RED/BLUE reconnect u već in_progress room -> joinedNow:false

    Time fresh join više ne zavisi od RLS-a, timing-a ili duplog rendera.
*/
export async function joinGameRoomWithCapability(
    roomId: string
): Promise<JoinGameRoomWithCapabilityResult> {
    const result =
        await joinGameRoom(roomId);

    if (
        result?.error ||
        !result?.role
    ) {
        return {
            ...result,
            entryKind: null,
        } as JoinGameRoomWithCapabilityResult;
    }

    if (result.role === "blue") {
        await issueBlueGameCapability(
            roomId
        );
    } else {
        await clearGameCapability(
            roomId
        );
    }

    const entryKind: GameEntryKind =
        result.role === "red" &&
        result.joinedNow === true
            ? "fresh_red_join"
            : "existing_participant";

    return {
        ...result,
        entryKind,
    } as JoinGameRoomWithCapabilityResult;
}
