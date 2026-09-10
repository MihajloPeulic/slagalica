"use server";

import {
    joinGameRoom,
} from "@/actions/game/game";

import {
    clearGameCapability,
    issueBlueGameCapability,
} from "@/lib/game/game-capability";

import {
    createServerSupabaseClient,
} from "@/utils/supabase/server";

type GameEntryKind =
    | "fresh_red_join"
    | "existing_participant";

/*
    Ovaj wrapper radi dvije stvari:

    1. poziva postojeći joinGameRoom() koji i dalje ostaje authority za
       auth / room claim / role logiku;

    2. vraća entryKind da client može razlikovati:
       - fresh RED join -> normalni VS / 5s start ekran
       - postojeći participant -> refresh/reconnect recovery

    Entry classification NIJE security odluka. Security i dalje zavisi od
    joinGameRoom() + BLUE capability cookie-a.
*/
export async function joinGameRoomWithCapability(
    roomId: string
) {
    const supabase =
        await createServerSupabaseClient();

    /*
        Ovdje nam treba samo user id prije join-a da znamo da li je ovo
        prvi RED claim ili ulazak postojećeg participanta. I dalje NIŠTA
        sigurnosno ne odlučujemo na osnovu ovog rezultata; joinGameRoom()
        ostaje authority.
    */
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const userId =
        user?.id ?? null;

    let wasParticipantBeforeJoin:
        boolean | null = null;

    if (userId) {
        const {
            data: roomBeforeJoin,
        } = await supabase
            .from("game_rooms")
            .select(`
                player_blue_id,
                player_red_id
            `)
            .eq("id", roomId)
            .maybeSingle();

        if (roomBeforeJoin) {
            wasParticipantBeforeJoin =
                roomBeforeJoin.player_blue_id === userId ||
                roomBeforeJoin.player_red_id === userId;
        }
    }

    const result =
        await joinGameRoom(roomId);

    if (
        result?.error ||
        !result?.role
    ) {
        return result;
    }

    if (result.role === "blue") {
        await issueBlueGameCapability(
            roomId
        );
    } else {
        /* RED nema Redis write capability. */
        await clearGameCapability(
            roomId
        );
    }

    const entryKind:
        GameEntryKind =
        result.role === "red" &&
        wasParticipantBeforeJoin === false
            ? "fresh_red_join"
            : "existing_participant";

    return {
        ...result,
        entryKind,
    };
}
