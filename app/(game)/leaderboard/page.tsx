
"use client";

import {
  Crown,
  Flame,
  Loader2,
  Trophy,
  User,
  Zap,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getLeaderboardHundred,
  type LeaderboardSort,
} from "@/data/leaderboard";

import InAppHeader from "@/components/ui/InAppHeader";
import PageContainer from "@/components/ui/PageContainer";
import PageSection from "@/components/ui/PageSection";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/Button";

type LeaderboardPlayer = {
  id: string;
  username: string;
  experience: number;
  level: number;
  highest_streak: number;
  wins: number;
};

type SortOption = {
  value: LeaderboardSort;
  label: string;
  description: string;
  icon: typeof Zap;
};

const sortOptions: SortOption[] = [
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
  const [leaderboard, setLeaderboard] =
    useState<LeaderboardPlayer[]>([]);

  const [sortBy, setSortBy] =
    useState<LeaderboardSort>(
      "experience",
    );

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLeaderboard() {
      setLoading(true);

      try {
        const data =
          await getLeaderboardHundred(
            sortBy,
          );

        if (!cancelled) {
          setLeaderboard(
            (data ??
              []) as LeaderboardPlayer[],
          );
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
  }, [sortBy]);

  const currentSort =
    sortOptions.find(
      (option) =>
        option.value === sortBy,
    ) ?? sortOptions[0];

  const topThree =
    leaderboard.slice(0, 3);

  const rest =
    leaderboard.slice(3);

  return (
    <PageContainer>
      <InAppHeader
        link_to="/home"
        title="Leaderboard"
      />

      <PageTitle
        eyebrow="Global ranking"
        title="Najbolji igrači"
        description="Pogledaj najbolje igrače po iskustvu, pobjedama i streaku."
      />

      <div className="section-stack">
        <PageSection>
          <SortSelector
            sortBy={sortBy}
            onChange={setSortBy}
            description={
              currentSort.description
            }
          />
        </PageSection>

        {loading ? (
          <LeaderboardLoading />
        ) : leaderboard.length === 0 ? (
          <EmptyLeaderboard />
        ) : (
          <>
            {topThree.length >= 3 && (
              <PageSection>
                <TopThree
                  players={topThree}
                  sortBy={sortBy}
                />
              </PageSection>
            )}

            {rest.length > 0 && (
              <PageSection
                title="Ostali igrači"
                description={`Poredano po ${currentSort.description}.`}
              >
                <LeaderboardTable
                  players={rest}
                  sortBy={sortBy}
                />
              </PageSection>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}


/* =========================================
   SORT
   ========================================= */

function SortSelector({
  sortBy,
  onChange,
  description,
}: {
  sortBy: LeaderboardSort;
  onChange: (
    value: LeaderboardSort,
  ) => void;
  description: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />

        <span className="card-title">
          Top 100 igrača
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1">
        {sortOptions.map(
          (option) => {
            const Icon =
              option.icon;

            const active =
              sortBy ===
              option.value;

            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={
                  active
                    ? "primary"
                    : "ghost"
                }
                fullWidth
                onClick={() =>
                  onChange(
                    option.value,
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />

                {option.label}
              </Button>
            );
          },
        )}
      </div>

      <p className="secondary-text mt-2">
        Najboljih 100 igrača po{" "}
        {description}.
      </p>
    </div>
  );
}


/* =========================================
   TOP 3
   ========================================= */

function TopThree({
  players,
  sortBy,
}: {
  players: LeaderboardPlayer[];
  sortBy: LeaderboardSort;
}) {
  return (
    <div className="grid grid-cols-3 items-end gap-2">
      <TopPlayerCard
        player={players[1]}
        place={2}
        sortBy={sortBy}
      />

      <TopPlayerCard
        player={players[0]}
        place={1}
        sortBy={sortBy}
      />

      <TopPlayerCard
        player={players[2]}
        place={3}
        sortBy={sortBy}
      />
    </div>
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
        card-base
        relative
        flex
        min-w-0
        flex-col
        items-center
        overflow-hidden
        px-2
        pb-4
        pt-4
        text-center
        ${
          first
            ? "min-h-[190px] border-primary/40"
            : "min-h-[170px]"
        }
      `}
    >
      {first && (
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      )}

      <RankBadge
        place={place}
      />

      <div
        className={`
          mt-3
          flex
          items-center
          justify-center
          rounded-xl
          border
          bg-background
          ${
            first
              ? "h-14 w-14 border-primary/30 text-primary"
              : "h-12 w-12 border-border text-text-secondary"
          }
        `}
      >
        <User
          className={
            first
              ? "h-5 w-5"
              : "h-4 w-4"
          }
        />
      </div>

      <p className="mt-3 w-full truncate text-xs font-black text-text">
        {player.username}
      </p>

      <p className="secondary-text mt-1">
        Level {player.level}
      </p>

      <div className="mt-auto pt-4">
        <p
          className={`
            font-black
            tabular-nums
            text-primary
            ${
              first
                ? "text-xl"
                : "text-base"
            }
          `}
        >
          {formatMetric(
            player,
            sortBy,
          )}
        </p>

        <div className="mt-0.5 flex items-center justify-center gap-1">
          {sortBy ===
            "highest_streak" && (
            <Flame className="h-3 w-3 text-primary" />
          )}

          <span className="text-[10px] font-bold uppercase text-text-muted">
            {getMetricShortLabel(
              sortBy,
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function RankBadge({
  place,
}: {
  place: 1 | 2 | 3;
}) {
  const style =
    place === 1
      ? "bg-primary text-black"
      : place === 2
        ? "bg-zinc-300/10 text-zinc-300"
        : "bg-amber-700/15 text-amber-600";

  return (
    <div
      className={`
        flex
        h-7
        min-w-7
        items-center
        justify-center
        rounded-full
        px-2
        text-[10px]
        font-black
        ${style}
      `}
    >
      {place === 1 ? (
        <Crown className="h-3.5 w-3.5" />
      ) : (
        place
      )}
    </div>
  );
}


/* =========================================
   TABLE
   ========================================= */

function LeaderboardTable({
  players,
  sortBy,
}: {
  players: LeaderboardPlayer[];
  sortBy: LeaderboardSort;
}) {
  return (
    <div>
      <div className="mb-2 grid grid-cols-[32px_minmax(0,1fr)_72px] items-center px-3 text-[10px] font-black uppercase tracking-wide text-text-muted">
        <span>#</span>

        <span>Igrač</span>

        <span className="text-right">
          {getMetricLabel(
            sortBy,
          )}
        </span>
      </div>

      <div className="card-base overflow-hidden">
        {players.map(
          (player, index) => (
            <LeaderboardRow
              key={player.id}
              player={player}
              rank={index + 4}
              sortBy={sortBy}
            />
          ),
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({
  player,
  rank,
  sortBy,
}: {
  player: LeaderboardPlayer;
  rank: number;
  sortBy: LeaderboardSort;
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_72px] items-center border-b border-border px-3 py-3 transition-colors last:border-b-0 hover:bg-surface-light/40">
      <div className="text-xs font-black tabular-nums text-text-muted">
        {rank}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-text-secondary">
          <User className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-xs font-black text-text">
            {player.username}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <span className="secondary-text">
              Level {player.level}
            </span>

            {sortBy !==
              "highest_streak" &&
              player.highest_streak >
                0 && (
                <>
                  <span className="text-text-muted">
                    •
                  </span>

                  <span className="secondary-text flex items-center gap-1">
                    <Flame className="h-3 w-3" />

                    {
                      player.highest_streak
                    }
                  </span>
                </>
              )}
          </div>
        </div>
      </div>

      <div className="text-right">
        <p className="text-sm font-black tabular-nums text-primary">
          {formatMetric(
            player,
            sortBy,
          )}
        </p>

        <p className="text-[10px] font-bold uppercase text-text-muted">
          {getMetricShortLabel(
            sortBy,
          )}
        </p>
      </div>
    </div>
  );
}


/* =========================================
   STATES
   ========================================= */

function LeaderboardLoading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />

        <p className="secondary-text">
          Učitavanje leaderboarda...
        </p>
      </div>
    </div>
  );
}

function EmptyLeaderboard() {
  return (
    <div className="card-base flex min-h-[260px] flex-col items-center justify-center border-dashed px-6 text-center">
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
   HELPERS
   ========================================= */

function getMetricLabel(
  sortBy: LeaderboardSort,
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
  sortBy: LeaderboardSort,
) {
  switch (sortBy) {
    case "wins":
      return "pobjede";

    case "highest_streak":
      return "streak";

    default:
      return "xp";
  }
}

function formatMetric(
  player: LeaderboardPlayer,
  sortBy: LeaderboardSort,
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
