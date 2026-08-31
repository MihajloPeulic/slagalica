"use client";

import { useState, useEffect, useRef } from "react";
import { RotateCcw, Sparkles, Check, X, Clock, Trophy, Target } from "lucide-react"; 

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
    myRole: "blue" | "red";
    round: number; // 1 (Plavom pripada runda) ili 2 (Crvenom pripada runda)
    data: { target: number, numbers: number[] };
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
        if (typeof res === 'number' && !isNaN(res) && isFinite(res) && res > 0 && Number.isInteger(res)) {
            return res;
        }
        return null;
    } catch {
        return null; // Greška u sintaksi
    }
}

// Računanje poena po Slagalica pravilima sa prednošću nosioca runde
function calculateNumberScores(target: number, blueRes: number | null, redRes: number | null, round: number) {
    let bluePts = 0;
    let redPts = 0;

    const blueDiff = blueRes !== null ? Math.abs(target - blueRes) : Infinity;
    const redDiff = redRes !== null ? Math.abs(target - redRes) : Infinity;

    // Ako niko nije predao validan broj, nema bodova
    if (blueDiff === Infinity && redDiff === Infinity) return { bluePts: 0, redPts: 0, blueDiff, redDiff };

    // Slučaj 1: Oba igrača imaju istu razliku (tačan broj ILI isto rastojanje)
    if (blueDiff === redDiff && blueDiff !== Infinity) {
        if (round === 1) {
            // Prva runda je plavog igrača
            bluePts = 10;
        } else if (round === 2) {
            // Druga runda je crvenog igrača
            redPts = 10;
        }
    } 
    // Slučaj 2: Plavi je bliži
    else if (blueDiff < redDiff) {
        if (blueDiff === 0) {
            bluePts = 10; // Tačan broj
        } else {
            bluePts = 5;  // Bliži, ali nije tačan
        }
    } 
    // Slučaj 3: Crveni je bliži
    else if (redDiff < blueDiff) {
        if (redDiff === 0) {
            redPts = 10; // Tačan broj
        } else {
            redPts = 5;  // Bliži, ali nije tačan
        }
    }

    return { bluePts, redPts, blueDiff, redDiff };
}

