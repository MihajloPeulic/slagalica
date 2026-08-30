"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, HelpCircle, Clock, Trophy, Target } from "lucide-react"; 

const SYMBOLS = [
    { id: "skocko", name: "Skočko", symbol: "😊" },
    { id: "tref", name: "Tref", symbol: "♣️" },
    { id: "pik", name: "Pik", symbol: "♠️" },
    { id: "srce", name: "Srce", symbol: "❤️" },
    { id: "karo", name: "Karo", symbol: "♦️" },
    { id: "zvezda", name: "Zvezda", symbol: "⭐" },
];

interface SkockoProps {
    myRole: "blue" | "red";
    round: number; // 1 ili 2
    data: { secretCode: string[] };
    sendBroadcast: (payload: any) => void;
    incomingBroadcast?: any;
    onScoreSubmit: (bluePoints: number, redPoints: number) => void;
    onNextRound: () => void;
    onTimerTick: (timeLeft: number) => void;
}

export function Skocko({ 
    myRole, 
    round, 
    data, 
    sendBroadcast, 
    incomingBroadcast, 
    onScoreSubmit, 
    onNextRound, 
    onTimerTick 
}: SkockoProps) {
    
    // Faze: potez nosioca runde -> šansa za protivnika -> kraj runde
    const [phase, setPhase] = useState<"primary_turn" | "secondary_turn" | "intermission">("primary_turn");
    
    const [gameTimeLeft, setGameTimeLeft] = useState(60);
    const [intermissionTimeLeft, setIntermissionTimeLeft] = useState(10);

    // 7 redova umesto 6 (6 za primarnog igrača, 1 za protivnika)
    const [rows, setRows] = useState<string[][]>(Array.from({ length: 7 }, () => Array(4).fill("")));
    const [hints, setHints] = useState<string[][]>(Array.from({ length: 7 }, () => Array(4).fill("none")));
    
    const [currentRow, setCurrentRow] = useState(0);
    const [currentCol, setCurrentCol] = useState(0);

    const [finalScores, setFinalScores] = useState({ blue: 0, red: 0 });
    const scoreSubmitted = useRef(false);

    // Određujemo čija je prva faza (Runda 1 -> Plavi, Runda 2 -> Crveni)
    const isPrimary = (round === 1 && myRole === "blue") || (round === 2 && myRole === "red");
    
    // Da li smem JA da klikam na tablu u ovom trenutku?
    const canPlay = (isPrimary && phase === "primary_turn") || (!isPrimary && phase === "secondary_turn");

    // ================= 1. INICIJALIZACIJA RUNDE =================
    useEffect(() => {
        setRows(Array.from({ length: 7 }, () => Array(4).fill("")));
        setHints(Array.from({ length: 7 }, () => Array(4).fill("none")));
        setCurrentRow(0);
        setCurrentCol(0);
        setGameTimeLeft(60);
        setIntermissionTimeLeft(10);
        setPhase("primary_turn");
        setFinalScores({ blue: 0, red: 0 });
        scoreSubmitted.current = false;
    }, [data, round]);

    // ================= 2. BEZBEDNI SLUŠALAC BROADCAST PORUKA =================
    useEffect(() => {
        // Ignorišemo sopstvene poruke
        if (!incomingBroadcast || incomingBroadcast.role === myRole) return;

        if (incomingBroadcast.type === "SKOCKO_SYNC") {
            setRows(incomingBroadcast.rows);
            setHints(incomingBroadcast.hints);
            setCurrentRow(incomingBroadcast.currentRow);
            setCurrentCol(incomingBroadcast.currentCol);
        } 
        else if (incomingBroadcast.type === "SKOCKO_SECONDARY_TURN") {
            setRows(incomingBroadcast.rows);
            setHints(incomingBroadcast.hints);
            setPhase("secondary_turn");
            setCurrentRow(6);
            setCurrentCol(0);
            setGameTimeLeft(15);
        } 
        else if (incomingBroadcast.type === "SKOCKO_END_ROUND") {
            setRows(incomingBroadcast.rows);
            setHints(incomingBroadcast.hints);
            setFinalScores({ blue: incomingBroadcast.bluePts, red: incomingBroadcast.redPts });
            setPhase("intermission");
        }
    }, [incomingBroadcast, myRole]);

    // ================= 3. TAJMER IGRE =================
    useEffect(() => {
        if (phase === "primary_turn" || phase === "secondary_turn") {
            onTimerTick(gameTimeLeft);

            if (gameTimeLeft > 0) {
                const timer = setInterval(() => setGameTimeLeft(prev => prev - 1), 1000);
                return () => clearInterval(timer);
            } else if (gameTimeLeft === 0) {
                // Autoritativna provera na timeout (samo igrač na potezu prijavljuje timeout)
                if (isPrimary && phase === "primary_turn") {
                    triggerSecondaryTurn(rows, hints);
                } else if (!isPrimary && phase === "secondary_turn") {
                    triggerEndRound(0, rows, hints);
                }
            }
        }
    }, [gameTimeLeft, phase, isPrimary]);

    // ================= 4. TAJMER INTERMISIJE =================
    useEffect(() => {
        if (phase === "intermission") {
            // Bezbedno slanje poena tačno jednom
            if (!scoreSubmitted.current) {
                scoreSubmitted.current = true;
                onScoreSubmit(finalScores.blue, finalScores.red);
            }

            onTimerTick(intermissionTimeLeft);
            if (intermissionTimeLeft > 0) {
                const timer = setInterval(() => setIntermissionTimeLeft(prev => prev - 1), 1000);
                return () => clearInterval(timer);
            } else if (intermissionTimeLeft === 0) {
                onNextRound();
            }
        }
    }, [intermissionTimeLeft, phase]);

    // ================= 5. INTERAKCIJE SA TABLOM =================
    function broadcastSync(newRows: string[][], newHints: string[][], newRow: number, newCol: number) {
        sendBroadcast({
            type: "SKOCKO_SYNC",
            role: myRole,
            rows: newRows,
            hints: newHints,
            currentRow: newRow,
            currentCol: newCol
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
        const lastFilledIndex = activeRow.map((val, idx) => val !== "" ? idx : -1).filter(idx => idx !== -1).pop();

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
            let pts = (rIdx < 2) ? 20 : (rIdx < 4 ? 15 : 10);
            triggerEndRound(pts, rows, updatedHints);
        } else {
            if (rIdx === 5) {
                // Primarni je promašio sve - prelazak na šansu protivnika!
                triggerSecondaryTurn(rows, updatedHints);
            } else if (rIdx === 6) {
                // Protivnik je promašio krađu - kraj sa nula poena
                triggerEndRound(0, rows, updatedHints);
            } else {
                // Nije kraj, nastavlja se sledeći red
                setCurrentRow(rIdx + 1);
                setCurrentCol(0);
                broadcastSync(rows, updatedHints, rIdx + 1, 0);
            }
        }
    }

    // Pomoćne funkcije za prelazak stanja
    function triggerSecondaryTurn(syncRows: string[][], syncHints: string[][]) {
        setPhase("secondary_turn");
        setCurrentRow(6);
        setCurrentCol(0);
        setGameTimeLeft(15);
        sendBroadcast({
            type: "SKOCKO_SECONDARY_TURN",
            role: myRole,
            rows: syncRows,
            hints: syncHints
        });
    }

    function triggerEndRound(pts: number, finalRows: string[][], finalHints: string[][]) {
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

        setFinalScores({ blue: bluePts, red: redPts });
        setPhase("intermission");
        
        sendBroadcast({
            type: "SKOCKO_END_ROUND",
            role: myRole,
            bluePts,
            redPts,
            rows: finalRows,
            hints: finalHints
        });
    }

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[340px] gap-4 animate-in fade-in zoom-in-95">
            {phase !== "intermission" ? (
                <>
                    <div className="flex flex-col items-center mb-1">
                        {phase === "primary_turn" && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse border border-primary/20 bg-primary/5 px-3 py-1 rounded-full">
                                Na potezu: <strong className={round === 1 ? "text-blue-500" : "text-red-500"}>{round === 1 ? "Plavi" : "Crveni"}</strong> igrač
                            </span>
                        )}
                        {phase === "secondary_turn" && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500 animate-bounce border border-red-500/20 bg-red-500/10 px-3 py-1 rounded-full shadow-sm">
                                Šansa za <strong className={round === 1 ? "text-red-500" : "text-blue-500"}>{round === 1 ? "Crvenog" : "Plavog"}</strong>!
                            </span>
                        )}
                    </div>

                    {/* TABLA ZA SKOCKA (7 REDOVA) */}
                    <div className="flex flex-col gap-2 w-full max-w-[320px]">
                        {rows.map((row, rIdx) => {
                            const isCurrentRow = rIdx === currentRow;
                            const isRowComplete = row[3] !== "";
                            const isOpponentRow = rIdx === 6;

                            return (
                                <div 
                                    key={rIdx} 
                                    className={`flex items-center justify-between p-2 rounded-2xl border transition-all
                                        ${isOpponentRow ? 'mt-3 border-t-[3px] border-t-red-500/40 bg-red-500/5' : ''}
                                        ${isCurrentRow && canPlay ? 'bg-surface/90 border-primary/60 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : ''}
                                        ${isCurrentRow && !canPlay ? 'bg-surface/70 border-primary/30' : ''}
                                        ${!isCurrentRow ? 'bg-surface/40 border-border/50 opacity-70' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {row.map((val, cIdx) => {
                                            const symbolObj = SYMBOLS.find(s => s.id === val);
                                            return (
                                                <button 
                                                    key={cIdx}
                                                    onClick={() => canPlay && isCurrentRow && handleTileClick(cIdx)}
                                                    disabled={!canPlay || !isCurrentRow || !val}
                                                    className={`flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-xl transition-all shadow-inner
                                                        ${isCurrentRow && cIdx === currentCol && canPlay ? 'border-primary ring-2 ring-primary/20 animate-pulse' : ''}
                                                        ${isCurrentRow && val && canPlay ? 'hover:border-red-500/50 hover:bg-red-500/5 cursor-pointer' : 'cursor-default'}
                                                    `}
                                                >
                                                    {symbolObj ? symbolObj.symbol : ""}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 px-2 py-2 rounded-xl bg-background/50 border border-border">
                                            {hints[rIdx].map((hintType, pIdx) => (
                                                <div 
                                                    key={pIdx} 
                                                    className={`h-2.5 w-2.5 rounded-full border transition-colors
                                                        ${hintType === "hit" ? 'bg-red-500 border-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : ''}
                                                        ${hintType === "almost" ? 'bg-amber-400 border-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]' : ''}
                                                        ${hintType === "none" ? 'bg-surface-light border-border' : ''}
                                                    `}
                                                ></div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => handleConfirmRow(rIdx)}
                                            disabled={!canPlay || !isCurrentRow || !isRowComplete}
                                            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all shadow-sm
                                                ${isCurrentRow && isRowComplete && canPlay
                                                    ? 'bg-primary border-primary text-black hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                                                    : 'bg-surface/50 border-border text-text-muted opacity-40 cursor-not-allowed'}`}
                                        >
                                            <HelpCircle className="h-5 w-5 stroke-[2.5]" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* TASTATURA SIMBOLA */}
                    <div className="grid grid-cols-6 gap-2 w-full mt-2">
                        {SYMBOLS.map((sym) => (
                            <button
                                key={sym.id}
                                onClick={() => handleSymbolSelect(sym.id)}
                                disabled={!canPlay}
                                className={`flex h-12 items-center justify-center rounded-xl border border-border text-2xl transition-all shadow-sm
                                    ${canPlay 
                                        ? 'bg-surface hover:bg-surface-light hover:border-primary/50 active:scale-95 cursor-pointer' 
                                        : 'bg-surface/30 opacity-50 cursor-not-allowed'}`}
                            >
                                {sym.symbol}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                /* INTERMISIJA - PRIKAZ REZULTATA I TAJNE KOMBINACIJE (PRIKAZUJE SE OBOJICI IGRACA) */
                <div className="flex flex-col items-center justify-center w-full bg-surface border border-border p-5 rounded-3xl shadow-2xl gap-4 animate-in zoom-in-95 mt-4">
                    
                    <div className="flex flex-col items-center mb-2">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Tražena kombinacija</span>
                        <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface-light border border-border">
                            {data.secretCode.map((symId, i) => (
                                <span key={i} className="text-3xl">{SYMBOLS.find(s => s.id === symId)?.symbol}</span>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                        {/* PLAVI IGRAČ */}
                        <div className="flex justify-between items-center p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                            <span className="text-xs font-bold text-blue-400 uppercase">Plavi Igrač</span>
                            <span className="text-lg font-black text-blue-400">+{finalScores.blue}</span>
                        </div>

                        {/* CRVENI IGRAČ */}
                        <div className="flex justify-between items-center p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                            <span className="text-xs font-bold text-red-400 uppercase">Crveni Igrač</span>
                            <span className="text-lg font-black text-red-400">+{finalScores.red}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-text-secondary bg-surface-light px-4 py-2 rounded-xl mt-2">
                        <Clock className="h-4 w-4 animate-spin text-primary" />
                        <span>Sledeća igra za: <strong className="text-primary font-black text-sm">{intermissionTimeLeft}s</strong></span>
                    </div>
                </div>
            )}
        </div>
    );
}