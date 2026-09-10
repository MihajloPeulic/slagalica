"use client";

import { useState, useEffect, useRef } from "react";
import { HelpCircle } from "lucide-react";
import Image from "next/image";
import { RoundIntermission } from "@/game_components/RoundIntermission";

const SYMBOLS = [
    {
        id: "lavic",
        name: "Lavić",
        symbol: (
            <Image src="/symbols/lav1.webp" alt="Lavić" width={32} height={32} className="h-8 w-8 object-contain" />
        ),
    },
    {
        id: "dijamant",
        name: "Dijamant",
        symbol: (
            <Image src="/symbols/dijamant.webp" alt="Lavić" width={32} height={32} className="h-7 w-7 object-contain" />
        ),
    },
    {
        id: "detelina",
        name: "Detelina",
        symbol: (
            <Image
                src="/symbols/djetelina.webp"
                alt="Lavić"
                width={32}
                height={32}
                className="h-7 w-7 object-contain"
            />
        ),
    },
    {
        id: "munja",
        name: "Munja",
        symbol: (
            <Image src="/symbols/munja.webp" alt="Lavić" width={32} height={32} className="h-7 w-7 object-contain" />
        ),
    },
    {
        id: "vatra",
        name: "Vatra",
        symbol: (
            <Image src="/symbols/vatra.webp" alt="Lavić" width={32} height={32} className="h-7 w-7 object-contain" />
        ),
    },
    {
        id: "mesec",
        name: "Mesec",
        symbol: (
            <Image src="/symbols/mesec.webp" alt="Lavić" width={32} height={32} className="h-7 w-7 object-contain" />
        ),
    },
];

interface SkockoProps {
    myRole: "blue" | "red";
    syncEpoch?: number;
    preferPeerSync?: boolean;
    isPaused?: boolean;
    pauseVersion?: number;
    resumeShiftMs?: number;
    onPeerSyncComplete?: () => void;
    round: number; // 1 ili 2
    data: { secretCode: string[] };
    initialState?: any;
    onPersistState?: (event: "state_sync" | "row_check" | "round_result", state: Record<string, unknown>) => void;
    sendBroadcast: (payload: any) => void;
    incomingBroadcast?: any;
    onScoreSubmit: (bluePoints: number, redPoints: number) => void;
    onNextRound: () => void;
    onTimerTick: (timeLeft: number) => void;
}

