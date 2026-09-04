"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getCurrentUserWithProfile } from "@/data/auth";
import { generateFullGameState } from "@/utils/games/rec";
import { GetFriendship } from "./friends";

// Funkcija kada igrač A izazove prijatelja / napravi sobu
export async function createGameRoom(friendId?: string) {
    const supabase = await createServerSupabaseClient();
    const user = await getCurrentUserWithProfile();
    const userId = user?.user?.id;

    if (!userId) return { error: "Niste ulogovani." };

    const initialGameState = await generateFullGameState();
    
    // Pravimo sobu: ti si PLAVI, a prijatelj je automatski CRVENI (ali status je 'waiting')
    const { data, error } = await supabase
        .from("game_rooms")
        .insert({
            player_blue_id: userId,
            blue_name: user.profile.username,
            player_red_id: friendId ? friendId : null,
            status: "waiting",
            game_state: initialGameState,
            current_game_index: 0,
            current_round: 1,
            score_blue: 0,
            score_red: 0
        })
        .select()
        .single();

    if (error) return { error: "Greška pri kreiranju sobe." };

    return { roomId: data.id };
}

// Funkcija kada igrač B prihvati poziv i uđe u sobu kao CRVENI
export async function joinGameRoom(roomId: string): Promise<{ 
    error?: string; 
    success?: boolean; 
    role?: "blue" | "red"; 
}> {
    const supabase = await createServerSupabaseClient();
    const user = await getCurrentUserWithProfile();
    const userId = user?.user?.id;

    if (!userId) return { error: "Niste ulogovani." };

    const { data: room, error: fetchError } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("id", roomId)
        .single();

    if (fetchError || !room) return { error: "Soba ne postoji." };

    if (room.player_blue_id === userId) return { success: true, role: "blue" };

    if (room.player_red_id === userId) {
        // Ako je bio u statusu waiting, sada prebacujemo u in_progress
        if (room.status === "waiting") {
            await supabase.from("game_rooms").update({ status: "in_progress" }).eq("id", roomId);
        }
        return { success: true, role: "red" };
    }

    if (room.player_red_id === null) {
        if (room.status === "waiting") {
            const { data: updatedRoom, error: updateError } = await supabase
                .from("game_rooms")
                .update({
                    player_red_id: userId,
                    status: "in_progress",
                })
                .eq("id", roomId)
                .is("player_red_id", null)
                .select("id, player_red_id, status")
                .maybeSingle();

            if (updateError) return { error: updateError.message };
            if (!updatedRoom) return { error: "Nisam uspio da zauzmem sobu." };
        }
        return { success: true, role: "red" };
    }

    return { error: "Nemate pristup ovoj sobi." };
}

export async function joinGameRoomOnStart() {
    const supabase = await createServerSupabaseClient();
    const user = await getCurrentUserWithProfile();
    const userId = user?.user?.id;

    const { data: room, error: fetchError } = await supabase
        .from("game_rooms")
        .select("id")
        .is("player_red_id", null)
        .neq("player_blue_id", userId)
        .limit(1)
        .maybeSingle();

    if (fetchError || !room) {
        if (fetchError) console.error(fetchError.message);
        return { roomId: null };
    }

    return { roomId: room.id };
}

// Funkcija za odbijanje poziva (Briše sobu)
export async function rejectGameInvite(roomId: string) {
    const supabase = await createServerSupabaseClient();
    
    const { error } = await supabase.from("game_rooms").delete().eq("id", roomId);

    if (error) return { error: "Greška pri odbijanju poziva." };

    return { success: true };
}

export async function finishGameAndUpdateFriendStats(roomId: string, blueScore: number, redScore: number) {
    const supabase = await createServerSupabaseClient();

    // 1. UČITAJ ROOM
    const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("id, player_blue_id, player_red_id, status")
        .eq("id", roomId)
        .single();

    if (roomError || !room) return { error: roomError?.message ?? "Soba nije pronađena." };
    if (!room.player_blue_id || !room.player_red_id) return { error: "Soba nema oba igrača." };
    
    // Ako je već finished, ne apdejtuj statistiku dvaput
    if (room.status === "finished") return { success: true };

    const blueId = room.player_blue_id;
    const redId = room.player_red_id;

    // 2. PRONAĐI FRIENDSHIP
    const friendshipResult = await GetFriendship(redId, blueId);

    // Ako nisu prijatelji, samo završi sobu
    if (!friendshipResult.isFriend) {
        const { error } = await supabase.from("game_rooms").update({ status: "finished" }).eq("id", roomId);
        return error ? { error: error.message } : { success: true };
    }

    const friendship = friendshipResult.friendship;
    const blueIsSender = friendship.sender_id === blueId;
    const redIsSender = friendship.sender_id === redId;

    if (!blueIsSender && !redIsSender) return { error: "Friendship podaci nisu validni." };

    // 3. REZULTAT
    let updateData: { sender_wins?: number; receiver_wins?: number; draw_games?: number } = {};
    let winner = "";

    if (blueScore === redScore) {
        updateData = { draw_games: Number(friendship.draw_games ?? 0) + 1 };
    } else if (blueScore > redScore) {
        updateData = blueIsSender 
            ? { sender_wins: Number(friendship.sender_wins ?? 0) + 1 }
            : { receiver_wins: Number(friendship.receiver_wins ?? 0) + 1 };
        winner = "blue";
    } else {
        updateData = redIsSender 
            ? { sender_wins: Number(friendship.sender_wins ?? 0) + 1 }
            : { receiver_wins: Number(friendship.receiver_wins ?? 0) + 1 };
        winner = "red";
    }

    // 4. UPDATE FRIENDSHIP
    const { error: friendUpdateError } = await supabase
        .from("friends")
        .update(updateData)
        .eq("id", friendship.id);

    if (friendUpdateError) return { error: friendUpdateError.message };

    // 5. STAVI ROOM NA FINISHED
    const { error: finishError } = await supabase
        .from("game_rooms")
        .update({ status: "finished" })
        .eq("id", roomId);

    if (finishError) return { error: finishError.message };

    // 6. UPDATE PROFILA
    const updateProfileStats = async (profileId: string, result: "wins" | "losses" | "draws") => {
        const { error } = await supabase.rpc("increment_profile_result", {
            p_profile_id: profileId,
            p_result: result,
        });
        if (error) throw new Error(error.message);
    };

    if (winner === "blue") {
        await updateProfileStats(blueId, "wins");
        await updateProfileStats(redId, "losses");
    } else if (winner === "red") {
        await updateProfileStats(blueId, "losses");
        await updateProfileStats(redId, "wins");
    } else {
        await updateProfileStats(blueId, "draws");
        await updateProfileStats(redId, "draws");
    }

    return { success: true };
}