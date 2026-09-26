import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { friendsTag } from "@/lib/cache/tags";
import { createAdminClient } from "@/utils/supabase/admin";

export async function getCachedFriends(userId: string) {
  "use cache";
  // Mutations expire this user's tag; ten years is only a fallback lifetime.
  cacheLife({ stale: 300, revalidate: 315360000 });
  cacheTag(friendsTag(userId));

  const { data, error } = await createAdminClient()
    .from("friends")
    .select(`
      id,
      sender_id,
      receiver_id,
      status,
      sender:profiles!friends_sender_id_fkey ( id, username, experience ),
      receiver:profiles!friends_receiver_id_fkey ( id, username, experience )
    `)
    .eq("status", "accepted")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
    const receiver = Array.isArray(row.receiver) ? row.receiver[0] : row.receiver;
    return row.sender_id === userId ? receiver : sender;
  });
}
 