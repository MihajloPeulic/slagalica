"use server";

import { getCurrentUserWithProfile } from "@/data/auth";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { rateLimits } from "@/lib/rate-limit";
import type { Database } from "@/types/supabase";

type Friend =
    Database["public"]["Tables"]["friends"]["Row"];

export async function AddAFriend(
    username: string
) {
    try {
        const normalizedUsername =
            username.trim();

        if (
            normalizedUsername.length < 3 ||
            normalizedUsername.length > 16
        ) {
            return {
                error: "Neispravan username.",
            };
        }

        const currentUserData =
            await getCurrentUserWithProfile();

        const currentUserId =
            currentUserData?.user?.id;

        if (!currentUserId) {
            return {
                error:
                    "Morate biti ulogovani da biste dodali prijatelja.",
            };
        }

        // =========================
        // RATE LIMIT
        // =========================

        const { success } =
            await rateLimits.friendRequest.limit(
                currentUserId
            );

        if (!success) {
            return {
                error:
                    "Poslali ste previše zahteva. Pokušajte ponovo kasnije.",
            };
        }

        const supabase =
            await createServerSupabaseClient();

        // =========================
        // TARGET USER
        // =========================

        const {
            data: targetUser,
            error: fetchError,
        } = await supabase
            .from("profiles")
            .select("id")
            .eq(
                "username",
                normalizedUsername
            )
            .maybeSingle();

        if (fetchError || !targetUser) {
            return {
                error:
                    "Ovaj username ne postoji.",
            };
        }

        if (
            targetUser.id === currentUserId
        ) {
            return {
                error:
                    "Ne možete poslati zahtev samom sebi.",
            };
        }

        // =========================
        // EXISTING FRIENDSHIP
        // =========================

        const {
            data: existingRequest,
            error: checkError,
        } = await supabase
            .from("friends")
            .select("*")
            .or(
                `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${currentUserId})`
            )
            .maybeSingle();

        if (checkError) {
            console.error(
                "Greška pri proveri postojećeg zahteva:",
                checkError.message
            );

            return {
                error:
                    "Došlo je do greške pri proveri. Pokušajte ponovo.",
            };
        }

        if (existingRequest) {
            if (
                existingRequest.status ===
                    "pending" ||
                existingRequest.status ===
                    "accepted"
            ) {
                return {
                    error:
                        "Već ste prijatelji ili je zahtev već poslat.",
                };
            }

            if (
                existingRequest.status ===
                    "declined" ||
                existingRequest.status ===
                    "rejected"
            ) {
                const { error: updateError } =
                    await supabase
                        .from("friends")
                        .update({
                            status: "pending",
                            sender_id:
                                currentUserId,
                            receiver_id:
                                targetUser.id,
                        })
                        .eq(
                            "id",
                            existingRequest.id
                        );

                if (updateError) {
                    console.error(
                        "Greška pri ponovnom slanju zahteva:",
                        updateError.message
                    );

                    return {
                        error:
                            "Došlo je do greške. Pokušajte ponovo.",
                    };
                }

                return {
                    success:
                        "Zahtev je uspešno poslat!",
                };
            }
        }

        // =========================
        // NEW REQUEST
        // =========================

        const { error: requestError } =
            await supabase
                .from("friends")
                .insert({
                    sender_id:
                        currentUserId,
                    receiver_id:
                        targetUser.id,
                    status: "pending",
                });

        if (requestError) {
            console.error(
                "Greška pri slanju novog zahteva:",
                requestError.message
            );

            return {
                error:
                    "Došlo je do greške. Pokušajte ponovo.",
            };
        }

        return {
            success:
                "Zahtev je uspešno poslat!",
        };
    } catch (err) {
        console.error(
            "Neočekivana greška u AddAFriend:",
            err
        );

        return {
            error:
                "Došlo je do neočekivane greške na serveru.",
        };
    }
}



