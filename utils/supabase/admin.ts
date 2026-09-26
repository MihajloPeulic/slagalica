import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  // Only call this from server-only data functions with an authenticated user
  // ID or a deliberately public projection such as the leaderboard.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
