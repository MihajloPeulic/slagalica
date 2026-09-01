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
    
    // Timestampovi su source of truth za sve tajmere.
    const [turnExpiresAt, setTurnExpiresAt] = useState(() => Date.now() + 15 * 1000);
    const [transitionExpiresAt, setTransitionExpiresAt] = useState(0);
    const [countdownExpiresAt, setCountdownExpiresAt] = useState(() => Date.now() + 5 * 1000);
    const [intermissionExpiresAt, setIntermissionExpiresAt] = useState(0);

    // UI countdown vrijednosti.
    const [timeLeft, setTimeLeft] = useState(15);
    const [transitionTimer, setTransitionTimer] = useState(3);
    const [countdownTimer, setCountdownTimer] = useState(5);
    const [intermissionTimeLeft, setIntermissionTimeLeft] = useState(10);

    const [blueScore, setBlueScore] = useState(0);
    const [redScore, setRedScore] = useState(0);

    // Ref-ovi za praćenje prethodnih poena da tačno pošaljemo deltice (razliku) u header
    const prevBlueRef = useRef(0);
    const prevRedRef = useRef(0);
    const hasReceivedSyncRef = useRef(false);

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

    // Jedan klijent vodi zajedničke vremenske prelaze da oba igrača ostanu u syncu.
    const isAuthority = myRole === "blue";

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

    const gameSnapshot = useRef({
        phase,
        turnExpiresAt,
        transitionExpiresAt,
        countdownExpiresAt,
        intermissionExpiresAt,
        blueScore,
        redScore,
        rightItems,
        currentIndex,
        activePlayer,
        selectedRight,
        matchedPairs,
        missedLeftIds,
        attemptCount,
        isError,
    });

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

        const now = Date.now();
        setCountdownExpiresAt(now + 5 * 1000);
        setTurnExpiresAt(0);
        setTransitionExpiresAt(0);
        setIntermissionExpiresAt(0);

        setCountdownTimer(5);
        setTimeLeft(15);
        setTransitionTimer(3);
        setIntermissionTimeLeft(10);

        setActivePlayer(round === 1 ? "blue" : "red");
        setBlueScore(0);
        setRedScore(0);
        prevBlueRef.current = 0;
        prevRedRef.current = 0;
        setPhase("countdown");

        hasReceivedSyncRef.current = false;

        sendBroadcast({
            type: "SPOJNICE_SYNC_REQUEST",
            role: myRole,
            round
        });
    }, [data, round]);

    useEffect(() => {
        gameSnapshot.current = {
            phase,
            turnExpiresAt,
            transitionExpiresAt,
            countdownExpiresAt,
            intermissionExpiresAt,
            blueScore,
            redScore,
            rightItems,
            currentIndex,
            activePlayer,
            selectedRight,
            matchedPairs,
            missedLeftIds,
            attemptCount,
            isError,
        };
    }, [
        phase,
        turnExpiresAt,
        transitionExpiresAt,
        countdownExpiresAt,
        intermissionExpiresAt,
        blueScore,
        redScore,
        rightItems,
        currentIndex,
        activePlayer,
        selectedRight,
        matchedPairs,
        missedLeftIds,
        attemptCount,
        isError,
    ]);

    // ================= 2. SLUŠALAC BROADCAST PORUKA =================
    useEffect(() => {
        if (!incomingBroadcast || incomingBroadcast.role === myRole) return;

        if (incomingBroadcast.round !== undefined && incomingBroadcast.round !== round) {
            return;
        }

        if (incomingBroadcast.type === "SPOJNICE_PICK") {
            if (!isAuthority) return;

            processPick(
                incomingBroadcast.itemId,
                incomingBroadcast.role,
                incomingBroadcast.currentIndex
            );

            return;
        }

        if (incomingBroadcast.type === "SPOJNICE_SYNC_REQUEST") {
            const snapshot = gameSnapshot.current;

            sendBroadcast({
                type: "SPOJNICE_SYNC",
                role: myRole,
                round,
                matchedPairs: snapshot.matchedPairs,
                missedLeftIds: snapshot.missedLeftIds,
                currentIndex: snapshot.currentIndex,
                activePlayer: snapshot.activePlayer,
                attemptCount: snapshot.attemptCount,
                selectedRight: snapshot.selectedRight,
                isError: snapshot.isError,
                phase: snapshot.phase,
                blueScore: snapshot.blueScore,
                redScore: snapshot.redScore,
                rightItems: snapshot.rightItems,
                turnExpiresAt: snapshot.turnExpiresAt,
                transitionExpiresAt: snapshot.transitionExpiresAt,
                countdownExpiresAt: snapshot.countdownExpiresAt,
                intermissionExpiresAt: snapshot.intermissionExpiresAt,
                isRefreshSync: true,
            });

            return;
        }

        if (incomingBroadcast.type === "SPOJNICE_SYNC") {
            if (incomingBroadcast.isRefreshSync) {
                if (hasReceivedSyncRef.current) return;
                hasReceivedSyncRef.current = true;
            }

            if (incomingBroadcast.matchedPairs) setMatchedPairs(incomingBroadcast.matchedPairs);
            if (incomingBroadcast.missedLeftIds) setMissedLeftIds(incomingBroadcast.missedLeftIds);
            if (incomingBroadcast.currentIndex !== undefined) setCurrentIndex(incomingBroadcast.currentIndex);
            if (incomingBroadcast.activePlayer) setActivePlayer(incomingBroadcast.activePlayer);
            if (incomingBroadcast.attemptCount !== undefined) setAttemptCount(incomingBroadcast.attemptCount);
            if (incomingBroadcast.selectedRight !== undefined) setSelectedRight(incomingBroadcast.selectedRight);
            if (incomingBroadcast.isError !== undefined) setIsError(incomingBroadcast.isError);
            if (incomingBroadcast.phase) setPhase(incomingBroadcast.phase);
            if (incomingBroadcast.rightItems) setRightItems(incomingBroadcast.rightItems);

            if (
                incomingBroadcast.blueScore !== undefined ||
                incomingBroadcast.redScore !== undefined
            ) {
                const nextBlue =
                    incomingBroadcast.blueScore ?? blueScore;
                const nextRed =
                    incomingBroadcast.redScore ?? redScore;

                setBlueScore(nextBlue);
                setRedScore(nextRed);

                if (incomingBroadcast.isRefreshSync) {
                    prevBlueRef.current = nextBlue;
                    prevRedRef.current = nextRed;
                } else {
                    updateHeaderDelta(nextBlue, nextRed);
                }
            }

            if (incomingBroadcast.turnExpiresAt !== undefined) {
                setTurnExpiresAt(incomingBroadcast.turnExpiresAt);
            }
            if (incomingBroadcast.transitionExpiresAt !== undefined) {
                setTransitionExpiresAt(incomingBroadcast.transitionExpiresAt);
            }
            if (incomingBroadcast.countdownExpiresAt !== undefined) {
                setCountdownExpiresAt(incomingBroadcast.countdownExpiresAt);
            }
            if (incomingBroadcast.intermissionExpiresAt !== undefined) {
                setIntermissionExpiresAt(incomingBroadcast.intermissionExpiresAt);
            }

            return;
        }

        if (incomingBroadcast.type === "SPOJNICE_END_ROUND") {
            setPhase("intermission");
            setMatchedPairs(incomingBroadcast.matchedPairs);
            setMissedLeftIds(incomingBroadcast.missedLeftIds);

            if (
                incomingBroadcast.blueScore !== undefined ||
                incomingBroadcast.redScore !== undefined
            ) {
                const nextBlue =
                    incomingBroadcast.blueScore ?? blueScore;
                const nextRed =
                    incomingBroadcast.redScore ?? redScore;

                setBlueScore(nextBlue);
                setRedScore(nextRed);
                updateHeaderDelta(nextBlue, nextRed);
            }

            if (incomingBroadcast.intermissionExpiresAt !== undefined) {
                setIntermissionExpiresAt(incomingBroadcast.intermissionExpiresAt);
            }

            return;
        }
    }, [
        incomingBroadcast,
        myRole,
        round,
        blueScore,
        redScore,
        isAuthority,
        activePlayer,
        currentIndex,
        phase,
        isError,
        isGameOver,
        rightItems,
        matchedPairs,
        missedLeftIds,
        attemptCount,
    ]);

    function broadcastState(extra: any = {}) {
        const snapshot = gameSnapshot.current;

        sendBroadcast({
            type: "SPOJNICE_SYNC",
            role: myRole,
            round,
            matchedPairs: snapshot.matchedPairs,
            missedLeftIds: snapshot.missedLeftIds,
            currentIndex: snapshot.currentIndex,
            activePlayer: snapshot.activePlayer,
            attemptCount: snapshot.attemptCount,
            selectedRight: snapshot.selectedRight,
            isError: snapshot.isError,
            phase: snapshot.phase,
            blueScore: snapshot.blueScore,
            redScore: snapshot.redScore,
            rightItems: snapshot.rightItems,
            turnExpiresAt: snapshot.turnExpiresAt,
            transitionExpiresAt: snapshot.transitionExpiresAt,
            countdownExpiresAt: snapshot.countdownExpiresAt,
            intermissionExpiresAt: snapshot.intermissionExpiresAt,
            ...extra
        });
    }

    // ================= 3. TAJMER PRIPREME (5s COUNTDOWN) =================
    useEffect(() => {
        if (phase !== "countdown") return;

        const tick = () => {
            const remaining = Math.max(
                0,
                Math.ceil((countdownExpiresAt - Date.now()) / 1000)
            );

            setCountdownTimer(remaining);
            onTimerTick(remaining);

            if (remaining <= 0) {
                if (isAuthority) {
                    const newTurnExpiresAt = Date.now() + 15 * 1000;

                    setPhase("playing");
                    setTimeLeft(15);
                    setTurnExpiresAt(newTurnExpiresAt);

                    broadcastState({
                        phase: "playing",
                        turnExpiresAt: newTurnExpiresAt,
                        transitionExpiresAt: 0,
                        isError: false,
                    });
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
    }, [phase, countdownExpiresAt, isAuthority]);

    // Kada se igra završi, prelazi se u intermisiju
    useEffect(() => {
        if (isGameOver && phase === "playing" && isAuthority) {
            const newIntermissionExpiresAt = Date.now() + 10 * 1000;

            setPhase("intermission");
            setIntermissionExpiresAt(newIntermissionExpiresAt);
            setIntermissionTimeLeft(10);

            sendBroadcast({
                type: "SPOJNICE_END_ROUND",
                role: myRole,
                round,
                matchedPairs,
                missedLeftIds,
                blueScore,
                redScore,
                intermissionExpiresAt: newIntermissionExpiresAt
            });
        }
    }, [isGameOver, phase, round, blueScore, redScore, matchedPairs, missedLeftIds]);

    // ================= 4. TAJMER TOKA IGRE (PLAYING) =================
    useEffect(() => {
        if (isGameOver || phase !== "playing") return;

        const tick = () => {
            if (isError) {
                const remaining = Math.max(
                    0,
                    Math.ceil((transitionExpiresAt - Date.now()) / 1000)
                );

                setTransitionTimer(remaining);
                onTimerTick(remaining);

                if (remaining <= 0 && isAuthority) {
                    executeTurnSwitch();
                    return true;
                }

                return false;
            }

            const remaining = Math.max(
                0,
                Math.ceil((turnExpiresAt - Date.now()) / 1000)
            );

            setTimeLeft(remaining);
            onTimerTick(remaining);

            if (remaining <= 0 && isAuthority) {
                const newTransitionExpiresAt = Date.now() + 3 * 1000;

                setIsError(true);
                setTransitionTimer(3);
                setTransitionExpiresAt(newTransitionExpiresAt);

                broadcastState({
                    isError: true,
                    transitionExpiresAt: newTransitionExpiresAt
                });

                return true;
            }

            return false;
        };

        if (tick()) return;

        const timer = setInterval(() => {
            if (tick()) clearInterval(timer);
        }, 250);

        return () => clearInterval(timer);
    }, [
        turnExpiresAt,
        transitionExpiresAt,
        isGameOver,
        isError,
        phase,
        myRole,
        activePlayer,
        isAuthority
    ]);

    // ================= 5. TAJMER INTERMISIJE (10s) =================
    useEffect(() => {
        if (phase !== "intermission") return;
        if (intermissionExpiresAt <= 0) return;

        const tick = () => {
            const remaining = Math.max(
                0,
                Math.ceil((intermissionExpiresAt - Date.now()) / 1000)
            );

            setIntermissionTimeLeft(remaining);
            onTimerTick(remaining);

            if (remaining <= 0) {
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
    }, [phase, intermissionExpiresAt, onNextRound]);

    function executeTurnSwitch() {
        if (!isAuthority) return;

        if (attemptCount === 0) {
            // Prvi igrač nije pogodio: drugi dobija svoj pokušaj.
            const nextAttempt = 1;
            const nextPlayer = activePlayer === "blue" ? "red" : "blue";
            const newTurnExpiresAt = Date.now() + 15 * 1000;

            setAttemptCount(nextAttempt);
            setSelectedRight(null);
            setIsError(false);
            setTransitionExpiresAt(0);
            setTimeLeft(15);
            setTurnExpiresAt(newTurnExpiresAt);
            setActivePlayer(nextPlayer);

            broadcastState({
                activePlayer: nextPlayer,
                attemptCount: nextAttempt,
                selectedRight: null,
                isError: false,
                transitionExpiresAt: 0,
                turnExpiresAt: newTurnExpiresAt,
            });
        } else {
            // Oba igrača su promašila isti par: nema minusa, samo prelazimo dalje.
            const currentLeftItem = leftItems[currentIndex];

            if (!currentLeftItem) return;

            const updatedMissed = [
                ...missedLeftIds,
                currentLeftItem.id
            ];

            setMissedLeftIds(updatedMissed);

            proceedToNextRow(
                updatedMissed,
                matchedPairs,
                blueScore,
                redScore
            );
        }
    }

    function proceedToNextRow(
        updatedMissed: number[],
        updatedMatched: { id: number; player: "blue" | "red" }[],
        currBlue: number,
        currRed: number
    ) {
        const nextIndex = currentIndex + 1;

        if (nextIndex >= leftItems.length) {
            // isGameOver effect će završiti rundu kad state stigne.
            setSelectedRight(null);
            setIsError(false);
            setTransitionExpiresAt(0);

            broadcastState({
                matchedPairs: updatedMatched,
                missedLeftIds: updatedMissed,
                selectedRight: null,
                isError: false,
                transitionExpiresAt: 0,
                blueScore: currBlue,
                redScore: currRed,
            });

            return;
        }

        const nextPlayer = roundStarter;
        const newTurnExpiresAt = Date.now() + 15 * 1000;

        setSelectedRight(null);
        setIsError(false);
        setAttemptCount(0);
        setTimeLeft(15);
        setTurnExpiresAt(newTurnExpiresAt);
        setTransitionExpiresAt(0);
        setCurrentIndex(nextIndex);
        setActivePlayer(nextPlayer);

        broadcastState({
            matchedPairs: updatedMatched,
            missedLeftIds: updatedMissed,
            currentIndex: nextIndex,
            activePlayer: nextPlayer,
            attemptCount: 0,
            selectedRight: null,
            isError: false,
            turnExpiresAt: newTurnExpiresAt,
            transitionExpiresAt: 0,
            blueScore: currBlue,
            redScore: currRed
        });
    }

    function handleRightClick(item: PairItem) {
        if (!canPlay || isGameOver || isError || !data) return;

        sendBroadcast({
            type: "SPOJNICE_PICK",
            role: myRole,
            round,
            itemId: item.id,
            currentIndex,
        });

        // Authority može odmah obraditi vlastiti klik.
        if (isAuthority) {
            processPick(item.id, myRole, currentIndex);
        }
    }

    function processPick(
        itemId: number,
        player: "blue" | "red",
        pickIndex: number
    ) {
        if (!isAuthority) return;
        if (phase !== "playing" || isError || isGameOver) return;
        if (player !== activePlayer) return;
        if (pickIndex !== currentIndex) return;

        const currentLeftItem = leftItems[currentIndex];
        const item = rightItems.find(right => right.id === itemId);

        if (!currentLeftItem || !item) return;
        if (matchedPairs.some(match => match.id === item.id)) return;

        setSelectedRight(item);

        let currBlue = blueScore;
        let currRed = redScore;
        const updatedMatched = [...matchedPairs];

        if (currentLeftItem.id === item.id) {
            // Svaki tačan par vrijedi +2. Netačan odgovor nikad ne oduzima poene.
            if (activePlayer === "blue") {
                currBlue += 2;
            } else {
                currRed += 2;
            }

            const nextMatched = [
                ...updatedMatched,
                {
                    id: currentLeftItem.id,
                    player: activePlayer,
                }
            ];

            setBlueScore(currBlue);
            setRedScore(currRed);
            setMatchedPairs(nextMatched);
            updateHeaderDelta(currBlue, currRed);

            proceedToNextRow(
                missedLeftIds,
                nextMatched,
                currBlue,
                currRed
            );
        } else {
            const newTransitionExpiresAt =
                Date.now() + 3 * 1000;

            setIsError(true);
            setTransitionTimer(3);
            setTransitionExpiresAt(
                newTransitionExpiresAt
            );

            broadcastState({
                selectedRight: item,
                isError: true,
                transitionExpiresAt: newTransitionExpiresAt
            });
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

                    <div className={`grid grid-cols-2 gap-3 w-full max-w-[340px] transition-all duration-300 ${!canPlay && phase === "playing" ? 'opacity-70' : ''}`}>
                        
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
                                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400 opacity-80 cursor-not-allowed" 
                                        : "bg-red-500/20 border-red-500/50 text-red-400 opacity-80 cursor-not-allowed";
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
                                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400 opacity-80 cursor-not-allowed"
                                        : "bg-red-500/20 border-red-500/50 text-red-400 opacity-80 cursor-not-allowed";
                                } else if (isSelected && isError) {
                                    btnStyle = "bg-yellow-500/20 border-yellow-500/60 text-yellow-400";
                                } else if (isSelected) {
                                    btnStyle = "bg-primary/20 border-primary text-primary";
                                }

                                return (
                                    <button
                                        key={`right-${item.id}`}
                                        onClick={() => handleRightClick(item)}
                                        disabled={!canPlay || isMatched || isError}
                                        className={`h-11 px-3 flex items-center justify-center text-center rounded-xl border text-xs font-bold transition-all shadow-sm ${canPlay && !isMatched && !isError ? 'cursor-pointer hover:bg-surface-light' : 'cursor-not-allowed opacity-75'} ${btnStyle}`}
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