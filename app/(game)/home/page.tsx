import Link from "next/link";
import {
  Flame,
  Settings,
} from "lucide-react";

import MainHeader from "@/components/MainHeader";
import Notifications from "@/components/Notifications";
import MainLogo from "@/components/MainLogo";
import StartGame from "@/components/StartGameButton";
import PageContainer from "@/components/ui/PageContainer";

import { getCurrentUserWithProfile } from "@/data/auth";

import type { Database } from "@/types/supabase";

type Profile =
  Database["public"]["Tables"]["profiles"]["Row"];

export default async function Home() {
  const data =
    await getCurrentUserWithProfile();

  const { profile } = data;

  return (
    <PageContainer className="flex min-h-[100dvh] flex-col">
      <MainHeader
        profile={profile as Profile}
      />

      <section className="my-auto flex flex-col items-center justify-center text-center">
        <div>
          <MainLogo />

          <p className="secondary-text mt-2">
            Kviz i mozgalice
          </p>
        </div>

        <div className="mt-8 flex w-full justify-center">
          <StartGame />
        </div>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
          <Flame className="h-4 w-4 text-primary" />

          <span className="text-xs font-black text-primary">
            {profile.win_streak} pobjeda u nizu
          </span>
        </div>
      </section>

      <footer className="mt-8 flex items-center justify-center gap-6">
        <Notifications />

        <Link
          href="/settings"
          aria-label="Podešavanja"
          className="icon-button border-0 bg-transparent"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </footer>
    </PageContainer>
  );
}