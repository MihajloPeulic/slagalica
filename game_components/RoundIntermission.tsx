"use client";

import type { ReactNode } from "react";
import { Clock, Trophy } from "lucide-react";

type RoundIntermissionProps = {
    gameTitle: string;
    round?: number;
    bluePoints: number;
    redPoints: number;
    timeLeft: number;
    nextLabel?: string;
    topContent?: ReactNode;
    blueDetail?: ReactNode;
    redDetail?: ReactNode;
    bottomContent?: ReactNode;
};

function formatPoints(points: number) {
    return points > 0 ? `+${points}` : `${points}`;
}

export function RoundIntermission({
    gameTitle,
    round,
    bluePoints,
    redPoints,
    timeLeft,
    nextLabel = "Sledeća runda za",
    topContent,
    blueDetail,
    redDetail,
    bottomContent,
}: RoundIntermissionProps) {
    return (
        <div className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface p-4 text-center animate-in zoom-in-95">
            <div className="flex flex-col items-center gap-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Trophy className="h-5 w-5" />
                </div>

                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                    {typeof round === "number" ? `Rezultat runde ${round}` : "Rezultat"}
                </p>

                <h2 className="text-base font-black text-text">{gameTitle}</h2>
            </div>

            {topContent ? <div className="w-full">{topContent}</div> : null}

            <div className="grid w-full grid-cols-2 gap-2">
                <div className="min-w-0 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-left">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wide text-blue-400">
                            Plavi igrač
                        </span>
                        <span className="shrink-0 text-xl font-black tabular-nums text-blue-400">
                            {formatPoints(bluePoints)}
                        </span>
                    </div>

                    {blueDetail ? <div className="mt-2 min-w-0 text-xs text-text-secondary">{blueDetail}</div> : null}
                </div>

                <div className="min-w-0 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-left">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wide text-red-400">
                            Crveni igrač
                        </span>
                        <span className="shrink-0 text-xl font-black tabular-nums text-red-400">
                            {formatPoints(redPoints)}
                        </span>
                    </div>

                    {redDetail ? <div className="mt-2 min-w-0 text-xs text-text-secondary">{redDetail}</div> : null}
                </div>
            </div>

            {bottomContent ? <div className="w-full">{bottomContent}</div> : null}

            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-text-secondary">
                <Clock className="h-4 w-4 text-primary" />
                <span>{nextLabel}</span>
                <strong className="text-sm font-black tabular-nums text-primary">{Math.max(0, timeLeft)}s</strong>
            </div>
        </div>
    );
}
