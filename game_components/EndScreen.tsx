"use client";

import { useEffect, useState, useRef } from "react";
import { Trophy, Frown, Sparkles, LogOut, Loader2, ArrowRight } from "lucide-react";
import { createClientSupabaseClient } from "@/utils/supabase/client";

interface EndScreenProps {
    myRole: "blue" | "red";
    blueScore: number;
    redScore: number;
    blueName: string;
    redName: string;
    roomId: string;
    onLeave: () => void;
}

export function EndScreen({ myRole, blueScore, redScore, blueName, redName, roomId, onLeave }: EndScreenProps) {
    const supabase = createClientSupabaseClient();
    
    const [step, setStep] = useState(0); // Kontroliše animacije (0 do 4)
    const [xpChange, setXpChange] = useState<number | null>(null);
    const [updatingDB, setUpdatingDB] = useState(true);
    
    const xpUpdatedRef = useRef(false);

    const myScore = myRole === "blue" ? blueScore : redScore;
    const oppScore = myRole === "blue" ? redScore : blueScore;
    
    const isWinner = myScore > oppScore;
    const isTie = myScore === oppScore;
    const diff = Math.abs(myScore - oppScore);

    // ================= 1. TAJMERI ZA ANIMACIJE =================
    useEffect(() => {
        if (step < 4) {
            const timer = setTimeout(() => {
                setStep(prev => prev + 1);
            }, 1000); // Svaki element se pojavljuje nakon 1 sekunde
            return () => clearTimeout(timer);
        }
    }, [step]);

    // ================= 2. RACUNANJE I UPIS XP-A =================
    useEffect(() => {
        async function updateXpInDatabase() {
            if (xpUpdatedRef.current) return;
            xpUpdatedRef.current = true;

            // Računanje XP logike
            let gainedOrLost = 0;
            if (isWinner) {
                if (diff > 30) gainedOrLost = 50;
                else if (diff >= 15) gainedOrLost = 35;
                else gainedOrLost = 20;
            } else if (isTie) {
                gainedOrLost = 10; // Neka utešna nagrada za nerešeno
            } else {
                gainedOrLost = -30;
            }

            setXpChange(gainedOrLost);

            // Upis u bazu za trenutnog (lokalnog) korisnika
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("experience")
                    .eq("id", user.id)
                    .single();

                if (profile) {
                    const currentXp = profile.experience || 0;
                    const newXp = Math.max(0, currentXp + gainedOrLost); // Ne dozvoljava manje od 0

                    await supabase
                        .from("profiles")
                        .update({ experience: newXp })
                        .eq("id", user.id);
                }
            }
            setUpdatingDB(false);
        }

        updateXpInDatabase();
    }, [isWinner, isTie, diff, supabase]);

    // ================= 3. KRAJ PARTIJE =================
    const handleFinishAndLeave = async () => {
        // Plavi igrač (kao host) postavlja sobu na finished
        if (myRole === "blue") {
            await supabase
                .from("game_rooms")
                .update({ status: "finished" })
                .eq("id", roomId);
        }
        
        // Zovi funkciju iz roditelja koja prekida socket i radi redirect
        onLeave();
    };

    return (
        <div className="flex flex-col items-center w-full max-w-sm mx-auto gap-4 py-8">
            
            {/* STEP 1: NASLOV I IGRAČI */}
            {step >= 1 && (
                <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-8 duration-700 w-full">
                    <Trophy className={`h-16 w-16 mb-2 ${isWinner ? 'text-yellow-400' : 'text-text-secondary opacity-50'}`} />
                    <h1 className="text-3xl font-black uppercase text-center text-text mb-6">
                        {isWinner ? "Pobjeda!" : isTie ? "Nerešeno" : "Poraz"}
                    </h1>
                    
                    <div className="flex justify-between items-center w-full gap-4">
                        <div className="flex-1 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 text-center shadow-lg">
                            <span className="text-[10px] font-bold text-blue-400 uppercase block mb-1">Plavi</span>
                            <span className="text-sm font-black text-text truncate block">{blueName}</span>
                        </div>
                        <span className="text-sm font-black text-text-secondary">VS</span>
                        <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center shadow-lg">
                            <span className="text-[10px] font-bold text-red-400 uppercase block mb-1">Crveni</span>
                            <span className="text-sm font-black text-text truncate block">{redName}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: KONAČNI POENI */}
            {step >= 2 && (
                <div className="flex justify-center items-center gap-6 w-full mt-4 animate-in fade-in zoom-in-50 duration-700">
                    <div className="text-4xl font-black text-blue-400 drop-shadow-md">{blueScore}</div>
                    <div className="text-lg font-black text-text-secondary/50">:</div>
                    <div className="text-4xl font-black text-red-400 drop-shadow-md">{redScore}</div>
                </div>
            )}

            {/* STEP 3: XP ANIMACIJA */}
            {step >= 3 && (
                <div className="mt-6 w-full animate-in fade-in slide-in-from-bottom-8 duration-700 flex justify-center">
                    {updatingDB ? (
                        <div className="flex items-center gap-2 text-text-secondary text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" /> Obračunavam XP...
                        </div>
                    ) : (
                        <div className={`flex items-center gap-3 px-6 py-4 rounded-3xl border shadow-xl transition-all
                            ${isWinner ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
                            
                            {isWinner ? (
                                <Sparkles className="h-6 w-6 text-emerald-400 animate-pulse" />
                            ) : (
                                <Frown className="h-6 w-6 text-red-400" />
                            )}
                            
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Tvoj XP nalog</span>
                                <span className={`text-xl font-black ${isWinner ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {xpChange && xpChange > 0 ? `+${xpChange}` : xpChange} XP
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STEP 4: DUGME ZA POVRATAK */}
            {step >= 4 && (
                <div className="mt-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <button
                        onClick={handleFinishAndLeave}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-surface border border-border text-text font-black uppercase text-sm hover:bg-surface-light hover:border-primary/50 transition-all active:scale-[0.98] shadow-sm"
                    >
                        <LogOut className="h-4 w-4" /> Vrati se na početnu <ArrowRight className="h-4 w-4" />
                    </button>
                    {myRole === "blue" && (
                        <p className="text-[10px] text-center text-text-secondary mt-3">
                            Kao plavi igrač, tvoj izlazak zatvara sobu.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}