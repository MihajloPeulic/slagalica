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
        <header
            className="
                z-10
                grid
                w-full
                grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]
                items-center
                gap-2
                sm:gap-3
            "
        >
            {/* PLAVI */}
            <div className="flex min-w-0 justify-start">
                <div
                    className={`
                        flex
                        min-w-0
                        w-full
                        max-w-[150px]
                        items-center
                        gap-2
                        rounded-2xl
                        border
                        bg-surface/80
                        px-2.5
                        py-2
                        shadow-sm
                        backdrop-blur-sm
                        transition-colors

                        sm:max-w-[170px]
                        sm:gap-2.5
                        sm:px-3.5

                        ${
                            role === "blue"
                                ? "border-blue-player/40"
                                : "border-border"
                        }
                    `}
                >
                    <div
                        className="
                            flex
                            h-9
                            w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            border
                            border-blue-player/20
                            bg-blue-player/10
                            text-blue-player
                        "
                    >
                        <User className="h-4 w-4 stroke-[2.5]" />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                        <span
                            className="
                                block
                                truncate
                                text-xs
                                font-bold
                                text-blue-player
                            "
                            title={blueName}
                        >
                            {blueName}
                        </span>

                        <span
                            className="
                                block
                                whitespace-nowrap
                                text-sm
                                font-black
                                text-blue-player
                            "
                        >
                            {player1Score} pts
                        </span>
                    </div>
                </div>
            </div>

            {/* TAJMER */}
            <div
                className={`
                    flex
                    shrink-0
                    items-center
                    gap-1.5
                    rounded-2xl
                    border
                    px-3
                    py-2
                    shadow-sm
                    backdrop-blur-sm
                    transition-colors

                    sm:gap-2
                    sm:px-4

                    ${
                        timeLeft <= 10 && !isSubmitted
                            ? "animate-pulse border-red-player/40 bg-red-player/10 text-red-player"
                            : "border-border bg-surface/80 text-text"
                    }
                `}
            >
                <Timer className="h-4 w-4 stroke-[2] sm:h-5 sm:w-5" />

                <span className="text-sm font-black tabular-nums tracking-wider sm:text-base">
                    0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                </span>
            </div>

            {/* CRVENI */}
            <div className="flex min-w-0 justify-end">
                <div
                    className={`
                        flex
                        min-w-0
                        w-full
                        max-w-[150px]
                        flex-row-reverse
                        items-center
                        gap-2
                        rounded-2xl
                        border
                        bg-surface/80
                        px-2.5
                        py-2
                        shadow-sm
                        backdrop-blur-sm
                        transition-colors

                        sm:max-w-[170px]
                        sm:gap-2.5
                        sm:px-3.5

                        ${
                            role === "red"
                                ? "border-red-player/40"
                                : "border-border"
                        }
                    `}
                >
                    <div
                        className="
                            flex
                            h-9
                            w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            border
                            border-red-player/20
                            bg-red-player/10
                            text-red-player
                        "
                    >
                        <User className="h-4 w-4 stroke-[2.5]" />
                    </div>

                    <div className="min-w-0 flex-1 text-right">
                        <span
                            className="
                                block
                                truncate
                                text-xs
                                font-bold
                                text-red-player
                            "
                            title={redName ?? ""}
                        >
                            {redName ?? "Protivnik"}
                        </span>

                        <span
                            className="
                                block
                                whitespace-nowrap
                                text-sm
                                font-black
                                text-red-player
                            "
                        >
                            {player2Score} pts
                        </span>
                    </div>
                </div>
            </div>
        </header>
    );
}