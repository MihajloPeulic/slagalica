"use server"

import { getCurrentUserWithProfile } from "@/data/auth"
import { createServerSupabaseClient } from "@/utils/supabase/server"
import type { Database } from "@/types/supabase";

type Friend =
    Database["public"]["Tables"]["friends"]["Row"];


export async function AddAFriend(username: string) {
    try {
        const supabase = await createServerSupabaseClient();

        // 1. Dobavljamo trenutnog korisnika (onog koji šalje zahtev)
        const currentUserData = await getCurrentUserWithProfile();
        const currentUserId = currentUserData?.user?.id;

        if (!currentUserId) {
            return { error: "Morate biti ulogovani da biste dodali prijatelja." };
        }

        // 2. Tražimo ID korisnika kojeg želimo da dodamo
        const { data: targetUser, error: fetchError } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", username)
            .single();

        if (fetchError || !targetUser) {
            return { error: "Ovaj username ne postoji." };
        }

        // 3. Provera da li dodaje samog sebe
        if (targetUser.id === currentUserId) {
            return { error: "Ne možete poslati zahtev samom sebi." };
        }

        // 4. PROVERA DA LI VEĆ POSTOJI ZAPIS (U bilo kom smeru)
        // Koristimo .maybeSingle() jer se neće srušiti ako ne nađe nijedan red
        const { data: existingRequest, error: checkError } = await supabase
            .from("friends")
            .select("*")
            .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${currentUserId})`)
            .maybeSingle();

        if (checkError) {
            console.error("Greška pri proveri postojećeg zahteva:", checkError.message);
            return { error: "Došlo je do greške pri proveri. Pokušajte ponovo." };
        }

        // 5. LOGIKA NA OSNOVU POSTOJEĆEG ZAPISA
        if (existingRequest) {
            // SLUČAJ A: Zahtev je već prihvaćen ili je na čekanju
            if (existingRequest.status === 'pending' || existingRequest.status === 'accepted') {
                return { error: "Već ste prijatelji ili je zahtev već poslat." };
            }

            // SLUČAJ B: Zahtev je bio odbijen. Radimo UPDATE umesto INSERT-a.
            // Proveravamo za "declined" ili "rejected" (zavisi kako si nazvao status u bazi)
            if (existingRequest.status === 'declined' || existingRequest.status === 'rejected') {
                const { error: updateError } = await supabase
                    .from("friends")
                    .update({ 
                        status: 'pending',
                        sender_id: currentUserId, // Trenutni korisnik postaje onaj koji šalje
                        receiver_id: targetUser.id
                    })
                    .eq("id", existingRequest.id);

                if (updateError) {
                    console.error("Greška pri ponovnom slanju zahteva:", updateError.message);
                    return { error: "Došlo je do greške. Pokušajte ponovo." };
                }

                return { success: "Zahtev je uspešno poslat!" };
            }
        }

        // 6. SLUČAJ C: Zapis ne postoji, radimo novi INSERT
        const { error: requestError } = await supabase
            .from("friends")
            .insert({
                sender_id: currentUserId,
                receiver_id: targetUser.id,
                status: 'pending' // Eksplicitno postavljamo na pending
            });

        if (requestError) {
            console.error("Greška pri slanju novog zahteva:", requestError.message);
            return { error: "Došlo je do greške. Pokušajte ponovo." };
        }

        return { success: "Zahtev je uspešno poslat!" };

    } catch (err) {
        console.error("Neočekivana greška u AddAFriend:", err);
        return { error: "Došlo je do neočekivane greške na serveru." };
    }
}


export async function AcceptFriendRequest(reqId: number) {

    const supabase = await createServerSupabaseClient()

    const {data, error} = await supabase
        .from("friends")
        .update({ status: 'accepted' })
        .eq("id", reqId)
        
    if(error){
        console.error(data)
    }

    return {success: true}
}

export async function RejectFriendRequest(reqId: number) {

    const supabase = await createServerSupabaseClient()

    const {data, error} = await supabase
        .from("friends")
        .update({ status: 'rejected' })
        .eq("id", reqId)
        
    if(error){
        console.error(data)
    }

    return {success: true}
}



export async function GetFriendshipAndFriend(friendId: string, myId: string) {

    const supabase = await createServerSupabaseClient()

     const {
        data: friend,
        error: friendError,
    } = await supabase
        .from("profiles")
        .select(`
            id,
            username,
            experience,
            level,
            avatar_url
        `)
        .eq("id", friendId)
        .maybeSingle();

    if (
        friendError ||
        !friend
    ) {
       throw new Error(friendError?.message)
    }

    const {
        data: friendship,
        error: friendshipError,
    } = await supabase
        .rpc("get_friendship_between_users", {
            p_user_id: myId,
            p_friend_id: friendId,
        })
        .maybeSingle();

    if(friendshipError || !friendship){
        throw new Error(friendshipError?.message)
    }
    

    return {friendship: friendship as Friend, friend: friend}
}


export async function GetFriendship(
    friendId: string,
    myId: string
) {
    const supabase =
        await createServerSupabaseClient();

    const {
        data: friendship,
        error: friendshipError,
    } = await supabase
        .rpc(
            "get_friendship_between_users",
            {
                p_user_id: myId,
                p_friend_id: friendId,
            }
        )
        .maybeSingle();

    if (friendshipError) {
        throw new Error(
            friendshipError.message
        );
    }

    if (!friendship) {
        return {
            isFriend: false as const,
            friendship: null,
        };
    }

    return {
        isFriend: true as const,
        friendship: friendship as Friend,
    };
}