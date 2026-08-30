"use client";

import { useState, useEffect, useRef } from "react";
import { Link2, Sparkles, Clock } from "lucide-react";

interface PairItem {
    id: number;
    left: string;
    right: string;
}

interface RoundData {
    tema: string;
    verzija: number;
    pairs: PairItem[];
    rightItems: PairItem[];
}

interface SpojniceProps {
    myRole: "blue" | "red";
    round: number; // 1 ili 2
    data: RoundData;
    sendBroadcast: (payload: any) => void;
    incomingBroadcast?: any;
    onScoreSubmit: (bluePoints: number, redPoints: number) => void;
    onNextRound: (forcedRound?: number) => void;
    onTimerTick: (timeLeft: number) => void;
}

export function Spojnice({
    myRole,
    round,
    data,
    sendBroadcast,
    incomingBroadcast,
    onScoreSubmit,
    onNextRound,
    onTimerTick
}: SpojniceProps) {
    const [phase, setPhase] = useState<"countdown" | "playing" | "intermission">("countdown");
    
    const [timeLeft, setTimeLeft] = useState(15);
    const [transitionTimer, setTransitionTimer] = useState(3); 
    const [countdownTimer, setCountdownTimer] = useState(5);
    const [intermissionTimeLeft, setIntermissionTimeLeft] = useState(10);

    const [blueScore, setBlueScore] = useState(0);
    const [redScore, setRedScore] = useState(0);

    // Ref-ovi za praćenje prethodnih poena da tačno pošaljemo deltice (razliku) u header
    const prevBlueRef = useRef(0);
    const prevRedRef = useRef(0);

    const leftItems = data?.pairs || [];
    const [rightItems, setRightItems] = useState<PairItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    
    const roundStarter = round === 1 ? "blue" : "red";
    const [activePlayer, setActivePlayer] = useState<"blue" | "red">(roundStarter);

    const [selectedRight, setSelectedRight] = useState<PairItem | null>(null);
    const [matchedPairs, setMatchedPairs] = useState<{ id: number; player: "blue" | "red" }[]>([]);
    const [missedLeftIds, setMissedLeftIds] = useState<number[]>([]);
    const [attemptCount, setAttemptCount] = useState(0);
    const [isError, setIsError] = useState(false);

    const totalItemsCount = leftItems.length;
    const isGameOver = totalItemsCount > 0 && (matchedPairs.length + missedLeftIds.length) === totalItemsCount;

    const canPlay = activePlayer === myRole && !isError && phase === "playing" && !isGameOver;

    // Funkcija koja proverava promene u poenima i prosleđuje deltu u roditeljski header
    function updateHeaderDelta(newBlue: number, newRed: number) {
        const deltaBlue = newBlue - prevBlueRef.current;
        const deltaRed = newRed - prevRedRef.current;

        if (deltaBlue > 0 || deltaRed > 0) {
            prevBlueRef.current = newBlue;
            prevRedRef.current = newRed;
            onScoreSubmit(deltaBlue, deltaRed);
        }
    }

    // ================= 1. INICIJALIZACIJA I SYNC REQUEST =================
    useEffect(() => {
        if (!data) return;

        setRightItems(data.rightItems || []);
        setCurrentIndex(0);
        setMatchedPairs([]);
        setMissedLeftIds([]);
        setAttemptCount(0);
        setSelectedRight(null);
        setIsError(false);
        setCountdownTimer(5);
        setIntermissionTimeLeft(10);
        setActivePlayer(round === 1 ? "blue" : "red");
        setTimeLeft(15);
        setBlueScore(0);
        setRedScore(0);
        prevBlueRef.current = 0;
        prevRedRef.current = 0;
        
        setPhase("countdown");

        sendBroadcast({
            type: "SPOJNICE_SYNC_REQUEST",
            role: myRole,
            round
        });
    }, [data, round]);

    // ================= 2. SLUŠALAC BROADCAST PORUKA =================
    useEffect(() => {
        if (!incomingBroadcast || incomingBroadcast.role === myRole) return;

        if (incomingBroadcast.round !== undefined && incomingBroadcast.round !== round) {
            return; 
        }

        if (incomingBroadcast.type === "SPOJNICE_SYNC_REQUEST") {
            broadcastSync();
            return;
        }

        if (incomingBroadcast.type === "SPOJNICE_SYNC") {
            if (incomingBroadcast.matchedPairs) setMatchedPairs(incomingBroadcast.matchedPairs);
            if (incomingBroadcast.missedLeftIds) setMissedLeftIds(incomingBroadcast.missedLeftIds);
            if (incomingBroadcast.currentIndex !== undefined) setCurrentIndex(incomingBroadcast.currentIndex);
            if (incomingBroadcast.activePlayer) setActivePlayer(incomingBroadcast.activePlayer);
            if (incomingBroadcast.attemptCount !== undefined) setAttemptCount(incomingBroadcast.attemptCount);
            if (incomingBroadcast.selectedRight !== undefined) setSelectedRight(incomingBroadcast.selectedRight);
            if (incomingBroadcast.isError !== undefined) setIsError(incomingBroadcast.isError);
            if (incomingBroadcast.phase) setPhase(incomingBroadcast.phase);
            
            // Sinhronizacija bodova u realnom vremenu na oba ekrana
            if (incomingBroadcast.blueScore !== undefined) {
                setBlueScore(incomingBroadcast.blueScore);
                updateHeaderDelta(incomingBroadcast.blueScore, incomingBroadcast.redScore ?? redScore);
            }
            if (incomingBroadcast.redScore !== undefined) {
                setRedScore(incomingBroadcast.redScore);
                updateHeaderDelta(incomingBroadcast.blueScore ?? blueScore, incomingBroadcast.redScore);
            }

            if (incomingBroadcast.countdownTimer !== undefined) setCountdownTimer(incomingBroadcast.countdownTimer);
            if (incomingBroadcast.timeLeft !== undefined) setTimeLeft(incomingBroadcast.timeLeft);
            if (incomingBroadcast.intermissionTimeLeft !== undefined) setIntermissionTimeLeft(incomingBroadcast.intermissionTimeLeft);
            if (incomingBroadcast.transitionTimer !== undefined) setTransitionTimer(incomingBroadcast.transitionTimer);
        }
        else if (incomingBroadcast.type === "SPOJNICE_END_ROUND") {
            setPhase("intermission");
            setMatchedPairs(incomingBroadcast.matchedPairs);
            setMissedLeftIds(incomingBroadcast.missedLeftIds);
            if (incomingBroadcast.blueScore !== undefined) {
                setBlueScore(incomingBroadcast.blueScore);
                updateHeaderDelta(incomingBroadcast.blueScore, incomingBroadcast.redScore ?? redScore);
            }
            if (incomingBroadcast.redScore !== undefined) {
                setRedScore(incomingBroadcast.redScore);
                updateHeaderDelta(incomingBroadcast.blueScore ?? blueScore, incomingBroadcast.redScore);
            }
        }
    }, [incomingBroadcast, myRole, round, blueScore, redScore]);

    function broadcastSync(extra: any = {}) {
        sendBroadcast({
            type: "SPOJNICE_SYNC",
            role: myRole,
            round,
            matchedPairs,
            missedLeftIds,
            currentIndex,
            activePlayer,
            attemptCount,
            selectedRight,
            isError,
            phase,
            blueScore,
            redScore,
            countdownTimer,
            timeLeft,
            intermissionTimeLeft,
            transitionTimer,
            ...extra
        });
    }

    // ================= 3. TAJMER PRIPREME (5s COUNTDOWN) =================
    useEffect(() => {
        if (phase !== "countdown") return;

        onTimerTick(countdownTimer);

        if (countdownTimer > 0) {
            const timer = setInterval(() => setCountdownTimer(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        } else {
            setPhase("playing");
            setTimeLeft(15);
            broadcastSync({ phase: "playing", timeLeft: 15 });
        }
    }, [phase, countdownTimer]);

    // Kada se igra završi, prelazi se u intermisiju
    useEffect(() => {
        if (isGameOver && phase === "playing") {
            setPhase("intermission");
            setIntermissionTimeLeft(10);

            sendBroadcast({
                type: "SPOJNICE_END_ROUND",
                role: myRole,
                round,
                matchedPairs,
                missedLeftIds,
                blueScore,
                redScore
            });
        }
    }, [isGameOver, phase, round, blueScore, redScore, matchedPairs, missedLeftIds]);

    // ================= 4. TAJMER TOKA IGRE (PLAYING) =================
    useEffect(() => {
        if (isGameOver || phase !== "playing") return;
        
        onTimerTick(isError ? transitionTimer : timeLeft);

        if (isError) {
            if (transitionTimer > 0) {
                const timer = setInterval(() => setTransitionTimer(prev => prev - 1), 1000);
                return () => clearInterval(timer);
            } else if (activePlayer === myRole) { 
                executeTurnSwitch();
            }
        } else {
            if (timeLeft > 0) {
                const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
                return () => clearInterval(timer);
            } else if (activePlayer === myRole) {
                setIsError(true);
                setTransitionTimer(3);
                broadcastSync({ isError: true, transitionTimer: 3 });
            }
        }
    }, [timeLeft, isGameOver, isError, transitionTimer, phase, myRole, activePlayer]);

    // ================= 5. TAJMER INTERMISIJE (10s) =================
    useEffect(() => {
        if (phase !== "intermission") return;

        onTimerTick(intermissionTimeLeft);

        if (intermissionTimeLeft > 0) {
            const timer = setInterval(() => setIntermissionTimeLeft(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        } else {
            onNextRound();
        }
    }, [phase, intermissionTimeLeft, onNextRound]);

    function executeTurnSwitch() {
        if (attemptCount === 0) {
            const nextAttempt = 1;
            const nextPlayer = activePlayer === "blue" ? "red" : "blue";
            setAttemptCount(nextAttempt);
            setSelectedRight(null);
            setIsError(false);
            setTimeLeft(15);
            setActivePlayer(nextPlayer);
            
            broadcastSync({
                activePlayer: nextPlayer,
                attemptCount: nextAttempt,
                selectedRight: null,
                isError: false,
                timeLeft: 15,
            });
        } else {
            const currentLeftItem = leftItems[currentIndex];
            if (currentLeftItem) {
                const updatedMissed = [...missedLeftIds, currentLeftItem.id];
                setMissedLeftIds(updatedMissed);
                proceedToNextRow(updatedMissed, matchedPairs, blueScore, redScore);
            }
        }
    }

    function proceedToNextRow(updatedMissed: number[], updatedMatched: any[], currBlue: number, currRed: number) {
        setSelectedRight(null);
        setIsError(false);
        setAttemptCount(0);
        setTimeLeft(15);

        const nextIndex = currentIndex + 1;
        const nextPlayer = roundStarter;

        if (nextIndex < leftItems.length) {
            setCurrentIndex(nextIndex);
            setActivePlayer(nextPlayer);
            
            broadcastSync({
                matchedPairs: updatedMatched,
                missedLeftIds: updatedMissed,
                currentIndex: nextIndex,
                activePlayer: nextPlayer,
                attemptCount: 0,
                selectedRight: null,
                isError: false,
                timeLeft: 15,
                blueScore: currBlue,
                redScore: currRed
            });
        }
    }

    function handleRightClick(item: PairItem) {
        if (!canPlay || isGameOver || isError || !data) return;

        const currentLeftItem = leftItems[currentIndex];
        if (!currentLeftItem) return;

        setSelectedRight(item);

        let currBlue = blueScore;
        let currRed = redScore;
        let updatedMatched = [...matchedPairs];

        if (currentLeftItem.id === item.id) {
            // Tačan pogodak: dodeljujemo bodove apsolutno onome ko je trenutno aktivan igrač
            if (activePlayer === "blue") {
                currBlue += 2;
            } else {
                currRed += 2;
            }

            setBlueScore(currBlue);
            setRedScore(currRed);

            // Odmah ažuriramo header sa novonastalim deltama za oba igrača
            updateHeaderDelta(currBlue, currRed);

            updatedMatched.push({ id: currentLeftItem.id, player: activePlayer });
            setMatchedPairs(updatedMatched);

            proceedToNextRow(missedLeftIds, updatedMatched, currBlue, currRed);
        } else {
            // Netačan pogodak -> Greška
            setIsError(true);
            setTransitionTimer(3);
            broadcastSync({ selectedRight: item, isError: true, transitionTimer: 3 });
        }
    }

    const displayedRightItems = phase === "intermission" 
        ? leftItems.map(left => data.pairs.find(p => p.id === left.id) || left)
        : rightItems;

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[340px] gap-4 animate-in fade-in zoom-in-95">
            {phase === "playing" || phase === "intermission" || phase === "countdown" ? (
                <>
                    <div className="flex flex-col items-center w-full max-w-[340px] text-center mb-1">
                        <span className="text-xs font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Link2 className="h-3.5 w-3.5" /> Spojnice (Runda {round}) {phase === "intermission" && "• Pregled rešenja"}
                        </span>
                        <h2 className="text-sm font-bold text-text mb-2">{data.tema}</h2>
                        
                        <div className={`text-xs font-black uppercase px-3 py-1 rounded-full border shadow-sm transition-colors
                            ${isError ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                             phase === 'intermission' ? 'bg-primary/20 border-primary/40 text-primary animate-pulse' :
                             phase === 'countdown' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 animate-pulse' :
                             (activePlayer === 'blue' ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-red-500/10 border-red-500/30 text-red-500')}`}
                        >
                            {isError ? "Greška! Promena igrača..." :
                             phase === 'intermission' ? `Pregled rešenja (${intermissionTimeLeft}s)` :
                             phase === 'countdown' ? `Priprema za rundu ${round} (${countdownTimer}s)` :
                             `Na potezu: ${activePlayer === 'blue' ? 'Plavi igrač' : 'Crveni igrač'}`}
                        </div>
                    </div>

                    <div className={`grid grid-cols-2 gap-3 w-full max-w-[340px] transition-all duration-300 ${!canPlay ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                        
                        {/* LEVA KOLONA */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider text-center">Pojmovi</span>
                            {leftItems.map((item, idx) => {
                                const matched = matchedPairs.find(m => m.id === item.id);
                                const isMissed = missedLeftIds.includes(item.id);
                                const isActive = idx === currentIndex && phase === "playing";

                                let btnStyle = "bg-surface/30 border-border/40 text-text-muted opacity-40 cursor-not-allowed";

                                if (phase === "intermission") {
                                    btnStyle = "bg-primary/10 border-primary/30 text-primary font-bold cursor-default opacity-100";
                                } else if (matched) {
                                    btnStyle = matched.player === "blue" 
                                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400 opacity-90 cursor-not-allowed" 
                                        : "bg-red-500/20 border-red-500/50 text-red-400 opacity-90 cursor-not-allowed";
                                } else if (isMissed) {
                                    btnStyle = "bg-surface/10 border-border/20 text-text-muted opacity-30 line-through cursor-not-allowed";
                                } else if (isActive) {
                                    btnStyle = "bg-surface border-primary text-text shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-2 ring-primary/40";
                                }

                                return (
                                    <div
                                        key={`left-${item.id}`}
                                        className={`h-11 px-3 flex items-center justify-center text-center rounded-xl border text-xs font-bold transition-all shadow-sm ${btnStyle}`}
                                    >
                                        <span className="truncate">{item.left}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* DESNA KOLONA */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider text-center">Rešenja</span>
                            {displayedRightItems.map((item) => {
                                const isMatched = matchedPairs.some(m => m.id === item.id);
                                const isSelected = selectedRight?.id === item.id;

                                let btnStyle = "bg-surface border-border text-text hover:bg-surface-light";
                                
                                if (phase === "intermission") {
                                    btnStyle = "bg-primary/10 border-primary/30 text-primary font-bold cursor-default opacity-100 shadow-sm";
                                } else if (isMatched) {
                                    const matchInfo = matchedPairs.find(m => m.id === item.id);
                                    btnStyle = matchInfo?.player === "blue"
                                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400 opacity-90 cursor-not-allowed"
                                        : "bg-red-500/20 border-red-500/50 text-red-400 opacity-90 cursor-not-allowed";
                                } else if (isSelected && isError) {
                                    btnStyle = "bg-red-500/20 border-red-500 text-red-400";
                                } else if (isSelected) {
                                    btnStyle = "bg-primary/20 border-primary text-primary";
                                }

                                return (
                                    <button
                                        key={`right-${item.id}`}
                                        onClick={() => handleRightClick(item)}
                                        disabled={!canPlay || isMatched || isError}
                                        className={`h-11 px-3 flex items-center justify-center text-center rounded-xl border text-xs font-bold transition-all shadow-sm ${canPlay && !isMatched && !isError ? 'cursor-pointer hover:bg-surface-light' : 'cursor-not-allowed'} ${btnStyle}`}
                                    >
                                        <span className="truncate">{item.right}</span>
                                    </button>
                                );
                            })}
                        </div>

                    </div>
                </>
            ) : null}
        </div>
    );
}