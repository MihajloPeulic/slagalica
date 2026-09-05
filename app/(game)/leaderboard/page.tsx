"use client";

import {
  ArrowLeft,
  Crown,
  Flame,
  Loader2,
  Trophy,
  User,
  Zap,
} from "lucide-react";

import Link from "next/link";

import {
  getLeaderboardHundred,
  type LeaderboardSort,
} from "@/data/leaderboard";

import { useEffect, useState } from "react";

type LeaderboardPlayer = {
  id: string;
  username: string;
  experience: number;
  level: number;
  highest_streak: number;
  wins: number;
};

const sortOptions: {
  value: LeaderboardSort;
  label: string;
  description: string;
  icon: typeof Zap;
}[] = [
  {
    value: "experience",
    label: "XP",
    description: "iskustvu",
    icon: Zap,
  },
  {
    value: "wins",
    label: "Pobjede",
    description: "broju pobjeda",
    icon: Trophy,
  },
  {
    value: "highest_streak",
    label: "Streak",
    description: "najvećem streaku",
    icon: Flame,
  },
];

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<
    LeaderboardPlayer[]
  >([]);

  const [sortBy, setSortBy] =
    useState<LeaderboardSort>("experience");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLeaderboard() {
      setLoading(true);

      try {
        const data =
          await getLeaderboardHundred(sortBy);

        if (!cancelled) {
          setLeaderboard(
            (data ?? []) as LeaderboardPlayer[]
          );
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
  }, [sortBy]);

  const currentSort =
    sortOptions.find(
      (option) => option.value === sortBy
    ) ?? sortOptions[0];

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <main className="min-h-dvh bg-background px-3 pb-10 pt-4 text-text sm:px-6 sm:pt-6">
      <div className="mx-auto w-full max-w-3xl">
        {/* TOP NAV */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/home"
            aria-label="Nazad na početnu"
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              border-border
              bg-surface
              text-text-secondary
              transition-all
              hover:border-primary/40
              hover:bg-surface-light
              hover:text-primary
              active:scale-95
            "
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary sm:text-[10px]">
              Global ranking
            </p>

            <h1 className="text-xl font-black tracking-tight sm:text-3xl">
              Leaderboard
            </h1>
          </div>

          <div
            className="
              flex
              h-10
              shrink-0
              items-center
              gap-1.5
              rounded-xl
              border
              border-border
              bg-surface
              px-2.5
              text-[10px]
              font-black
              text-text-secondary

              sm:gap-2
              sm:px-3
              sm:text-xs
            "
          >
            <Trophy className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
            Top 100
          </div>
        </div>

        {/* SORT SELECTOR */}
        <section className="mb-5">
          <div
            className="
              grid
              grid-cols-3
              gap-1
              rounded-2xl
              border
              border-border
              bg-surface
              p-1
            "
          >
            {sortOptions.map((option) => {
              const Icon = option.icon;
              const active =
                sortBy === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setSortBy(option.value)
                  }
                  className={`
                    flex
                    h-10
                    cursor-pointer
                    items-center
                    justify-center
                    gap-1.5
                    rounded-xl
                    px-2
                    text-[10px]
                    font-black
                    transition-all

                    sm:h-11
                    sm:gap-2
                    sm:text-xs

                    ${
                      active
                        ? "bg-primary text-black shadow-sm"
                        : "text-text-secondary hover:bg-surface-light hover:text-text"
                    }
                  `}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />

                  {option.label}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-center text-[10px] text-text-muted sm:text-xs">
            Najboljih 100 igrača po{" "}
            {currentSort.description}.
          </p>
        </section>

        {loading ? (
          <LeaderboardLoading />
        ) : leaderboard.length === 0 ? (
          <EmptyLeaderboard />
        ) : (
          <>
            {/* TOP 3 */}
            {topThree.length >= 3 && (
              <section className="mb-7 grid grid-cols-3 items-end gap-2 sm:gap-3">
                <TopPlayerCard
                  player={topThree[1]}
                  place={2}
                  sortBy={sortBy}
                />

                <TopPlayerCard
                  player={topThree[0]}
                  place={1}
                  sortBy={sortBy}
                />

                <TopPlayerCard
                  player={topThree[2]}
                  place={3}
                  sortBy={sortBy}
                />
              </section>
            )}

            {/* TABLE HEADER */}
            <div
              className="
                mb-2
                grid
                grid-cols-[32px_minmax(0,1fr)_82px]
                items-center
                px-3
                text-[9px]
                font-black
                uppercase
                tracking-[0.12em]
                text-text-muted

                sm:grid-cols-[44px_minmax(0,1fr)_110px]
                sm:px-4
              "
            >
              <span>#</span>

              <span>Igrač</span>

              <span className="text-right">
                {getMetricLabel(sortBy)}
              </span>
            </div>

            {/* PLAYERS 4 - 100 */}
            <section className="overflow-hidden rounded-2xl border border-border bg-surface">
              {rest.map((player, index) => {
                const rank = index + 4;

                return (
                  <div
                    key={player.id}
                    className="
                      grid
                      grid-cols-[32px_minmax(0,1fr)_82px]
                      items-center
                      border-b
                      border-border/70
                      px-3
                      py-3
                      transition-colors
                      last:border-b-0
                      hover:bg-surface-light/40

                      sm:grid-cols-[44px_minmax(0,1fr)_110px]
                      sm:px-4
                    "
                  >
                    {/* RANK */}
                    <div className="text-xs font-black tabular-nums text-text-muted">
                      {rank}
                    </div>

                    {/* PLAYER */}
                    <div className="flex min-w-0 items-center gap-2.5">
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
                          border-border
                          bg-background
                          text-text-secondary

                          sm:h-10
                          sm:w-10
                        "
                      >
                        <User className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-text sm:text-sm">
                          {player.username}
                        </p>

                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-[9px] font-bold text-text-muted">
                            Level {player.level}
                          </span>

                          {sortBy !==
                            "highest_streak" &&
                            player.highest_streak >
                              0 && (
                              <>
                                <span className="text-text-muted/30">
                                  •
                                </span>

                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-text-muted">
                                  <Flame className="h-2.5 w-2.5" />
                                  {
                                    player.highest_streak
                                  }
                                </span>
                              </>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* CURRENT METRIC */}
                    <div className="text-right">
                      <p className="text-sm font-black tabular-nums text-primary sm:text-base">
                        {formatMetric(
                          player,
                          sortBy
                        )}
                      </p>

                      <p className="text-[8px] font-black uppercase tracking-wider text-text-muted">
                        {getMetricShortLabel(
                          sortBy
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function TopPlayerCard({
  player,
  place,
  sortBy,
}: {
  player: LeaderboardPlayer;
  place: 1 | 2 | 3;
  sortBy: LeaderboardSort;
}) {
  const first = place === 1;

  return (
    <div
      className={`
        relative
        flex
        min-w-0
        flex-col
        items-center
        overflow-hidden
        rounded-2xl
        border
        bg-surface
        px-1.5
        pb-3
        pt-4
        text-center
        shadow-sm

        sm:px-3

        ${
          first
            ? "min-h-[190px] border-primary/50 sm:min-h-[215px]"
            : "min-h-[168px] border-border sm:min-h-[188px]"
        }
      `}
    >
      {/* TOP ACCENT */}
      {first && (
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      )}

      {/* PLACE */}
      <div
        className={`
          mb-3
          flex
          h-7
          min-w-7
          items-center
          justify-center
          rounded-full
          px-2
          text-[10px]
          font-black

          sm:h-8
          sm:min-w-8
          sm:text-xs

          ${
            place === 1
              ? "bg-primary text-black"
              : place === 2
              ? "bg-zinc-300/10 text-zinc-300"
              : "bg-amber-700/15 text-amber-600"
          }
        `}
      >
        {place === 1 ? (
          <Crown className="h-4 w-4" />
        ) : (
          place
        )}
      </div>

      {/* AVATAR */}
      <div
        className={`
          mb-2
          flex
          items-center
          justify-center
          rounded-2xl
          border
          bg-background

          ${
            first
              ? "h-13 w-13 border-primary/30 text-primary sm:h-14 sm:w-14"
              : "h-11 w-11 border-border text-text-secondary sm:h-12 sm:w-12"
          }
        `}
      >
        <User
          className={
            first
              ? "h-5 w-5 sm:h-6 sm:w-6"
              : "h-4 w-4 sm:h-5 sm:w-5"
          }
        />
      </div>

      {/* NAME */}
      <p
        className="
          w-full
          break-words
          text-[10px]
          font-black
          leading-tight
          text-text

          sm:text-sm
        "
      >
        {player.username}
      </p>

      <p className="mt-1 text-[8px] font-bold text-text-muted sm:text-[9px]">
        Level {player.level}
      </p>

      {/* VALUE */}
      <div className="mt-auto pt-3">
        <p
          className={`
            font-black
            tabular-nums
            text-primary

            ${
              first
                ? "text-lg sm:text-xl"
                : "text-sm sm:text-base"
            }
          `}
        >
          {formatMetric(player, sortBy)}
        </p>

        <div className="mt-0.5 flex items-center justify-center gap-1">
          {sortBy === "highest_streak" && (
            <Flame className="h-2.5 w-2.5 text-primary" />
          )}

          <p className="text-[7px] font-black uppercase tracking-[0.12em] text-text-muted sm:text-[8px]">
            {getMetricShortLabel(sortBy)}
          </p>
        </div>
      </div>
    </div>
  );
}

function getMetricLabel(
  sortBy: LeaderboardSort
) {
  switch (sortBy) {
    case "wins":
      return "Pobjede";

    case "highest_streak":
      return "Streak";

    default:
      return "XP";
  }
}

function getMetricShortLabel(
  sortBy: LeaderboardSort
) {
  switch (sortBy) {
    case "wins":
      return "wins";

    case "highest_streak":
      return "streak";

    default:
      return "xp";
  }
}

function formatMetric(
  player: LeaderboardPlayer,
  sortBy: LeaderboardSort
) {
  switch (sortBy) {
    case "wins":
      return player.wins.toLocaleString();

    case "highest_streak":
      return player.highest_streak.toLocaleString();

    default:
      return player.experience.toLocaleString();
  }
}

function LeaderboardLoading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />

        <p className="text-xs font-bold text-text-secondary">
          Učitavanje leaderboarda...
        </p>
      </div>
    </div>
  );
}

function EmptyLeaderboard() {
  return (
    <div
      className="
        flex
        min-h-[260px]
        flex-col
        items-center
        justify-center
        rounded-2xl
        border
        border-dashed
        border-border
        bg-surface
        px-6
        text-center
      "
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-light text-text-secondary">
        <Trophy className="h-5 w-5" />
      </div>

      <p className="text-sm font-black">
        Leaderboard je prazan
      </p>

      <p className="mt-1 max-w-xs text-xs text-text-secondary">
        Trenutno nema igrača za prikaz.
      </p>
    </div>
  );
}