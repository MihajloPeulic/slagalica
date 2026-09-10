"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles, Check, Loader2 } from "lucide-react";
import { verifyWordAction } from "@/data/game/slagalica";
import { saveGameSnapshotAction } from "@/actions/game/game-state";
import { RoundIntermission } from "@/game_components/RoundIntermission";

interface LetterTile {
    id: string;
    value: string;
    used: boolean;
}

interface Data {
    slova: LetterTile[];
    najduza_rec: string | null;
}

interface ScoreBreakdown {
    letters: number;
    longerWordBonus: number;
    roundAdvantageBonus: number;
    computerBonus: number;
}

interface RoundSummary {
    blueWord: string;
    redWord: string;
    isBlueValid: boolean;
    isRedValid: boolean;
    bluePts: number;
    redPts: number;
    blueBreakdown: ScoreBreakdown;
    redBreakdown: ScoreBreakdown;
    longestWord: string;
}

interface PronadjiRecProps {
    roomId: string;
    myRole: "blue" | "red";
    syncEpoch?: number;
    preferPeerSync?: boolean;
    isPaused?: boolean;
    pauseVersion?: number;
    resumeShiftMs?: number;
    onPeerSyncComplete?: () => void;
    round: number;
    tiles: Data;
    initialState?: any;
    sendBroadcast: (payload: any) => void;
    incomingBroadcast?: any;
    onScoreSubmit: (bluePoints: number, redPoints: number) => void;
    onNextRound: () => void;
    onTimerTick: (timeLeft: number) => void;
}

function calculateSlagalicaScores(
    blueLen: number,
    isBlueValid: boolean,
    redLen: number,
    isRedValid: boolean,
    compLen: number,
    round: number
) {
    const blueBreakdown: ScoreBreakdown = {
        letters: blueLen,
        longerWordBonus: 0,
        roundAdvantageBonus: 0,
        computerBonus: 0,
    };

    const redBreakdown: ScoreBreakdown = {
        letters: redLen,
        longerWordBonus: 0,
        roundAdvantageBonus: 0,
        computerBonus: 0,
    };

    if (blueLen > redLen) {
        blueBreakdown.longerWordBonus = 6;
    } else if (redLen > blueLen) {
        redBreakdown.longerWordBonus = 6;
    } else if (blueLen === redLen && blueLen > 0 && isBlueValid && isRedValid) {
        if (round === 1) {
            blueBreakdown.roundAdvantageBonus = 6;
        } else {
            redBreakdown.roundAdvantageBonus = 6;
        }
    }

    if (isBlueValid && blueLen > 0 && compLen > 0) {
        if (blueLen > compLen) {
            blueBreakdown.computerBonus = 6;
        } else if (blueLen === compLen) {
            blueBreakdown.computerBonus = 3;
        }
    }

    if (isRedValid && redLen > 0 && compLen > 0) {
        if (redLen > compLen) {
            redBreakdown.computerBonus = 6;
        } else if (redLen === compLen) {
            redBreakdown.computerBonus = 3;
        }
    }

    const bluePoints =
        blueBreakdown.letters +
        blueBreakdown.longerWordBonus +
        blueBreakdown.roundAdvantageBonus +
        blueBreakdown.computerBonus;

    const redPoints =
        redBreakdown.letters +
        redBreakdown.longerWordBonus +
        redBreakdown.roundAdvantageBonus +
        redBreakdown.computerBonus;

    return {
        bluePoints,
        redPoints,
        blueBreakdown,
        redBreakdown,
    };
}

