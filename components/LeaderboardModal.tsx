"use client";

import { getLeaderboardByXp } from "@/data/leaderboard";
import {
    ChevronRight,
    Crown,
    Loader2,
    Trophy,
    User,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type LeaderboardUser = {
    id: string;
    username: string;
    experience: number;
};

export default function LeaderboardModal() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function fetchLeaderboard() {
            setLoading(true);

            try {
                const lead = await getLeaderboardByXp();

                if (!cancelled) {
                    setLeaderboard(lead || []);
                }
            } catch (error) {
                console.error(
                    "Greška pri učitavanju leaderboarda:",
                    error
                );

                if (!cancelled) {
                    setLeaderboard([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchLeaderboard();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div
            className="
                z-50
                flex
                w-[320px]
                max-w-[calc(100vw-32px)]
                flex-col
                overflow-hidden
                rounded-2xl
                border
                border-border/70
                bg-surface
                shadow-[0_18px_60px_rgba(0,0,0,0.55)]
                animate-modal-in
            "
        >
            {/* HEADER */}
            <div
                className="
                    shrink-0
                    border-b
                    border-border/60
                    bg-gradient-to-b
                    from-surface-light/60
                    to-transparent
                    px-3.5
                    pb-3
                    pt-3.5
                "
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="
                                flex
                                h-9
                                w-9
                                items-center
                                justify-center
                                rounded-xl
                                border
                                border-primary/20
                                bg-primary/10
                                text-primary
                            "
                        >
                            <Trophy className="h-4 w-4" />
                        </div>

                        <div>
                            <p
                                className="
                                    text-[9px]
                                    font-black
                                    uppercase
                                    tracking-[0.18em]
                                    text-primary
                                "
                            >
                                Global ranking
                            </p>

                            <h3 className="text-sm font-black text-text">
                                Top 10 igrača
                            </h3>
                        </div>
                    </div>

                    <div
                        className="
                            rounded-lg
                            border
                            border-border
                            bg-background/60
                            px-2
                            py-1
                            text-[9px]
                            font-black
                            text-text-muted
                        "
                    >
                        XP
                    </div>
                </div>
            </div>

            {/* LIST */}
            <div
                className="
                    custom-scrollbar
                    flex
                    max-h-[365px]
                    min-h-[185px]
                    flex-col
                    overflow-y-auto
                    overscroll-contain
                    p-2
                "
            >
                {loading ? (
                    <div className="flex min-h-[185px] items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                    </div>
                ) : leaderboard.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        {leaderboard.map((user, index) => {
                            const rank = index + 1;
                            const isFirst = rank === 1;
                            const isTopThree = rank <= 3;

                            return (
                                <div
                                    key={user.id || index}
                                    className={`
                                        relative
                                        grid
                                        grid-cols-[34px_minmax(0,1fr)_72px]
                                        items-center
                                        gap-2
                                        overflow-hidden
                                        rounded-xl
                                        border
                                        px-2
                                        py-2
                                        transition-all

                                        ${
                                            isFirst
                                                ? "border-primary/30 bg-primary/[0.055]"
                                                : "border-transparent hover:border-border/70 hover:bg-surface-light/40"
                                        }
                                    `}
                                >
                                    {/* GOLD ACCENT */}
                                    {isFirst && (
                                        <div className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
                                    )}

                                    {/* RANK */}
                                    <div
                                        className={`
                                            flex
                                            h-8
                                            w-8
                                            items-center
                                            justify-center
                                            rounded-lg
                                            text-[11px]
                                            font-black

                                            ${
                                                rank === 1
                                                    ? "bg-primary text-black"
                                                    : rank === 2
                                                    ? "bg-zinc-300/10 text-zinc-300"
                                                    : rank === 3
                                                    ? "bg-amber-700/15 text-amber-600"
                                                    : "bg-background text-text-muted"
                                            }
                                        `}
                                    >
                                        {rank === 1 ? (
                                            <Crown className="h-3.5 w-3.5" />
                                        ) : (
                                            rank
                                        )}
                                    </div>

                                    {/* PLAYER */}
                                    <div className="flex min-w-0 items-center gap-2">
                                        <div
                                            className={`
                                                flex
                                                h-8
                                                w-8
                                                shrink-0
                                                items-center
                                                justify-center
                                                rounded-lg
                                                border

                                                ${
                                                    isTopThree
                                                        ? "border-primary/15 bg-background text-primary"
                                                        : "border-border bg-background text-text-secondary"
                                                }
                                            `}
                                        >
                                            <User className="h-3.5 w-3.5" />
                                        </div>

                                        <div className="min-w-0">
                                            <p
                                                className={`
                                                    truncate
                                                    text-[11px]
                                                    font-black

                                                    ${
                                                        isFirst
                                                            ? "text-primary"
                                                            : "text-text"
                                                    }
                                                `}
                                            >
                                                {user.username}
                                            </p>

                                            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-text-muted">
                                                #{rank} globalno
                                            </p>
                                        </div>
                                    </div>

                                    {/* XP */}
                                    <div className="text-right">
                                        <p
                                            className={`
                                                text-xs
                                                font-black
                                                tabular-nums

                                                ${
                                                    isFirst
                                                        ? "text-primary"
                                                        : "text-text"
                                                }
                                            `}
                                        >
                                            {user.experience.toLocaleString()}
                                        </p>

                                        <p
                                            className="
                                                text-[7px]
                                                font-black
                                                uppercase
                                                tracking-[0.14em]
                                                text-text-muted
                                            "
                                        >
                                            XP
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div
                        className="
                            flex
                            min-h-[185px]
                            flex-col
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-dashed
                            border-border
                            bg-background/20
                            px-5
                            text-center
                        "
                    >
                        <div
                            className="
                                mb-3
                                flex
                                h-10
                                w-10
                                items-center
                                justify-center
                                rounded-xl
                                bg-surface-light
                                text-text-secondary
                            "
                        >
                            <Trophy className="h-4 w-4" />
                        </div>

                        <p className="text-xs font-black text-text">
                            Leaderboard je prazan
                        </p>

                        <p className="mt-1 text-[9px] text-text-secondary">
                            Trenutno nema igrača za prikaz.
                        </p>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div
                className="
                    shrink-0
                    border-t
                    border-border/60
                    bg-background/20
                    p-2
                "
            >
                <Link
                    href="/leaderboard"
                    className="
                        group
                        flex
                        h-10
                        w-full
                        items-center
                        justify-between
                        rounded-xl
                        px-3
                        text-xs
                        font-black
                        text-text
                        transition-all
                        hover:bg-surface-light
                    "
                >
                    <div className="flex items-center gap-2">
                        <Trophy className="h-3.5 w-3.5 text-primary" />

                        <span>Pogledaj cijeli leaderboard</span>
                    </div>

                    <ChevronRight
                        className="
                            h-4
                            w-4
                            text-text-muted
                            transition-transform
                            group-hover:translate-x-0.5
                            group-hover:text-primary
                        "
                    />
                </Link>
            </div>
        </div>
    );
}