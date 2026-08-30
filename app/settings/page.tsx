import Link from "next/link";
import { User, ChevronRight, Settings as SettingsIcon, ChevronLeft } from "lucide-react";

import LogOutButton from "./LogOutButton";

export default function SettingsPage() {
    

    return (
        <main className="phone-frame relative flex flex-col px-6 min-h-[100dvh] bg-background z-0 overflow-hidden py-8">
            
            {/* 🌟 POZADINSKI SJAJ 🌟 */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

            {/* HEADER */}
            <header className="flex items-center gap-4 mb-10 z-10">
                <Link 
                    href="/" 
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface text-text-secondary transition hover:text-text hover:bg-surface-light shadow-sm"
                >
                    <ChevronLeft className="h-6 w-6" />
                </Link>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-text flex items-center gap-2">
                        <SettingsIcon className="h-6 w-6 text-primary" />
                        Podešavanja
                    </h1>
                </div>
            </header>

            {/* SEKCIJA SA DUGMIĆIMA */}
            <div className="flex flex-col gap-3 z-10 mt-2">
                
                {/* Account Dugme */}
                <Link 
                    href="/settings/account"
                    className="group flex items-center justify-between p-4 rounded-2xl border border-border bg-surface/80 backdrop-blur-sm transition-all hover:bg-surface-light hover:border-primary/50 shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-black transition-colors">
                            <User className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-text text-lg">Nalog</span>
                            <span className="text-sm font-medium text-text-secondary">Podesi profil i podatke</span>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-text-muted group-hover:text-primary transition-colors group-hover:translate-x-1" />
                </Link>

                {/* Razmak pre Logout dugmeta (opciono, da ga odvoji od ostalih podešavanja) */}
                <div className="h-4"></div>

                {/* Logout Dugme */}
                <LogOutButton></LogOutButton>

            </div>
        </main>
    );
}