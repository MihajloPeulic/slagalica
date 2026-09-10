"use client";

import { useEffect, useState } from "react";
import { Trophy, Frown, Sparkles, LogOut, ArrowRight, WifiOff } from "lucide-react";
import type { FinalGameResult } from "@/lib/game/game-result-types";

interface EndScreenProps {
    myRole: "blue" | "red";
    result: FinalGameResult;
    blueName: string;
    redName: string;
    onLeave: () => void;
}

export function EndScreen({ myRole, result, blueName, redName, onLeave }: EndScreenProps) {
    const [step, setStep] = useState(0);

    const myScore = myRole === "blue" ? result.blueScore : result.redScore;
    const oppScore = myRole === "blue" ? result.redScore : result.blueScore;
    const myXpChange = myRole === "blue" ? result.blueXpChange : result.redXpChange;

    const isWinner = result.winnerRole === myRole;
    const isTie = result.winnerRole === null;
    const iForfeited = result.forfeitedRole === myRole;
    const wasDisconnect = result.finishReason === "disconnect";

    useEffect(() => {
        if (step >= 4) return;

        const timer = setTimeout(() => {
            setStep((prev) => prev + 1);
        }, 700);

        return () => clearTimeout(timer);
    }, [step]);

    return (
        <div className="flex w-full max-w-sm flex-col items-center gap-4 py-8 mx-auto">
            {step >= 1 && (
                <div className="flex w-full animate-in flex-col items-center gap-2 fade-in slide-in-from-top-8 duration-700">
                    {wasDisconnect ? (
                        <WifiOff className={`mb-2 h-16 w-16 ${isWinner ? "text-emerald-400" : "text-red-400"}`} />
                    ) : (
                        <Trophy
                            className={`mb-2 h-16 w-16 ${
                                isWinner ? "text-yellow-400" : "text-text-secondary opacity-50"
                            }`}
                        />
                    )}

                    <h1 className="mb-3 text-center text-3xl font-black uppercase text-text">
                        {isWinner ? "Pobjeda!" : isTie ? "Nerešeno" : "Poraz"}
                    </h1>

                    {wasDisconnect && (
                        <p className="mb-4 max-w-xs text-center text-sm font-medium text-text-secondary">
                            {iForfeited
                                ? "Nisi se vratio u meč u roku od 40 sekundi."
                                : "Protivnik se nije vratio u meč u roku od 40 sekundi."}
                        </p>
                    )}

                    <div className="flex w-full items-center justify-between gap-4">
                        <div className="flex-1 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
                            <span className="mb-1 block text-[10px] font-bold uppercase text-blue-400">Plavi</span>
                            <span className="block truncate text-sm font-black text-text">{blueName}</span>
                        </div>

                        <span className="text-sm font-black text-text-secondary">VS</span>

                        <div className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                            <span className="mb-1 block text-[10px] font-bold uppercase text-red-400">Crveni</span>
                            <span className="block truncate text-sm font-black text-text">{redName}</span>
                        </div>
                    </div>
                </div>
            )}

            {step >= 2 && (
                <div className="mt-4 flex w-full animate-in items-center justify-center gap-6 fade-in zoom-in-50 duration-700">
                    <div className="text-4xl font-black text-blue-400">{result.blueScore}</div>
                    <div className="text-lg font-black text-text-secondary/50">:</div>
                    <div className="text-4xl font-black text-red-400">{result.redScore}</div>
                </div>
            )}

            {step >= 3 && (
                <div className="mt-6 flex w-full animate-in justify-center fade-in slide-in-from-bottom-8 duration-700">
                    <div
                        className={`flex items-center gap-3 rounded-2xl border px-6 py-4 ${
                            myXpChange >= 0
                                ? "border-emerald-500/40 bg-emerald-500/10"
                                : "border-red-500/40 bg-red-500/10"
                        }`}
                    >
                        {myXpChange >= 0 ? (
                            <Sparkles className="h-6 w-6 text-emerald-400" />
                        ) : (
                            <Frown className="h-6 w-6 text-red-400" />
                        )}

                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                                Tvoj XP
                            </span>
                            <span
                                className={`text-xl font-black ${
                                    myXpChange >= 0 ? "text-emerald-400" : "text-red-400"
                                }`}
                            >
                                {myXpChange > 0 ? `+${myXpChange}` : myXpChange} XP
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {step >= 4 && (
                <div className="mt-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <button
                        onClick={onLeave}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-4 text-sm font-black uppercase text-text transition-all hover:border-primary/50 hover:bg-surface-light active:scale-[0.98]"
                    >
                        <LogOut className="h-4 w-4" />
                        Vrati se na početnu
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            )}

            <span className="sr-only">
                Konačni rezultat {myScore} prema {oppScore}.
            </span>
        </div>
    );
}
