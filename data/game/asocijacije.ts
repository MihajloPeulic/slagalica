"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function getAsocijacijeRounds() {
    try {
        const supabase = await createServerSupabaseClient();

        // Pozivamo Postgres funkciju koja vraća 2 random reda
        const { data, error } = await supabase.rpc("get_random_asocijacije");

        if (error) {
            console.error("Greška pri dohvatanju asocijacija:", error.message);
            return { success: null, error: error.message };
        }

        if (!data || data.length < 2) {
            return { success: null, error: "Nema dovoljno igara asocijacija u bazi (potrebne su bar 2)." };
        }

        // Funkcija koja formatira jedan red iz baze u format koji frontend očekuje
        const formatRound = (row: any) => {
            const kolone = row.kolone; // Sadrži objekte za A, B, C, D
            
            return {
                verzija: row.verzija,
                // Kolona A
                A1: kolone.A.fields[0],
                A2: kolone.A.fields[1],
                A3: kolone.A.fields[2],
                A4: kolone.A.fields[3],
                A_SOL: kolone.A.sol,
                
                // Kolona B
                B1: kolone.B.fields[0],
                B2: kolone.B.fields[1],
                B3: kolone.B.fields[2],
                B4: kolone.B.fields[3],
                B_SOL: kolone.B.sol,
                
                // Kolona C
                C1: kolone.C.fields[0],
                C2: kolone.C.fields[1],
                C3: kolone.C.fields[2],
                C4: kolone.C.fields[3],
                C_SOL: kolone.C.sol,
                
                // Kolona D
                D1: kolone.D.fields[0],
                D2: kolone.D.fields[1],
                D3: kolone.D.fields[2],
                D4: kolone.D.fields[3],
                D_SOL: kolone.D.sol,
                
                // Konačno rešenje
                FINAL: row.konacno
            };
        };

        const round1 = formatRound(data[0]);
        const round2 = formatRound(data[1]);

        return { 
            success: { round1, round2 }, 
            error: null 
        };
    } catch (err) {
        console.error("Serverska greška:", err);
        return { success: null, error: "Došlo je do neočekivane greške." };
    }
}