// app/prijatelji/[friendId]/page.tsx

import { notFound } from "next/navigation";
import {
    ArrowLeft,
    Swords,
    Trophy,
    Handshake,
    User,
} from "lucide-react";
import Link from "next/link";

import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getCurrentUserWithProfile } from "@/data/auth";
import { GetFriendshipAndFriend } from "@/actions/friends";

interface PageProps {
    params: Promise<{
        friendId: string;
    }>;
}

export default async function FriendDetailsPage({
    params,
}: PageProps) {
    const { friendId } = await params;

    const currentUser = await getCurrentUserWithProfile();

    const myId = currentUser?.user?.id;

    const {friendship, friend} = await GetFriendshipAndFriend(friendId, myId as string)


    let friendWins = 0;
    let myWins = 0;
    let draws = friendship.draw_games;

    if(friendship.sender_id === myId) {
        myWins = friendship.sender_wins
        friendWins = friendship.receiver_wins
    }

    if(friendship.sender_id === friendId) {
        friendWins = friendship.sender_wins
        myWins = friendship.receiver_wins
    }

    const totalGames =
        friendWins +
        myWins +
        draws;

    const friendInitial =
        friend.username
            ?.charAt(0)
            .toUpperCase() || "?";

    return (
        <main className="min-h-screen bg-background text-text">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">

                {/* HEADER */}

                <div className="mb-8 flex items-center justify-between">
                    <Link
                        href="/home"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface transition-colors hover:bg-surface-light"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>

                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                        Profil igrača
                    </span>

                    <div className="h-9 w-9" />
                </div>

                {/* PROFILE */}

                <section className="flex flex-col items-center">

                    {/* AVATAR */}

                    {/* {friend.avatar_url ? (
                        <img
                            src={friend.avatar_url}
                            alt={friend.username}
                            className="h-24 w-24 rounded-full border-2 border-primary/30 object-cover shadow-lg"
                        />
                    ) :*/
                        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 text-3xl font-black text-primary shadow-lg">
                            {friendInitial}
                        </div>
                    }

                    {/* NAME */}

                    <h1 className="mt-4 text-2xl font-black tracking-tight">
                        {friend.username}
                    </h1>

                    {friend.experience !==
                        undefined && (
                        <span className="mt-1 text-xs font-semibold text-text-secondary">
                            {friend.experience} XP
                        </span>
                    )}

                    {/* INVITE */}

                    <button
                        className="cursor-pointer mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-black transition-all hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]"
                    >
                        <Swords className="h-4 w-4" />

                        Pozovi u partiju
                    </button>
                </section>

                {/* HEAD TO HEAD */}

                <section className="mt-10 rounded-3xl border border-border bg-surface p-5">

                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">
                                Head to head
                            </p>

                            <h2 className="mt-1 text-lg font-black">
                                Međusobni duel
                            </h2>
                        </div>

                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Swords className="h-4 w-4" />
                        </div>
                    </div>

                    {/* RESULTS */}

                    <div className="grid grid-cols-3 gap-2">

                        {/* FRIEND */}

                        <div className="rounded-2xl bg-red-500/5 p-4 text-center">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                                <Trophy className="h-4 w-4" />
                            </div>

                            <div className="text-2xl font-black text-red-400">
                                {friendWins}
                            </div>

                            <div className="mt-1 text-[9px] font-black uppercase tracking-wider text-text-secondary">
                                On
                            </div>
                        </div>

                        {/* DRAW */}

                        <div className="rounded-2xl bg-white/[0.03] p-4 text-center">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-text-secondary">
                                <Handshake className="h-4 w-4" />
                            </div>

                            <div className="text-2xl font-black">
                                {draws}
                            </div>

                            <div className="mt-1 text-[9px] font-black uppercase tracking-wider text-text-secondary">
                                Neriješeno
                            </div>
                        </div>

                        {/* ME */}

                        <div className="rounded-2xl bg-blue-500/5 p-4 text-center">
                            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                                <Trophy className="h-4 w-4" />
                            </div>

                            <div className="text-2xl font-black text-blue-400">
                                {myWins}
                            </div>

                            <div className="mt-1 text-[9px] font-black uppercase tracking-wider text-text-secondary">
                                Ti
                            </div>
                        </div>
                    </div>

                    {/* TOTAL */}

                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                        <span className="text-xs font-semibold text-text-secondary">
                            Ukupno odigrano
                        </span>

                        <span className="text-sm font-black">
                            {totalGames}
                        </span>
                    </div>
                </section>

                {/* EMPTY STATE */}

                {totalGames === 0 && (
                    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface/50 p-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-light text-text-secondary">
                            <User className="h-4 w-4" />
                        </div>

                        <div>
                            <p className="text-xs font-bold">
                                Još niste igrali
                            </p>

                            <p className="mt-0.5 text-[11px] text-text-secondary">
                                Pozovi ga u partiju i započnite prvi duel.
                            </p>
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}