export function MojBroj({ 
    myRole, 
    round,
    data, 
    sendBroadcast, 
    incomingBroadcast,
    onScoreSubmit,
    onNextRound,
    onTimerTick
}: MojBrojProps) {
    const [phase, setPhase] = useState<"playing" | "calculating" | "intermission">("playing");

    // Source of truth za vrijeme su timestampovi, ne lokalni countdown.
    const [gameExpiresAt, setGameExpiresAt] = useState(() => Date.now() + 60 * 1000);
    const [intermissionExpiresAt, setIntermissionExpiresAt] = useState(0);
    const [intermissionTimeLeft, setIntermissionTimeLeft] = useState(10);

    const [tiles, setTiles] = useState<NumberTile[]>([]);
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

    const currentExpression = history.map(item => item.value).join(" ");

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

    // 1. RESET NA POČETKU NOVE RUNDE
    useEffect(() => {
        setTiles(
            data.numbers.map((value, idx) => ({
                id: `num-${idx}`,
                value,
                used: false,
            }))
        );

        // Aktivni input se uvijek resetuje.
        setHistory([]);

        setIsMySubmitted(false);
        setMyFinalExpression("");
        setMyFinalResult(null);

        setIsOpponentSubmitted(false);
        setOpponentExpression("");
        setOpponentFinalResult(null);

        setRoundSummary(null);
        setPhase("playing");

        setGameExpiresAt(Date.now() + 60 * 1000);
        setIntermissionExpiresAt(0);
        setIntermissionTimeLeft(10);

        isProcessingRoundRef.current = false;
        hasReceivedSyncRef.current = false;
    }, [data.target, data.numbers.join(","), round]);

    // 2. SNAPSHOT UVIJEK DRŽI NAJNOVIJE DOZVOLJENO STANJE
    useEffect(() => {
        gameSnapshot.current = {
            phase,
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

    // 3. REFRESH/MOUNT -> JEDNOM TRAŽI SYNC OD DRUGOG IGRAČA
    useEffect(() => {
        hasReceivedSyncRef.current = false;

        sendBroadcast({
            type: "MOJ_BROJ_SYNC_REQUEST",
            role: myRole,
            round,
        });
    }, [myRole, round]);

    // 4. BROADCAST LISTENER
    useEffect(() => {
        if (!incomingBroadcast) return;

        if (
            typeof incomingBroadcast.round === "number" &&
            incomingBroadcast.round !== round
        ) {
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

        // Refresher prima zajednički state.
        if (incomingBroadcast.type === "MOJ_BROJ_SYNC_RESPONSE") {
            if (incomingBroadcast.role === myRole) return;

            // Sync response se primjenjuje samo jednom po mountu/rundi.
            if (hasReceivedSyncRef.current) return;
            hasReceivedSyncRef.current = true;

            // NEMA vraćanja aktivnog inputa.
            setHistory([]);
            setTiles(
                data.numbers.map((value, idx) => ({
                    id: `num-${idx}`,
                    value,
                    used: false,
                }))
            );

            setIsMySubmitted(!!incomingBroadcast.isMySubmitted);
            setMyFinalExpression(
                typeof incomingBroadcast.myFinalExpression === "string"
                    ? incomingBroadcast.myFinalExpression
                    : ""
            );
            setMyFinalResult(
                typeof incomingBroadcast.myFinalResult === "number"
                    ? incomingBroadcast.myFinalResult
                    : null
            );

            setIsOpponentSubmitted(!!incomingBroadcast.isOpponentSubmitted);
            setOpponentExpression(
                typeof incomingBroadcast.opponentExpression === "string"
                    ? incomingBroadcast.opponentExpression
                    : ""
            );
            setOpponentFinalResult(
                typeof incomingBroadcast.opponentFinalResult === "number"
                    ? incomingBroadcast.opponentFinalResult
                    : null
            );

            if (
                incomingBroadcast.phase === "playing" ||
                incomingBroadcast.phase === "calculating" ||
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

            setRoundSummary(incomingBroadcast.roundSummary ?? null);

            isProcessingRoundRef.current =
                incomingBroadcast.phase === "calculating" ||
                incomingBroadcast.phase === "intermission";

            return;
        }

        // Drugi igrač traži stanje od nas.
        if (incomingBroadcast.type === "MOJ_BROJ_SYNC_REQUEST") {
            if (incomingBroadcast.role === myRole) return;

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

                phase: snapshot.phase,
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

    // 5. GAME TIMER - 60 SEKUNDI
    useEffect(() => {
        if (phase !== "playing") return;

        const tick = () => {
            const timeLeft = Math.max(
                0,
                Math.ceil((gameExpiresAt - Date.now()) / 1000)
            );

            onTimerTick(timeLeft);

            if (
                timeLeft <= 0 ||
                (isMySubmitted && isOpponentSubmitted)
            ) {
                if (!isProcessingRoundRef.current) {
                    isProcessingRoundRef.current = true;
                    handleEndRoundProcessing();
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
    }, [
        gameExpiresAt,
        isMySubmitted,
        isOpponentSubmitted,
        phase,
    ]);

    // 6. INTERMISSION TIMER - 10 SEKUNDI
    useEffect(() => {
        if (phase !== "intermission") return;
        if (intermissionExpiresAt <= 0) return;

        const tick = () => {
            const timeLeft = Math.max(
                0,
                Math.ceil((intermissionExpiresAt - Date.now()) / 1000)
            );

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
    }, [intermissionExpiresAt, phase]);

    // 7. KLIKOVI I LOGIKA
    function handleNumberClick(tile: NumberTile) {
        if (tile.used || isMySubmitted || phase !== "playing") return;
        const lastAction = history[history.length - 1];
        if (lastAction && lastAction.type === 'number') return;
        setTiles(prev => prev.map(t => t.id === tile.id ? { ...t, used: true } : t));
        setHistory(prev => [...prev, { type: 'number', value: tile.value, tileId: tile.id }]);
    }

    function handleOperatorClick(op: string) {
        if (isMySubmitted || phase !== "playing") return;
        setHistory(prev => [...prev, { type: 'operator', value: op }]);
    }

    function handleUndo() {
        if (history.length === 0 || isMySubmitted || phase !== "playing") return;
        const lastAction = history[history.length - 1];
        if (lastAction.type === 'number' && lastAction.tileId) {
            setTiles(prev => prev.map(t => t.id === lastAction.tileId ? { ...t, used: false } : t));
        }
        setHistory(prev => prev.slice(0, -1));
    }

    function handleResetExpression() {
        if (isMySubmitted || phase !== "playing") return;
        setTiles(prev => prev.map(t => ({ ...t, used: false })));
        setHistory([]);
    }

    function handleDeletePressStart() {
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

    // 8. POTVRDA OD STRANE IGRAČA
    function handleUserSubmit() {
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

    // 9. ZAVRŠETAK RUNDE I BODOVANJE
    function handleEndRoundProcessing() {
        setPhase("calculating");

        // Ako smo već submitovali, koristi zaključani finalni izraz.
        // Ako nismo, timeout koristi samo trenutni LOKALNI input.
        const finalMyRes = isMySubmitted
            ? myFinalResult
            : evaluateExpression(currentExpression);

        const finalMyExpr = isMySubmitted
            ? (myFinalExpression || "Nema rešenja")
            : (finalMyRes !== null ? currentExpression : "Nema rešenja");

        const finalOppExpr = opponentExpression || "Nema rešenja";
        const finalOppRes = isOpponentSubmitted
            ? opponentFinalResult
            : null;

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

        const newIntermissionExpiresAt = Date.now() + 10 * 1000;
        setIntermissionExpiresAt(newIntermissionExpiresAt);
        setIntermissionTimeLeft(10);
        setPhase("intermission");
    }

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[340px] gap-4 animate-in fade-in zoom-in-95">
            {phase !== "intermission" ? (
                <>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Traženi broj</span>
                        <div className="flex items-center justify-center h-[72px] w-[120px] rounded-2xl border-2 border-primary/60 bg-surface/90 shadow-md">
                            <span className="text-4xl font-black text-primary tracking-tight">{data.target}</span>
                        </div>
                    </div>

                    <div className="w-full text-center py-3.5 px-4 bg-surface/80 border border-border rounded-2xl text-text font-bold text-base tracking-wide min-h-[50px] flex items-center justify-center shadow-inner">
                        {currentExpression || <span className="text-text-muted text-sm font-normal">Sastavljajte izraz klikom...</span>}
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
                                            ${tile.used 
                                                ? 'bg-surface/30 border-border/40 text-text-muted opacity-40 cursor-not-allowed' 
                                                : 'bg-surface border-border hover:bg-surface-light hover:border-primary/50 text-text active:scale-95 cursor-pointer'}`}
                                    >
                                        {tile.value}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-1.5 w-full mt-1">
                                {['+', '-', '*', '/', '(', ')'].map((op) => (
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
                /* EKRAN REZULTATA (INTERMISIJA) */
                <div className="flex flex-col items-center justify-center w-full bg-surface border border-border p-5 rounded-3xl shadow-2xl gap-4 animate-in zoom-in-95">
                    <div className="flex items-center gap-2 text-primary font-black uppercase text-xs tracking-wider bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                        <Target className="h-4 w-4" /> Cilj: {data.target}
                    </div>

                    <div className="flex flex-col gap-3 w-full my-1">
                        {/* PLAVI IGRAČ */}
                        <div className="flex flex-col p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-blue-400 uppercase">Plavi Igrač</span>
                                <span className="text-lg font-black text-blue-400">+{roundSummary?.bluePts}</span>
                            </div>
                            <span className="text-sm font-bold text-text">{roundSummary?.blueExpr}</span>
                            <span className="text-xs text-text-secondary mt-1">
                                Rezultat: {roundSummary?.blueRes !== null ? roundSummary.blueRes : "-"} 
                                {roundSummary?.blueDiff !== Infinity ? ` (Razlika: ${roundSummary.blueDiff})` : ""}
                            </span>
                        </div>

                        {/* CRVENI IGRAČ */}
                        <div className="flex flex-col p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-red-400 uppercase">Crveni Igrač</span>
                                <span className="text-lg font-black text-red-400">+{roundSummary?.redPts}</span>
                            </div>
                            <span className="text-sm font-bold text-text">{roundSummary?.redExpr}</span>
                            <span className="text-xs text-text-secondary mt-1">
                                Rezultat: {roundSummary?.redRes !== null ? roundSummary.redRes : "-"} 
                                {roundSummary?.redDiff !== Infinity ? ` (Razlika: ${roundSummary.redDiff})` : ""}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-text-secondary bg-surface-light px-4 py-2 rounded-xl">
                        <Clock className="h-4 w-4 animate-spin text-primary" />
                        <span>Sledeća igra za: <strong className="text-primary font-black text-sm">{intermissionTimeLeft}s</strong></span>
                    </div>
                </div>
            )}
        </div>
    );
}