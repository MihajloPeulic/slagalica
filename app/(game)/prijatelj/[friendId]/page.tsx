import {
  ShieldAlert,
  Swords,
  User,
} from "lucide-react";

import { getCurrentUserWithProfile } from "@/data/auth";
import { GetFriendshipAndFriend } from "@/actions/friends";

import InAppHeader from "@/components/ui/InAppHeader";
import PageContainer from "@/components/ui/PageContainer";
import PageSection from "@/components/ui/PageSection";
import Link from "next/link";
import ProfileStats from "@/components/ProfileStats";
import {Button} from "@/components/ui/Button";

interface PageProps {
  params: Promise<{
    friendId: string;
  }>;
}

export default async function FriendDetailsPage({
  params,
}: PageProps) {
  const { friendId } = await params;

  const currentUser =
    await getCurrentUserWithProfile();

  const myId =
    currentUser?.user?.id;

  const res = await GetFriendshipAndFriend(
    friendId
  );

  if(!res.friendship || !res.friend) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-background px-4">
            <div className="flex max-w-xs flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                    <ShieldAlert className="h-5 w-5" />
                </div>

                <p className="card-title text-red-400">
                    {res.error}
                </p>
            </div>
            <Link
                href="/home"
                className="mt-6 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
                Nazad na početnu
            </Link>
        </div>
    )}

  const { friendship, friend } = res;

  let friendWins = 0;
  let myWins = 0;

  const draws =
    friendship.draw_games;

  if (
    friendship.sender_id === myId
  ) {
    myWins =
      friendship.sender_wins;

    friendWins =
      friendship.receiver_wins;
  } else {
    friendWins =
      friendship.sender_wins;

    myWins =
      friendship.receiver_wins;
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
    <PageContainer>
      <InAppHeader
        link_to="/home"
        title="Prijatelj"
      />

      <div className="section-stack">
        <FriendProfile
          username={
            friend.username
          }
          experience={
            friend.experience
          }
          initial={
            friendInitial
          }
        />

        <PageSection title="Međusobni duel">
          <ProfileStats
            type="friend"
            wins={myWins}
            losses={friendWins}
            draws={draws}
          />
        </PageSection>

        {totalGames === 0 && (
          <EmptyHistory />
        )}
      </div>
    </PageContainer>
  );
}

/* =========================================
   PROFILE
   ========================================= */

function FriendProfile({
  username,
  experience,
  initial,
}: {
  username: string;
  experience: number;
  initial: string;
}) {
  return (
    <section className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-2xl font-black text-primary">
        {initial}
      </div>

      <h1 className="page-title mt-4">
        {username}
      </h1>

      <p className="secondary-text mt-1">
        {experience.toLocaleString()} XP
      </p>

      <Button
        type="button"
        className="mt-5"
      >
        <Swords className="h-4 w-4" />

        Pozovi u partiju
      </Button>
    </section>
  );
}

/* =========================================
   EMPTY STATE
   ========================================= */

function EmptyHistory() {
  return (
    <div className="card-base flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-light text-text-secondary">
        <User className="h-4 w-4" />
      </div>

      <div>
        <p className="card-title">
          Još niste igrali
        </p>

        <p className="secondary-text mt-1">
          Pozovi ga u partiju i
          započnite prvi duel.
        </p>
      </div>
    </div>
  );
}