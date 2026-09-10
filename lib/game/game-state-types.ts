export const GAME_EVENT_MAP = {
    rec: [
        "state_sync",
        "round_result",
    ],

    broj: [
        "state_sync",
        "round_result",
    ],

    skocko: [
        "state_sync",
        "row_check",
        "round_result",
    ],

    ko_zna_zna: [
        "state_sync",
        "question_result",
        "question_start",
        "game_result",
    ],

    spojnice: [
        "state_sync",
        "pair_attempt",
        "round_result",
    ],

    asocijacije: [
        "state_sync",
        "column_solved",
        "final_solved",
        "round_result",
    ],
} as const;

export type GameName =
    keyof typeof GAME_EVENT_MAP;

export type GameEventName =
    (typeof GAME_EVENT_MAP)[GameName][number];

export type GameProgressUpdate = {
    gameIndex?: number;
    round?: number;

    blueScore?: number;
    redScore?: number;

    /*
        Apsolutni canonical timestampovi.
        Možeš ih direktno postaviti kada već postoje.
    */
    gameStartAt?: number | null;
    headerExpiresAt?: number | null;

    /*
        Kada treba NOVI timestamp, šalji duration/delay.
        Server će koristiti svoj Date.now().
    */
    gameStartDelayMs?: number | null;
    headerDurationMs?: number | null;
};

export type SaveGameSnapshotInput = {
    roomId: string;
    game: GameName;
    round: number;
    event: string;

    /*
        Latest kompletan snapshot trenutne mini-igre.
    */
    state: Record<string, unknown>;

    /*
        Ako isti događaj mijenja i score/progress,
        može se sačuvati u ISTOM Redis write-u.
    */
    progress?: GameProgressUpdate;
};

export type SavedMiniGameSnapshot = {
    game: GameName;
    round: number;
    event: string;
    state: Record<string, unknown>;
    updatedAt: number;
};

export type RestoredGameState = {
    serverNow: number;

    progress: {
        gameIndex: number;
        round: number;

        blueScore: number;
        redScore: number;

        gameStartAt: number | null;
        headerExpiresAt: number | null;

        updatedAt: number | null;
    };

    games: Partial<
        Record<
            GameName,
            Record<
                string,
                SavedMiniGameSnapshot
            >
        >
    >;
};