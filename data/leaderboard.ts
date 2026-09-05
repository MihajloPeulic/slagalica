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


export type LeaderboardSort =
  | "experience"
  | "highest_streak"
  | "wins";

export async function getLeaderboardHundred(
  sortBy: LeaderboardSort = "experience"
) {
  try {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("profiles")
      .select(`
        id,
        username,
        experience,
        level,
        highest_streak,
        wins
      `)
      .order(sortBy, {
        ascending: false,
      });

    // Ako dva igrača imaju isti streak/wins,
    // veći XP odlučuje ko je iznad.
    if (sortBy !== "experience") {
      query = query.order("experience", {
        ascending: false,
      });
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error(
        "Greška pri dohvatanju leaderboarda:",
        error.message
      );

      return [];
    }

    return data ?? [];
  } catch (error) {
    console.error(
      "Neočekivana greška pri dohvatanju leaderboarda:",
      error
    );

    return [];
  }
}