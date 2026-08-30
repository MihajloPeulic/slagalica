"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Swords, Check, X } from "lucide-react";
import { createClientSupabaseClient } from "@/utils/supabase/client";
import { rejectGameInvite } from "@/actions/game";

const supabase = createClientSupabaseClient();

export default function GameInviteListener({ currentUserId }: { currentUserId: string }) {
    const router = useRouter();
    const [incomingInvite, setIncomingInvite] = useState<{ roomId: string } | null>(null);

    useEffect(() => {
        if (!currentUserId) return;

        // Slušamo da li je neko kreirao sobu gde je trenutni korisnik player_red_id
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
                (payload) => {
                    const newRoom = payload.new as any;
                    if (newRoom.status === "waiting") {
                        setIncomingInvite({ roomId: newRoom.id });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);

    if (!incomingInvite) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-surface border border-primary/40 p-6 rounded-3xl max-w-sm w-full flex flex-col items-center text-center shadow-[0_0_50px_rgba(245,158,11,0.2)]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 mb-4 animate-bounce">
                    <Swords className="h-7 w-7" />
                </div>
                
                <h3 className="text-xl font-black text-text mb-1">Izazov na duelu!</h3>
                <p className="text-xs text-text-secondary mb-6">Prijatelj te pozvao da odigrate meč Slagalice.</p>

                <div className="flex items-center gap-3 w-full">
                    {/* ODBIJ DUGME */}
                    <button
                        onClick={async () => {
                            await rejectGameInvite(incomingInvite.roomId);
                            setIncomingInvite(null);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-surface-light border border-border py-3 rounded-2xl text-xs font-bold text-text-secondary hover:text-text transition-all"
                    >
                        <X className="h-4 w-4" />
                        Odbij
                    </button>

                    {/* PRIHVATI DUGME */}
                    <button
                        onClick={() => {
                            router.push(`/igra/${incomingInvite.roomId}`);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary py-3 rounded-2xl text-xs font-bold text-black shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <Check className="h-4 w-4 stroke-[3]" />
                        Prihvati
                    </button>
                </div>
            </div>
        </div>
    );
}