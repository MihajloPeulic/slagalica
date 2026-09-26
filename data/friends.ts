"use server"

import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getCurrentUserWithProfile } from "./auth";
import { getCachedFriends } from "@/lib/cache/friends";

export type FriendRequest = {
    id: number;
    sender_id: string;
    status: string;
    created_at: string;
    sender: {
        username: string;
        experience: number;
    };
};

export async function getFriendRequests() {
    try {
        const supabase = await createServerSupabaseClient();
        const userData = await getCurrentUserWithProfile();
        const currentUserID = userData?.user?.id;

        if (!currentUserID) {
            return [];
        }


        const { data, error } = await supabase
            .from("friends")
            .select(`
                id,
                sender_id,
                status,
                created_at,
                sender:profiles!sender_id ( username, experience )
            `)
            .eq("receiver_id", currentUserID)
            .eq("status", "pending")
            .order("created_at", { ascending: false });


        if (error) {
            console.error("Greška pri dohvatanju friend requestova:", error.message);
            return [];
        }

        // RJEŠENJE: Ručno mapiramo podatke i garantujemo TypeScript-u ispravan oblik
        const formattedRequests = (data || []).map((req: any) => ({
            id: req.id,
            sender_id: req.sender_id,
            status: req.status,
            created_at: req.created_at,
            // Ako Supabase vrati niz, uzimamo prvi element, inače uzimamo sam objekat
            sender: Array.isArray(req.sender) ? req.sender[0] : req.sender
        }));

        return formattedRequests;
        
    } catch (err) {
        console.error("Neočekivana greška:", err);
        return [];
    }
}


export async function getFriends() {
    try {
        // Authenticate before using the shared server cache keyed by user ID.
        const userData = await getCurrentUserWithProfile();
        const currentUserID = userData?.user?.id;

        if (!currentUserID) {
            return [];
        }

        return await getCachedFriends(currentUserID);
    } catch (err) {
        console.error("Neočekivana greška:", err);
        return [];
    }
}
