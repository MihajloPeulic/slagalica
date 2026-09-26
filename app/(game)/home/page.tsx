import Link from "next/link";
import { Flame, Settings } from "lucide-react";

import MainHeader from "@/components/MainHeader";
import Notifications from "@/components/Notifications";
import MainLogo from "@/components/MainLogo";
import StartGame from "@/components/StartGameButton";
import PageContainer from "@/components/ui/PageContainer";

import { getCurrentUserWithProfile } from "@/data/auth";

import type { Database } from "@/types/supabase";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function Home() {
    const data = await getCurrentUserWithProfile();

    const { profile } = data;

    return (
        <PageContainer className="quiz-home flex min-h-[100dvh] flex-col">
            <MainHeader profile={profile as Profile} />

            <section className="my-auto flex items-center justify-center py-8 sm:py-10">
                <div
                    className="
            quiz-hero-disc
            relative
            flex
            aspect-square
            w-full
            max-w-[390px]
            flex-col
            items-center
            justify-center
            rounded-full
            px-5
            py-6
            text-center
          "
                >
                    <div className="w-full">
                        <MainLogo />
                    </div>

                    <div className="mt-7 flex w-[75%] justify-center">
                        <StartGame />
                    </div>

                    <div
                        className="
              mt-5
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-border
              bg-surface-light
              px-3
              py-1.5
            "
                    >
                        <Flame className="h-4 w-4 text-orange" />

                        <span className="text-xs font-black text-text-primary">
                            {profile.win_streak} pobjeda u nizu
                        </span>
                    </div>
                </div>
            </section>

            <footer className="mt-4 flex items-center justify-center gap-6 pb-2">
                <Notifications />

                <Link href="/settings" aria-label="Podešavanja" className="icon-button border-0 bg-transparent">
                    <Settings className="h-5 w-5 text-text-primary" />
                </Link>
            </footer>
        </PageContainer>
    );
}