export function PronadjiRec({
    roomId,
    myRole,
    syncEpoch = 0,
    preferPeerSync = false,
    isPaused = false,
    pauseVersion = 0,
    resumeShiftMs = 0,
    onPeerSyncComplete,
    round,
    tiles: initialTiles,
    initialState,
    sendBroadcast,
    incomingBroadcast,
    onScoreSubmit,
    onNextRound,
    onTimerTick,
}: PronadjiRecProps) {
    const [phase, setPhase] = useState<"selecting" | "playing" | "calculating" | "intermission">("selecting");

    const roundStarter: "blue" | "red" = round === 1 ? "blue" : "red";
    const isRoundStarter = myRole === roundStarter;

    // 5 sekundi za "izbor" slova. Prava slova su već predgenerisana.
    const [selectionExpiresAt, setSelectionExpiresAt] = useState(() => Date.now() + 5 * 1000);

    // Timestamp kada timer igre ističe.
    const [gameExpiresAt, setGameExpiresAt] = useState(0);
    const [intermissionExpiresAt, setIntermissionExpiresAt] = useState(0);

    // Ovo je samo za prikaz u UI-u.
    const [intermissionTimeLeft, setIntermissionTimeLeft] = useState(10);

    const [tiles, setTiles] = useState<LetterTile[]>(
        () => initialTiles?.slova?.map((tile) => ({ ...tile, used: false })) ?? []
    );
    const [rollingLetters, setRollingLetters] = useState<string[]>(() => Array.from({ length: 12 }, () => "A"));
    const [history, setHistory] = useState<{ value: string; tileId: string }[]>([]);
    const [myWord, setMyWord] = useState("");
    const [opponentWord, setOpponentWord] = useState<string | null>(null);
    const [isMySubmitted, setIsMySubmitted] = useState(false);
    const [isOpponentSubmitted, setIsOpponentSubmitted] = useState(false);

    const [isChecking, setIsChecking] = useState(false);
    const [wordStatus, setWordStatus] = useState<"TAČNO" | "NETAČNO" | null>(null);

    const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);

    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressRef = useRef(false);
    const isProcessingRoundRef = useRef(false);
    const hasPersistedRoundRef = useRef(false);

    // RED je klijent koji traži canonical mini-game state od BLUE-a.
    // Retry zatvara race condition kada se obje komponente mountaju skoro istovremeno.
    const hasReceivedInitialSyncRef = useRef(false);
    const syncRequestIdRef = useRef<string | null>(null);
    const syncRetryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const snapshotSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
    const isSyncReadyRef = useRef(false);
    const lastAppliedPauseVersionRef = useRef(pauseVersion);

    /*
        RED nakon full refresha nema canonical mini-game state u memoriji.
        Dok ne stigne SYNC_RESPONSE od BLUE-a ne prikazujemo fresh/default
        "selecting" state, jer to vizuelno izgleda kao restart runde.
    */
    const [isAwaitingCanonicalSync, setIsAwaitingCanonicalSync] = useState(
        myRole === "red" || (myRole === "blue" && preferPeerSync)
    );

    const localDraftKey = `game-draft:${roomId}:rec:r${round}:${myRole}`;

    const currentWord = history.map((item) => item.value).join("");

    /*
        Snapshot se koristi zato što broadcast listener ne treba da zavisi
        od React closure state-a koji može biti zastario.
    */
    const gameSnapshot = useRef({
        phase,
        selectionExpiresAt,
        gameExpiresAt,
        intermissionExpiresAt,
        myWord,
        opponentWord,
        isMySubmitted,
        isOpponentSubmitted,
        roundSummary,
    });

    function restoreLocalDraft() {
        if (typeof window === "undefined") return;

        try {
            const raw = window.localStorage.getItem(localDraftKey);
            if (!raw) return;

            const parsed = JSON.parse(raw) as {
                history?: Array<{ value: string; tileId: string }>;
            };

            if (!Array.isArray(parsed.history)) return;

            const availableTiles = initialTiles?.slova ?? [];
            const tileMap = new Map(availableTiles.map((tile) => [tile.id, tile]));
            const usedIds = new Set<string>();
            const restoredHistory: { value: string; tileId: string }[] = [];

            for (const item of parsed.history) {
                if (
                    !item ||
                    typeof item.tileId !== "string" ||
                    typeof item.value !== "string" ||
                    usedIds.has(item.tileId)
                ) {
                    continue;
                }

                const tile = tileMap.get(item.tileId);
                if (!tile || tile.value !== item.value) continue;

                usedIds.add(item.tileId);
                restoredHistory.push({ value: item.value, tileId: item.tileId });
            }

            setHistory(restoredHistory);
            setTiles(
                availableTiles.map((tile) => ({
                    ...tile,
                    used: usedIds.has(tile.id),
                }))
            );
        } catch (error) {
            console.error("Ne mogu vratiti lokalni draft riječi:", error);
        }
    }

    function clearLocalDraft() {
        if (typeof window === "undefined") return;

        try {
            window.localStorage.removeItem(localDraftKey);
        } catch {
            // localStorage može biti blokiran; gameplay i dalje radi.
        }
    }

    function queueSnapshotSave(task: () => Promise<unknown>) {
        const nextSave = snapshotSaveQueueRef.current
            .catch(() => undefined)
            .then(async () => {
                await task();
            });

        snapshotSaveQueueRef.current = nextSave;
        return nextSave;
    }

    async function persistTimerState(state: {
        phase: "selecting" | "playing";
        selectionExpiresAt: number;
        gameExpiresAt: number;
        intermissionExpiresAt?: number;
        myWord?: string;
        opponentWord?: string | null;
        isMySubmitted?: boolean;
        isOpponentSubmitted?: boolean;
        roundSummary?: RoundSummary | null;
    }) {
        if (myRole !== "blue") return;

        try {
            await queueSnapshotSave(() =>
                saveGameSnapshotAction({
                    roomId,
                    game: "rec",
                    round,
                    event: "state_sync",
                    state: {
                        completed: false,
                        phase: state.phase,
                        selectionExpiresAt: state.selectionExpiresAt,
                        gameExpiresAt: state.gameExpiresAt,
                        intermissionExpiresAt: state.intermissionExpiresAt ?? 0,
                        myWord: state.myWord ?? "",
                        opponentWord: state.opponentWord ?? null,
                        isMySubmitted: state.isMySubmitted ?? false,
                        isOpponentSubmitted: state.isOpponentSubmitted ?? false,
                        roundSummary: state.roundSummary ?? null,
                    },
                })
            );
        } catch (error) {
            console.error("Ne mogu sačuvati timer Pronađi riječ runde:", error);
        }
    }

    // 1. RESET / REDIS RESTORE NA POČETKU NOVE RUNDE
    // initialTiles je već razriješen prije renderovanja komponente.
    useEffect(() => {
        setTiles(
            initialTiles?.slova?.map((tile) => ({
                ...tile,
                used: false,
            })) ?? []
        );

        setHistory([]);
        setWordStatus(null);
        setIsChecking(false);
        setRollingLetters(Array.from({ length: 12 }, () => "A"));
        setIntermissionTimeLeft(10);

        isProcessingRoundRef.current = false;
        hasPersistedRoundRef.current = false;
        hasReceivedInitialSyncRef.current = false;
        syncRequestIdRef.current = null;
        isSyncReadyRef.current = false;
        setIsAwaitingCanonicalSync(myRole === "red" || (myRole === "blue" && preferPeerSync));

        if (
            myRole === "blue" &&
            !preferPeerSync &&
            initialState &&
            initialState.completed !== true &&
            (initialState.phase === "selecting" || initialState.phase === "playing")
        ) {
            const restoredPhase: "selecting" | "playing" = initialState.phase;
            const restoredSelectionExpiresAt =
                typeof initialState.selectionExpiresAt === "number"
                    ? initialState.selectionExpiresAt
                    : Date.now() + 5 * 1000;
            const restoredGameExpiresAt =
                typeof initialState.gameExpiresAt === "number" ? initialState.gameExpiresAt : 0;
            const restoredIntermissionExpiresAt =
                typeof initialState.intermissionExpiresAt === "number" ? initialState.intermissionExpiresAt : 0;
            const restoredMyWord = typeof initialState.myWord === "string" ? initialState.myWord : "";
            const restoredOpponentWord =
                typeof initialState.opponentWord === "string" ? initialState.opponentWord : null;
            const restoredIsMySubmitted = !!initialState.isMySubmitted;
            const restoredIsOpponentSubmitted = !!initialState.isOpponentSubmitted;
            const restoredRoundSummary = initialState.roundSummary ?? null;

            setPhase(restoredPhase);
            setSelectionExpiresAt(restoredSelectionExpiresAt);
            setGameExpiresAt(restoredGameExpiresAt);
            setIntermissionExpiresAt(restoredIntermissionExpiresAt);
            setMyWord(restoredMyWord);
            setOpponentWord(restoredOpponentWord);
            setIsMySubmitted(restoredIsMySubmitted);
            setIsOpponentSubmitted(restoredIsOpponentSubmitted);
            setRoundSummary(restoredRoundSummary);

            gameSnapshot.current = {
                phase: restoredPhase,
                selectionExpiresAt: restoredSelectionExpiresAt,
                gameExpiresAt: restoredGameExpiresAt,
                intermissionExpiresAt: restoredIntermissionExpiresAt,
                myWord: restoredMyWord,
                opponentWord: restoredOpponentWord,
                isMySubmitted: restoredIsMySubmitted,
                isOpponentSubmitted: restoredIsOpponentSubmitted,
                roundSummary: restoredRoundSummary,
            };

            isSyncReadyRef.current = true;

            if (restoredPhase === "playing" && !restoredIsMySubmitted) {
                restoreLocalDraft();
            } else if (restoredIsMySubmitted) {
                clearLocalDraft();
            }

            return;
        }

        if (myRole === "red" || (myRole === "blue" && preferPeerSync)) {
            /*
                Refresh/reconnect: ne kreiramo fresh rundu prije peer synca.
                Ako je BLUE refreshao, živi RED je source. Ako su oba
                refresala, parent će BLUE-u dati Redis fallback pa će se
                komponenta ponovo mountovati sa initialState-om.
            */
            return;
        }

        const initialSelectionExpiresAt = Date.now() + 5 * 1000;

        setMyWord("");
        setOpponentWord(null);
        setIsMySubmitted(false);
        setIsOpponentSubmitted(false);
        setRoundSummary(null);
        setPhase("selecting");
        setSelectionExpiresAt(initialSelectionExpiresAt);
        setGameExpiresAt(0);
        setIntermissionExpiresAt(0);

        if (myRole === "blue") {
            gameSnapshot.current = {
                phase: "selecting",
                selectionExpiresAt: initialSelectionExpiresAt,
                gameExpiresAt: 0,
                intermissionExpiresAt: 0,
                myWord: "",
                opponentWord: null,
                isMySubmitted: false,
                isOpponentSubmitted: false,
                roundSummary: null,
            };

            isSyncReadyRef.current = true;

            void persistTimerState({
                phase: "selecting",
                selectionExpiresAt: initialSelectionExpiresAt,
                gameExpiresAt: 0,
            });
        }
        /*
        VAŽNO:
        Resetujemo samo kada se stvarno promijeni room/runda/role.

        initialTiles i initialState su objekti. game_rooms UPDATE zbog
        disconnect claim/cancel može vratiti isti sadržaj kao novi JS objekat.
        Da su u dependency listi, React bi tada obrisao history/tiles i
        vratio Pronađi riječ na početak iako runda nije promijenjena.
    */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, round, myRole]);

    // 2. SNAPSHOT UVIJEK DRŽI NAJNOVIJE STANJE
    useEffect(() => {
        gameSnapshot.current = {
            phase,
            selectionExpiresAt,
            gameExpiresAt,
            intermissionExpiresAt,
            myWord,
            opponentWord,
            isMySubmitted,
            isOpponentSubmitted,
            roundSummary,
        };
    }, [
        phase,
        selectionExpiresAt,
        gameExpiresAt,
        intermissionExpiresAt,
        myWord,
        opponentWord,
        isMySubmitted,
        isOpponentSubmitted,
        roundSummary,
    ]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        if (phase === "playing" && !isMySubmitted) {
            try {
                window.localStorage.setItem(localDraftKey, JSON.stringify({ history }));
            } catch {
                // localStorage je best-effort reconnect cache.
            }

            return;
        }

        if (isMySubmitted || phase === "calculating" || phase === "intermission") {
            clearLocalDraft();
        }
    }, [history, phase, isMySubmitted, localDraftKey]);

    function clearSyncRetryTimers() {
        syncRetryTimersRef.current.forEach((timer) => clearTimeout(timer));
        syncRetryTimersRef.current = [];
    }

    function sendInitialSyncRequest() {
        if (!(myRole === "red" || (myRole === "blue" && preferPeerSync)) || hasReceivedInitialSyncRef.current) {
            return;
        }

        if (!syncRequestIdRef.current) {
            syncRequestIdRef.current = `${Date.now()}-${myRole}-${round}-${syncEpoch}-${Math.random().toString(36).slice(2)}`;
        }

        sendBroadcast({
            type: "SYNC_REQUEST",
            role: myRole,
            round,
            requestId: syncRequestIdRef.current,
        });
    }

    // 3. RED TRAŽI CANONICAL STATE OD BLUE-A.
    // Ako prvi request ode prije nego što je BLUE listener spreman,
    // pokušavamo ponovo nakon 500 ms i 1500 ms.
    useEffect(() => {
        clearSyncRetryTimers();
        hasReceivedInitialSyncRef.current = false;

        if (!(myRole === "red" || (myRole === "blue" && preferPeerSync))) {
            setIsAwaitingCanonicalSync(false);
            return;
        }

        setIsAwaitingCanonicalSync(true);
        sendInitialSyncRequest();

        const retry500 = setTimeout(sendInitialSyncRequest, 500);

        const retry1500 = setTimeout(sendInitialSyncRequest, 1_500);
        const retry3000 = setTimeout(sendInitialSyncRequest, 3_000);

        const retry5000 = setTimeout(sendInitialSyncRequest, 5_000);

        const retry8000 = setTimeout(sendInitialSyncRequest, 8_000);

        syncRetryTimersRef.current = [retry500, retry1500, retry3000, retry5000, retry8000];

        return () => {
            clearSyncRetryTimers();
            hasReceivedInitialSyncRef.current = false;
            syncRequestIdRef.current = null;
        };
    }, [myRole, round, syncEpoch, preferPeerSync]);

    // 4. BROADCAST LISTENER
    useEffect(() => {
        if (!incomingBroadcast) return;

        if (incomingBroadcast.type === "SUBMIT_WORD") {
            if (incomingBroadcast.role === myRole) return;
            if (typeof incomingBroadcast.round === "number" && incomingBroadcast.round !== round) return;

            setOpponentWord(incomingBroadcast.word);
            setIsOpponentSubmitted(true);
            return;
        }

        if (incomingBroadcast.type === "LETTERS_STOP") {
            if (incomingBroadcast.role === myRole) return;
            if (typeof incomingBroadcast.round === "number" && incomingBroadcast.round !== round) return;

            const nextGameExpiresAt =
                typeof incomingBroadcast.gameExpiresAt === "number"
                    ? incomingBroadcast.gameExpiresAt
                    : Date.now() + 60 * 1000;

            setGameExpiresAt(nextGameExpiresAt);
            setPhase("playing");

            gameSnapshot.current = {
                ...gameSnapshot.current,
                phase: "playing",
                gameExpiresAt: nextGameExpiresAt,
            };

            if (myRole === "blue") {
                void persistTimerState({
                    phase: "playing",
                    selectionExpiresAt: gameSnapshot.current.selectionExpiresAt,
                    gameExpiresAt: nextGameExpiresAt,
                    intermissionExpiresAt: gameSnapshot.current.intermissionExpiresAt,
                    myWord: gameSnapshot.current.myWord,
                    opponentWord: gameSnapshot.current.opponentWord,
                    isMySubmitted: gameSnapshot.current.isMySubmitted,
                    isOpponentSubmitted: gameSnapshot.current.isOpponentSubmitted,
                    roundSummary: gameSnapshot.current.roundSummary,
                });
            }

            return;
        }

        if (incomingBroadcast.type === "SYNC_RESPONSE") {
            if (
                typeof incomingBroadcast.requestId !== "string" ||
                incomingBroadcast.requestId !== syncRequestIdRef.current
            ) {
                return;
            }

            if (incomingBroadcast.role === myRole || !(myRole === "red" || (myRole === "blue" && preferPeerSync))) {
                return;
            }

            if (typeof incomingBroadcast.round === "number" && incomingBroadcast.round !== round) return;

            hasReceivedInitialSyncRef.current = true;
            syncRequestIdRef.current = null;
            clearSyncRetryTimers();
            setIsAwaitingCanonicalSync(false);
            isSyncReadyRef.current = true;

            onPeerSyncComplete?.();

            /*
                opponentWord koji šalje protivnik = njegova riječ.
                myWord koji šalje protivnik = riječ koju on ima spremljenu
                kao našu riječ.

                Ovo omogućava da nakon refresha vratimo i činjenicu
                da smo MI već submitovali.
            */
            if (typeof incomingBroadcast.myWord === "string") {
                setMyWord(incomingBroadcast.myWord);
            }

            if (typeof incomingBroadcast.opponentWord === "string") {
                setOpponentWord(incomingBroadcast.opponentWord);
            } else {
                setOpponentWord(null);
            }

            setIsMySubmitted(!!incomingBroadcast.isMySubmitted);
            setIsOpponentSubmitted(!!incomingBroadcast.isOpponentSubmitted);

            if (
                incomingBroadcast.phase === "selecting" ||
                incomingBroadcast.phase === "playing" ||
                incomingBroadcast.phase === "calculating" ||
                incomingBroadcast.phase === "intermission"
            ) {
                setPhase(incomingBroadcast.phase);
            }

            if (typeof incomingBroadcast.selectionExpiresAt === "number") {
                setSelectionExpiresAt(incomingBroadcast.selectionExpiresAt);
            }

            if (typeof incomingBroadcast.gameExpiresAt === "number") {
                setGameExpiresAt(incomingBroadcast.gameExpiresAt);
            }

            if (typeof incomingBroadcast.intermissionExpiresAt === "number") {
                setIntermissionExpiresAt(incomingBroadcast.intermissionExpiresAt);
            }

            if (incomingBroadcast.roundSummary) {
                setRoundSummary(incomingBroadcast.roundSummary);
            }

            if (incomingBroadcast.phase === "playing" && !incomingBroadcast.isMySubmitted) {
                restoreLocalDraft();
            } else if (incomingBroadcast.isMySubmitted) {
                clearLocalDraft();
            }

            return;
        }

        if (incomingBroadcast.type === "SYNC_REQUEST") {
            // Bilo koji već spreman peer odgovara refresanom protivniku.
            if (incomingBroadcast.role === myRole || !isSyncReadyRef.current) {
                return;
            }

            if (typeof incomingBroadcast.round === "number" && incomingBroadcast.round !== round) return;

            const snapshot = gameSnapshot.current;

            sendBroadcast({
                type: "SYNC_RESPONSE",
                role: myRole,
                round,
                requestId: incomingBroadcast.requestId,
                phase: snapshot.phase,
                selectionExpiresAt: snapshot.selectionExpiresAt,
                gameExpiresAt: snapshot.gameExpiresAt,
                intermissionExpiresAt: snapshot.intermissionExpiresAt,

                /*
                    Iz perspektive igrača koji traži sync:

                    snapshot.opponentWord = njegova riječ
                    snapshot.myWord = naša riječ
                */
                myWord: snapshot.opponentWord ?? "",
                opponentWord: snapshot.myWord,

                isMySubmitted: snapshot.isOpponentSubmitted,
                isOpponentSubmitted: snapshot.isMySubmitted,

                roundSummary: snapshot.roundSummary,
            });
        }
    }, [incomingBroadcast, myRole, round]);

    /*
        Kada se disconnect claim poništi, SQL daje tačan duration pauze.
        Pomjeramo sve aktivne deadline timestampove za isti broj ms.
        Zato se runda nastavlja sa ISTIM preostalim vremenom.
    */
    useEffect(() => {
        if (pauseVersion <= lastAppliedPauseVersionRef.current) return;

        lastAppliedPauseVersionRef.current = pauseVersion;

        if (!Number.isFinite(resumeShiftMs) || resumeShiftMs <= 0) return;

        const snapshot = gameSnapshot.current;
        const resumeNow = Date.now();
        const pauseStartedAt = resumeNow - resumeShiftMs;

        const shiftActiveDeadline = (value: number, maxDurationMs: number) => {
            if (value <= 0 || value <= pauseStartedAt) {
                return value;
            }

            /*
                Timer koji je već postojao na početku pauze može imati
                najviše maxDurationMs preostalog vremena. Ako je razlika
                veća od maksimuma, timer je kreiran tokom/poslije pauze
                (npr. nova runda) i staru pauzu NE dodajemo na njega.
            */
            const remainingWhenPauseStarted = value - pauseStartedAt;

            if (remainingWhenPauseStarted > maxDurationMs + 250) {
                return value;
            }

            return Math.min(value + resumeShiftMs, resumeNow + maxDurationMs);
        };

        let shiftedSelection = snapshot.selectionExpiresAt;
        let shiftedGame = snapshot.gameExpiresAt;
        let shiftedIntermission = snapshot.intermissionExpiresAt;

        /*
            Shiftujemo SAMO timer trenutne faze.
            Ako nova runda već ima fresh 60s timer kada pause_version stigne,
            cap ga ostavlja na maksimalno 60s umjesto 60s + trajanje pauze.
        */
        if (snapshot.phase === "selecting") {
            shiftedSelection = shiftActiveDeadline(snapshot.selectionExpiresAt, 5_000);
        } else if (snapshot.phase === "playing") {
            shiftedGame = shiftActiveDeadline(snapshot.gameExpiresAt, 60_000);
        } else if (snapshot.phase === "intermission") {
            shiftedIntermission = shiftActiveDeadline(snapshot.intermissionExpiresAt, 10_000);
        }

        setSelectionExpiresAt(shiftedSelection);
        setGameExpiresAt(shiftedGame);
        setIntermissionExpiresAt(shiftedIntermission);

        gameSnapshot.current = {
            ...snapshot,
            selectionExpiresAt: shiftedSelection,
            gameExpiresAt: shiftedGame,
            intermissionExpiresAt: shiftedIntermission,
        };

        if (
            myRole === "blue" &&
            isSyncReadyRef.current &&
            (snapshot.phase === "selecting" || snapshot.phase === "playing")
        ) {
            void persistTimerState({
                phase: snapshot.phase,
                selectionExpiresAt: shiftedSelection,
                gameExpiresAt: shiftedGame,
                intermissionExpiresAt: shiftedIntermission,
                myWord: snapshot.myWord,
                opponentWord: snapshot.opponentWord,
                isMySubmitted: snapshot.isMySubmitted,
                isOpponentSubmitted: snapshot.isOpponentSubmitted,
                roundSummary: snapshot.roundSummary,
            });
        }
    }, [pauseVersion, resumeShiftMs, myRole]);

    // 5. VIZUELNO "MIJEŠANJE" SLOVA
    useEffect(() => {
        if (phase !== "selecting" || isPaused) return;

        const visualAlphabet = [
            "A",
            "E",
            "I",
            "O",
            "U",
            "N",
            "R",
            "S",
            "T",
            "K",
            "L",
            "J",
            "V",
            "D",
            "P",
            "C",
            "M",
            "B",
            "G",
            "Z",
            "Š",
            "Č",
            "Ć",
            "Ž",
            "Đ",
            "LJ",
            "NJ",
            "DŽ",
        ];

        const timer = setInterval(() => {
            setRollingLetters(
                Array.from({ length: 12 }, () => visualAlphabet[Math.floor(Math.random() * visualAlphabet.length)])
            );
        }, 70);

        return () => clearInterval(timer);
    }, [phase]);

    function stopLetters() {
        if (isPaused) return;
        if (phase !== "selecting") return;
        if (!isRoundStarter) return;

        const nextGameExpiresAt = Date.now() + 60 * 1000;

        setGameExpiresAt(nextGameExpiresAt);
        setPhase("playing");
        onTimerTick(60);

        gameSnapshot.current = {
            ...gameSnapshot.current,
            phase: "playing",
            gameExpiresAt: nextGameExpiresAt,
        };

        if (myRole === "blue") {
            void persistTimerState({
                phase: "playing",
                selectionExpiresAt: gameSnapshot.current.selectionExpiresAt,
                gameExpiresAt: nextGameExpiresAt,
                intermissionExpiresAt: gameSnapshot.current.intermissionExpiresAt,
                myWord: gameSnapshot.current.myWord,
                opponentWord: gameSnapshot.current.opponentWord,
                isMySubmitted: gameSnapshot.current.isMySubmitted,
                isOpponentSubmitted: gameSnapshot.current.isOpponentSubmitted,
                roundSummary: gameSnapshot.current.roundSummary,
            });
        }

        sendBroadcast({
            type: "LETTERS_STOP",
            role: myRole,
            round,
            gameExpiresAt: nextGameExpiresAt,
        });
    }

    // 6. TIMER ZA STOP SLOVA - 5 SEKUNDI
    useEffect(() => {
        if (phase !== "selecting" || isPaused) return;

        const tick = () => {
            const timeLeft = Math.max(0, Math.ceil((selectionExpiresAt - Date.now()) / 1000));

            onTimerTick(timeLeft);

            if (timeLeft <= 0) {
                // Starter je autoritativan i šalje trenutak početka igre.
                if (isRoundStarter) {
                    stopLetters();
                }

                return true;
            }

            return false;
        };

        if (tick()) return;

        const timer = setInterval(() => {
            const finished = tick();

            if (finished) {
                clearInterval(timer);
            }
        }, 100);

        return () => clearInterval(timer);
    }, [phase, selectionExpiresAt, isRoundStarter, myRole, round, isPaused]);

    // 7. GAME TIMER - 60 SEKUNDI
    useEffect(() => {
        if (phase !== "playing" || isPaused) return;

        const tick = () => {
            const timeLeft = Math.max(0, Math.ceil((gameExpiresAt - Date.now()) / 1000));

            onTimerTick(timeLeft);

            if (timeLeft <= 0 || (isMySubmitted && isOpponentSubmitted)) {
                if (!isProcessingRoundRef.current) {
                    isProcessingRoundRef.current = true;
                    void handleEndRoundProcessing();
                }

                return true;
            }

            return false;
        };

        if (tick()) return;

        const timer = setInterval(() => {
            const finished = tick();

            if (finished) {
                clearInterval(timer);
            }
        }, 250);

        return () => clearInterval(timer);
    }, [gameExpiresAt, isMySubmitted, isOpponentSubmitted, phase, isPaused]);

    // 8. INTERMISSION TIMER - 10 SEKUNDI
    useEffect(() => {
        if (phase !== "intermission" || isPaused) return;
        if (intermissionExpiresAt <= 0) return;

        const tick = () => {
            const timeLeft = Math.max(0, Math.ceil((intermissionExpiresAt - Date.now()) / 1000));

            setIntermissionTimeLeft(timeLeft);
            onTimerTick(timeLeft);

            if (timeLeft <= 0) {
                onNextRound();
                return true;
            }

            return false;
        };

        if (tick()) return;

        const timer = setInterval(() => {
            const finished = tick();

            if (finished) {
                clearInterval(timer);
            }
        }, 250);

        return () => clearInterval(timer);
    }, [intermissionExpiresAt, phase, isPaused]);

    // 9. AUTOMATSKA PROVJERA RIJEČI
    useEffect(() => {
        if (phase !== "playing" || !currentWord || currentWord.length === 0) {
            setWordStatus(null);
            setIsChecking(false);
            return;
        }

        setWordStatus(null);
        setIsChecking(true);

        const validationTimer = setTimeout(async () => {
            try {
                const result = await verifyWordAction(currentWord);
                setWordStatus(result.success ? "TAČNO" : "NETAČNO");
            } catch {
                setWordStatus("NETAČNO");
            } finally {
                setIsChecking(false);
            }
        }, 1200);

        return () => {
            clearTimeout(validationTimer);
        };
    }, [currentWord, phase]);

    function handleLetterClick(tile: LetterTile) {
        if (isPaused) return;
        if (tile.used || isMySubmitted || phase !== "playing") {
            return;
        }

        setTiles((prev) => prev.map((t) => (t.id === tile.id ? { ...t, used: true } : t)));

        setHistory((prev) => [
            ...prev,
            {
                value: tile.value,
                tileId: tile.id,
            },
        ]);
    }

    function handleUndo() {
        if (isPaused) return;
        if (history.length === 0 || isMySubmitted || phase !== "playing") {
            return;
        }

        const lastAction = history[history.length - 1];

        setTiles((prev) => prev.map((t) => (t.id === lastAction.tileId ? { ...t, used: false } : t)));

        setHistory((prev) => prev.slice(0, -1));
    }

    function handleResetWord() {
        if (isPaused) return;
        if (isMySubmitted || phase !== "playing") {
            return;
        }

        setTiles((prev) =>
            prev.map((t) => ({
                ...t,
                used: false,
            }))
        );

        setHistory([]);
        setWordStatus(null);
    }

    function clearLongPressTimer() {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }

    function handleDeletePointerDown() {
        if (isPaused) return;
        if (isMySubmitted || phase !== "playing") {
            return;
        }

        clearLongPressTimer();
        isLongPressRef.current = false;

        longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            isLongPressRef.current = true;
            handleResetWord();
        }, 600);
    }

    function handleDeletePointerUp() {
        if (isMySubmitted || phase !== "playing") {
            clearLongPressTimer();
            isLongPressRef.current = false;
            return;
        }

        clearLongPressTimer();

        if (!isLongPressRef.current) {
            handleUndo();
        }

        isLongPressRef.current = false;
    }

    function handleDeletePointerCancel() {
        clearLongPressTimer();
        isLongPressRef.current = false;
    }

    function handleUserSubmit() {
        if (isPaused) return;
        if (isMySubmitted || phase !== "playing") {
            return;
        }

        const finalWord = currentWord;

        setMyWord(finalWord);
        setIsMySubmitted(true);

        sendBroadcast({
            type: "SUBMIT_WORD",
            role: myRole,
            round,
            word: finalWord,
        });
    }

    /*
        Redis snapshot se pravi SAMO JEDNOM:
        kada je runda potpuno završena i imamo rezultat.

        RED nikada ne poziva server action.
        Server capability je dodatna sigurnosna provjera.
    */
    async function persistRoundResult(summary: RoundSummary | null, bluePts: number, redPts: number) {
        if (myRole !== "blue" || hasPersistedRoundRef.current) {
            return;
        }

        hasPersistedRoundRef.current = true;

        try {
            await queueSnapshotSave(() =>
                saveGameSnapshotAction({
                    roomId,
                    game: "rec",
                    round,
                    event: "round_result",

                    state: {
                        completed: true,
                        bluePts,
                        redPts,
                        roundSummary: summary,
                    },
                })
            );
        } catch (error) {
            /*
                Persistence failure ne smije promijeniti
                rezultat same igre.
            */
            hasPersistedRoundRef.current = false;

            console.error("Ne mogu sačuvati rezultat Pronađi riječ runde:", error);
        }
    }

    // 10. KRAJ RUNDE I BODOVANJE
    async function handleEndRoundProcessing() {
        setPhase("calculating");

        const finalMyWord = isMySubmitted ? myWord : currentWord;

        const finalOpponentWord = opponentWord || "";

        const blueWordStr = myRole === "blue" ? finalMyWord : finalOpponentWord;

        const redWordStr = myRole === "red" ? finalMyWord : finalOpponentWord;

        try {
            const longestWord = initialTiles?.najduza_rec ?? "";

            /*
                Server action je jedini source of truth za broj slova.

                verifyWordAction vraća `points`, gdje su DŽ, NJ i LJ
                već uračunati kao po jedno slovo.
            */
            const [blueRes, redRes, computerRes] = await Promise.all([
                blueWordStr ? verifyWordAction(blueWordStr) : { success: false, points: 0 },

                redWordStr ? verifyWordAction(redWordStr) : { success: false, points: 0 },

                longestWord ? verifyWordAction(longestWord) : { success: false, points: 0 },
            ]);

            const isBlueValid = blueRes.success;
            const isRedValid = redRes.success;

            const blueLen =
                blueRes.success && "points" in blueRes && typeof blueRes.points === "number" ? blueRes.points : 0;

            const redLen =
                redRes.success && "points" in redRes && typeof redRes.points === "number" ? redRes.points : 0;

            const compLen =
                computerRes.success && "points" in computerRes && typeof computerRes.points === "number"
                    ? computerRes.points
                    : 0;

            const {
                bluePoints: bluePts,
                redPoints: redPts,
                blueBreakdown,
                redBreakdown,
            } = calculateSlagalicaScores(blueLen, isBlueValid, redLen, isRedValid, compLen, round);

            onScoreSubmit(bluePts, redPts);

            const summary: RoundSummary = {
                blueWord: blueWordStr,
                redWord: redWordStr,
                isBlueValid,
                isRedValid,
                bluePts,
                redPts,
                blueBreakdown,
                redBreakdown,
                longestWord,
            };

            setRoundSummary(summary);

            /*
                Čuvamo canonical završeni rezultat.
                Ovo se dešava i kada su oba submitovala
                i kada je runda završila istekom vremena,
                jer oba puta dolazimo kroz
                handleEndRoundProcessing().
            */
            await persistRoundResult(summary, bluePts, redPts);

            /*
                Intermission počinje TEK SADA.
                Ne na početku game komponente.
            */
            const newIntermissionExpiresAt = Date.now() + 10 * 1000;

            setIntermissionExpiresAt(newIntermissionExpiresAt);

            setIntermissionTimeLeft(10);
            setPhase("intermission");
        } catch (err) {
            console.error("Greška pri bodovanju:", err);

            onScoreSubmit(0, 0);

            await persistRoundResult(null, 0, 0);

            const newIntermissionExpiresAt = Date.now() + 10 * 1000;

            setIntermissionExpiresAt(newIntermissionExpiresAt);

            setIntermissionTimeLeft(10);
            setPhase("intermission");
        }
    }

    if (myRole === "red" && isAwaitingCanonicalSync) {
        return (
            <div className="flex w-full max-w-[340px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface px-5 py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div>
                    <p className="text-sm font-black text-text">Vraćam stanje runde...</p>
                    <p className="mt-1 text-xs font-medium text-text-secondary">
                        Čekam trenutno stanje od plavog igrača.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[340px] gap-4 animate-in fade-in zoom-in-95">
            {phase === "selecting" ? (
                <div className="flex flex-col items-center justify-center w-full gap-5">
                    <div className="text-center">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">Biranje slova</div>

                        <div className="mt-1 text-xs font-medium text-text-secondary">
                            {isRoundStarter
                                ? "Pritisni STOP kada želiš"
                                : `${roundStarter === "blue" ? "Plavi" : "Crveni"} igrač bira slova`}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5 w-full">
                        <div className="grid grid-cols-6 gap-2">
                            {rollingLetters.slice(0, 6).map((letter, index) => (
                                <div
                                    key={`rolling-top-${index}`}
                                    className="flex h-12 items-center justify-center rounded-xl border border-primary/30 bg-surface text-lg font-black text-text shadow-sm"
                                >
                                    {letter}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-6 gap-2">
                            {rollingLetters.slice(6, 12).map((letter, index) => (
                                <div
                                    key={`rolling-bottom-${index}`}
                                    className="flex h-12 items-center justify-center rounded-xl border border-primary/30 bg-surface text-lg font-black text-text shadow-sm"
                                >
                                    {letter}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={stopLetters}
                        disabled={!isRoundStarter}
                        className="w-full py-4 rounded-2xl bg-primary text-black font-black text-xl tracking-wider transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(245,158,11,0.2)] cursor-pointer disabled:cursor-default disabled:opacity-35"
                    >
                        {isRoundStarter ? "STOP" : "ČEKANJE..."}
                    </button>
                </div>
            ) : phase !== "intermission" ? (
                <>
                    <div className="min-h-[24px] flex items-center justify-center">
                        {isChecking && (
                            <span className="text-xs font-bold text-text-muted animate-pulse">Proveravam reč...</span>
                        )}

                        {!isChecking && wordStatus === "TAČNO" && (
                            <span className="text-xs font-black text-emerald-500 tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                                TAČNO
                            </span>
                        )}

                        {!isChecking && wordStatus === "NETAČNO" && (
                            <span className="text-xs font-black text-red-500 tracking-wider uppercase bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
                                NETAČNO
                            </span>
                        )}
                    </div>

                    <div className="w-full text-center py-4 px-4 bg-surface/90 backdrop-blur-md border-2 border-primary/60 rounded-3xl text-primary font-black text-2xl tracking-widest min-h-[64px] flex items-center justify-center overflow-x-auto shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                        {isMySubmitted
                            ? myWord
                            : currentWord || (
                                  <span className="text-text-muted text-sm font-normal tracking-normal">
                                      Sastavljajte reč klikom...
                                  </span>
                              )}
                    </div>

                    {!isMySubmitted && phase === "playing" ? (
                        <>
                            <div className="flex flex-col gap-2.5 w-full">
                                <div className="grid grid-cols-6 gap-2">
                                    {tiles.slice(0, 6).map((tile) => (
                                        <button
                                            key={tile.id}
                                            onClick={() => handleLetterClick(tile)}
                                            disabled={tile.used}
                                            className={`flex h-12 items-center justify-center rounded-xl border text-lg font-black transition-all shadow-sm ${
                                                tile.used
                                                    ? "bg-surface/30 border-border/40 text-text-muted opacity-40 cursor-not-allowed"
                                                    : "bg-surface border-border hover:bg-surface-light hover:border-primary/50 text-text active:scale-95 cursor-pointer"
                                            }`}
                                        >
                                            {tile.value}
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-6 gap-2">
                                    {tiles.slice(6, 12).map((tile) => (
                                        <button
                                            key={tile.id}
                                            onClick={() => handleLetterClick(tile)}
                                            disabled={tile.used}
                                            className={`flex h-12 items-center justify-center rounded-xl border text-lg font-black transition-all shadow-sm ${
                                                tile.used
                                                    ? "bg-surface/30 border-border/40 text-text-muted opacity-40 cursor-not-allowed"
                                                    : "bg-surface border-border hover:bg-surface-light hover:border-primary/50 text-text active:scale-95 cursor-pointer"
                                            }`}
                                        >
                                            {tile.value}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onPointerDown={handleDeletePointerDown}
                                    onPointerUp={handleDeletePointerUp}
                                    onPointerCancel={handleDeletePointerCancel}
                                    onContextMenu={(event) => event.preventDefault()}
                                    className="w-full flex items-center justify-center gap-2 py-3 mt-1 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500 font-bold text-sm transition-all active:scale-95 shadow-sm cursor-pointer select-none touch-manipulation"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Obriši slovo (Drži za sve)
                                </button>
                            </div>

                            <button
                                onClick={handleUserSubmit}
                                disabled={currentWord.length === 0}
                                className="w-full py-4 mt-2 rounded-2xl bg-primary text-black font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(245,158,11,0.2)] cursor-pointer disabled:opacity-50"
                            >
                                Potvrdi reč
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-surface/60 border border-border rounded-3xl w-full gap-2">
                            <Sparkles className="h-8 w-8 text-primary animate-bounce" />

                            <span className="text-sm font-bold text-text">
                                {phase === "calculating" ? "Bodovanje u toku..." : "Reč uspešno poslata!"}
                            </span>

                            <span className="text-xs text-text-secondary">
                                {isOpponentSubmitted ? "Obračunavam rezultate..." : "Čekamo protivnika da završi..."}
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <RoundIntermission
                    gameTitle="Pronađi riječ"
                    round={round}
                    bluePoints={roundSummary?.bluePts ?? 0}
                    redPoints={roundSummary?.redPts ?? 0}
                    timeLeft={intermissionTimeLeft}
                    nextLabel={round === 1 ? "Sledeća runda za" : "Sledeća igra za"}
                    blueDetail={
                        <div className="flex flex-col gap-1">
                            <span className="truncate font-black text-text">
                                {roundSummary?.blueWord || "Bez reči"}
                            </span>
                            <span>{roundSummary?.isBlueValid ? "Tačna reč" : "Netačna / bez reči"}</span>
                        </div>
                    }
                    redDetail={
                        <div className="flex flex-col gap-1">
                            <span className="truncate font-black text-text">{roundSummary?.redWord || "Bez reči"}</span>
                            <span>{roundSummary?.isRedValid ? "Tačna reč" : "Netačna / bez reči"}</span>
                        </div>
                    }
                    bottomContent={
                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                            <p className="text-[9px] font-black uppercase tracking-wide text-text-muted">Najduža reč</p>
                            <p className="mt-1 truncate text-sm font-black tracking-wide text-primary">
                                {roundSummary?.longestWord || initialTiles?.najduza_rec || "—"}
                            </p>
                        </div>
                    }
                />
            )}
        </div>
    );
}
