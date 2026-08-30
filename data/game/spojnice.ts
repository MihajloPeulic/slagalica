"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function getSpojniceRounds() {
    try {
        const supabase = await createServerSupabaseClient();

        // Pozivamo optimizovanu Postgres funkciju koja vraća 2 random reda
        const { data, error } = await supabase.rpc("get_random_spojnice");

        if (error) {
            console.error("Greška pri dohvatanju spojnica:", error.message);
            return { success: null, error: error.message };
        }

        // Provera da li imamo bar 2 igre u bazi
        if (!data || data.length < 2) {
            return { success: null, error: "Nema dovoljno igara u bazi (potrebne su bar 2)." };
        }

        // Pakujemo podatke za klijent
        const round1 = {
            tema: data[0].tema,
            verzija: data[0].verzija,
            pairs: data[0].parovi,
        };

        const round2 = {
            tema: data[1].tema,
            verzija: data[1].verzija,
            pairs: data[1].parovi,
        };

        return { 
            success: { round1, round2 }, 
            error: null 
        };
    } catch (err) {
        console.error("Serverska greška:", err);
        return { success: null, error: "Došlo je do neočekivane greške." };
    }
}