export async function AcceptFriendRequest(
    reqId: number
) {
    const currentUserData =
        await getCurrentUserWithProfile();

    const currentUserId =
        currentUserData?.user?.id;

    if (!currentUserId) {
        return {
            error: "Niste ulogovani.",
        };
    }

    const { success } =
        await rateLimits.friendResponse.limit(
            currentUserId
        );

    if (!success) {
        return {
            error:
                "Previše pokušaja. Pokušajte ponovo kasnije.",
        };
    }

    const supabase =
        await createServerSupabaseClient();

    const {
        data,
        error,
    } = await supabase
        .from("friends")
        .update({
            status: "accepted",
        })
        .eq("id", reqId)
        .eq(
            "receiver_id",
            currentUserId
        )
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

    if (error) {
        console.error(
            "Accept friend request error:",
            error
        );

        return {
            error:
                "Došlo je do greške.",
        };
    }

    if (!data) {
        return {
            error:
                "Zahtev ne postoji ili nemate dozvolu.",
        };
    }

    return {
        success: true,
    };
}


export async function RejectFriendRequest(
    reqId: number
) {
    const currentUserData =
        await getCurrentUserWithProfile();

    const currentUserId =
        currentUserData?.user?.id;

    if (!currentUserId) {
        return {
            error: "Niste ulogovani.",
        };
    }

    const { success } =
        await rateLimits.friendResponse.limit(
            currentUserId
        );

    if (!success) {
        return {
            error:
                "Previše pokušaja. Pokušajte ponovo kasnije.",
        };
    }

    const supabase =
        await createServerSupabaseClient();

    const {
        data,
        error,
    } = await supabase
        .from("friends")
        .update({
            status: "rejected",
        })
        .eq("id", reqId)
        .eq(
            "receiver_id",
            currentUserId
        )
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

    if (error) {
        console.error(
            "Reject friend request error:",
            error
        );

        return {
            error:
                "Došlo je do greške.",
        };
    }

    if (!data) {
        return {
            error:
                "Zahtev ne postoji ili nemate dozvolu.",
        };
    }

    return {
        success: true,
    };
}




export async function GetFriendshipAndFriend(
    friendId: string
) {
    const currentUserData =
        await getCurrentUserWithProfile();

    const currentUserId =
        currentUserData?.user?.id;

    if (!currentUserId) {
        throw new Error("Niste ulogovani.");
    }

    const supabase =
        await createServerSupabaseClient();

    // =========================
    // FRIEND PROFILE
    // =========================

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

    if (friendError) {
        return {
            friendship: null,
            friend: null,
            error: "Niste prijatelji ili korisnik ne postoji.",
        };
    }

    if (!friend) {
        return {
            friendship: null,
            friend: null,
            error: "Niste prijatelji ili korisnik ne postoji.",
        };
            
    }   

    // =========================
    // FRIENDSHIP
    // =========================

    const {
        data: friendship,
        error: friendshipError,
    } = await supabase
        .rpc(
            "get_friendship_between_users",
            {
                p_user_id:
                    currentUserId,

                p_friend_id:
                    friendId,
            }
        )
        .maybeSingle();

    if (friendshipError) {
        return {
            friendship: null,
            friend,
            error: "Niste prijatelji ili korisnik ne postoji.",
        };
    }

    if (!friendship) {
        return {
            friendship: null,
            friend,
        };
    }

    return {
        friendship:
            friendship as Friend,

        friend,
    };
}




export async function GetFriendship(
    friendId: string
) {
    const currentUserData =
        await getCurrentUserWithProfile();

    const currentUserId =
        currentUserData?.user?.id;

    if (!currentUserId) {
        throw new Error(
            "Niste ulogovani."
        );
    }

    const supabase =
        await createServerSupabaseClient();

    const {
        data: friendship,
        error: friendshipError,
    } = await supabase
        .rpc(
            "get_friendship_between_users",
            {
                p_user_id:
                    currentUserId,

                p_friend_id:
                    friendId,
            }
        )
        .maybeSingle();

    if (friendshipError) {
        return {
            isFriend: false as const,
            friendship: null,
            error: friendshipError.message,
        };
    }

    if (!friendship) {
        return {
            isFriend: false as const,
            friendship: null,
        };
    }

    return {
        isFriend: true as const,
        friendship:
            friendship as Friend,
    };
}