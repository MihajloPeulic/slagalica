"use server"

import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getCurrentUserWithProfile } from "./auth";

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
            receiver_id,
            status,
            sender:profiles!friends_sender_id_fkey ( id, username, experience ),
            receiver:profiles!friends_receiver_id_fkey ( id, username, experience )
        `)
        .eq("status", "accepted")
        .or(`sender_id.eq.${currentUserID},receiver_id.eq.${currentUserID}`);

        if(error){
            console.error("Greška pri dohvatanju friend requestova:", error.message);
            return [];
        }

        const friends = (data || []).map((d: any) => {
            // Normalizujemo podatke (ako Supabase iz nekog razloga vrati niz, uzmemo prvi element, inače uzmemo objekat)
            const senderObj = Array.isArray(d.sender) ? d.sender[0] : d.sender;
            const receiverObj = Array.isArray(d.receiver) ? d.receiver[0] : d.receiver;
            

            // Ako je trenutni korisnik sender, vrati profil receiver-a. U suprotnom, vrati profil sender-a!
            return d.sender_id === currentUserID ? receiverObj : senderObj;
        });

        return friends


    } catch (err) {
        console.error("Neočekivana greška:", err);
        return [];
    }
}