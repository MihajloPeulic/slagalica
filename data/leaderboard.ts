"use server";

import {
  getCachedLeaderboardByXp,
  getCachedLeaderboardHundred,
} from "@/lib/cache/leaderboard";

export type LeaderboardSort =
  | "experience"
  | "highest_streak"
  | "wins";

export async function getLeaderboardByXp() {
  try {
    return await getCachedLeaderboardByXp();
  } catch (error) {
    console.error("Greška pri dohvatanju leaderboarda:", error);
    return [];
  }
}

export async function getLeaderboardHundred(
  sortBy: LeaderboardSort = "experience"
) {
  try {
    return await getCachedLeaderboardHundred(sortBy);
  } catch (error) {
    console.error("Greška pri dohvatanju leaderboarda:", error);
    return [];
  }
}
