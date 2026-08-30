"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function getKoZnaZnaQuestions() {
    try {
        const supabase = await createServerSupabaseClient();

        // Pozivamo optimizovanu Postgres funkciju koja vraća 10 random redova
        const { data, error } = await supabase.rpc("get_random_ko_zna_zna_questions");

        if (error) {
            console.error("Greška pri dohvatanju pitanja:", error.message);
            return { success: [], error: error.message };
        }

        if (!data || data.length === 0) {
            return { success: [], error: "Nema pitanja u bazi." };
        }

        // Mapiramo podatke da odgovaraju strukturi na frontendu
        const formattedQuestions = data.map((q: any) => ({
            id: q.id,
            question: q.pitanje,
            options: q.opcije,
            correctIndex: q.tacna_opcija,
        }));

        return { success: formattedQuestions, error: null };
    } catch (err) {
        console.error("Serverska greška:", err);
        return { success: [], error: "Došlo je do neočekivane greške." };
    }
}