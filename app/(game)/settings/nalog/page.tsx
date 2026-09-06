import {
  Flame,
  LockKeyhole,
  Mail,
  Swords,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";

import { redirect } from "next/navigation";

import { getCurrentUserWithProfile } from "@/data/auth";

import InAppHeader from "@/components/ui/InAppHeader";
import PageContainer from "@/components/ui/PageContainer";
import PageSection from "@/components/ui/PageSection";

import { ProfileAvatar } from "./ProfileAvatar";
import { EditProfileField } from "./EditProfileField";
import ProfileStats from "@/components/ProfileStats";

export default async function ProfilePage() {
  const currentUser =
    await getCurrentUserWithProfile();

  const userId = currentUser?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const profile = currentUser.profile;

  const wins = profile.wins ?? 0;
  const losses = profile.losses ?? 0;
  const draws = Number(
    profile.draws ?? 0,
  );

  const highestWinStreak = Number(
    profile.highest_streak ?? 0,
  );

  const totalGames =
    wins + losses + draws;

  const winRate =
    totalGames > 0
      ? Math.round(
          (wins / totalGames) * 100,
        )
      : 0;

  const experience =
    profile.experience ?? 0;

  const level =
    Math.floor(experience / 500) + 1;

  const levelProgress =
    experience % 500;

  const progressPercent =
    (levelProgress / 500) * 100;

  const email =
    currentUser?.user?.email ?? "";

  return (
    <PageContainer>
      <InAppHeader
        link_to="/settings"
        title="Nalog"
      />

      <div className="section-stack">
        <ProfileOverview
          userId={userId}
          username={profile.username}
          avatarUrl={profile.avatar_url}
          experience={experience}
          level={level}
          levelProgress={levelProgress}
          progressPercent={
            progressPercent
          }
        />

        <PageSection title="Statistika">
          <ProfileStats
            type="mine"
            wins={wins}
            losses={losses}
            draws={draws}
          />
        </PageSection>

        <PageSection title="Forma">
          <div className="card-base overflow-hidden">
            <PerformanceRow
              icon={Flame}
              label="Najduži niz pobjeda"
              value={highestWinStreak}
              tone="primary"
            />

            <div className="mx-4 border-t border-border" />

            <PerformanceRow
              label="Stopa pobjeda"
              value={`${winRate}%`}
            />
          </div>
        </PageSection>

        <PageSection title="Podaci naloga">
          <div className="card-base overflow-hidden">
            <EditProfileField
              type="username"
              label="Username"
              value={profile.username}
              icon={
                <UserRound className="h-4 w-4" />
              }
            />

            <div className="mx-4 border-t border-border" />

            <EditProfileField
              type="email"
              label="Email"
              value={email}
              icon={
                <Mail className="h-4 w-4" />
              }
            />

            <div className="mx-4 border-t border-border" />

            <EditProfileField
              type="password"
              label="Lozinka"
              value="••••••••"
              icon={
                <LockKeyhole className="h-4 w-4" />
              }
            />
          </div>
        </PageSection>
      </div>
    </PageContainer>
  );
}

/* =========================================
   PROFILE
   ========================================= */

function ProfileOverview({
  userId,
  username,
  avatarUrl,
  experience,
  level,
  levelProgress,
  progressPercent,
}: {
  userId: string;
  username: string;
  avatarUrl: string | null;
  experience: number;
  level: number;
  levelProgress: number;
  progressPercent: number;
}) {
  return (
    <section className="card-base card-padding flex flex-col items-center text-center">
      <ProfileAvatar
        userId={userId}
        username={username}
        avatarUrl={avatarUrl}
      />

      <h1 className="page-title mt-4">
        {username}
      </h1>

      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
          Level {level}
        </span>

        <span className="secondary-text">
          {experience.toLocaleString()} XP
        </span>
      </div>

      <div className="mt-5 w-full">
        <div className="secondary-text mb-2 flex items-center justify-between">
          <span>Level {level}</span>

          <span>
            {levelProgress} / 500 XP
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{
              width: `${progressPercent}%`,
            }}
          />
        </div>
      </div>
    </section>
  );
}

/* =========================================
   STATS
   ========================================= */

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone:
    | "green"
    | "red"
    | "neutral";
}) {
  const styles = {
    green: {
      wrapper:
        "border-emerald-500/20 bg-emerald-500/5",
      icon:
        "bg-emerald-500/10 text-emerald-400",
      value:
        "text-emerald-400",
    },

    red: {
      wrapper:
        "border-red-500/20 bg-red-500/5",
      icon:
        "bg-red-500/10 text-red-400",
      value:
        "text-red-400",
    },

    neutral: {
      wrapper:
        "border-border bg-surface",
      icon:
        "bg-surface-light text-text-secondary",
      value:
        "text-text",
    },
  };

  const style = styles[tone];

  return (
    <div
      className={`
        rounded-xl
        border
        p-3
        ${style.wrapper}
      `}
    >
      <div
        className={`
          flex
          h-8
          w-8
          items-center
          justify-center
          rounded-lg
          ${style.icon}
        `}
      >
        <Icon className="h-4 w-4" />
      </div>

      <p
        className={`
          mt-3
          text-xl
          font-black
          tabular-nums
          ${style.value}
        `}
      >
        {value}
      </p>

      <p className="secondary-text mt-1 truncate">
        {label}
      </p>
    </div>
  );
}

/* =========================================
   PERFORMANCE
   ========================================= */

function PerformanceRow({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  tone?: "primary" | "default";
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}

        <span className="card-title">
          {label}
        </span>
      </div>

      <span
        className={`
          shrink-0
          text-lg
          font-black
          tabular-nums
          ${
            tone === "primary"
              ? "text-primary"
              : "text-text"
          }
        `}
      >
        {value}
      </span>
    </div>
  );
}