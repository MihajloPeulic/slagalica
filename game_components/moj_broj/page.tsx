"use client";

import { useState, useEffect, useRef } from "react";
import { RotateCcw, Sparkles, Check, X, Clock, Trophy, Target } from "lucide-react"; 

interface NumberTile {
    id: string;
    value: number;
    used: boolean;
}

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
    const [gameTimeLeft, setGameTimeLeft] = useState(60);
    const [intermissionTimeLeft, setIntermissionTimeLeft] = useState(10);

    const [tiles, setTiles] = useState<NumberTile[]>([]);
    const [history, setHistory] = useState<{ type: 'number' | 'operator'; value: string | number; tileId?: string }[]>([]);

    const [isMySubmitted, setIsMySubmitted] = useState(false);
    const [myFinalResult, setMyFinalResult] = useState<number | null>(null);

    const [isOpponentSubmitted, setIsOpponentSubmitted] = useState(false);
    const [opponentExpression, setOpponentExpression] = useState("");
    const [opponentFinalResult, setOpponentFinalResult] = useState<number | null>(null);

    const [roundSummary, setRoundSummary] = useState<any>(null);

    const clickCountRef = useRef(0);
    const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

    const currentExpression = history.map(item => item.value).join(" ");

    // 1. INICIJALIZACIJA RUNDE
    useEffect(() => {
        const newTiles = data.numbers.map((val, idx) => ({
            id: `num-${idx}`,
            value: val,
            used: false,
        }));
        setTiles(newTiles);
        setHistory([]);
        setIsMySubmitted(false);
        setIsOpponentSubmitted(false);
        setMyFinalResult(null);
        setOpponentFinalResult(null);
        setOpponentExpression("");
        setGameTimeLeft(60);
        setIntermissionTimeLeft(10);
        setPhase("playing");
        setRoundSummary(null);
    }, [data, round]);

    // 2. SLUŠALAC BROADCAST PORUKA
    useEffect(() => {
        if (!incomingBroadcast) return;
        if (incomingBroadcast.type === "SUBMIT_NUMBERS" && incomingBroadcast.role !== myRole) {
            setOpponentExpression(incomingBroadcast.expression);
            setOpponentFinalResult(incomingBroadcast.result);
            setIsOpponentSubmitted(true);
        }
    }, [incomingBroadcast, myRole]);

    // 3. TAJMER IGRE
    useEffect(() => {
        if (phase !== "playing") return;
        onTimerTick(gameTimeLeft);

        if (gameTimeLeft > 0 && !(isMySubmitted && isOpponentSubmitted)) {
            const timer = setInterval(() => setGameTimeLeft(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        } 
        
        if (gameTimeLeft === 0 || (isMySubmitted && isOpponentSubmitted)) {
            handleEndRoundProcessing();
        }
    }, [gameTimeLeft, isMySubmitted, isOpponentSubmitted, phase]);

    // 4. TAJMER INTERMISIJE
    useEffect(() => {
        if (phase !== "intermission") return;
        onTimerTick(intermissionTimeLeft);

        if (intermissionTimeLeft > 0) {
            const timer = setInterval(() => setIntermissionTimeLeft(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        } else if (intermissionTimeLeft === 0) {
            onNextRound();
        }
    }, [intermissionTimeLeft, phase]);

    // 5. KLIKOVI I LOGIKA
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

    function handleBruteforceDelete() {
        if (isMySubmitted || phase !== "playing") return;
        clickCountRef.current += 1;
        if (clickCountRef.current === 3) {
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickCountRef.current = 0;
            handleResetExpression();
        } else {
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickTimerRef.current = setTimeout(() => {
                if (clickCountRef.current === 1) handleUndo();
                clickCountRef.current = 0;
            }, 300);
        }
    }

    // 6. POTVRDA OD STRANE IGRAČA
    function handleUserSubmit() {
        if (isMySubmitted || phase !== "playing") return;
        
        const res = evaluateExpression(currentExpression);
        if (res === null) {
            alert("Nevažeći izraz!");
            return;
        }

        setIsMySubmitted(true);
        setMyFinalResult(res);

        sendBroadcast({
            type: "SUBMIT_NUMBERS",
            role: myRole,
            expression: currentExpression,
            result: res
        });
    }

    // 7. ZAVRŠETAK RUNDE I BODOVANJE
    function handleEndRoundProcessing() {
        setPhase("calculating");

        // Evaluacija ukoliko igrač nije kliknuo Submit a vreme je isteklo
        const finalMyRes = isMySubmitted ? myFinalResult : evaluateExpression(currentExpression);
        const finalMyExpr = isMySubmitted ? currentExpression : (finalMyRes ? currentExpression : "Nema rešenja");
        
        const finalOppExpr = opponentExpression || "Nema rešenja";
        const finalOppRes = isOpponentSubmitted ? opponentFinalResult : null;

        const blueRes = myRole === "blue" ? finalMyRes : finalOppRes;
        const blueExpr = myRole === "blue" ? finalMyExpr : finalOppExpr;
        
        const redRes = myRole === "red" ? finalMyRes : finalOppRes;
        const redExpr = myRole === "red" ? finalMyExpr : finalOppExpr;

        // PROSLEĐUJEMO 'round' u funkciju za kalkulaciju
        const { bluePts, redPts, blueDiff, redDiff } = calculateNumberScores(data.target, blueRes, redRes, round);

        onScoreSubmit(bluePts, redPts);

        setRoundSummary({
            blueExpr, redExpr, blueRes, redRes, bluePts, redPts, blueDiff, redDiff
        });

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
                                    onClick={handleBruteforceDelete}
                                    className="flex items-center justify-center h-10 px-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500 transition-all active:scale-95 cursor-pointer"
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