export function Skocko({
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
    onPersistState,
    sendBroadcast,
    incomingBroadcast,
    onScoreSubmit,
    onNextRound,
    onTimerTick,
}: SkockoProps) {
    // Faze: potez nosioca runde -> šansa za protivnika -> kraj runde
    const [phase, setPhase] = useState<"primary_turn" | "secondary_turn" | "intermission">("primary_turn");

    // Timestampovi su source of truth za tajmere, da refresh ne resetuje vrijeme.
    const [gameExpiresAt, setGameExpiresAt] = useState(() => Date.now() + 60 * 1000);
    const [intermissionExpiresAt, setIntermissionExpiresAt] = useState(0);
    const [intermissionTimeLeft, setIntermissionTimeLeft] = useState(10);

    // 7 redova umesto 6 (6 za primarnog igrača, 1 za protivnika)
    const [rows, setRows] = useState<string[][]>(Array.from({ length: 7 }, () => Array(4).fill("")));
    const [hints, setHints] = useState<string[][]>(Array.from({ length: 7 }, () => Array(4).fill("none")));

    const [currentRow, setCurrentRow] = useState(0);
    const [currentCol, setCurrentCol] = useState(0);

    const [finalScores, setFinalScores] = useState({ blue: 0, red: 0 });
    const scoreSubmitted = useRef(false);
    const hasReceivedSyncRef = useRef(false);
    const syncRequestIdRef = useRef<string | null>(null);
    const syncRetryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const isSyncReadyRef = useRef(false);
    const hasPersistedRoundRef = useRef(false);
    const initializedRoundRef = useRef<number | null>(null);
    const lastAppliedPauseVersionRef = useRef(pauseVersion);

    // Određujemo čija je prva faza (Runda 1 -> Plavi, Runda 2 -> Crveni)
    const isPrimary = (round === 1 && myRole === "blue") || (round === 2 && myRole === "red");

    // Da li smem JA da klikam na tablu u ovom trenutku?
    const canPlay =
        !isPaused && ((isPrimary && phase === "primary_turn") || (!isPrimary && phase === "secondary_turn"));

    const gameSnapshot = useRef({
        phase,
        gameExpiresAt,
        intermissionExpiresAt,
        rows,
        hints,
        currentRow,
        currentCol,
        finalScores,
    });

    // ================= 1. INICIJALIZACIJA / REDIS RESTORE =================
    useEffect(() => {
        if (initializedRoundRef.current === round) return;
        initializedRoundRef.current = round;

        scoreSubmitted.current = false;
        hasReceivedSyncRef.current = false;
        syncRequestIdRef.current = null;
        isSyncReadyRef.current = false;
        hasPersistedRoundRef.current = false;

        if (myRole === "blue" && !preferPeerSync && initialState && initialState.completed !== true) {
            const restoredRows = Array.isArray(initialState.rows)
                ? initialState.rows
                : Array.from({ length: 7 }, () => Array(4).fill(""));

            const restoredHints = Array.isArray(initialState.hints)
                ? initialState.hints
                : Array.from({ length: 7 }, () => Array(4).fill("none"));

            setRows(restoredRows);
            setHints(restoredHints);
            setCurrentRow(typeof initialState.currentRow === "number" ? initialState.currentRow : 0);
            setCurrentCol(typeof initialState.currentCol === "number" ? initialState.currentCol : 0);

            if (
                initialState.phase === "primary_turn" ||
                initialState.phase === "secondary_turn" ||
                initialState.phase === "intermission"
            ) {
                setPhase(initialState.phase);
            } else {
                setPhase("primary_turn");
            }

            setGameExpiresAt(
                typeof initialState.gameExpiresAt === "number" ? initialState.gameExpiresAt : Date.now() + 60 * 1000
            );
            setIntermissionExpiresAt(
                typeof initialState.intermissionExpiresAt === "number" ? initialState.intermissionExpiresAt : 0
            );
            const restoredPhase: "primary_turn" | "secondary_turn" | "intermission" =
                initialState.phase === "primary_turn" ||
                initialState.phase === "secondary_turn" ||
                initialState.phase === "intermission"
                    ? initialState.phase
                    : "primary_turn";

            const restoredGameExpiresAt =
                typeof initialState.gameExpiresAt === "number" ? initialState.gameExpiresAt : Date.now() + 60 * 1000;

            const restoredIntermissionExpiresAt =
                typeof initialState.intermissionExpiresAt === "number" ? initialState.intermissionExpiresAt : 0;

            const restoredFinalScores =
                initialState.finalScores && typeof initialState.finalScores === "object"
                    ? initialState.finalScores
                    : { blue: 0, red: 0 };

            setFinalScores(restoredFinalScores);

            /*
                React setState se primjenjuje tek na narednom renderu.
                Zato canonical snapshot odmah upisujemo u ref prije nego
                što BLUE smije odgovoriti RED-u.
            */
            gameSnapshot.current = {
                phase: restoredPhase,
                gameExpiresAt: restoredGameExpiresAt,
                intermissionExpiresAt: restoredIntermissionExpiresAt,
                rows: restoredRows,
                hints: restoredHints,
                currentRow: typeof initialState.currentRow === "number" ? initialState.currentRow : 0,
                currentCol: typeof initialState.currentCol === "number" ? initialState.currentCol : 0,
                finalScores: restoredFinalScores,
            };

            isSyncReadyRef.current = true;

            return;
        }

        /*
            RED uvijek, a BLUE nakon peer-first room restore-a, prvo čeka
            živi peer. Ne stvaramo fresh canonical state dok taj sync traje.
        */
        if (myRole === "red" || (myRole === "blue" && preferPeerSync)) {
            return;
        }

        const initialGameExpiresAt = Date.now() + 60 * 1000;

        const initialRows = Array.from({ length: 7 }, () => Array(4).fill(""));

        const initialHints = Array.from({ length: 7 }, () => Array(4).fill("none"));

        setRows(initialRows);
        setHints(initialHints);
        setCurrentRow(0);
        setCurrentCol(0);
        setGameExpiresAt(initialGameExpiresAt);
        setIntermissionExpiresAt(0);
        setIntermissionTimeLeft(10);
        setPhase("primary_turn");
        setFinalScores({ blue: 0, red: 0 });

        /*
            Prvi timestamp mora biti persistentan i prije
            prvog potvrđenog reda, inače bi refresh restartao 60s.
        */
        if (myRole === "blue") {
            /*
                Fresh BLUE je odmah canonical.
                Ref punimo sinhrono da rani RED request ne dobije
                default/staro stanje.
            */
            gameSnapshot.current = {
                phase: "primary_turn",
                gameExpiresAt: initialGameExpiresAt,
                intermissionExpiresAt: 0,
                rows: initialRows,
                hints: initialHints,
                currentRow: 0,
                currentCol: 0,
                finalScores: { blue: 0, red: 0 },
            };

            isSyncReadyRef.current = true;

            onPersistState?.("state_sync", {
                completed: false,
                phase: "primary_turn",
                gameExpiresAt: initialGameExpiresAt,
                intermissionExpiresAt: 0,
                rows: initialRows,
                hints: initialHints,
                currentRow: 0,
                currentCol: 0,
                finalScores: { blue: 0, red: 0 },
            });
        }
    }, [data.secretCode.join(","), round, myRole, initialState]);

    useEffect(() => {
        gameSnapshot.current = {
            phase,
            gameExpiresAt,
            intermissionExpiresAt,
            rows,
            hints,
            currentRow,
            currentCol,
            finalScores,
        };
    }, [phase, gameExpiresAt, intermissionExpiresAt, rows, hints, currentRow, currentCol, finalScores]);

    function clearSyncRetryTimers() {
        syncRetryTimersRef.current.forEach((timer) => clearTimeout(timer));
        syncRetryTimersRef.current = [];
    }

    function sendInitialSyncRequest() {
        const shouldRequest = myRole === "red" || (myRole === "blue" && preferPeerSync);

        if (!shouldRequest || hasReceivedSyncRef.current) return;

        if (!syncRequestIdRef.current) {
            syncRequestIdRef.current = `${Date.now()}-${myRole}-${round}-${syncEpoch}-${Math.random().toString(36).slice(2)}`;
        }

        sendBroadcast({
            type: "SKOCKO_SYNC_REQUEST",
            role: myRole,
            round,
            requestId: syncRequestIdRef.current,
        });
    }

    /*
        RED traži canonical Skočko state od BLUE-a.
        Ako prvi request ode prije nego što je BLUE listener/restore
        spreman, pokušava ponovo nakon 500 ms i 1500 ms.
    */
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

    // ================= 2. BEZBEDNI SLUŠALAC BROADCAST PORUKA =================
    useEffect(() => {
        if (!incomingBroadcast || incomingBroadcast.role === myRole) return;

        if (typeof incomingBroadcast.round === "number" && incomingBroadcast.round !== round) {
            return;
        }

        if (incomingBroadcast.type === "SKOCKO_SYNC_REQUEST") {
            if (incomingBroadcast.role === myRole || !isSyncReadyRef.current) return;

            const snapshot = gameSnapshot.current;

            sendBroadcast({
                type: "SKOCKO_SYNC_RESPONSE",
                role: myRole,
                round,
                requestId: incomingBroadcast.requestId,
                phase: snapshot.phase,
                gameExpiresAt: snapshot.gameExpiresAt,
                intermissionExpiresAt: snapshot.intermissionExpiresAt,
                rows: snapshot.rows,
                hints: snapshot.hints,
                currentRow: snapshot.currentRow,
                currentCol: snapshot.currentCol,
                finalScores: snapshot.finalScores,
            });

            return;
        }

        if (incomingBroadcast.type === "SKOCKO_SYNC_RESPONSE") {
            if (
                typeof incomingBroadcast.requestId !== "string" ||
                incomingBroadcast.requestId !== syncRequestIdRef.current
            ) {
                return;
            }

            const shouldAcceptPeerSync = myRole === "red" || (myRole === "blue" && preferPeerSync);

            if (!shouldAcceptPeerSync || incomingBroadcast.role === myRole) return;

            if (hasReceivedSyncRef.current) return;
            hasReceivedSyncRef.current = true;
            syncRequestIdRef.current = null;
            clearSyncRetryTimers();
            isSyncReadyRef.current = true;

            onPeerSyncComplete?.();

            if (
                incomingBroadcast.phase === "primary_turn" ||
                incomingBroadcast.phase === "secondary_turn" ||
                incomingBroadcast.phase === "intermission"
            ) {
                setPhase(incomingBroadcast.phase);
            }

            if (typeof incomingBroadcast.gameExpiresAt === "number") {
                setGameExpiresAt(incomingBroadcast.gameExpiresAt);
            }

            if (typeof incomingBroadcast.intermissionExpiresAt === "number") {
                setIntermissionExpiresAt(incomingBroadcast.intermissionExpiresAt);
            }

            if (Array.isArray(incomingBroadcast.rows)) {
                setRows(incomingBroadcast.rows);
            }

            if (Array.isArray(incomingBroadcast.hints)) {
                setHints(incomingBroadcast.hints);
            }

            if (typeof incomingBroadcast.currentRow === "number") {
                setCurrentRow(incomingBroadcast.currentRow);
            }

            if (typeof incomingBroadcast.currentCol === "number") {
                setCurrentCol(incomingBroadcast.currentCol);
            }

            if (incomingBroadcast.finalScores) {
                setFinalScores(incomingBroadcast.finalScores);
            }

            if (incomingBroadcast.phase === "intermission") {
                scoreSubmitted.current = true;
            }

            return;
        }

        if (incomingBroadcast.type === "SKOCKO_PERSIST_REQUEST") {
            if (myRole === "blue" && incomingBroadcast.state && typeof incomingBroadcast.event === "string") {
                onPersistState?.(incomingBroadcast.event, incomingBroadcast.state);
            }

            return;
        }

        if (incomingBroadcast.type === "SKOCKO_SYNC") {
            setRows(incomingBroadcast.rows);
            setHints(incomingBroadcast.hints);
            setCurrentRow(incomingBroadcast.currentRow);
            setCurrentCol(incomingBroadcast.currentCol);
        } else if (incomingBroadcast.type === "SKOCKO_SECONDARY_TURN") {
            setRows(incomingBroadcast.rows);
            setHints(incomingBroadcast.hints);
            setPhase("secondary_turn");
            setCurrentRow(6);
            setCurrentCol(0);
            setGameExpiresAt(
                typeof incomingBroadcast.gameExpiresAt === "number"
                    ? incomingBroadcast.gameExpiresAt
                    : Date.now() + 15 * 1000
            );
        } else if (incomingBroadcast.type === "SKOCKO_END_ROUND") {
            setRows(incomingBroadcast.rows);
            setHints(incomingBroadcast.hints);
            setFinalScores({ blue: incomingBroadcast.bluePts, red: incomingBroadcast.redPts });
            setIntermissionExpiresAt(
                typeof incomingBroadcast.intermissionExpiresAt === "number"
                    ? incomingBroadcast.intermissionExpiresAt
                    : Date.now() + 10 * 1000
            );
            setIntermissionTimeLeft(10);
            setPhase("intermission");
        }
    }, [incomingBroadcast, myRole, round, preferPeerSync]);

    /*
        DB pause_version se povećava tačno jednom kada se disconnect claim
        uspješno poništi. Pomjeramo sve aktivne absolute deadlineove za
        server-izmjereno trajanje pauze, pa oba clienta nastavljaju sa istim
        preostalim vremenom.
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

        let shiftedGameExpiresAt = snapshot.gameExpiresAt;
        let shiftedIntermissionExpiresAt = snapshot.intermissionExpiresAt;

        if (snapshot.phase === "primary_turn") {
            shiftedGameExpiresAt = shiftActiveDeadline(snapshot.gameExpiresAt, 60_000);
        } else if (snapshot.phase === "secondary_turn") {
            shiftedGameExpiresAt = shiftActiveDeadline(snapshot.gameExpiresAt, 15_000);
        } else if (snapshot.phase === "intermission") {
            shiftedIntermissionExpiresAt = shiftActiveDeadline(snapshot.intermissionExpiresAt, 10_000);
        }

        setGameExpiresAt(shiftedGameExpiresAt);
        setIntermissionExpiresAt(shiftedIntermissionExpiresAt);

        gameSnapshot.current = {
            ...snapshot,
            gameExpiresAt: shiftedGameExpiresAt,
            intermissionExpiresAt: shiftedIntermissionExpiresAt,
        };

        if (myRole === "blue" && isSyncReadyRef.current) {
            onPersistState?.("state_sync", {
                completed: false,
                ...gameSnapshot.current,
            });
        }
    }, [pauseVersion, resumeShiftMs, myRole]);

    // ================= 3. TAJMER IGRE =================
    useEffect(() => {
        if (isPaused) return;
        if (phase !== "primary_turn" && phase !== "secondary_turn") return;

        const tick = () => {
            const timeLeft = Math.max(0, Math.ceil((gameExpiresAt - Date.now()) / 1000));

            onTimerTick(timeLeft);

            if (timeLeft <= 0) {
                if (isPrimary && phase === "primary_turn") {
                    triggerSecondaryTurn(rows, hints);
                } else if (!isPrimary && phase === "secondary_turn") {
                    triggerEndRound(0, rows, hints);
                }

                return true;
            }

            return false;
        };

        if (tick()) return;

        const timer = setInterval(() => {
            if (tick()) clearInterval(timer);
        }, 250);

        return () => clearInterval(timer);
    }, [gameExpiresAt, phase, isPrimary, rows, hints, isPaused]);

    // ================= 4. TAJMER INTERMISIJE =================
    useEffect(() => {
        if (phase !== "intermission" || isPaused) return;

        if (!scoreSubmitted.current) {
            scoreSubmitted.current = true;

            onScoreSubmit(finalScores.blue, finalScores.red);

            /*
                Finalni row-check i kraj runde su jedan canonical
                snapshot. Score je već upisan u parent ref prije
                ovog persistence callbacka.
            */
            if (myRole === "blue" && !hasPersistedRoundRef.current) {
                hasPersistedRoundRef.current = true;

                const snapshot = gameSnapshot.current;

                onPersistState?.("round_result", {
                    completed: true,
                    phase: "intermission",
                    gameExpiresAt: snapshot.gameExpiresAt,
                    intermissionExpiresAt: snapshot.intermissionExpiresAt,
                    rows: snapshot.rows,
                    hints: snapshot.hints,
                    currentRow: snapshot.currentRow,
                    currentCol: snapshot.currentCol,
                    finalScores: snapshot.finalScores,
                });
            }
        }

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
            if (tick()) clearInterval(timer);
        }, 250);

        return () => clearInterval(timer);
    }, [intermissionExpiresAt, phase, finalScores, isPaused]);

    // ================= 5. INTERAKCIJE SA TABLOM =================
    function persistOrRelay(event: "state_sync" | "row_check", state: Record<string, unknown>) {
        if (myRole === "blue") {
            onPersistState?.(event, state);
            return;
        }

        sendBroadcast({
            type: "SKOCKO_PERSIST_REQUEST",
            role: myRole,
            round,
            event,
            state,
        });
    }

    function broadcastSync(newRows: string[][], newHints: string[][], newRow: number, newCol: number) {
        sendBroadcast({
            type: "SKOCKO_SYNC",
            role: myRole,
            round,
            rows: newRows,
            hints: newHints,
            currentRow: newRow,
            currentCol: newCol,
        });
    }

    function handleSymbolSelect(symbolId: string) {
        if (!canPlay || currentCol >= 4 || currentRow >= 7) return;

        const updatedRows = [...rows];
        updatedRows[currentRow] = [...updatedRows[currentRow]];
        updatedRows[currentRow][currentCol] = symbolId;

        const nextCol = currentCol < 3 ? currentCol + 1 : 3;

        setRows(updatedRows);
        setCurrentCol(nextCol);
        broadcastSync(updatedRows, hints, currentRow, nextCol);
    }

    function handleTileClick(colIndex: number) {
        if (!canPlay) return;

        const activeRow = rows[currentRow];
        const lastFilledIndex = activeRow
            .map((val, idx) => (val !== "" ? idx : -1))
            .filter((idx) => idx !== -1)
            .pop();

        if (lastFilledIndex !== undefined && colIndex === lastFilledIndex) {
            const updatedRows = [...rows];
            updatedRows[currentRow] = [...updatedRows[currentRow]];
            updatedRows[currentRow][colIndex] = "";

            setRows(updatedRows);
            setCurrentCol(colIndex);
            broadcastSync(updatedRows, hints, currentRow, colIndex);
        }
    }

    // ================= 6. POTVRDA I LOGIKA BODOVANJA =================
    function handleConfirmRow(rIdx: number) {
        if (!canPlay || rIdx !== currentRow || rows[rIdx][3] === "") return;

        const guess = [...rows[rIdx]];
        const codeCopy = [...data.secretCode];

        let hits = 0;
        let almosts = 0;

        for (let i = 0; i < 4; i++) {
            if (guess[i] === codeCopy[i]) {
                hits++;
                codeCopy[i] = "used";
                guess[i] = "checked";
            }
        }

        for (let i = 0; i < 4; i++) {
            if (guess[i] !== "checked") {
                const foundIndex = codeCopy.indexOf(guess[i]);
                if (foundIndex !== -1) {
                    almosts++;
                    codeCopy[foundIndex] = "used";
                }
            }
        }

        const rowHints = [];
        for (let i = 0; i < hits; i++) rowHints.push("hit");
        for (let i = 0; i < almosts; i++) rowHints.push("almost");
        while (rowHints.length < 4) rowHints.push("none");

        const updatedHints = [...hints];
        updatedHints[rIdx] = rowHints;
        setHints(updatedHints);

        if (hits === 4) {
            let pts = rIdx < 3 ? 20 : rIdx < 5 ? 15 : 10;
            triggerEndRound(pts, rows, updatedHints);
        } else {
            if (rIdx === 5) {
                // Primarni je promašio sve - prelazak na šansu protivnika!
                triggerSecondaryTurn(rows, updatedHints, "row_check");
            } else if (rIdx === 6) {
                // Protivnik je promašio krađu - kraj sa nula poena
                triggerEndRound(0, rows, updatedHints);
            } else {
                // Nije kraj, nastavlja se sledeći red
                const nextRow = rIdx + 1;

                setCurrentRow(nextRow);
                setCurrentCol(0);
                broadcastSync(rows, updatedHints, nextRow, 0);

                persistOrRelay("row_check", {
                    completed: false,
                    phase,
                    gameExpiresAt,
                    intermissionExpiresAt,
                    rows,
                    hints: updatedHints,
                    currentRow: nextRow,
                    currentCol: 0,
                    finalScores,
                });
            }
        }
    }

    // Pomoćne funkcije za prelazak stanja
    function triggerSecondaryTurn(
        syncRows: string[][],
        syncHints: string[][],
        persistEvent: "state_sync" | "row_check" = "state_sync"
    ) {
        if (isPaused) return;

        const newGameExpiresAt = Date.now() + 15 * 1000;

        setPhase("secondary_turn");
        setCurrentRow(6);
        setCurrentCol(0);
        setGameExpiresAt(newGameExpiresAt);

        sendBroadcast({
            type: "SKOCKO_SECONDARY_TURN",
            role: myRole,
            round,
            rows: syncRows,
            hints: syncHints,
            gameExpiresAt: newGameExpiresAt,
        });

        persistOrRelay(persistEvent, {
            completed: false,
            phase: "secondary_turn",
            gameExpiresAt: newGameExpiresAt,
            intermissionExpiresAt: 0,
            rows: syncRows,
            hints: syncHints,
            currentRow: 6,
            currentCol: 0,
            finalScores,
        });
    }

    function triggerEndRound(pts: number, finalRows: string[][], finalHints: string[][]) {
        if (isPaused) return;

        let bluePts = 0;
        let redPts = 0;

        // Računamo kome idu poeni na osnovu runde i trenutne faze
        if (round === 1) {
            if (phase === "primary_turn") bluePts = pts;
            else if (phase === "secondary_turn") redPts = pts;
        } else {
            if (phase === "primary_turn") redPts = pts;
            else if (phase === "secondary_turn") bluePts = pts;
        }

        const newIntermissionExpiresAt = Date.now() + 10 * 1000;

        setFinalScores({ blue: bluePts, red: redPts });
        setIntermissionExpiresAt(newIntermissionExpiresAt);
        setIntermissionTimeLeft(10);
        setPhase("intermission");

        sendBroadcast({
            type: "SKOCKO_END_ROUND",
            role: myRole,
            round,
            bluePts,
            redPts,
            rows: finalRows,
            hints: finalHints,
            intermissionExpiresAt: newIntermissionExpiresAt,
        });
    }

    return (
        <div className="flex max-h-[calc(100dvh-7rem)] w-full max-w-[360px] origin-center flex-col items-center justify-center gap-[clamp(0.25rem,0.75dvh,0.5rem)] overflow-visible [@media(max-height:640px)]:scale-[0.95] [@media(max-height:580px)]:scale-[0.88] animate-in fade-in zoom-in-95">
            {phase !== "intermission" ? (
                <>
                    <div className="flex flex-col items-center pt-1">
                        {phase === "primary_turn" && (
                            <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">
                                Na potezu:{" "}
                                <strong className={round === 1 ? "text-blue-500" : "text-red-500"}>
                                    {round === 1 ? "Plavi" : "Crveni"}
                                </strong>{" "}
                                igrač
                            </span>
                        )}
                        {phase === "secondary_turn" && (
                            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-500 animate-bounce shadow-sm">
                                Šansa za{" "}
                                <strong className={round === 1 ? "text-red-500" : "text-blue-500"}>
                                    {round === 1 ? "Crvenog" : "Plavog"}
                                </strong>
                                !
                            </span>
                        )}
                    </div>

                    {/* TABLA ZA SKOCKA (7 REDOVA) */}
                    <div className="flex w-[min(88vw,43dvh,310px)] flex-col gap-[clamp(0.12rem,0.45dvh,0.3rem)]">
                        {rows.map((row, rIdx) => {
                            const isCurrentRow = rIdx === currentRow;
                            const isRowComplete = row[3] !== "";
                            const isOpponentRow = rIdx === 6;

                            return (
                                <div
                                    key={rIdx}
                                    className={`grid w-full grid-cols-6 items-center gap-1.5 rounded-xl border px-1.5 py-[clamp(0.1rem,0.35dvh,0.25rem)] transition-all
                                        ${isOpponentRow ? "mt-[clamp(0.18rem,0.6dvh,0.5rem)] border-t-[3px] border-t-red-500/40 bg-red-500/5" : ""}
                                        ${isCurrentRow && canPlay ? "bg-surface/90 border-primary/60 shadow-[0_0_15px_rgba(245,158,11,0.1)]" : ""}
                                        ${isCurrentRow && !canPlay ? "bg-surface/70 border-primary/30" : ""}
                                        ${!isCurrentRow ? "bg-surface/40 border-border/50 opacity-70" : ""}
                                    `}
                                >
                                    <div className="col-span-4 grid min-w-0 grid-cols-4 gap-1.5">
                                        {row.map((val, cIdx) => {
                                            const symbolObj = SYMBOLS.find((s) => s.id === val);
                                            return (
                                                <button
                                                    key={cIdx}
                                                    onClick={() => canPlay && isCurrentRow && handleTileClick(cIdx)}
                                                    disabled={!canPlay || !isCurrentRow || !val}
                                                    className={`flex aspect-square w-full items-center justify-center rounded-xl border border-border bg-background text-lg transition-all shadow-inner
                                                        ${isCurrentRow && cIdx === currentCol && canPlay ? "border-primary ring-2 ring-primary/20 animate-pulse" : ""}
                                                        ${isCurrentRow && val && canPlay ? "hover:border-red-500/50 hover:bg-red-500/5 cursor-pointer" : "cursor-default"}
                                                    `}
                                                >
                                                    {symbolObj ? symbolObj.symbol : ""}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {rIdx < currentRow || (phase === "secondary_turn" && rIdx < 6) ? (
                                        <div
                                            className="
                                                col-span-2
                                                flex
                                                h-full
                                                min-h-0
                                                w-full
                                                items-center
                                                justify-evenly
                                                rounded-xl
                                                border
                                                border-border
                                                bg-background/50
                                                px-2
                                            "
                                        >
                                            {hints[rIdx].map((hintType, pIdx) => (
                                                <div
                                                    key={pIdx}
                                                    className={`h-2 w-2 rounded-full border transition-colors
                                                        ${hintType === "hit" ? "bg-red-500 border-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" : ""}
                                                        ${hintType === "almost" ? "bg-amber-400 border-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" : ""}
                                                        ${hintType === "none" ? "bg-surface-light border-border" : ""}
                                                    `}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleConfirmRow(rIdx)}
                                            disabled={!canPlay || !isCurrentRow || !isRowComplete}
                                            className={`col-span-2 flex h-full min-h-0 w-full items-center justify-center rounded-xl border transition-all shadow-sm
                                                ${
                                                    isCurrentRow && isRowComplete && canPlay
                                                        ? "bg-primary border-primary text-black hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
                                                        : "bg-surface/50 border-border text-text-muted opacity-40 cursor-not-allowed"
                                                }`}
                                        >
                                            <HelpCircle className="h-5 w-5 stroke-[2.5]" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* TASTATURA SIMBOLA */}
                    <div className="grid w-[min(88vw,43dvh,310px)] grid-cols-6 gap-1.5 px-1.5">
                        {SYMBOLS.map((sym) => (
                            <button
                                key={sym.id}
                                onClick={() => handleSymbolSelect(sym.id)}
                                disabled={!canPlay}
                                className={`flex aspect-square w-full items-center justify-center rounded-xl border border-border text-xl transition-all shadow-sm
                                    ${
                                        canPlay
                                            ? "bg-surface hover:bg-surface-light hover:border-primary/50 active:scale-95 cursor-pointer"
                                            : "bg-surface/30 opacity-50 cursor-not-allowed"
                                    }`}
                            >
                                {sym.symbol}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <RoundIntermission
                    gameTitle="Skočko"
                    round={round}
                    bluePoints={finalScores.blue}
                    redPoints={finalScores.red}
                    timeLeft={intermissionTimeLeft}
                    nextLabel={round === 1 ? "Sledeća runda za" : "Sledeća igra za"}
                    bottomContent={
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-3">
                            <span className="text-[9px] font-black uppercase tracking-wide text-text-muted">
                                Tražena kombinacija
                            </span>
                            <div className="flex items-center gap-1.5">
                                {data.secretCode.map((symId, index) => (
                                    <span key={index} className="text-2xl">
                                        {SYMBOLS.find((symbol) => symbol.id === symId)?.symbol}
                                    </span>
                                ))}
                            </div>
                        </div>
                    }
                />
            )}
        </div>
    );
}
