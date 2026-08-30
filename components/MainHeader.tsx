"use client"

import { Trophy, Award, Users } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import FriendsModal from "./FriendsModal";
import LeaderboardModal from "./LeaderboardModal";

import type { Database } from "@/types/supabase";

type  Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function MainHeader({profile}: {profile: Profile}) {
    const [frModal, setFrModal] = useState(false);
    const [ldModal, setLdModal] = useState(false);
    
    // 1. Kreiramo referencu koju ćemo zakačiti na header
    const headerRef = useRef<HTMLElement>(null);

    // 2. useEffect za detekciju klika izvan
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Ako referenca postoji i kliknuti element NIJE unutar headera
            if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
                setFrModal(false);
                setLdModal(false);
            }
        }

        // Dodajemo event listener na ceo dokument
        document.addEventListener("mousedown", handleClickOutside);
        
        // Cleanup funkcija koja skida listener kada se komponenta unmount-uje
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []); // Prazan array znači da se ovo pokreće samo jednom pri mountovanju

    return (
        // 3. Kačimo referencu na glavni element koji sadrži modale i dugmiće
        <header ref={headerRef} className="relative z-50">
            <div className="flex items-center justify-between">
                
                {/* Levo: Trophy (Leaderboard Dugme + Modal) */}
                <div className="relative flex flex-col items-start">
                    <button 
                        type="button"
                        onClick={() => {
                            setLdModal((prev) => !prev);
                            setFrModal(false); // Automatski gasimo drugi modal
                        }}
                        className={`cursor-pointer flex h-14 w-14 items-center justify-center rounded-2xl border border-border transition hover:bg-surface-light shadow-sm ${ldModal ? 'bg-surface-light text-primary border-primary/50' : 'bg-surface text-text-secondary'}`}
                    >
                        <Trophy className="h-6 w-6 stroke-[1.5]" />
                    </button>

                    {/* MODAL ZA LEADERBOARD */}
                    {ldModal && (
                        <div className="absolute top-[120%] left-0 z-[100]">
                            <LeaderboardModal />
                        </div>
                    )}
                </div>

                {/* Sredina: XP Badge */}
                <div className="flex items-center gap-2.5 rounded-full border border-primary/40 bg-surface/80 backdrop-blur-sm px-5 py-2.5 shadow-sm">
                    <Award className="h-5 w-5 text-primary stroke-[2]" />
                    <span className="text-sm font-bold text-primary tracking-wide">
                        {profile.experience} XP
                    </span>
                </div>

                {/* Desno: Friends (Dugme + Modal) */}
                <div className="relative flex flex-col items-end">
                    <button 
                        type="button"
                        onClick={() => {
                            setFrModal((prev) => !prev);
                            setLdModal(false); // Automatski gasimo drugi modal
                        }}
                        className={`cursor-pointer flex h-14 w-14 items-center justify-center rounded-2xl border border-border transition hover:bg-surface-light shadow-sm ${frModal ? 'bg-surface-light text-primary border-primary/50' : 'bg-surface text-text-secondary'}`}
                    >
                        <Users className="h-6 w-6 stroke-[1.5]" />
                    </button>

                    {/* MODAL ZA PRIJATELJE */}
                    {frModal && (
                        <div className="absolute top-[120%] right-0 z-[100]">
                            <FriendsModal />
                        </div>
                    )}
                </div>

            </div>
        </header>
    );
}