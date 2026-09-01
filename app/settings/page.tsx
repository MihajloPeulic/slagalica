import Link from "next/link";
import {
    User,
    ChevronRight,
    Settings as SettingsIcon,
    ChevronLeft,
} from "lucide-react";

import LogOutButton from "./LogOutButton";

export default function SettingsPage() {
    return (
        <main className="phone-frame relative flex min-h-[100dvh] flex-col overflow-hidden bg-background px-5 py-6 z-0">

            {/* Pozadinski sjaj */}
            <div className="absolute right-0 top-0 -z-10 h-[260px] w-[260px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

            {/* HEADER */}
            <header className="z-10 mb-7 flex items-center gap-3">
                <Link
                    href="/"
                    className="
                        flex h-9 w-9 items-center justify-center
                        rounded-xl
                        border border-border
                        bg-surface
                        text-text-secondary
                        transition
                        hover:bg-surface-light
                        hover:text-text
                    "
                >
                    <ChevronLeft className="h-4 w-4" />
                </Link>

                <div className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5 text-primary" />

                    <h1 className="text-xl font-black tracking-tight text-text">
                        Podešavanja
                    </h1>
                </div>
            </header>

            {/* SETTINGS LIST */}
            <div className="z-10 overflow-hidden rounded-2xl border border-border bg-surface/70">

                <Link
                    href="/settings/account"
                    className="
                        group
                        flex items-center justify-between
                        px-4 py-3
                        transition-colors
                        hover:bg-surface-light
                    "
                >
                    <div className="flex items-center gap-3">

                        <div
                            className="
                                flex h-8 w-8
                                items-center justify-center
                                rounded-lg
                                bg-primary/10
                                text-primary
                                transition-colors
                                group-hover:bg-primary/15
                            "
                        >
                            <User className="h-4 w-4" />
                        </div>

                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-text">
                                Nalog
                            </span>

                            <span className="text-[11px] font-medium text-text-secondary">
                                Profil i podaci
                            </span>
                        </div>

                    </div>

                    <ChevronRight
                        className="
                            h-4 w-4
                            text-text-muted
                            transition
                            group-hover:translate-x-0.5
                            group-hover:text-primary
                        "
                    />
                </Link>

            </div>

            {/* LOGOUT */}
            <div className="z-10 mt-4">
                <LogOutButton />
            </div>

        </main>
    );
}