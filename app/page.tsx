// app/page.tsx

import Link from "next/link";
import {
    ArrowRight,
    Brain,
    Gamepad2,
    Swords,
    Trophy,
    Users,
    Zap,
} from "lucide-react";

export default function LandingPage() {
    return (
        <main className="min-h-screen overflow-hidden bg-background text-text">

            {/* NAVBAR */}

            <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">

                    {/* LOGO */}

                    <Link
                        href="/"
                        className="flex items-center gap-2"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-black">
                            S
                        </div>

                        <span className="text-lg font-black tracking-tight">
                            Slagalica
                        </span>
                    </Link>

                    {/* DESKTOP NAV */}

                    <nav className="hidden items-center gap-7 md:flex">
                        <a
                            href="#kako-radi"
                            className="text-sm font-semibold text-text-secondary transition-colors hover:text-text"
                        >
                            Kako radi
                        </a>

                        <a
                            href="#igre"
                            className="text-sm font-semibold text-text-secondary transition-colors hover:text-text"
                        >
                            Igre
                        </a>

                        <a
                            href="#multiplayer"
                            className="text-sm font-semibold text-text-secondary transition-colors hover:text-text"
                        >
                            Multiplayer
                        </a>
                    </nav>

                    {/* AUTH */}

                    <div className="flex items-center gap-2">
                        <Link
                            href="/login"
                            className="hidden rounded-lg px-4 py-2 text-sm font-bold text-text-secondary transition-colors hover:bg-surface hover:text-text sm:block"
                        >
                            Prijava
                        </Link>

                        <Link
                            href="/register"
                            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Započni
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                </div>
            </header>

            {/* HERO */}

            <section className="relative flex min-h-screen items-center pt-20">

                {/* subtle background */}

                <div className="pointer-events-none absolute left-1/2 top-20 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[120px]" />

                <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">

                    {/* HERO TEXT */}

                    <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">

                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-text-secondary">
                            <Zap className="h-3.5 w-3.5 text-primary" />
                            Multiplayer kviz i logičke igre
                        </div>

                        <h1 className="text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-7xl">
                            Igraj.
                            <br />
                            <span className="text-primary">
                                Razmišljaj.
                            </span>
                            <br />
                            Pobijedi.
                        </h1>

                        <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-text-secondary sm:text-lg lg:mx-0">
                            Klasična Slagalica u modernom multiplayer
                            izdanju. Izazovi prijatelje, pronađi
                            protivnika i testiraj znanje kroz šest
                            različitih igara.
                        </p>

                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">

                            <Link
                                href="/register"
                                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Igraj besplatno
                                <ArrowRight className="h-4 w-4" />
                            </Link>

                            <Link
                                href="/login"
                                className="flex h-12 items-center justify-center rounded-xl border border-border bg-surface px-6 text-sm font-bold transition-colors hover:bg-surface-light"
                            >
                                Već imam nalog
                            </Link>

                        </div>

                        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold text-text-secondary lg:justify-start">
                            <span>✓ Besplatno</span>
                            <span>✓ Bez instalacije</span>
                            <span>✓ Radi na telefonu</span>
                        </div>

                    </div>

                    {/* GAME PREVIEW */}

                    <div className="relative mx-auto w-full max-w-lg">

                        <div className="absolute -inset-10 rounded-full bg-primary/[0.04] blur-3xl" />

                        <div className="relative overflow-hidden rounded-[28px] border border-border bg-surface shadow-2xl">

                            {/* GAME WINDOW HEADER */}

                            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                                <div className="flex gap-1.5">
                                    <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
                                    <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
                                </div>

                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                                    Slagalica
                                </span>

                                <div className="w-10" />
                            </div>

                            {/* PLAYERS */}

                            <div className="flex items-center justify-between border-b border-border px-5 py-4">

                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 font-black text-blue-400">
                                        M
                                    </div>

                                    <div>
                                        <div className="text-xs font-black">
                                            Mihajlo
                                        </div>
                                        <div className="text-[10px] text-text-secondary">
                                            42 XP
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="text-xl font-black">
                                        24
                                        <span className="mx-1.5 text-text-secondary">
                                            :
                                        </span>
                                        18
                                    </div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">
                                        Runda 2
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-xs font-black">
                                            Nikola
                                        </div>
                                        <div className="text-[10px] text-text-secondary">
                                            35 XP
                                        </div>
                                    </div>

                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 font-black text-red-400">
                                        N
                                    </div>
                                </div>

                            </div>

                            {/* MOCK GAME */}

                            <div className="p-5 sm:p-6">

                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
                                            Ko zna zna
                                        </span>

                                        <h3 className="mt-1 text-sm font-black">
                                            Koji je glavni grad Kanade?
                                        </h3>
                                    </div>

                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-sm font-black">
                                        7
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">

                                    {[
                                        "Toronto",
                                        "Ottawa",
                                        "Vancouver",
                                        "Montreal",
                                    ].map((answer, index) => (
                                        <div
                                            key={answer}
                                            className={`rounded-xl border px-4 py-3 text-left text-xs font-bold ${
                                                index === 1
                                                    ? "border-primary/50 bg-primary/10 text-primary"
                                                    : "border-border bg-background"
                                            }`}
                                        >
                                            <span className="mr-2 text-text-secondary">
                                                {String.fromCharCode(
                                                    65 + index
                                                )}
                                            </span>

                                            {answer}
                                        </div>
                                    ))}

                                </div>

                                <div className="mt-5 flex gap-2">
                                    <div className="h-1.5 flex-1 rounded-full bg-primary" />
                                    <div className="h-1.5 flex-1 rounded-full bg-primary" />
                                    <div className="h-1.5 flex-1 rounded-full bg-primary" />
                                    <div className="h-1.5 flex-1 rounded-full bg-border" />
                                    <div className="h-1.5 flex-1 rounded-full bg-border" />
                                </div>

                            </div>

                        </div>

                    </div>

                </div>
            </section>

            {/* FEATURES */}

            <section
                id="kako-radi"
                className="border-y border-border bg-surface/30 py-20 sm:py-24"
            >
                <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">

                    <div className="mx-auto max-w-2xl text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                            Kako radi
                        </span>

                        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                            Od klika do partije za par sekundi.
                        </h2>

                        <p className="mt-4 text-sm leading-6 text-text-secondary sm:text-base">
                            Nema komplikovanih lobbyja ni podešavanja.
                            Uđeš, pronađeš igrača i počinješ.
                        </p>
                    </div>

                    <div className="mt-12 grid gap-4 md:grid-cols-3">

                        <FeatureCard
                            icon={<Users className="h-5 w-5" />}
                            number="01"
                            title="Pronađi protivnika"
                            description="Matchmaking te automatski spaja sa drugim igračem koji čeka partiju."
                        />

                        <FeatureCard
                            icon={<Brain className="h-5 w-5" />}
                            number="02"
                            title="Odigraj šest igara"
                            description="Riječi, brojevi, znanje, logika i asocijacije u jednoj kompletnoj partiji."
                        />

                        <FeatureCard
                            icon={<Trophy className="h-5 w-5" />}
                            number="03"
                            title="Pobijedi"
                            description="Skupljaj poene kroz rundu i završi partiju sa većim rezultatom."
                        />

                    </div>

                </div>
            </section>

            {/* GAMES */}

            <section
                id="igre"
                className="py-20 sm:py-24"
            >
                <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">

                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">

                        <div className="max-w-xl">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                                Šest igara
                            </span>

                            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                                Jedna partija.
                                <br />
                                Šest različitih izazova.
                            </h2>
                        </div>

                        <p className="max-w-md text-sm leading-6 text-text-secondary">
                            Svaka igra testira drugačiju vještinu —
                            brzinu, znanje, vokabular, računanje ili
                            logiku.
                        </p>

                    </div>

                    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                        <GameCard
                            number="01"
                            title="Pronađi riječ"
                            description="Složi najdužu moguću riječ od ponuđenih slova."
                        />

                        <GameCard
                            number="02"
                            title="Moj broj"
                            description="Kombinuj brojeve i operacije da dođeš što bliže cilju."
                        />

                        <GameCard
                            number="03"
                            title="Skočko"
                            description="Pogodi skrivenu kombinaciju simbola."
                        />

                        <GameCard
                            number="04"
                            title="Ko zna zna"
                            description="Brzi duel opšteg znanja protiv protivnika."
                        />

                        <GameCard
                            number="05"
                            title="Spojnice"
                            description="Pronađi tačne veze između pojmova."
                        />

                        <GameCard
                            number="06"
                            title="Asocijacije"
                            description="Otvori polja, poveži pojmove i pronađi konačno rješenje."
                        />

                    </div>

                </div>
            </section>

            {/* MULTIPLAYER */}

            <section
                id="multiplayer"
                className="py-10 sm:py-16"
            >
                <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">

                    <div className="relative overflow-hidden rounded-[32px] border border-border bg-surface px-6 py-12 sm:px-10 md:px-14 md:py-16">

                        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 bg-primary/[0.07] blur-[100px]" />

                        <div className="relative grid gap-10 md:grid-cols-[1fr_auto] md:items-center">

                            <div className="max-w-2xl">

                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Swords className="h-5 w-5" />
                                </div>

                                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                                    Ne igraš protiv računara.
                                </h2>

                                <p className="mt-4 max-w-xl text-sm leading-6 text-text-secondary sm:text-base">
                                    Izazovi prijatelja ili pronađi
                                    protivnika online. Svaka odluka,
                                    pogodak i sekunda mogu odlučiti
                                    pobjednika.
                                </p>

                            </div>

                            <Link
                                href="/register"
                                className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-black text-black transition-transform hover:scale-[1.02]"
                            >
                                Napravi nalog
                                <ArrowRight className="h-4 w-4" />
                            </Link>

                        </div>

                    </div>

                </div>
            </section>

            {/* CTA */}

            <section className="py-24">
                <div className="mx-auto max-w-3xl px-5 text-center sm:px-6">

                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface text-primary">
                        <Gamepad2 className="h-6 w-6" />
                    </div>

                    <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
                        Spreman za prvu partiju?
                    </h2>

                    <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-text-secondary sm:text-base">
                        Napravi nalog, pronađi protivnika i vidi koliko
                        dobro zapravo znaš Slagalicu.
                    </p>

                    <Link
                        href="/register"
                        className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-black text-black transition-transform hover:scale-[1.02]"
                    >
                        Igraj Slagalicu
                        <ArrowRight className="h-4 w-4" />
                    </Link>

                </div>
            </section>

            {/* FOOTER */}

            <footer className="border-t border-border">
                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">

                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-black text-black">
                            S
                        </div>

                        <span className="text-sm font-black">
                            Slagalica
                        </span>
                    </div>

                    <p className="text-xs text-text-secondary">
                        Multiplayer igra znanja i logike.
                    </p>

                    <div className="flex gap-5 text-xs font-semibold text-text-secondary">
                        <Link
                            href="/login"
                            className="hover:text-text"
                        >
                            Prijava
                        </Link>

                        <Link
                            href="/register"
                            className="hover:text-text"
                        >
                            Registracija
                        </Link>
                    </div>

                </div>
            </footer>

        </main>
    );
}

function FeatureCard({
    icon,
    number,
    title,
    description,
}: {
    icon: React.ReactNode;
    number: string;
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {icon}
                </div>

                <span className="text-[10px] font-black tracking-widest text-text-secondary/50">
                    {number}
                </span>
            </div>

            <h3 className="mt-6 text-base font-black">
                {title}
            </h3>

            <p className="mt-2 text-sm leading-6 text-text-secondary">
                {description}
            </p>
        </div>
    );
}

function GameCard({
    number,
    title,
    description,
}: {
    number: string;
    title: string;
    description: string;
}) {
    return (
        <div className="group rounded-2xl border border-border bg-surface/60 p-5 transition-colors hover:bg-surface">
            <div className="flex items-start gap-4">

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-black text-primary">
                    {number}
                </span>

                <div>
                    <h3 className="text-sm font-black">
                        {title}
                    </h3>

                    <p className="mt-1.5 text-xs leading-5 text-text-secondary">
                        {description}
                    </p>
                </div>

            </div>
        </div>
    );
}