export type PlayerRole = "blue" | "red";
export type GameFinishReason = "normal" | "disconnect";

export type FinalGameResult = {
    finishReason: GameFinishReason;
    winnerRole: PlayerRole | null;
    forfeitedRole: PlayerRole | null;
    blueScore: number;
    redScore: number;
    blueXpChange: number;
    redXpChange: number;
    finishedAt: string;
};
