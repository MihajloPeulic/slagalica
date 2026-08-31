import Link from "next/link";
import { PlayCircle, Flame, Settings } from "lucide-react";
import MainHeader from "@/components/MainHeader";
import Notifications from "@/components/Notifications"; 
import { getCurrentUserWithProfile } from "@/data/auth";
import { redirect } from "next/navigation";
import GameInviteListener from "@/components/GameInviteListener"; // <--- Uvezi ovde

import type { Database } from "@/types/supabase";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function Home() {

  const data = await getCurrentUserWithProfile()

  if(data?.error){
    redirect("/login?error=unauthorized")
  }
  
  const {profile} = data

  return (
    <main className="phone-frame relative flex flex-col justify-between px-6 pt-10 pb-6 min-h-[100dvh] bg-background z-0 overflow-hidden">
      
      {/* Realtime listener za pozive koji iskace preko celog ekrana */}
      <GameInviteListener currentUserId={profile.id}  />

      {/* --- POZADINSKI SJAJ (GLOW) --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-primary/15 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      {/* --- TOP NAVBAR --- */}
      <MainHeader profile={profile as Profile}></MainHeader>

      {/* --- CENTRALNI DEO (Title & CTA) --- */}
      <section className="flex flex-col items-center justify-center text-center space-y-8 z-10 my-auto">
        <div className="space-y-1.5">
          <h1 className="text-5xl font-black tracking-tight text-text drop-shadow-md">
            Slagalica
          </h1>
          <p className="text-base text-text-secondary font-medium">
            Kviz i mozgalice
          </p>
        </div>

        <Link
          href="/game/select"
          className="group relative w-full max-w-[280px] flex items-center justify-center gap-3 rounded-[2rem] bg-primary py-5 text-xl font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_50px_rgba(245,158,11,0.25)]"
        >
          <PlayCircle className="h-7 w-7 stroke-[2]" />
          Start a game
        </Link>

        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface/60 backdrop-blur-sm px-4 py-2">
          <Flame className="h-4 w-4 text-primary stroke-[2.5]" />
          <span className="text-xs font-bold tracking-wider text-primary uppercase">
            {profile.win_streak} win streak
          </span>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="flex items-center justify-center gap-8 z-10 mb-5">
        <Notifications />
        <Link
          href="/settings"
          className="text-text-secondary transition hover:text-text"
        >
          <Settings className="h-6 w-6 stroke-[1.5]" />
        </Link>
      </footer>

      {/* --- AUTOR POTPIS --- */}
      <div className="absolute bottom-1.5 left-0 right-0 text-center pointer-events-none z-10">
        <span className="text-[9px] tracking-widest text-text-secondary/25 font-light uppercase">
          Crafted by Mihajlo Peulić
        </span>
      </div>

    </main>
  );
}