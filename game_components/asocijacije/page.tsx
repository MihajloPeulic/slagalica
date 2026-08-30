"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Check, ArrowRight, HelpCircle, Clock } from "lucide-react";

type Player = "blue" | "red";
type ColKey = "A" | "B" | "C" | "D";
type Phase = "preparing" | "playing" | "transition" | "intermission" | "celebration";

export interface AsocijacijeRoundData {
    kolone: {
        A: { fields: string[]; sol: string[] };
        B: { fields: string[]; sol: string[] };
        C: { fields: string[]; sol: string[] };
        D: { fields: string[]; sol: string[] };
    };
    konacno: string[];
}

interface AsocijacijeProps {
    myRole: Player;
    round: 1 | 2;
    data: AsocijacijeRoundData;
    sendBroadcast: (payload: any) => void;
    incomingBroadcast?: any;
    onScoreSubmit: (bluePoints: number, redPoints: number) => void;
    onNextRound: () => void;
    onTimerTick: (timeLeft: number) => void;
}

const COLS: ColKey[] = ["A", "B", "C", "D"];

export function Asocijacije({
    myRole,
    round,
    data,
    sendBroadcast,
    incomingBroadcast,
    onScoreSubmit,
    onNextRound,
    onTimerTick
}: AsocijacijeProps) {
    const roundStarter: Player = round === 1 ? "blue" : "red";

    const [activePlayer, setActivePlayer] = useState<Player>(roundStarter);
    const [phase, setPhase] = useState<Phase>("preparing");

    const [blueScore, setBlueScore] = useState(0);
    const [redScore, setRedScore] = useState(0);

    const [prepareTimeLeft, setPrepareTimeLeft] = useState(5);
    const [expiresAt, setExpiresAt] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const [transitionTimer, setTransitionTimer] = useState(0);
    const [summaryTimeLeft, setSummaryTimeLeft] = useState(10);

    const [openedFields, setOpenedFields] = useState<string[]>([]);
    const [solvedCols, setSolvedCols] = useState<Record<ColKey, Player | null>>({
        A: null, B: null, C: null, D: null
    });

    // Pomoćni state za efekat sakupljanja boje pojedinačne kolone
    const [lastSolvedCol, setLastSolvedCol] = useState<{ col: ColKey, time: number } | null>(null);

    const [finalSolvedBy, setFinalSolvedBy] = useState<Player | null>(null);

    // true = trenutni igrač još smije otvoriti svoje jedno numerisano polje
    const [canOpenField, setCanOpenField] = useState(true);

    const [remainingAttempts, setRemainingAttempts] = useState({
        blue: 2,
        red: 2
    });

    const [modalTarget, setModalTarget] = useState<ColKey | "FINAL" | null>(null);
    const [inputValue, setInputValue] = useState("");
    const [isError, setIsError] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Sprečava da timeout / button / timer završe isti potez više puta.
    const turnEndingRef = useRef(false);

    // Sprečava da se kraj igre pokrene više puta.
    const gameEndedRef = useRef(false);

    const allFieldsOpened = openedFields.length === 16;
    const isMyTurn = myRole === activePlayer;

    function normalize(str: string) {
        return str
            .toLowerCase()
            .replace(/dž/g, "dz")
            .replace(/[čć]/g, "c")
            .replace(/š/g, "s")
            .replace(/ž/g, "z")
            .replace(/đ/g, "dj")
            .trim();
    }

    function addPoints(player: Player, points: number) {
        if (player === "blue") {
            setBlueScore(prev => prev + points);
            onScoreSubmit(points, 0);
        } else {
            setRedScore(prev => prev + points);
            onScoreSubmit(0, points);
        }
    }

    function calculateColPoints(col: ColKey) {
        const unopened = [1, 2, 3, 4]
            .map(num => `${col}${num}`)
            .filter(field => !openedFields.includes(field))
            .length;

        return 2 + unopened;
    }

    function calculateFinalPoints() {
        let points = 5;
        COLS.forEach(col => {
            if (!solvedCols[col]) {
                points += calculateColPoints(col);
            }
        });
        return points;
    }

    function hasOpenedFieldInCol(col: ColKey) {
        return openedFields.some(field => field.startsWith(col));
    }

    // Poziva se kada istrošimo pokušaje bez pogađanja konačnog (brzi prelazak)
    function triggerEndGame() {
        if (gameEndedRef.current) return;
        gameEndedRef.current = true;
        turnEndingRef.current = true;

        setPhase("intermission");
        setSummaryTimeLeft(10);
        setExpiresAt(null);
        setModalTarget(null);
        setInputValue("");
    }

    // Poziva se kada se tačno pogodi KONAČNO (lepa kaskadna animacija)
    function triggerCelebration(player: Player, pts: number) {
        if (gameEndedRef.current) return;
        gameEndedRef.current = true;
        turnEndingRef.current = true;

        setPhase("celebration");
        setExpiresAt(null);
        setModalTarget(null);
        setInputValue("");

        setSolvedCols(prev => {
            const updated = { ...prev };
            COLS.forEach(col => {
                if (!updated[col]) updated[col] = player;
            });
            return updated;
        });
        setFinalSolvedBy(player);
        addPoints(player, pts);

        // Sačekamo da kaskadne CSS animacije završe pa onda prebacimo na Intermission ekran
        setTimeout(() => {
            setPhase("intermission");
            setSummaryTimeLeft(10);
        }, 4000); 
    }

    function handlePassTurnLocal() {
        if (turnEndingRef.current || phase !== "playing") return false;

        turnEndingRef.current = true;
        setModalTarget(null);

        if (allFieldsOpened) {
            const attempts = { ...remainingAttempts };
            if (attempts[activePlayer] > 0) attempts[activePlayer] -= 1;
            setRemainingAttempts(attempts);

            if (attempts.blue === 0 && attempts.red === 0) {
                triggerEndGame();
                return true;
            }
        }

        setPhase("transition");
        setTransitionTimer(3);

        return true;
    }

    // ============================================================
    // INIT
    // ============================================================

    useEffect(() => {
        setActivePlayer(roundStarter);
        setPhase("preparing");
        setBlueScore(0);
        setRedScore(0);
        setOpenedFields([]);
        setSolvedCols({ A: null, B: null, C: null, D: null });
        setLastSolvedCol(null);
        setFinalSolvedBy(null);
        setCanOpenField(true);
        setRemainingAttempts({ blue: 2, red: 2 });
        setPrepareTimeLeft(5);
        setExpiresAt(null);
        setTimeLeft(30);
        setTransitionTimer(0);
        setSummaryTimeLeft(10);
        setModalTarget(null);
        setInputValue("");
        setIsError(false);

        turnEndingRef.current = false;
        gameEndedRef.current = false;
    }, [round, roundStarter]);

    // ============================================================
    // BROADCAST
    // ============================================================

    

    useEffect(() => {
        if (!incomingBroadcast || incomingBroadcast.role === myRole) return;
        const msg = incomingBroadcast;

        if (msg.type === "SYNC_REQUEST") {
            sendBroadcast({
                type: "SYNC_RESPONSE", role: myRole, phase, activePlayer, blueScore, redScore, openedFields, solvedCols,
                finalSolvedBy, canOpenField, remainingAttempts, expiresAt, transitionTimer, prepareTimeLeft, summaryTimeLeft
            });
            return;
        }

        if (msg.type === "SYNC_RESPONSE") {
            setPhase(msg.phase);
            setActivePlayer(msg.activePlayer);
            setBlueScore(msg.blueScore);
            setRedScore(msg.redScore);
            setOpenedFields(msg.openedFields ?? []);
            setSolvedCols(msg.solvedCols ?? { A: null, B: null, C: null, D: null });
            setFinalSolvedBy(msg.finalSolvedBy ?? null);
            setCanOpenField(msg.canOpenField);
            
            if (msg.remainingAttempts) {
                setRemainingAttempts(msg.remainingAttempts);
            }
            
            setExpiresAt(msg.expiresAt ?? null);
            setTransitionTimer(msg.transitionTimer ?? 0);
            
            if (typeof msg.prepareTimeLeft === "number") {
                setPrepareTimeLeft(msg.prepareTimeLeft);
            }
            if (typeof msg.summaryTimeLeft === "number") {
                setSummaryTimeLeft(msg.summaryTimeLeft);
            }

            // === NOVI DEO: SINHRONIZACIJA REFERENCI ===
            // Ako se igrač vratio u trenutku kada je igra već završena
            if (msg.phase === "intermission" || msg.phase === "celebration") {
                gameEndedRef.current = true;
                turnEndingRef.current = true;
            } else {
                gameEndedRef.current = false;
                turnEndingRef.current = false;
            }

            // Ako se sinhronizujemo u trenutku animacije osiguramo da pređemo dalje na kraju
            if (msg.phase === "celebration") {
                setTimeout(() => {
                    setPhase("intermission");
                    setSummaryTimeLeft(10);
                }, 3000);
            }
            return;
        }

        if (msg.type !== "ASOC_MOVE") return;

        if (msg.action === "OPEN") {
            setOpenedFields(prev => prev.includes(msg.field) ? prev : [...prev, msg.field]);
            setCanOpenField(false);
            return;
        }

        if (msg.action === "SOLVE_COL") {
            setLastSolvedCol({ col: msg.col, time: Date.now() });
            setSolvedCols(prev => ({ ...prev, [msg.col]: msg.player }));
            addPoints(msg.player, msg.pts);
            setCanOpenField(false);
            if (msg.newExpiresAt) setExpiresAt(msg.newExpiresAt);
            return;
        }

        if (msg.action === "SOLVE_FINAL") {
            triggerCelebration(msg.player, msg.pts);
            return;
        }

        if (msg.action === "PASS") {
            handlePassTurnLocal();
        }
    }, [incomingBroadcast, myRole]);

    useEffect(() => {
        // Čim se Asocijacije renderuju, pitamo drugog igrača za stanje
        sendBroadcast({
            type: "SYNC_REQUEST",
            role: myRole
        });
    }, []); 
    // ============================================================
    // FIELD CLICK & ANSWERS
    // ============================================================

    function handleFieldClick(field: string) {
        if (!isMyTurn || phase !== "playing" || !canOpenField || openedFields.includes(field) || turnEndingRef.current) return;

        setOpenedFields(prev => [...prev, field]);
        setCanOpenField(false);
        sendBroadcast({ type: "ASOC_MOVE", role: myRole, action: "OPEN", field });
    }

    function handleGuessSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!modalTarget || !inputValue.trim() || !isMyTurn || phase !== "playing" || turnEndingRef.current) return;

        const correctAnswers = modalTarget === "FINAL" ? data.konacno : data.kolone[modalTarget].sol;
        const correct = correctAnswers.some(answer => normalize(inputValue) === normalize(answer));

        if (correct) {
            if (modalTarget === "FINAL") handleCorrectFinal();
            else handleCorrectColumn(modalTarget);
            setModalTarget(null);
            setInputValue("");
            return;
        }

        setIsError(true);
        setTimeout(() => {
            setIsError(false);
            setModalTarget(null);
            setInputValue("");
            const processed = handlePassTurnLocal();
            if (processed) sendBroadcast({ type: "ASOC_MOVE", role: myRole, action: "PASS" });
        }, 800);
    }

    function handleCorrectColumn(col: ColKey) {
        if (solvedCols[col]) return;
        const pts = calculateColPoints(col);
        setLastSolvedCol({ col, time: Date.now() });
        setSolvedCols(prev => ({ ...prev, [col]: myRole }));
        addPoints(myRole, pts);
        setCanOpenField(false);
        sendBroadcast({ type: "ASOC_MOVE", role: myRole, action: "SOLVE_COL", col, player: myRole, pts, newExpiresAt: expiresAt });
    }

    function handleCorrectFinal() {
        if (finalSolvedBy) return;
        const pts = calculateFinalPoints();
        sendBroadcast({ type: "ASOC_MOVE", role: myRole, action: "SOLVE_FINAL", player: myRole, pts });
        triggerCelebration(myRole, pts);
    }

    // ============================================================
    // TAJMERI 
    // ============================================================

    useEffect(() => {
        if (phase !== "preparing") return;
        onTimerTick(prepareTimeLeft);
        if (prepareTimeLeft <= 0) {
            setExpiresAt(Date.now() + 30000);
            setTimeLeft(30);
            setCanOpenField(true);
            turnEndingRef.current = false;
            setPhase("playing");
            return;
        }
        const timer = setTimeout(() => setPrepareTimeLeft(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [phase, prepareTimeLeft]);

    useEffect(() => {
        if (phase !== "playing" || !expiresAt) return;
        const timer = setInterval(() => {
            const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            setTimeLeft(left);
            onTimerTick(left);
            if (left === 0 && isMyTurn && !turnEndingRef.current) {
                const processed = handlePassTurnLocal();
                if (processed) sendBroadcast({ type: "ASOC_MOVE", role: myRole, action: "PASS" });
            }
        }, 250);
        return () => clearInterval(timer);
    }, [phase, expiresAt, isMyTurn, activePlayer, allFieldsOpened, remainingAttempts]);

    useEffect(() => {
        if (phase !== "transition") return;
        onTimerTick(transitionTimer);
        if (transitionTimer > 0) {
            const timer = setTimeout(() => setTransitionTimer(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
        setActivePlayer(activePlayer === "blue" ? "red" : "blue");
        setCanOpenField(!allFieldsOpened);
        setExpiresAt(Date.now() + 30000);
        setTimeLeft(30);
        turnEndingRef.current = false;
        setPhase("playing");
    }, [phase, transitionTimer, activePlayer, allFieldsOpened]);

    useEffect(() => {
        if (phase !== "intermission") return;
        onTimerTick(summaryTimeLeft);
        if (summaryTimeLeft <= 0) {
            if (myRole === "blue") onNextRound();
            return;
        }
        const timer = setTimeout(() => setSummaryTimeLeft(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [phase, summaryTimeLeft, myRole]);

    useEffect(() => { if (modalTarget && inputRef.current) inputRef.current.focus(); }, [modalTarget]);

    // ============================================================
    // FIELD UI - Sa računanjem kašnjenja (kaskadne animacije)
    // ============================================================

    function renderField(col: ColKey, row: number) {
        const fieldKey = `${col}${row}`;
        const manuallyOpened = openedFields.includes(fieldKey);
        const solved = solvedCols[col] !== null;
        const solver = solvedCols[col];

        // LOGIKA KAŠNJENJA ZA ANIMACIJU (Od spoljašnjih ivica prema centru)
        let delayMs = 0;
        if (phase === "celebration") {
            delayMs = (col === "A" || col === "B") ? (row - 1) * 200 : (4 - row) * 200;
        } else if (lastSolvedCol?.col === col && Date.now() - lastSolvedCol.time < 2000) {
            delayMs = (col === "A" || col === "B") ? (row - 1) * 150 : (4 - row) * 150;
        }

        let style = "bg-surface/50 border-border text-text hover:bg-surface-light";
        let content = fieldKey;

        if (solved) {
            style = solver === "blue"
                ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                : "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]";
            content = data.kolone[col].fields[row - 1];
        } else if (manuallyOpened) {
            style = "bg-surface border-primary/50 text-text shadow-[0_0_10px_rgba(245,158,11,0.1)]";
            content = data.kolone[col].fields[row - 1];
        }

        const disabled = manuallyOpened || solved || phase !== "playing" || !isMyTurn || !canOpenField || turnEndingRef.current;

        return (
            <button
                key={fieldKey}
                onClick={() => handleFieldClick(fieldKey)}
                disabled={disabled}
                style={{ transitionDelay: `${delayMs}ms` }}
                className={`h-[42px] w-full flex items-center justify-center rounded-lg border text-[10px] font-bold transition-all duration-700 ease-in-out ${style} ${disabled ? "cursor-default" : "cursor-pointer active:scale-95"}`}
            >
                <span className="truncate px-1">{content}</span>
            </button>
        );
    }

    function renderColSolution(col: ColKey) {
        const solved = solvedCols[col] !== null;
        const solver = solvedCols[col];
        const hasOpened = hasOpenedFieldInCol(col);

        let delayMs = 0;
        if (phase === "celebration") {
            delayMs = 800;
        } else if (lastSolvedCol?.col === col && Date.now() - lastSolvedCol.time < 2000) {
            delayMs = 600;
        }

        const canGuess = !solved && phase === "playing" && isMyTurn && !canOpenField && hasOpened && !turnEndingRef.current;
        let style = "bg-surface/80 border-border text-text-secondary";

        if (solved) {
            style = solver === "blue"
                ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-[1.02]"
                : "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] scale-[1.02]";
        } else if (canGuess) {
            style = "bg-surface border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 cursor-pointer";
        }

        return (
            <button
                key={`sol-${col}`}
                onClick={() => setModalTarget(col)}
                disabled={!canGuess}
                style={{ transitionDelay: `${delayMs}ms` }}
                className={`h-[42px] w-full flex items-center justify-center rounded-lg border text-[10px] font-black uppercase transition-all duration-700 ease-in-out shadow-sm ${style}`}
            >
                <span className="truncate px-1">{solved ? data.kolone[col].sol[0] : `KOLONA ${col}`}</span>
            </button>
        );
    }

    const canGuessFinal = !finalSolvedBy && phase === "playing" && isMyTurn && !canOpenField && openedFields.length > 0 && !turnEndingRef.current;

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[360px] animate-in fade-in zoom-in-95 mt-[-10px]">
            <div className="flex flex-col items-center mb-5 z-10">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Asocijacije (Runda {round})
                </span>

                {phase === "preparing" && (
                    <span className="text-[10px] font-black uppercase px-4 py-1.5 rounded-full border bg-primary/10 border-primary/30 text-primary">
                        Igra počinje za {prepareTimeLeft}s
                    </span>
                )}

                {phase !== "preparing" && phase !== "intermission" && (
                    <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full border shadow-sm transition-colors duration-500
                        ${phase === "celebration" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 scale-110" : 
                        phase === "transition" ? "bg-surface-light border-border text-text-secondary" : 
                        activePlayer === "blue" ? "bg-blue-500/10 border-blue-500/30 text-blue-500" : "bg-red-500/10 border-red-500/30 text-red-500"}`}
                    >
                        {phase === "celebration" ? "Svaka čast! Rešeno!" :
                         phase === "transition" ? "Sledeći igrač se sprema..." : 
                         isMyTurn ? `Tvoj potez (${timeLeft}s)` : "Protivnik razmišlja..."}
                    </span>
                )}

                {allFieldsOpened && phase !== "intermission" && phase !== "celebration" && (
                    <div className="flex gap-2 mt-2">
                        <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            Plavi: {remainingAttempts.blue} pokušaja
                        </span>
                        <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                            Crveni: {remainingAttempts.red} pokušaja
                        </span>
                    </div>
                )}
            </div>

            {phase === "preparing" ? (
                <div className="flex flex-col items-center justify-center py-10 px-5 text-center bg-surface border border-border rounded-3xl w-full shadow-xl gap-4">
                    <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Priprema</span>
                    <div className="text-5xl font-black text-primary">{prepareTimeLeft}</div>
                    <p className="text-xs font-bold text-text-secondary">Asocijacije uskoro počinju</p>
                </div>
            ) : phase === "intermission" ? (
                <div className="flex flex-col items-center justify-center py-6 px-5 text-center bg-surface border border-border rounded-3xl w-full shadow-2xl gap-4">
                    <HelpCircle className="h-10 w-10 text-primary animate-pulse" />
                    <h2 className="text-lg font-black text-text">Završene Asocijacije!</h2>
                    <div className="flex flex-col gap-2.5 w-full">
                        <div className="flex justify-between items-center p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                            <span className="text-xs font-bold text-blue-400 uppercase">Plavi Igrač</span>
                            <span className="text-lg font-black text-blue-400">{blueScore > 0 ? "+" : ""}{blueScore}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                            <span className="text-xs font-bold text-red-400 uppercase">Crveni Igrač</span>
                            <span className="text-lg font-black text-red-400">{redScore > 0 ? "+" : ""}{redScore}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-text-secondary bg-surface-light px-4 py-2 rounded-xl">
                        <Clock className="h-4 w-4 text-primary" /> Sledeća igra za: <strong className="text-primary">{summaryTimeLeft}s</strong>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col justify-center w-full gap-1.5">
                    <div className="flex gap-2.5">
                        <div className="flex-1 flex flex-col gap-1.5">
                            {[1, 2, 3, 4].map(n => renderField("A", n))}
                            <div className="mt-1">{renderColSolution("A")}</div>
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5">
                            {[1, 2, 3, 4].map(n => renderField("B", n))}
                            <div className="mt-1">{renderColSolution("B")}</div>
                        </div>
                    </div>

                    <div className="w-full my-1.5">
                        <button
                            onClick={() => setModalTarget("FINAL")}
                            disabled={!canGuessFinal}
                            style={{ transitionDelay: phase === "celebration" ? "1100ms" : "0ms" }}
                            className={`h-[52px] w-full flex items-center justify-center rounded-2xl border text-sm font-black uppercase transition-all duration-700 ease-in-out shadow-sm ${
                                finalSolvedBy
                                    ? finalSolvedBy === "blue"
                                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.5)] scale-105"
                                        : "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.5)] scale-105"
                                    : canGuessFinal
                                    ? "bg-surface border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                                    : "bg-surface/30 border-border/50 text-text-muted cursor-not-allowed"
                            }`}
                        >
                            {finalSolvedBy ? data.konacno[0] : "KONAČNO REŠENJE"}
                        </button>
                    </div>

                    <div className="flex gap-2.5">
                        <div className="flex-1 flex flex-col gap-1.5">
                            <div className="mb-1">{renderColSolution("C")}</div>
                            {[1, 2, 3, 4].map(n => renderField("C", n))}
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5">
                            <div className="mb-1">{renderColSolution("D")}</div>
                            {[1, 2, 3, 4].map(n => renderField("D", n))}
                        </div>
                    </div>

                    {isMyTurn && phase === "playing" && (
                        <div className="w-full flex justify-center mt-5">
                            <button
                                onClick={() => {
                                    const processed = handlePassTurnLocal();
                                    if (processed) sendBroadcast({ type: "ASOC_MOVE", role: myRole, action: "PASS" });
                                }}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-surface border border-border text-text text-xs font-bold hover:bg-surface-light active:scale-95 transition-all"
                            >
                                Dalje <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {modalTarget && isMyTurn && phase !== "celebration" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
                    <div className={`w-full max-w-[320px] bg-surface border rounded-3xl p-5 shadow-2xl ${isError ? "border-red-500" : "border-border"}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-text uppercase">
                                {modalTarget === "FINAL" ? "Konačno rešenje" : `Rešenje kolone ${modalTarget}`}
                            </h3>
                            <button onClick={() => { setModalTarget(null); setInputValue(""); }} className="p-1.5 rounded-full bg-surface-light text-text-muted hover:text-text">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleGuessSubmit} className="flex flex-col gap-3">
                            <input
                                ref={inputRef}
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                placeholder="Unesi reč..."
                                className={`w-full bg-background border rounded-xl px-4 py-3 text-sm font-bold text-text focus:outline-none ${isError ? "border-red-500" : "border-border focus:border-primary"}`}
                            />
                            <button type="submit" className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm ${isError ? "bg-red-500 text-white" : "bg-primary text-black"}`}>
                                {isError ? "Netačno!" : "Potvrdi"} <Check className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}