"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Swords,
  X,
} from "lucide-react";

import { createClientSupabaseClient } from "@/utils/supabase/client";
import { rejectGameInvite } from "@/actions/game/game";
import { IconButton } from "@/components/ui/IconButton";

const supabase =
  createClientSupabaseClient();

interface IncomingInvite {
  roomId: string;
  username: string;
}

export default function GameInviteListener({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const router = useRouter();

  const [
    incomingInvite,
    setIncomingInvite,
  ] =
    useState<IncomingInvite | null>(
      null,
    );

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(
        `invites_${currentUserId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_rooms",
          filter: `player_red_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newRoom =
            payload.new as {
              id: string;
              blue_name: string;
              status: string;
            };

          if (
            newRoom.status !== "waiting"
          ) {
            return;
          }

          setIncomingInvite({
            roomId: newRoom.id,
            username:
              newRoom.blue_name,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel,
      );
    };
  }, [currentUserId]);

  if (!incomingInvite) {
    return null;
  }

  function handleAccept() {
    router.push(
      `/igra/${incomingInvite!.roomId}`,
    );

    setIncomingInvite(null);
  }

  async function handleReject() {
    await rejectGameInvite(
      incomingInvite!.roomId,
    );

    setIncomingInvite(null);
  }

  return (
    <div className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="card-base flex items-center gap-3 p-3 shadow-lg">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Swords className="h-4 w-4" />
          </div>

          <p className="body-text min-w-0 leading-snug">
            <span className="font-black text-primary">
              {
                incomingInvite.username
              }
            </span>{" "}
            vas izaziva na meč.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleAccept}
            aria-label="Prihvati izazov"
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              border
              border-success/30
              bg-success/10
              text-success
              transition-colors
              hover:bg-success/20
              active:scale-[0.98]
            "
          >
            <Check className="h-4 w-4 stroke-[3]" />
          </button>

          <IconButton
            type="button"
            label="Odbij izazov"
            onClick={handleReject}
            className="
              h-9
              w-9
              border-red-player/25
              bg-red-player/10
              text-red-player
              hover:border-red-player/30
              hover:bg-red-player/20
              hover:text-red-player
            "
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}