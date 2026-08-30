"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getCurrentUserWithProfile } from "@/data/auth";
import {generateFullGameState} from "@/utils/games/rec"

// Funkcija kada igrač A izazove prijatelja / napravi sobu
export async function createGameRoom(friendId: string) {
    const supabase = await createServerSupabaseClient();
    const user = await getCurrentUserWithProfile();
    const userId = user?.user?.id;

    if (!userId) return { error: "Niste ulogovani." };

    const initialGameState = await generateFullGameState()
    // Pravimo sobu: ti si PLAVI, a prijatelj je automatski CRVENI (ali status je 'waiting')
    const { data, error } = await supabase
        .from("game_rooms")
        .insert({
            player_blue_id: userId,
            player_red_id: friendId, // Unosimo odmah ID prijatelja da bi znao da je on pozvan
            status: "waiting",
            game_state: initialGameState,
            current_game_index: 0,
            current_round: 1,
            score_blue: 0,
            score_red: 0
        })
        .select()
        .single();

    if (error) {
        return { error: "Greška pri kreiranju sobe." };
    }

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

    if (fetchError || !room) {
        return { error: "Soba ne postoji." };
    }

    if (room.player_blue_id === userId) {
        return { success: true, role: "blue" };
    }

    if (room.player_red_id === userId) {
        // Ako je bio u statusu waiting, sada prebacujemo u in_progress jer je prihvatio!
        if (room.status === "waiting") {
            await supabase
                .from("game_rooms")
                .update({ status: "in_progress" })
                .eq("id", roomId);
        }
        return { success: true, role: "red" };
    }

    return { error: "Nemate pristup ovoj sobi." };
}

// Funkcija za odbijanje poziva (Briše sobu ili je postavlja na cancelled)
export async function rejectGameInvite(roomId: string) {
    const supabase = await createServerSupabaseClient();
    
    const { error } = await supabase
        .from("game_rooms")
        .delete()
        .eq("id", roomId);

    if (error) {
        return { error: "Greška pri odbijanju poziva." };
    }

    return { success: true };
}