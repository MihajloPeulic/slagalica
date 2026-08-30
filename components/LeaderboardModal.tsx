"use client"

import { getLeaderboardByXp } from "@/data/leaderboard";
import { Trophy, ChevronRight, Loader2 } from "lucide-react"; // Importovan Loader2
import Link from "next/link";
import { useEffect, useState } from "react";

export default function LeaderboardModal() {
    const [leaderboard, setLeaderboard] = useState<{id: string, username: string, experience: number}[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLeaderboard() {
            setLoading(true);
            try {
                const lead = await getLeaderboardByXp();
                setLeaderboard(lead || []);
            } catch (error) {
                console.error("Greška pri učitavanju leaderboarda:", error);
            } finally {
                setLoading(false);
            }
        }
        
        fetchLeaderboard(); // OVO JE FALILO: Poziv funkcije!
    }, []); // OVO JE FALILO: Prazan niz da se izvrši samo jednom pri učitavanju

    return (
        <div className="w-[280px] sm:w-[320px] bg-surface border border-border p-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] animate-modal-in flex flex-col z-50">
            
            {/* Header Modala */}
            <div className="flex items-center gap-2 mb-2 px-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                    Top 10 Igrača
                </h3>
            </div>
            
            {/* Scrollable lista igrača */}
            <div className="flex flex-col gap-1 max-h-[300px] min-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                {loading ? (
                    // Prikaz učitavanja dok se čekaju podaci sa servera
                    <div className="flex h-full min-h-[150px] items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                    </div>
                ) : leaderboard.length > 0 ? (
                    leaderboard.map((user, index) => {
                        const rank = index + 1; // Računamo poziciju na osnovu redosleda u nizu
                        
                        return (
                            <div 
                                key={user.id || index} 
                                className="group flex items-center justify-between p-2 rounded-xl border border-transparent hover:border-border hover:bg-surface-light transition-colors cursor-default"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Rank bedž (Zlato, Srebro, Bronza, i ostali) */}
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm
                                        ${rank === 1 ? 'bg-primary/20 text-primary' : 
                                          rank === 2 ? 'bg-gray-400/20 text-gray-400' : 
                                          rank === 3 ? 'bg-amber-700/20 text-amber-600' : 
                                          'bg-surface-light text-text-muted'}
                                    `}>
                                        {rank}
                                    </div>
                                    <span className={`font-semibold ${rank === 1 ? 'text-primary' : 'text-text'} truncate max-w-[100px]`}>
                                        {user.username}
                                    </span>
                                </div>
                                
                                <div className="text-right shrink-0">
                                    <span className="text-sm font-bold text-text">{user.experience}</span>
                                    <span className="text-[10px] font-medium text-text-secondary ml-1">XP</span>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    // Prikaz ako nema korisnika u bazi
                    <div className="py-10 text-center text-xs font-medium text-text-secondary">
                        Tabela je trenutno prazna.
                    </div>
                )}
            </div>

            {/* View All Dugme na dnu */}
            <div className="mt-2 pt-2 border-t border-border">
                <Link 
                    href="/leaderboard"
                    className="flex items-center justify-center gap-1 w-full py-2.5 rounded-xl text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
                >
                    View All
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>

        </div>
    );
}