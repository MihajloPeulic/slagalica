"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function verifyWordAction(word: string) {
    if (!word || word.trim().length === 0) {
        return { success: false, message: "Reč je prazna." };
    }

    try {
        const supabase = await createServerSupabaseClient();

        // Pretraga u Supabase tabeli 'slagalica_recnik'
        const { data, error } = await supabase
            .from("slagalica_recnik")
            .select("rec")
            .eq("rec", word.toUpperCase())
            .single();

        if (error || !data) {
            return { success: false, message: `Reč "${word}" ne postoji u bazi ili nije validna!` };
        }

        const points = word.length;
        return { success: true };
    } catch (err) {
        console.error("Greška pri proveri reči:", err);
        return { success: false, message: "Došlo je do greške prilikom provere reči." };
    }
}