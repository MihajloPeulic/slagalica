import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { leaderboardTag } from "@/lib/cache/tags";
import type { LeaderboardSort } from "@/data/leaderboard";
import { createAdminClient } from "@/utils/supabase/admin";

function tagLeaderboard() {
  // Profile mutations expire the tag; ten years is only a fallback lifetime.
  cacheLife({ stale: 300, revalidate: 315360000 });
  cacheTag(leaderboardTag);
}

export async function getCachedLeaderboardByXp() {
  "use cache";
  tagLeaderboard();

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, username, experience")
    .order("experience", { ascending: false })
    .limit(10);

  if (error) throw error;
  return data ?? [];
}

export async function getCachedLeaderboardHundred(sortBy: LeaderboardSort) {
  "use cache";
  tagLeaderboard();

  let query = createAdminClient()
    .from("profiles")
    .select("id, username, experience, level, highest_streak, wins")
    .order(sortBy, { ascending: false });

  if (sortBy !== "experience") {
    query = query.order("experience", { ascending: false });
  }

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data ?? [];
}
