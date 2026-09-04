import {
    Trophy,
    Flame,
    Swords,
    Target,
    Mail,
    LockKeyhole,
    UserRound,
    Gamepad2,
    ArrowLeft,
} from "lucide-react";

import { redirect } from "next/navigation";
import Link from "next/link";

import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getCurrentUserWithProfile } from "@/data/auth";
import { ProfileAvatar } from "./ProfileAvatar";
import { EditProfileField } from "./EditProfileField";

export default async function ProfilePage() {
    const supabase =
        await createServerSupabaseClient();

    const currentUser =
        await getCurrentUserWithProfile();

    const userId =
        currentUser?.user?.id;

    if (!userId) {
        redirect("/login");
    }



    let wins = currentUser.profile.wins;
    let losses = currentUser.profile.losses;
    let draws = currentUser.profile.draws;

    let highestWinStreak = currentUser.profile.highest_streak;


    const totalGames =
        wins +
        losses +
        draws;

    const winRate =
        totalGames > 0
            ? Math.round(
                  (wins / totalGames) *
                      100
              )
            : 0;

    /*
        Ako nemaš level sistem, možeš
        ovo potpuno ukloniti.
    */

    const experience =
        currentUser.profile.experience ?? 0;

    const level =
        Math.floor(
            experience / 500
        ) + 1;

    const levelProgress =
        experience % 500;

    const progressPercent =
        (levelProgress / 500) *
        100;

    const email =
        currentUser?.user?.email ?? "";

    return (
        <main className="min-h-screen bg-background text-text">

            <div className="mx-auto w-full max-w-2xl px-5 py-7">

                {/* PAGE HEADER */}

                <header className="mb-8 flex items-center justify-between">
                    <Link
                        href="/settings"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface transition-colors hover:bg-surface-light"
                        aria-label="Nazad"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>

                    <h1 className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                        Moj profil
                    </h1>

                    <div className="h-9 w-9" />
                </header>

                {/* HERO CARD */}

                <section className="relative overflow-hidden rounded-[28px] border border-border bg-surface">

                    {/* DECORATION */}

                    <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />

                    <div className="relative flex flex-col items-center px-6 pb-7 pt-8">

                        {/* AVATAR */}

                        <ProfileAvatar
                            userId={userId}
                            username={
                                currentUser.profile.username
                            }
                            avatarUrl={
                                "profile.avatar_url"
                            }
                        />

                        {/* USERNAME */}

                        <h2 className="mt-4 text-2xl font-black">
                            {currentUser.profile.username}
                        </h2>

                        <div className="mt-1 flex items-center gap-2">

                            <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                                Level {level}
                            </span>

                            <span className="text-xs font-semibold text-text-secondary">
                                {experience} XP
                            </span>

                        </div>

                        {/* LEVEL PROGRESS */}

                        <div className="mt-5 w-full max-w-sm">

                            <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-text-secondary">

                                <span>
                                    Level {level}
                                </span>

                                <span>
                                    {levelProgress} / 500 XP
                                </span>

                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-background">

                                <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{
                                        width: `${progressPercent}%`,
                                    }}
                                />

                            </div>

                        </div>

                    </div>

                </section>

                {/* STATS */}

                <section className="mt-5">

                    <div className="mb-3 flex items-center justify-between">

                        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-text-secondary">
                            Statistika
                        </h3>

                        <div className="flex items-center gap-1 text-[11px] font-bold text-text-secondary">

                            <Gamepad2 className="h-3.5 w-3.5" />

                            {totalGames} partija

                        </div>

                    </div>

                    <div className="grid grid-cols-3 gap-3">

                        {/* WINS */}

                        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">

                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                                <Trophy className="h-4 w-4" />
                            </div>

                            <div className="mt-4 text-2xl font-black text-emerald-400">
                                {wins}
                            </div>

                            <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-text-secondary">
                                Pobjede
                            </div>

                        </div>

                        {/* LOSSES */}

                        <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.06] p-4">

                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                                <Target className="h-4 w-4" />
                            </div>

                            <div className="mt-4 text-2xl font-black text-red-400">
                                {losses}
                            </div>

                            <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-text-secondary">
                                Porazi
                            </div>

                        </div>

                        {/* DRAWS */}

                        <div className="rounded-2xl border border-border bg-surface-light/40 p-4">

                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-text-secondary">
                                <Swords className="h-4 w-4" />
                            </div>

                            <div className="mt-4 text-2xl font-black">
                                {draws}
                            </div>

                            <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-text-secondary">
                                Neriješeno
                            </div>

                        </div>

                    </div>

                </section>

                {/* PERFORMANCE */}

                <section className="mt-5 rounded-3xl border border-border bg-surface p-5">

                    <div className="mb-5 flex items-center justify-between">

                        <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary">
                                Performance
                            </span>

                            <h3 className="mt-1 font-black">
                                Competitive stats
                            </h3>
                        </div>

                        <Swords className="h-5 w-5 text-primary" />

                    </div>

                    {/* STREAK */}

                    <div className="flex items-center justify-between rounded-2xl bg-orange-500/[0.07] p-4">

                        <div className="flex items-center gap-3">

                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
                                <Flame className="h-5 w-5" />
                            </div>

                            <div>

                                <div className="text-sm font-black">
                                    Highest win streak
                                </div>

                                <div className="text-[10px] text-text-secondary">
                                    Najviše uzastopnih pobjeda
                                </div>

                            </div>

                        </div>

                        <span className="text-2xl font-black text-orange-400">
                            {highestWinStreak}
                        </span>

                    </div>

                    {/* WIN RATE */}

                    <div className="mt-3 flex items-center justify-between rounded-2xl bg-background/50 p-4">

                        <div>

                            <div className="text-sm font-black">
                                Win rate
                            </div>

                            <div className="text-[10px] text-text-secondary">
                                Procenat pobjeda
                            </div>

                        </div>

                        <span className="text-xl font-black text-primary">
                            {winRate}%
                        </span>

                    </div>

                </section>

                {/* ACCOUNT */}

                <section className="mt-7">

                    <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-text-secondary">
                        Account
                    </h3>

                    <div className="overflow-hidden rounded-3xl border border-border bg-surface">

                        <EditProfileField
                            type="username"
                            label="Username"
                            value={
                                currentUser.profile.username
                            }
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
                            label="Password"
                            value="••••••••"
                            icon={
                                <LockKeyhole className="h-4 w-4" />
                            }
                        />

                    </div>

                </section>

            </div>

        </main>
    );
}