import { Timer, User } from "lucide-react";

interface GameHeaderProps {
    player1Score: number;
    player2Score: number;
    timeLeft: number;
    isSubmitted: boolean;
    blueName: string;
    redName: string | undefined;
    role: "blue" | "red" | null;
}

export function GameHeader({
    player1Score,
    player2Score,
    timeLeft,
    isSubmitted,
    blueName,
    redName,
    role
}: GameHeaderProps) {
    return (
        <header className="flex items-center justify-between w-full z-10">
            {/* PLAVI */}
            <div
                className={`flex items-center gap-2.5 bg-surface/80 backdrop-blur-sm border px-3.5 py-2 rounded-2xl shadow-sm ${
                    role === "blue"
                        ? "border-blue-500/40"
                        : "border-border"
                }`}
            >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <User className="h-4 w-4 stroke-[2.5]" />
                </div>

                <div className="flex flex-col text-left">
                    <span className="text-[10px] font-bold text-blue-400 truncate max-w-[70px]">
                        {blueName}
                    </span>

                    <span className="text-sm font-black text-blue-500">
                        {player1Score} pts
                    </span>
                </div>
            </div>

            {/* TAJMER */}
            <div
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl border backdrop-blur-sm shadow-sm transition-colors ${
                    timeLeft <= 10 && !isSubmitted
                        ? "bg-red-500/10 border-red-500/40 text-red-500 animate-pulse"
                        : "bg-surface/80 border-border text-text"
                }`}
            >
                <Timer className="h-5 w-5 stroke-[2]" />

                <span className="text-base font-black tracking-wider">
                    0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                </span>
            </div>

            {/* CRVENI */}
            <div
                className={`flex items-center gap-2.5 bg-surface/80 backdrop-blur-sm border px-3.5 py-2 rounded-2xl shadow-sm flex-row-reverse ${
                    role === "red"
                        ? "border-red-500/40"
                        : "border-border"
                }`}
            >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                    <User className="h-4 w-4 stroke-[2.5]" />
                </div>

                <div className="flex flex-col text-right">
                    <span className="text-[10px] font-bold text-red-400 truncate max-w-[70px]">
                        {redName}
                    </span>

                    <span className="text-sm font-black text-red-500">
                        {player2Score} pts
                    </span>
                </div>
            </div>
        </header>
    );
}