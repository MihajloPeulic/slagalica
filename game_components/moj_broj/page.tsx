"use client";

import { useState, useEffect, useRef } from "react";
import { RotateCcw, Sparkles, Target } from "lucide-react";
import { saveGameSnapshotAction } from "@/actions/game/game-state";
import { RoundIntermission } from "@/game_components/RoundIntermission";

interface NumberTile {
    id: string;
    value: number;
    used: boolean;
}

type NumberHistoryItem = {
    type: "number" | "operator";
    value: string | number;
    tileId?: string;
};

interface MojBrojProps {
    roomId: string;
    myRole: "blue" | "red";
    syncEpoch?: number;
    preferPeerSync?: boolean;
    isPaused?: boolean;
    pauseVersion?: number;
    resumeShiftMs?: number;
    onPeerSyncComplete?: () => void;
    round: number; // 1 (Plavom pripada runda) ili 2 (Crvenom pripada runda)
    data: { target: number; numbers: number[] };
    initialState?: any;
    sendBroadcast: (payload: any) => void;
    incomingBroadcast?: any;
    onScoreSubmit: (bluePoints: number, redPoints: number) => void;
    onNextRound: () => void;
    onTimerTick: (timeLeft: number) => void;
}

// Funkcija za bezbednu evaluaciju izraza
function evaluateExpression(expr: string): number | null {
    if (!expr) return null;
    try {
        const res = new Function(`return ${expr}`)();
        if (typeof res === "number" && !isNaN(res) && isFinite(res) && res > 0 && Number.isInteger(res)) {
            return res;
        }
        return null;
    } catch {
        return null; // Greška u sintaksi
    }
}

// Bodovanje: pobjednik uvijek dobija 10, gubitnik 0.
// Ako imaju istu razliku od cilja, prednost ima igrač čija je runda.
function calculateNumberScores(target: number, blueRes: number | null, redRes: number | null, round: number) {
    let bluePts = 0;
    let redPts = 0;

    const blueDiff = blueRes !== null ? Math.abs(target - blueRes) : Infinity;

    const redDiff = redRes !== null ? Math.abs(target - redRes) : Infinity;

    if (blueDiff === Infinity && redDiff === Infinity) {
        return {
            bluePts: 0,
            redPts: 0,
            blueDiff,
            redDiff,
        };
    }

    if (blueDiff === redDiff && blueDiff !== Infinity) {
        if (round === 1) {
            bluePts = 10;
        } else {
            redPts = 10;
        }
    } else if (blueDiff < redDiff) {
        bluePts = 10;
    } else if (redDiff < blueDiff) {
        redPts = 10;
    }

    return {
        bluePts,
        redPts,
        blueDiff,
        redDiff,
    };
}

