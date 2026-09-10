"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getCurrentUserWithProfile } from "@/data/auth";
import { generateFullGameState } from "@/utils/games/rec";

type GameRoomAccessResult =
    | {
          hasAccess: true;
      }
    | {
          hasAccess: false;
          existingRoomId?: string;
          error?: string;
      };

export type JoinGameRoomOnStartResult =
    | {
          kind: "active_game";
          roomId: string;
      }
    | {
          kind: "match_found";
          roomId: string;
      }
    | {
          kind: "none";
          roomId: null;
      }
    | {
          kind: "error";
          roomId: null;
          error: string;
      };

async function checkGameRoomAccess(
    userId: string,
    excludeRoomId?: string,
): Promise<GameRoomAccessResult> {
    const supabase =
        await createServerSupabaseClient();

    let query = supabase
        .from("game_rooms")
        .select("id")
        .or(
            `player_blue_id.eq.${userId},player_red_id.eq.${userId}`,
        )
        .in("status", [
            "waiting",
            "in_progress",
        ]);

    /*
        Kod join-a dozvoli da user ponovo uđe
        u sobu u kojoj se već nalazi.
    */
    if (excludeRoomId) {
        query = query.neq(
            "id",
            excludeRoomId,
        );
    }

    const {
        data: existingRoom,
        error,
    } = await query
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error(
            "Game room access check:",
            error.message,
        );

        return {
            hasAccess: false,
            error:
                "Greška pri proveri pristupa sobi.",
        };
    }

    if (existingRoom) {
        return {
            hasAccess: false,
            existingRoomId:
                existingRoom.id,
        };
    }

    return {
        hasAccess: true,
    };
}

// Funkcija kada igrač A izazove prijatelja / napravi sobu
export async function createGameRoom(
    friendId?: string,
) {
    const user =
        await getCurrentUserWithProfile();

    const userId =
        user?.user?.id;

    if (!userId) {
        return {
            error: "Niste ulogovani.",
        };
    }

    /*
        VAŽNO:
        Ako user već ima waiting/in_progress sobu,
        vraćamo i njen ID.

        Ovo je server-side fallback za race:
        čak i ako je StartGame prije par ms provjerio da
        nema aktivne sobe, ovdje opet dobijamo canonical
        odgovor prije kreiranja nove.
    */
    const accessCheck =
        await checkGameRoomAccess(
            userId,
        );

    if (!accessCheck.hasAccess) {
        if (
            accessCheck.existingRoomId
        ) {
            return {
                error:
                    "Već ste u aktivnoj partiji.",
                activeRoomId:
                    accessCheck.existingRoomId,
            };
        }

        return {
            error:
                accessCheck.error ??
                "Greška pri proveri aktivne partije.",
        };
    }

    if (friendId) {
        if (friendId === userId) {
            return {
                error:
                    "Ne možete izazvati sami sebe.",
            };
        }

        const friendAccessCheck =
            await checkGameRoomAccess(
                friendId,
            );

        if (
            !friendAccessCheck.hasAccess
        ) {
            return {
                error:
                    "Ovaj igrač je već u aktivnoj partiji.",
            };
        }
    }

    const initialGameState =
        await generateFullGameState();

    const supabase =
        await createServerSupabaseClient();

    const { data, error } =
        await supabase
            .from("game_rooms")
            .insert({
                player_blue_id:
                    userId,

                blue_name:
                    user.profile.username,

                player_red_id:
                    friendId ?? null,

                status: "waiting",

                game_state:
                    initialGameState,

                current_game_index: 0,
                current_round: 1,

                score_blue: 0,
                score_red: 0,
            })
            .select()
            .single();

    if (error) {
        return {
            error:
                "Greška pri kreiranju sobe.",
        };
    }

    return {
        roomId: data.id,
    };
}

