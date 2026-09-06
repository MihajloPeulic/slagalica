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
  const [leaderboard, setLeaderboard] =
    useState<LeaderboardUser[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLeaderboard() {
      setLoading(true);

      try {
        const lead =
          await getLeaderboardByXp();

        if (!cancelled) {
          setLeaderboard(lead || []);
        }
      } catch (error) {
        console.error(
          "Greška pri učitavanju leaderboarda:",
          error,
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
    <div className="card-base animate-modal-in z-50 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden shadow-lg">
      <LeaderboardHeader />

      <div className="custom-scrollbar flex max-h-[365px] min-h-[185px] flex-col overflow-y-auto overscroll-contain p-2">
        {loading ? (
          <LeaderboardLoading />
        ) : leaderboard.length > 0 ? (
          <LeaderboardList
            leaderboard={leaderboard}
          />
        ) : (
          <LeaderboardEmpty />
        )}
      </div>

      <LeaderboardFooter />
    </div>
  );
}

/* =========================================
   HEADER
   ========================================= */

function LeaderboardHeader() {
  return (
    <header className="shrink-0 border-b border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Trophy className="h-4 w-4" />
          </div>

          <div>
            <p className="eyebrow">
              Global ranking
            </p>

            <h2 className="card-title mt-0.5">
              Top 10 igrača
            </h2>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-black text-text-muted">
          XP
        </div>
      </div>
    </header>
  );
}

/* =========================================
   LIST
   ========================================= */

function LeaderboardList({
  leaderboard,
}: {
  leaderboard: LeaderboardUser[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {leaderboard.map(
        (user, index) => {
          const rank = index + 1;

          return (
            <LeaderboardRow
              key={user.id}
              user={user}
              rank={rank}
            />
          );
        },
      )}
    </div>
  );
}

/* =========================================
   ROW
   ========================================= */

function LeaderboardRow({
  user,
  rank,
}: {
  user: LeaderboardUser;
  rank: number;
}) {
  const isFirst = rank === 1;
  const isTopThree = rank <= 3;

  return (
    <div
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
        transition-colors
        ${
          isFirst
            ? "border-primary/30 bg-primary/5"
            : "border-transparent hover:border-border hover:bg-surface-light/40"
        }
      `}
    >
      {isFirst && (
        <div className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
      )}

      <RankBadge rank={rank} />

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
                ? "border-primary/20 bg-background text-primary"
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
              text-xs
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

          <p className="mt-0.5 text-[10px] font-semibold text-text-muted">
            #{rank} globalno
          </p>
        </div>
      </div>

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

        <p className="text-[10px] font-bold text-text-muted">
          XP
        </p>
      </div>
    </div>
  );
}

/* =========================================
   RANK BADGE
   ========================================= */

function RankBadge({
  rank,
}: {
  rank: number;
}) {
  const rankStyles =
    rank === 1
      ? "bg-primary text-black"
      : rank === 2
        ? "bg-zinc-300/10 text-zinc-300"
        : rank === 3
          ? "bg-amber-700/15 text-amber-600"
          : "bg-background text-text-muted";

  return (
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
        ${rankStyles}
      `}
    >
      {rank === 1 ? (
        <Crown className="h-3.5 w-3.5" />
      ) : (
        rank
      )}
    </div>
  );
}

/* =========================================
   STATES
   ========================================= */

function LeaderboardLoading() {
  return (
    <div className="flex min-h-[185px] items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}

function LeaderboardEmpty() {
  return (
    <div className="flex min-h-[185px] flex-col items-center justify-center rounded-xl border border-dashed border-border px-5 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-light text-text-secondary">
        <Trophy className="h-4 w-4" />
      </div>

      <p className="card-title">
        Leaderboard je prazan
      </p>

      <p className="secondary-text mt-1">
        Trenutno nema igrača za prikaz.
      </p>
    </div>
  );
}

/* =========================================
   FOOTER
   ========================================= */

function LeaderboardFooter() {
  return (
    <footer className="shrink-0 border-t border-border p-2">
      <Link
        href="/leaderboard"
        className="group flex h-10 w-full items-center justify-between rounded-xl px-3 text-xs font-black text-text transition-colors hover:bg-surface-light"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-primary" />

          <span>
            Pogledaj cijeli leaderboard
          </span>
        </div>

        <ChevronRight className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </footer>
  );
}