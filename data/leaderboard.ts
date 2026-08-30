"use server"

import { createServerSupabaseClient } from "@/utils/supabase/server";


export async function getLeaderboardByXp() {
    try {
        const supabase = await createServerSupabaseClient();

        const { data, error } = await supabase
            .from("profiles")
            .select(`
                id,
                username,
                experience
            `)
            .order("experience", {ascending: false})
            .limit(10)


        if (error) {
            console.error("Greška pri dohvatanju leaderboarda: " + error.message);
            return [];
        }

        if (!data) {
            console.error("Nema nikoga na leaderboardu.");
            return [];
        }

        return data;
        
    } catch (err) {
        console.error("Neočekivana greška:", err);
        return [];
    }
}