// Funkcija kada igrač B prihvati poziv i uđe u sobu kao CRVENI
export async function joinGameRoom(
    roomId: string,
): Promise<{
    error?: string;
    success?: boolean;
    role?: "blue" | "red";

    /*
        true samo kada OVAJ poziv predstavlja prvi stvarni RED ulazak
        koji pokreće meč. Wrapper koristi ovo za robustan fresh_red_join;
        nema preflight SELECT/race/RLS heuristike.
    */
    joinedNow?: boolean;

    /*
        Ako je korisnik pokušao otvoriti DRUGU sobu
        dok već ima aktivnu partiju, caller po želji
        može ponuditi povratak u ovu sobu.
    */
    activeRoomId?: string;
}> {
    const user =
        await getCurrentUserWithProfile();

    const userId =
        user?.user?.id;

    if (!userId) {
        return {
            error: "Niste ulogovani.",
        };
    }

    /*
        Smije već biti u OVOM roomu,
        ali ne smije biti u nekom drugom.
    */
    const accessCheck =
        await checkGameRoomAccess(
            userId,
            roomId,
        );

    if (!accessCheck.hasAccess) {
        return {
            error:
                accessCheck.error ??
                "Već ste u drugoj aktivnoj partiji.",

            activeRoomId:
                accessCheck.existingRoomId,
        };
    }

    const supabase =
        await createServerSupabaseClient();

    const {
        data: room,
        error: fetchError,
    } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("id", roomId)
        .single();

    if (
        fetchError ||
        !room
    ) {
        return {
            error:
                "Soba ne postoji.",
        };
    }

    // =========================
    // VEĆ JE BLUE
    // =========================

    if (
        room.player_blue_id ===
        userId
    ) {
        return {
            success: true,
            role: "blue",
            joinedNow: false,
        };
    }

    // =========================
    // VEĆ JE RED
    // =========================

    if (
        room.player_red_id ===
        userId
    ) {
        if (
            room.status ===
            "waiting"
        ) {
            const {
                data: startedRoom,
                error: startError,
            } = await supabase
                .from("game_rooms")
                .update({
                    status:
                        "in_progress",
                })
                .eq("id", roomId)
                .eq(
                    "status",
                    "waiting",
                )
                .select("id, status")
                .maybeSingle();

            if (startError) {
                return {
                    error:
                        "Greška pri pokretanju partije.",
                };
            }

            /*
                Friend invite: RED je već unaprijed player_red_id, ali je
                ovo njegov prvi stvarni ulazak jer je baš ovaj poziv prebacio
                waiting -> in_progress.
            */
            /*
                Čak i ako startedRoom bude null zbog paralelnog duplog
                init poziva koji je milisekundu ranije već prebacio isti
                room u in_progress, ovaj caller je ušao iz WAITING stanja.
                Zato je ovo i dalje fresh join, ne reconnect.
            */
            return {
                success: true,
                role: "red",
                joinedNow: true,
            };
        }

        return {
            success: true,
            role: "red",
            joinedNow: false,
        };
    }

    // =========================
    // PRAZAN RED SLOT
    // =========================

    if (
        room.player_red_id ===
        null
    ) {
        if (
            room.status !==
            "waiting"
        ) {
            return {
                error:
                    "U ovu sobu se više ne može ući.",
            };
        }

        /*
            Atomic claim:
            samo jedan RED može zauzeti waiting room.
        */
        const {
            data: updatedRoom,
            error: updateError,
        } = await supabase
            .from("game_rooms")
            .update({
                player_red_id:
                    userId,

                status:
                    "in_progress",
            })
            .eq("id", roomId)
            .eq(
                "status",
                "waiting",
            )
            .is(
                "player_red_id",
                null,
            )
            .select(
                "id, player_red_id, status",
            )
            .maybeSingle();

        if (updateError) {
            return {
                error:
                    updateError.message,
            };
        }

        if (!updatedRoom) {
            /*
                Dev Strict Mode / dupli navigation init može poslati dva
                join poziva skoro istovremeno. Ako je drugi poziv izgubio
                atomic UPDATE zato što je PRVI POZIV ISTOG usera već zauzeo
                RED slot, to nije greška niti reconnect.
            */
            const { data: claimedByParallelCall } =
                await supabase
                    .from("game_rooms")
                    .select("player_red_id, status")
                    .eq("id", roomId)
                    .maybeSingle();

            if (
                claimedByParallelCall?.player_red_id === userId &&
                claimedByParallelCall?.status === "in_progress"
            ) {
                return {
                    success: true,
                    role: "red",
                    joinedNow: true,
                };
            }

            return {
                error:
                    "Nisam uspio da zauzmem sobu.",
            };
        }

        return {
            success: true,
            role: "red",
            joinedNow: true,
        };
    }

    return {
        error:
            "Nemate pristup ovoj sobi.",
    };
}

