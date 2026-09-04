"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function verifyWordAction(word: string) {
    const normalizedWord = word?.trim().toUpperCase();

    if (!normalizedWord) {
        return {
            success: false as const,
            points: 0,
            message: "Reč je prazna.",
        };
    }

    try {
        const supabase =
            await createServerSupabaseClient();

        const { data, error } = await supabase
            .from("slagalica_recnik")
            .select("rec")
            .eq("rec", normalizedWord)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return {
                success: false as const,
                points: 0,
                message: `Reč "${word}" ne postoji u bazi ili nije validna!`,
            };
        }
        
        const letters =
            normalizedWord.match(/DŽ|NJ|LJ|./gu) ?? [];

        return {
            success: true as const,
            points: letters.length,
        };
    } catch (err) {
        console.error(
            "Greška pri proveri reči:",
            err
        );

        return {
            success: false as const,
            points: 0,
            message:
                "Došlo je do greške prilikom provere reči.",
        };
    }
}
