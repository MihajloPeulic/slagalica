"use client";

import {
  Award,
  Trophy,
  Users,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import FriendsModal from "./FriendsModal";
import LeaderboardModal from "./LeaderboardModal";

import { IconButton } from "@/components/ui/IconButton";

import type { Database } from "@/types/supabase";

type Profile =
  Database["public"]["Tables"]["profiles"]["Row"];

export default function MainHeader({
  profile,
}: {
  profile: Profile;
}) {
  const [frModal, setFrModal] =
    useState(false);

  const [ldModal, setLdModal] =
    useState(false);

  const headerRef =
    useRef<HTMLElement>(null);

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent,
    ) {
      if (
        headerRef.current &&
        !headerRef.current.contains(
          event.target as Node,
        )
      ) {
        setFrModal(false);
        setLdModal(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  function toggleLeaderboard() {
    setLdModal((prev) => !prev);
    setFrModal(false);
  }

  function toggleFriends() {
    setFrModal((prev) => !prev);
    setLdModal(false);
  }

  return (
    <header
      ref={headerRef}
      className="relative z-50"
    >
      <div className="flex items-center justify-between">
        {/* LEADERBOARD */}
        <div className="relative">
          <IconButton
            type="button"
            label="Leaderboard"
            onClick={toggleLeaderboard}
            className={`
              h-11
              w-11
              ${
                ldModal
                  ? "border-primary/40 bg-surface-light text-primary"
                  : ""
              }
            `}
          >
            <Trophy className="h-4 w-4" />
          </IconButton>

          {ldModal && (
            <div className="absolute left-0 top-[calc(100%+0.75rem)] z-[100]">
              <LeaderboardModal />
            </div>
          )}
        </div>

        {/* XP */}
        <div className="flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4">
          <Award className="h-4 w-4 text-primary" />

          <span className="text-sm font-black tabular-nums text-primary">
            {profile.experience.toLocaleString()} XP
          </span>
        </div>

        {/* FRIENDS */}
        <div className="relative">
          <IconButton
            type="button"
            label="Prijatelji"
            onClick={toggleFriends}
            className={`
              h-11
              w-11
              ${
                frModal
                  ? "border-primary/40 bg-surface-light text-primary"
                  : ""
              }
            `}
          >
            <Users className="h-4 w-4" />
          </IconButton>

          {frModal && (
            <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[100]">
              <FriendsModal />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}