/*
    START GAME / MATCHMAKING

    1. Prvo provjeri ima li user VEĆ waiting/in_progress partiju.
       Ako ima, NE šaljemo ga automatski u nju iz UI-a — vraćamo
       kind: "active_game" + roomId da ErrorPopup može ponuditi
       "Vrati se u partiju".

    2. Ako nema aktivnu partiju, tražimo običan public waiting room.

    VAŽNO:
    Ovdje NE claimamo RED slot. Samo vraćamo candidate room.
    Pravi atomic claim ostaje u joinGameRoom() kada /igra/[roomId]
    učita stranicu.

    joinGameRoom() sada sam vraća joinedNow=true kada ovaj poziv
    stvarno pokrene RED ulazak. Zato entryKind više ne zavisi od
    preflight SELECT-a, RLS-a ili React/Server Action race-a.
*/
export async function joinGameRoomOnStart():
    Promise<JoinGameRoomOnStartResult> {
    const user =
        await getCurrentUserWithProfile();

    const userId =
        user?.user?.id;

    if (!userId) {
        return {
            kind: "error",
            roomId: null,
            error:
                "Niste ulogovani.",
        };
    }

    /*
        Prvo canonical provjera aktivne partije.
    */
    const accessCheck =
        await checkGameRoomAccess(
            userId,
        );

    if (!accessCheck.hasAccess) {
        if (
            accessCheck.existingRoomId
        ) {
            return {
                kind: "active_game",
                roomId:
                    accessCheck.existingRoomId,
            };
        }

        return {
            kind: "error",
            roomId: null,
            error:
                accessCheck.error ??
                "Greška pri proveri aktivne partije.",
        };
    }

    const supabase =
        await createServerSupabaseClient();

    const {
        data: room,
        error: fetchError,
    } = await supabase
        .from("game_rooms")
        .select("id")
        .eq(
            "status",
            "waiting",
        )
        .is(
            "player_red_id",
            null,
        )
        .neq(
            "player_blue_id",
            userId,
        )
        /*
            Najstariji waiting room prvi.
            Fairer queue od proizvoljnog reda.
        */
        .order(
            "created_at",
            {
                ascending: true,
            },
        )
        .limit(1)
        .maybeSingle();

    if (fetchError) {
        console.error(
            "Matchmaking room search:",
            fetchError.message,
        );

        return {
            kind: "error",
            roomId: null,
            error:
                "Greška pri traženju partije.",
        };
    }

    if (!room) {
        return {
            kind: "none",
            roomId: null,
        };
    }

    return {
        kind: "match_found",
        roomId: room.id,
    };
}

// Funkcija za odbijanje poziva (Briše sobu)
export async function rejectGameInvite(
    roomId: string,
) {
    const supabase =
        await createServerSupabaseClient();

    const { error } =
        await supabase
            .from("game_rooms")
            .delete()
            .eq("id", roomId);

    if (error) {
        return {
            error:
                "Greška pri odbijanju poziva.",
        };
    }

    return {
        success: true,
    };
}
