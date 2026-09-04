"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Swords, Check, X } from "lucide-react";
import { createClientSupabaseClient } from "@/utils/supabase/client";
import { rejectGameInvite } from "@/actions/game";

const supabase = createClientSupabaseClient();

interface IncomingInvite {
    roomId: string;
    username: string;
}

export default function GameInviteListener({
    currentUserId
}: {
    currentUserId: string;
}) {
    const router = useRouter();

    const [incomingInvite, setIncomingInvite] =
        useState<IncomingInvite | null>(null);

    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`invites_${currentUserId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "game_rooms",
                    filter: `player_red_id=eq.${currentUserId}`,
                },
                async (payload) => {
                    const newRoom = payload.new as any;

                    if (newRoom.status !== "waiting") {
                        return;
                    }

                    

                    setIncomingInvite({
                        roomId: newRoom.id,
                        username: newRoom.blue_name
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);

    if (!incomingInvite) {
        return null;
    }

    return (
        <div
            className="
                fixed
                top-3
                left-1/2
                -translate-x-1/2
                z-[100]
                w-[calc(100%-24px)]
                max-w-[390px]
                animate-in
                slide-in-from-top-4
                fade-in
                duration-300
            "
        >
            <div
                className="
                    flex
                    items-center
                    justify-between
                    gap-3
                    rounded-2xl
                    border
                    border-border
                    bg-surface/95
                    backdrop-blur-xl
                    px-3.5
                    py-3
                    shadow-2xl
                "
            >
                {/* LIJEVA STRANA */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                        className="
                            flex
                            h-9
                            w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-primary/20
                            bg-primary/10
                            text-primary
                        "
                    >
                        <Swords className="h-4.5 w-4.5" />
                    </div>

                    <p className="min-w-0 text-xs leading-snug text-text">
                        <span className="font-black text-primary">
                            {incomingInvite.username}
                        </span>{" "}
                        vas izaziva na meč ⚔️
                    </p>
                </div>

                {/* DESNA STRANA */}
                <div className="flex shrink-0 items-center gap-1.5">
                    {/* ACCEPT */}
                    <button
                        onClick={() => {
                            router.push(
                                `/igra/${incomingInvite.roomId}`
                            );

                            setIncomingInvite(null);
                        }}
                        aria-label="Prihvati izazov"
                        className="
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-emerald-500/30
                            bg-emerald-500/10
                            text-emerald-400
                            transition-all
                            hover:bg-emerald-500/20
                            active:scale-90
                        "
                    >
                        <Check className="h-4 w-4 stroke-[3]" />
                    </button>

                    {/* REJECT */}
                    <button
                        onClick={async () => {
                            await rejectGameInvite(
                                incomingInvite.roomId
                            );

                            setIncomingInvite(null);
                        }}
                        aria-label="Odbij izazov"
                        className="
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-red-500/25
                            bg-red-500/10
                            text-red-400
                            transition-all
                            hover:bg-red-500/20
                            active:scale-90
                        "
                    >
                        <X className="h-4 w-4 stroke-[2.5]" />
                    </button>
                </div>
            </div>
        </div>
    );
}