export function MojBroj({
    roomId,
    myRole,
    syncEpoch = 0,
    preferPeerSync = false,
    isPaused = false,
    pauseVersion = 0,
    resumeShiftMs = 0,
    onPeerSyncComplete,
    round,
    data,
    initialState,
    sendBroadcast,
    incomingBroadcast,
    onScoreSubmit,
    onNextRound,
    onTimerTick,
}: MojBrojProps) {
    const [phase, setPhase] = useState<"selecting" | "playing" | "calculating" | "intermission">("selecting");

    const roundStarter: "blue" | "red" = round === 1 ? "blue" : "red";
    const isRoundStarter = myRole === roundStarter;

    // 5 sekundi za vizuelni izbor brojeva.
    const [selectionExpiresAt, setSelectionExpiresAt] = useState(() => Date.now() + 5 * 1000);

    // Source of truth za vrijeme su timestampovi, ne lokalni countdown.
    const [gameExpiresAt, setGameExpiresAt] = useState(0);
    const [intermissionExpiresAt, setIntermissionExpiresAt] = useState(0);
    const [intermissionTimeLeft, setIntermissionTimeLeft] = useState(10);

    const [tiles, setTiles] = useState<NumberTile[]>([]);
    const [rollingTarget, setRollingTarget] = useState(100);
    const [rollingNumbers, setRollingNumbers] = useState<number[]>(() =>
        Array.from({ length: data.numbers.length }, () => 1)
    );
    const [history, setHistory] = useState<NumberHistoryItem[]>([]);

    const [isMySubmitted, setIsMySubmitted] = useState(false);
    const [myFinalExpression, setMyFinalExpression] = useState("");
    const [myFinalResult, setMyFinalResult] = useState<number | null>(null);

    const [isOpponentSubmitted, setIsOpponentSubmitted] = useState(false);
    const [opponentExpression, setOpponentExpression] = useState("");
    const [opponentFinalResult, setOpponentFinalResult] = useState<number | null>(null);

    const [roundSummary, setRoundSummary] = useState<any>(null);

    const deleteHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPressRef = useRef(false);
    const isProcessingRoundRef = useRef(false);
    const hasReceivedSyncRef = useRef(false);
    const syncRequestIdRef = useRef<string | null>(null);
    const syncRetryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const snapshotSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
    const isSyncReadyRef = useRef(false);
    const lastAppliedPauseVersionRef = useRef(pauseVersion);
    const initializedKeyRef = useRef<string | null>(null);
    const hasPersistedRoundRef = useRef(false);

    const localDraftKey = `game-draft:${roomId}:broj:r${round}:${myRole}`;

    const currentExpression = history.map((item) => item.value).join(" ");

    /*
        Snapshot sadrži samo state koji smijemo vratiti nakon refresha.

        Namjerno NEMA:
        - history
        - tiles
        - currentExpression

        Dakle nepotvrđeni input se uvijek briše.

        myFinalExpression je druga stvar: on postoji tek nakon "Potvrdi",
        više nije editabilan i potreban je za nastavak/bodovanje runde.
    */
    const gameSnapshot = useRef({
        phase,
        selectionExpiresAt,
        gameExpiresAt,
        intermissionExpiresAt,
        isMySubmitted,
        myFinalExpression,
        myFinalResult,
        isOpponentSubmitted,
        opponentExpression,
        opponentFinalResult,
        roundSummary,
    });

    function restoreLocalDraft() {
        if (typeof window === "undefined") return;

        try {
            const raw = window.localStorage.getItem(localDraftKey);
            if (!raw) return;

            const parsed = JSON.parse(raw) as {
                history?: NumberHistoryItem[];
            };

            if (!Array.isArray(parsed.history)) return;

            const baseTiles = data.numbers.map((value, idx) => ({
                id: `num-${idx}`,
                value,
                used: false,
            }));
            const tileMap = new Map(baseTiles.map((tile) => [tile.id, tile]));
            const usedIds = new Set<string>();
            const restoredHistory: NumberHistoryItem[] = [];
            const operators = new Set(["+", "-", "*", "/", "(", ")"]);

            for (const item of parsed.history) {
                if (!item || (item.type !== "number" && item.type !== "operator")) {
                    continue;
                }

                if (item.type === "operator") {
                    if (typeof item.value === "string" && operators.has(item.value)) {
                        restoredHistory.push({ type: "operator", value: item.value });
                    }
                    continue;
                }

                if (typeof item.tileId !== "string" || usedIds.has(item.tileId)) {
                    continue;
                }

                const tile = tileMap.get(item.tileId);
                if (!tile || Number(item.value) !== tile.value) continue;

                usedIds.add(item.tileId);
                restoredHistory.push({
                    type: "number",
                    value: tile.value,
                    tileId: tile.id,
                });
            }

            setHistory(restoredHistory);
            setTiles(
                baseTiles.map((tile) => ({
                    ...tile,
                    used: usedIds.has(tile.id),
                }))
            );
        } catch (error) {
            console.error("Ne mogu vratiti lokalni draft Moj Broj:", error);
        }
    }

    function clearLocalDraft() {
        if (typeof window === "undefined") return;

        try {
            window.localStorage.removeItem(localDraftKey);
        } catch {
            // localStorage je best-effort reconnect cache.
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
        isMySubmitted?: boolean;
        myFinalExpression?: string;
        myFinalResult?: number | null;
        isOpponentSubmitted?: boolean;
        opponentExpression?: string;
        opponentFinalResult?: number | null;
        roundSummary?: any;
    }) {
        if (myRole !== "blue") return;

        try {
            await queueSnapshotSave(() =>
                saveGameSnapshotAction({
                    roomId,
                    game: "broj",
                    round,
                    event: "state_sync",
                    state: {
                        completed: false,
                        phase: state.phase,
                        selectionExpiresAt: state.selectionExpiresAt,
                        gameExpiresAt: state.gameExpiresAt,
                        intermissionExpiresAt: state.intermissionExpiresAt ?? 0,
                        isMySubmitted: state.isMySubmitted ?? false,
                        myFinalExpression: state.myFinalExpression ?? "",
                        myFinalResult: state.myFinalResult ?? null,
                        isOpponentSubmitted: state.isOpponentSubmitted ?? false,
                        opponentExpression: state.opponentExpression ?? "",
                        opponentFinalResult: state.opponentFinalResult ?? null,
                        roundSummary: state.roundSummary ?? null,
                    },
                })
            );
        } catch (error) {
            console.error("Ne mogu sačuvati timer Moj Broj runde:", error);
        }
    }

    // 1. RESET / REDIS RESTORE NA POČETKU NOVE RUNDE
    useEffect(() => {
        const initKey = `${roomId}:${round}:${myRole}`;
        if (initializedKeyRef.current === initKey) return;
        initializedKeyRef.current = initKey;

        setTiles(
            data.numbers.map((value, idx) => ({
                id: `num-${idx}`,
                value,
                used: false,
            }))
        );

        setHistory([]);
        setRollingTarget(100);
        setRollingNumbers(Array.from({ length: data.numbers.length }, () => 1));
        setIntermissionTimeLeft(10);

        isProcessingRoundRef.current = false;
        hasReceivedSyncRef.current = false;
        syncRequestIdRef.current = null;
        isSyncReadyRef.current = false;
        hasPersistedRoundRef.current = false;

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
            const restoredIsMySubmitted = !!initialState.isMySubmitted;
            const restoredMyFinalExpression =
                typeof initialState.myFinalExpression === "string" ? initialState.myFinalExpression : "";
            const restoredMyFinalResult =
                typeof initialState.myFinalResult === "number" ? initialState.myFinalResult : null;
            const restoredIsOpponentSubmitted = !!initialState.isOpponentSubmitted;
            const restoredOpponentExpression =
                typeof initialState.opponentExpression === "string" ? initialState.opponentExpression : "";
            const restoredOpponentFinalResult =
                typeof initialState.opponentFinalResult === "number" ? initialState.opponentFinalResult : null;
            const restoredRoundSummary = initialState.roundSummary ?? null;

            setPhase(restoredPhase);
            setSelectionExpiresAt(restoredSelectionExpiresAt);
            setGameExpiresAt(restoredGameExpiresAt);
            setIntermissionExpiresAt(restoredIntermissionExpiresAt);

            setIsMySubmitted(restoredIsMySubmitted);
            setMyFinalExpression(restoredMyFinalExpression);
            setMyFinalResult(restoredMyFinalResult);
            setIsOpponentSubmitted(restoredIsOpponentSubmitted);
            setOpponentExpression(restoredOpponentExpression);
            setOpponentFinalResult(restoredOpponentFinalResult);
            setRoundSummary(restoredRoundSummary);

            gameSnapshot.current = {
                phase: restoredPhase,
                selectionExpiresAt: restoredSelectionExpiresAt,
                gameExpiresAt: restoredGameExpiresAt,
                intermissionExpiresAt: restoredIntermissionExpiresAt,
                isMySubmitted: restoredIsMySubmitted,
                myFinalExpression: restoredMyFinalExpression,
                myFinalResult: restoredMyFinalResult,
                isOpponentSubmitted: restoredIsOpponentSubmitted,
                opponentExpression: restoredOpponentExpression,
                opponentFinalResult: restoredOpponentFinalResult,
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
            return;
        }

        const initialSelectionExpiresAt = Date.now() + 5 * 1000;

        setIsMySubmitted(false);
        setMyFinalExpression("");
        setMyFinalResult(null);
        setIsOpponentSubmitted(false);
        setOpponentExpression("");
        setOpponentFinalResult(null);
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
                isMySubmitted: false,
                myFinalExpression: "",
                myFinalResult: null,
                isOpponentSubmitted: false,
                opponentExpression: "",
                opponentFinalResult: null,
                roundSummary: null,
            };

            isSyncReadyRef.current = true;

            void persistTimerState({
                phase: "selecting",
                selectionExpiresAt: initialSelectionExpiresAt,
                gameExpiresAt: 0,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, round, myRole]);

    // 2. SNAPSHOT UVIJEK DRŽI NAJNOVIJE DOZVOLJENO STANJE
    useEffect(() => {
        gameSnapshot.current = {
            phase,
            selectionExpiresAt,
            gameExpiresAt,
            intermissionExpiresAt,
            isMySubmitted,
            myFinalExpression,
            myFinalResult,
            isOpponentSubmitted,
            opponentExpression,
            opponentFinalResult,
            roundSummary,
        };
    }, [
        phase,
        selectionExpiresAt,
        gameExpiresAt,
        intermissionExpiresAt,
        isMySubmitted,
        myFinalExpression,
        myFinalResult,
        isOpponentSubmitted,
        opponentExpression,
        opponentFinalResult,
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
        if (!(myRole === "red" || (myRole === "blue" && preferPeerSync)) || hasReceivedSyncRef.current) {
            return;
        }

        if (!syncRequestIdRef.current) {
            syncRequestIdRef.current = `${Date.now()}-${myRole}-${round}-${syncEpoch}-${Math.random().toString(36).slice(2)}`;
        }

        sendBroadcast({
            type: "MOJ_BROJ_SYNC_REQUEST",
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
        hasReceivedSyncRef.current = false;

        if (!(myRole === "red" || (myRole === "blue" && preferPeerSync))) {
            return;
        }

        sendInitialSyncRequest();

        const retry500 = setTimeout(sendInitialSyncRequest, 500);

        const retry1500 = setTimeout(sendInitialSyncRequest, 1_500);

        const retry3000 = setTimeout(sendInitialSyncRequest, 3_000);

        const retry5000 = setTimeout(sendInitialSyncRequest, 5_000);

        const retry8000 = setTimeout(sendInitialSyncRequest, 8_000);

        syncRetryTimersRef.current = [retry500, retry1500, retry3000, retry5000, retry8000];

        return () => {
            clearSyncRetryTimers();
            hasReceivedSyncRef.current = false;
            syncRequestIdRef.current = null;
        };
    }, [myRole, round, syncEpoch, preferPeerSync]);

    // 4. BROADCAST LISTENER
    useEffect(() => {
        if (!incomingBroadcast) return;

        if (typeof incomingBroadcast.round === "number" && incomingBroadcast.round !== round) {
            return;
        }

        // Protivnik je zaključao svoj rezultat.
        if (incomingBroadcast.type === "SUBMIT_NUMBERS") {
            if (incomingBroadcast.role === myRole) return;

            setOpponentExpression(incomingBroadcast.expression);
            setOpponentFinalResult(incomingBroadcast.result);
            setIsOpponentSubmitted(true);
            return;
        }

        if (incomingBroadcast.type === "MOJ_BROJ_SELECTION_STOP") {
            if (incomingBroadcast.role === myRole) return;

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
                    isMySubmitted: gameSnapshot.current.isMySubmitted,
                    myFinalExpression: gameSnapshot.current.myFinalExpression,
                    myFinalResult: gameSnapshot.current.myFinalResult,
                    isOpponentSubmitted: gameSnapshot.current.isOpponentSubmitted,
                    opponentExpression: gameSnapshot.current.opponentExpression,
                    opponentFinalResult: gameSnapshot.current.opponentFinalResult,
                    roundSummary: gameSnapshot.current.roundSummary,
                });
            }

            return;
        }

        if (incomingBroadcast.type === "MOJ_BROJ_SYNC_RESPONSE") {
            if (
                typeof incomingBroadcast.requestId !== "string" ||
                incomingBroadcast.requestId !== syncRequestIdRef.current
            ) {
                return;
            }

            if (incomingBroadcast.role === myRole || !(myRole === "red" || (myRole === "blue" && preferPeerSync))) {
                return;
            }

            // Sync response se primjenjuje samo jednom po mountu/rundi.
            if (hasReceivedSyncRef.current) return;
            hasReceivedSyncRef.current = true;
            syncRequestIdRef.current = null;
            clearSyncRetryTimers();
            isSyncReadyRef.current = true;
            onPeerSyncComplete?.();

            setIsMySubmitted(!!incomingBroadcast.isMySubmitted);
            setMyFinalExpression(
                typeof incomingBroadcast.myFinalExpression === "string" ? incomingBroadcast.myFinalExpression : ""
            );
            setMyFinalResult(
                typeof incomingBroadcast.myFinalResult === "number" ? incomingBroadcast.myFinalResult : null
            );

            setIsOpponentSubmitted(!!incomingBroadcast.isOpponentSubmitted);
            setOpponentExpression(
                typeof incomingBroadcast.opponentExpression === "string" ? incomingBroadcast.opponentExpression : ""
            );
            setOpponentFinalResult(
                typeof incomingBroadcast.opponentFinalResult === "number" ? incomingBroadcast.opponentFinalResult : null
            );

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

            setRoundSummary(incomingBroadcast.roundSummary ?? null);

            if (incomingBroadcast.phase === "playing" && !incomingBroadcast.isMySubmitted) {
                restoreLocalDraft();
            } else if (incomingBroadcast.isMySubmitted) {
                clearLocalDraft();
            }

            isProcessingRoundRef.current =
                incomingBroadcast.phase === "calculating" || incomingBroadcast.phase === "intermission";

            return;
        }

        if (incomingBroadcast.type === "MOJ_BROJ_SYNC_REQUEST") {
            if (incomingBroadcast.role === myRole || !isSyncReadyRef.current) {
                return;
            }

            const snapshot = gameSnapshot.current;

            /*
                Perspektiva se obrće:

                snapshot.opponent* = state igrača koji traži sync.
                snapshot.my*       = naš state.

                Zato requester dobija opponent* kao svoj my*.
            */
            sendBroadcast({
                type: "MOJ_BROJ_SYNC_RESPONSE",
                role: myRole,
                round,
                requestId: incomingBroadcast.requestId,

                phase: snapshot.phase,
                selectionExpiresAt: snapshot.selectionExpiresAt,
                gameExpiresAt: snapshot.gameExpiresAt,
                intermissionExpiresAt: snapshot.intermissionExpiresAt,

                isMySubmitted: snapshot.isOpponentSubmitted,
                myFinalExpression: snapshot.opponentExpression,
                myFinalResult: snapshot.opponentFinalResult,

                isOpponentSubmitted: snapshot.isMySubmitted,
                opponentExpression: snapshot.myFinalExpression,
                opponentFinalResult: snapshot.myFinalResult,

                roundSummary: snapshot.roundSummary,
            });

            return;
        }
    }, [incomingBroadcast, myRole, round, data.numbers]);

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
                isMySubmitted: snapshot.isMySubmitted,
                myFinalExpression: snapshot.myFinalExpression,
                myFinalResult: snapshot.myFinalResult,
                isOpponentSubmitted: snapshot.isOpponentSubmitted,
                opponentExpression: snapshot.opponentExpression,
                opponentFinalResult: snapshot.opponentFinalResult,
                roundSummary: snapshot.roundSummary,
            });
        }
    }, [pauseVersion, resumeShiftMs, myRole]);

    // 5. VIZUELNO MIJEŠANJE BROJEVA
    useEffect(() => {
        if (phase !== "selecting" || isPaused) return;

        const smallNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const largeNumbers = [25, 50, 75, 100];

        const timer = setInterval(() => {
            setRollingTarget(Math.floor(Math.random() * (999 - 100 + 1)) + 100);

            setRollingNumbers(
                data.numbers.map((_, index) => {
                    // Zadnja dva polja često izgledaju kao "veći" brojevi,
                    // ostala kao standardni mali brojevi.
                    const useLargePool = index >= Math.max(0, data.numbers.length - 2);

                    const pool = useLargePool ? largeNumbers : smallNumbers;

                    return pool[Math.floor(Math.random() * pool.length)];
                })
            );
        }, 70);

        return () => clearInterval(timer);
    }, [phase, data.numbers]);

    function stopNumberSelection() {
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
                isMySubmitted: gameSnapshot.current.isMySubmitted,
                myFinalExpression: gameSnapshot.current.myFinalExpression,
                myFinalResult: gameSnapshot.current.myFinalResult,
                isOpponentSubmitted: gameSnapshot.current.isOpponentSubmitted,
                opponentExpression: gameSnapshot.current.opponentExpression,
                opponentFinalResult: gameSnapshot.current.opponentFinalResult,
                roundSummary: gameSnapshot.current.roundSummary,
            });
        }

        sendBroadcast({
            type: "MOJ_BROJ_SELECTION_STOP",
            role: myRole,
            round,
            gameExpiresAt: nextGameExpiresAt,
        });
    }

    // 6. TIMER ZA IZBOR - 5 SEKUNDI
    useEffect(() => {
        if (phase !== "selecting" || isPaused) return;

        const tick = () => {
            const timeLeft = Math.max(0, Math.ceil((selectionExpiresAt - Date.now()) / 1000));

            onTimerTick(timeLeft);

            if (timeLeft <= 0) {
                if (isRoundStarter) {
                    stopNumberSelection();
                }

                return true;
            }

            return false;
        };

        if (tick()) return;

        const timer = setInterval(() => {
            if (tick()) {
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
            if (tick()) {
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
            if (tick()) {
                clearInterval(timer);
            }
        }, 250);

        return () => clearInterval(timer);
    }, [intermissionExpiresAt, phase, isPaused]);

    // 9. KLIKOVI I LOGIKA
    function handleNumberClick(tile: NumberTile) {
        if (isPaused) return;
        if (tile.used || isMySubmitted || phase !== "playing") return;
        const lastAction = history[history.length - 1];
        if (lastAction && lastAction.type === "number") return;
        setTiles((prev) => prev.map((t) => (t.id === tile.id ? { ...t, used: true } : t)));
        setHistory((prev) => [...prev, { type: "number", value: tile.value, tileId: tile.id }]);
    }

    function handleOperatorClick(op: string) {
        if (isPaused) return;
        if (isMySubmitted || phase !== "playing") return;
        setHistory((prev) => [...prev, { type: "operator", value: op }]);
    }

    function handleUndo() {
        if (isPaused) return;
        if (history.length === 0 || isMySubmitted || phase !== "playing") return;
        const lastAction = history[history.length - 1];
        if (lastAction.type === "number" && lastAction.tileId) {
            setTiles((prev) => prev.map((t) => (t.id === lastAction.tileId ? { ...t, used: false } : t)));
        }
        setHistory((prev) => prev.slice(0, -1));
    }

    function handleResetExpression() {
        if (isPaused) return;
        if (isMySubmitted || phase !== "playing") return;
        setTiles((prev) => prev.map((t) => ({ ...t, used: false })));
        setHistory([]);
    }

    function handleDeletePressStart() {
        if (isPaused) return;
        if (isMySubmitted || phase !== "playing") return;

        didLongPressRef.current = false;

        deleteHoldTimerRef.current = setTimeout(() => {
            didLongPressRef.current = true;
            handleResetExpression();
        }, 500);
    }

    function handleDeletePressEnd() {
        if (deleteHoldTimerRef.current) {
            clearTimeout(deleteHoldTimerRef.current);
            deleteHoldTimerRef.current = null;
        }

        // Ako nije bio long press, briši samo zadnju stavku
        if (!didLongPressRef.current) {
            handleUndo();
        }

        didLongPressRef.current = false;
    }

    function handleDeletePressCancel() {
        if (deleteHoldTimerRef.current) {
            clearTimeout(deleteHoldTimerRef.current);
            deleteHoldTimerRef.current = null;
        }

        didLongPressRef.current = false;
    }

    // 10. POTVRDA OD STRANE IGRAČA
    function handleUserSubmit() {
        if (isPaused) return;
        if (isMySubmitted || phase !== "playing") return;

        const res = evaluateExpression(currentExpression);
        if (res === null) {
            alert("Nevažeći izraz!");
            return;
        }

        setIsMySubmitted(true);
        setMyFinalExpression(currentExpression);
        setMyFinalResult(res);

        sendBroadcast({
            type: "SUBMIT_NUMBERS",
            role: myRole,
            round,
            expression: currentExpression,
            result: res,
        });
    }

    /*
        Redis save ide SAMO kad je runda potpuno završena.

        To znači:
        - oba igrača su submitovala
        ILI
        - game timer je istekao

        RED nikada ne poziva server action.
    */
    async function persistRoundResult(summary: {
        blueExpr: string;
        redExpr: string;
        blueRes: number | null;
        redRes: number | null;
        bluePts: number;
        redPts: number;
        blueDiff: number;
        redDiff: number;
    }) {
        if (myRole !== "blue" || hasPersistedRoundRef.current) {
            return;
        }

        hasPersistedRoundRef.current = true;

        try {
            await queueSnapshotSave(() =>
                saveGameSnapshotAction({
                    roomId,
                    game: "broj",
                    round,
                    event: "round_result",

                    state: {
                        completed: true,
                        bluePts: summary.bluePts,
                        redPts: summary.redPts,
                        roundSummary: summary,
                    },
                })
            );
        } catch (error) {
            hasPersistedRoundRef.current = false;

            console.error("Ne mogu sačuvati rezultat Moj Broj runde:", error);
        }
    }

    // 11. ZAVRŠETAK RUNDE I BODOVANJE
    async function handleEndRoundProcessing() {
        setPhase("calculating");

        // Ako smo već submitovali, koristi zaključani finalni izraz.
        // Ako nismo, timeout koristi samo trenutni LOKALNI input.
        const finalMyRes = isMySubmitted ? myFinalResult : evaluateExpression(currentExpression);

        const finalMyExpr = isMySubmitted
            ? myFinalExpression || "Nema rešenja"
            : finalMyRes !== null
              ? currentExpression
              : "Nema rešenja";

        const finalOppExpr = opponentExpression || "Nema rešenja";
        const finalOppRes = isOpponentSubmitted ? opponentFinalResult : null;

        const blueRes = myRole === "blue" ? finalMyRes : finalOppRes;
        const blueExpr = myRole === "blue" ? finalMyExpr : finalOppExpr;

        const redRes = myRole === "red" ? finalMyRes : finalOppRes;
        const redExpr = myRole === "red" ? finalMyExpr : finalOppExpr;

        // PROSLEĐUJEMO 'round' u funkciju za kalkulaciju
        const { bluePts, redPts, blueDiff, redDiff } = calculateNumberScores(data.target, blueRes, redRes, round);

        onScoreSubmit(bluePts, redPts);

        const summary = {
            blueExpr,
            redExpr,
            blueRes,
            redRes,
            bluePts,
            redPts,
            blueDiff,
            redDiff,
        };

        setRoundSummary(summary);

        /*
            Canonical završni snapshot.
            Isti flow se koristi za oba submitovana
            i za završetak zbog timeouta.
        */
        await persistRoundResult(summary);

        const newIntermissionExpiresAt = Date.now() + 10 * 1000;
        setIntermissionExpiresAt(newIntermissionExpiresAt);
        setIntermissionTimeLeft(10);
        setPhase("intermission");
    }

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[340px] gap-4 animate-in fade-in zoom-in-95">
            {phase === "selecting" ? (
                <div className="flex flex-col items-center justify-center w-full gap-5">
                    <div className="text-center">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                            Biranje brojeva
                        </div>

                        <div className="mt-1 text-xs font-medium text-text-secondary">
                            {isRoundStarter
                                ? "Pritisni STOP kada želiš"
                                : `${roundStarter === "blue" ? "Plavi" : "Crveni"} igrač bira brojeve`}
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">
                            Traženi broj
                        </span>

                        <div className="flex items-center justify-center h-[72px] w-[120px] rounded-2xl border-2 border-primary/60 bg-surface/90 shadow-md">
                            <span className="text-4xl font-black text-primary tracking-tight">{rollingTarget}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-6 gap-2 w-full">
                        {rollingNumbers.map((value, index) => (
                            <div
                                key={`rolling-number-${index}`}
                                className="flex h-11 items-center justify-center rounded-xl border border-primary/30 bg-surface text-lg font-black text-text shadow-sm"
                            >
                                {value}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={stopNumberSelection}
                        disabled={!isRoundStarter}
                        className="w-full py-4 rounded-2xl bg-primary text-black font-black text-xl tracking-wider transition-all active:scale-[0.98] shadow-md cursor-pointer disabled:cursor-default disabled:opacity-35"
                    >
                        {isRoundStarter ? "STOP" : "ČEKANJE..."}
                    </button>
                </div>
            ) : phase !== "intermission" ? (
                <>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">
                            Traženi broj
                        </span>
                        <div className="flex items-center justify-center h-[72px] w-[120px] rounded-2xl border-2 border-primary/60 bg-surface/90 shadow-md">
                            <span className="text-4xl font-black text-primary tracking-tight">{data.target}</span>
                        </div>
                    </div>

                    <div className="w-full text-center py-3.5 px-4 bg-surface/80 border border-border rounded-2xl text-text font-bold text-base tracking-wide min-h-[50px] flex items-center justify-center shadow-inner">
                        {currentExpression || (
                            <span className="text-text-muted text-sm font-normal">Sastavljajte izraz klikom...</span>
                        )}
                    </div>

                    {!isMySubmitted && phase === "playing" ? (
                        <>
                            <div className="grid grid-cols-6 gap-2 w-full">
                                {tiles.map((tile) => (
                                    <button
                                        key={tile.id}
                                        onClick={() => handleNumberClick(tile)}
                                        disabled={tile.used}
                                        className={`flex h-11 items-center justify-center rounded-xl border text-lg font-black transition-all shadow-sm 
                                            ${
                                                tile.used
                                                    ? "bg-surface/30 border-border/40 text-text-muted opacity-40 cursor-not-allowed"
                                                    : "bg-surface border-border hover:bg-surface-light hover:border-primary/50 text-text active:scale-95 cursor-pointer"
                                            }`}
                                    >
                                        {tile.value}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-1.5 w-full mt-1">
                                {["+", "-", "*", "/", "(", ")"].map((op) => (
                                    <button
                                        key={op}
                                        onClick={() => handleOperatorClick(op)}
                                        className="flex-1 h-10 rounded-xl border border-border bg-surface hover:bg-surface-light text-text font-bold transition-all active:scale-95 cursor-pointer"
                                    >
                                        {op}
                                    </button>
                                ))}
                                <button
                                    onPointerDown={handleDeletePressStart}
                                    onPointerUp={handleDeletePressEnd}
                                    onPointerLeave={handleDeletePressCancel}
                                    onPointerCancel={handleDeletePressCancel}
                                    className="flex items-center justify-center h-10 px-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500 transition-all active:scale-95 cursor-pointer touch-none"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </button>
                            </div>

                            <button
                                onClick={handleUserSubmit}
                                disabled={history.length === 0}
                                className="w-full py-3.5 mt-2 rounded-2xl bg-primary text-black font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md cursor-pointer disabled:opacity-50"
                            >
                                Potvrdi rešenje
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-surface/60 border border-border rounded-3xl w-full gap-2 mt-4">
                            <Sparkles className="h-8 w-8 text-primary animate-bounce" />
                            <span className="text-sm font-bold text-text">
                                {phase === "calculating" ? "Bodovanje u toku..." : "Rešenje uspešno poslato!"}
                            </span>
                            <span className="text-xs text-text-secondary">
                                {isOpponentSubmitted ? "Obračunavam rezultate..." : "Čekamo protivnika da završi..."}
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <RoundIntermission
                    gameTitle="Moj Broj"
                    round={round}
                    bluePoints={roundSummary?.bluePts ?? 0}
                    redPoints={roundSummary?.redPts ?? 0}
                    timeLeft={intermissionTimeLeft}
                    nextLabel={round === 1 ? "Sledeća runda za" : "Sledeća igra za"}
                    topContent={
                        <div className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-black text-primary">
                            <Target className="h-4 w-4" />
                            Cilj: {data.target}
                        </div>
                    }
                    blueDetail={
                        <div className="flex flex-col gap-1">
                            <span className="truncate font-black text-text">
                                {roundSummary?.blueExpr || "Nema rešenja"}
                            </span>
                            <span>
                                Rezultat: {roundSummary?.blueRes ?? "-"}
                                {roundSummary?.blueDiff !== Infinity && roundSummary?.blueDiff !== undefined
                                    ? ` · razlika ${roundSummary.blueDiff}`
                                    : ""}
                            </span>
                        </div>
                    }
                    redDetail={
                        <div className="flex flex-col gap-1">
                            <span className="truncate font-black text-text">
                                {roundSummary?.redExpr || "Nema rešenja"}
                            </span>
                            <span>
                                Rezultat: {roundSummary?.redRes ?? "-"}
                                {roundSummary?.redDiff !== Infinity && roundSummary?.redDiff !== undefined
                                    ? ` · razlika ${roundSummary.redDiff}`
                                    : ""}
                            </span>
                        </div>
                    }
                />
            )}
        </div>
    );
}
