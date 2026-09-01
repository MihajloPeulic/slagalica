"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles, Check, X, Clock, Trophy } from "lucide-react";
import { verifyWordAction } from "@/data/game/slagalica";



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
    myRole: "blue" | "red";
    round: number;
    tiles: Data;
    sendBroadcast: (payload: any) => void;
    incomingBroadcast?: any;
    onScoreSubmit: (bluePoints: number, redPoints: number) => void;
    onNextRound: () => void;
    onTimerTick: (timeLeft: number) => void;
}

function calculateSlagalicaScores(
    blueWord: string,
    isBlueValid: boolean,
    redWord: string,
    isRedValid: boolean,
    computerWord: string,
    round: number
) {
    const blueLen = isBlueValid ? blueWord.length : 0;
    const redLen = isRedValid ? redWord.length : 0;
    const compLen = computerWord?.length ?? 0;

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
    } else if (
        blueLen === redLen &&
        blueLen > 0 &&
        isBlueValid &&
        isRedValid
    ) {
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
    myRole,
    round,
    tiles: initialTiles,
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
        () => initialTiles?.slova?.map(tile => ({ ...tile, used: false })) ?? []
    );
    const [rollingLetters, setRollingLetters] = useState<string[]>(
        () => Array.from({ length: 12 }, () => "A")
    );
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

    const currentWord = history.map(item => item.value).join("");


    
    

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

    // 1. RESET NA POČETKU NOVE RUNDE
    // initialTiles je već razriješen prije renderovanja komponente.
    useEffect(() => {
        setTiles(
            initialTiles?.slova?.map(tile => ({
                ...tile,
                used: false,
            })) ?? []
        );

        setHistory([]);
        setMyWord("");
        setOpponentWord(null);
        setIsMySubmitted(false);
        setIsOpponentSubmitted(false);
        setWordStatus(null);
        setIsChecking(false);
        setRoundSummary(null);
        setPhase("selecting");
        setSelectionExpiresAt(Date.now() + 5 * 1000);
        setGameExpiresAt(0);
        setRollingLetters(Array.from({ length: 12 }, () => "A"));
        setIntermissionExpiresAt(0);
        setIntermissionTimeLeft(10);
        isProcessingRoundRef.current = false;
    }, [initialTiles, round]);

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

    // 3. KADA SE KOMPONENTA MOUNTA TRAŽIMO SYNC OD PROTIVNIKA
    useEffect(() => {
        sendBroadcast({
            type: "SYNC_REQUEST",
            role: myRole,
            round,
        });
    }, [myRole, round]);

    // 4. BROADCAST LISTENER
    useEffect(() => {
        if (!incomingBroadcast) return;

        if (incomingBroadcast.type === "SUBMIT_WORD") {
            if (incomingBroadcast.role === myRole) return;
            if (
                typeof incomingBroadcast.round === "number" &&
                incomingBroadcast.round !== round
            ) return;
            
            setOpponentWord(incomingBroadcast.word);
            setIsOpponentSubmitted(true);
            return;
        }

        if (incomingBroadcast.type === "LETTERS_STOP") {
            if (incomingBroadcast.role === myRole) return;
            if (
                typeof incomingBroadcast.round === "number" &&
                incomingBroadcast.round !== round
            ) return;

            const nextGameExpiresAt =
                typeof incomingBroadcast.gameExpiresAt === "number"
                    ? incomingBroadcast.gameExpiresAt
                    : Date.now() + 60 * 1000;

            setGameExpiresAt(nextGameExpiresAt);
            setPhase("playing");
            return;
        }

        if (incomingBroadcast.type === "SYNC_RESPONSE") {
            if (incomingBroadcast.role === myRole) return;
            if (
                typeof incomingBroadcast.round === "number" &&
                incomingBroadcast.round !== round
            ) return;

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

            return;
        }

        if (incomingBroadcast.type === "SYNC_REQUEST") {
            // Ne odgovaraj na vlastiti request.
            if (incomingBroadcast.role === myRole) return;
            if (
                typeof incomingBroadcast.round === "number" &&
                incomingBroadcast.round !== round
            ) return;

            const snapshot = gameSnapshot.current;

            sendBroadcast({
                type: "SYNC_RESPONSE",
                role: myRole,
                round,
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

    // 5. VIZUELNO "MIJEŠANJE" SLOVA
    useEffect(() => {
        if (phase !== "selecting") return;

        const visualAlphabet = [
            "A", "E", "I", "O", "U",
            "N", "R", "S", "T", "K", "L", "J",
            "V", "D", "P", "C", "M", "B", "G", "Z",
            "Š", "Č", "Ć", "Ž", "Đ", "LJ", "NJ",
        ];

        const timer = setInterval(() => {
            setRollingLetters(
                Array.from(
                    { length: 12 },
                    () => visualAlphabet[
                        Math.floor(Math.random() * visualAlphabet.length)
                    ]
                )
            );
        }, 70);

        return () => clearInterval(timer);
    }, [phase]);

    function stopLetters() {
        if (phase !== "selecting") return;
        if (!isRoundStarter) return;

        const nextGameExpiresAt = Date.now() + 60 * 1000;

        setGameExpiresAt(nextGameExpiresAt);
        setPhase("playing");
        onTimerTick(60);

        sendBroadcast({
            type: "LETTERS_STOP",
            role: myRole,
            round,
            gameExpiresAt: nextGameExpiresAt,
        });
    }

    // 6. TIMER ZA STOP SLOVA - 5 SEKUNDI
    useEffect(() => {
        if (phase !== "selecting") return;

        const tick = () => {
            const timeLeft = Math.max(
                0,
                Math.ceil((selectionExpiresAt - Date.now()) / 1000)
            );

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
    }, [
        phase,
        selectionExpiresAt,
        isRoundStarter,
        myRole,
        round,
    ]);

    // 7. GAME TIMER - 60 SEKUNDI
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
    }, [
        gameExpiresAt,
        isMySubmitted,
        isOpponentSubmitted,
        phase,
    ]);

    // 8. INTERMISSION TIMER - 10 SEKUNDI
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
            const finished = tick();

            if (finished) {
                clearInterval(timer);
            }
        }, 250);

        return () => clearInterval(timer);
    }, [intermissionExpiresAt, phase]);

    // 9. AUTOMATSKA PROVJERA RIJEČI
    useEffect(() => {
        if (
            phase !== "playing" ||
            !currentWord ||
            currentWord.length === 0
        ) {
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
        if (
            tile.used ||
            isMySubmitted ||
            phase !== "playing"
        ) {
            return;
        }

        setTiles(prev =>
            prev.map(t =>
                t.id === tile.id
                    ? { ...t, used: true }
                    : t
            )
        );

        setHistory(prev => [
            ...prev,
            {
                value: tile.value,
                tileId: tile.id,
            },
        ]);
    }

    function handleUndo() {
        if (
            history.length === 0 ||
            isMySubmitted ||
            phase !== "playing"
        ) {
            return;
        }

        const lastAction = history[history.length - 1];

        setTiles(prev =>
            prev.map(t =>
                t.id === lastAction.tileId
                    ? { ...t, used: false }
                    : t
            )
        );

        setHistory(prev => prev.slice(0, -1));
    }

    function handleResetWord() {
        if (
            isMySubmitted ||
            phase !== "playing"
        ) {
            return;
        }

        setTiles(prev =>
            prev.map(t => ({
                ...t,
                used: false,
            }))
        );

        setHistory([]);
        setWordStatus(null);
    }

    function handleTouchStartOrMouseDown() {
        if (
            isMySubmitted ||
            phase !== "playing"
        ) {
            return;
        }

        isLongPressRef.current = false;

        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            handleResetWord();
        }, 600);
    }

    function handleTouchEndOrMouseUp() {
        if (
            isMySubmitted ||
            phase !== "playing"
        ) {
            return;
        }

        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (!isLongPressRef.current) {
            handleUndo();
        }

        isLongPressRef.current = false;
    }

    function handleUserSubmit() {
        if (
            isMySubmitted ||
            phase !== "playing"
        ) {
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

    // 10. KRAJ RUNDE I BODOVANJE
    async function handleEndRoundProcessing() {
        setPhase("calculating");

        const finalMyWord = isMySubmitted
            ? myWord
            : currentWord;

        const finalOpponentWord = opponentWord || "";

        const blueWordStr =
            myRole === "blue"
                ? finalMyWord
                : finalOpponentWord;

        const redWordStr =
            myRole === "red"
                ? finalMyWord
                : finalOpponentWord;

        try {
            const [blueRes, redRes] = await Promise.all([
                blueWordStr
                    ? verifyWordAction(blueWordStr)
                    : { success: false, compLen: 0 },

                redWordStr
                    ? verifyWordAction(redWordStr)
                    : { success: false, compLen: 0 },
            ]);

            const isBlueValid = !!blueRes.success;
            const isRedValid = !!redRes.success;

            const longestWord = initialTiles?.najduza_rec ?? "";

            const {
                bluePoints: bluePts,
                redPoints: redPts,
                blueBreakdown,
                redBreakdown,
            } = calculateSlagalicaScores(
                blueWordStr,
                isBlueValid,
                redWordStr,
                isRedValid,
                longestWord,
                round
            );

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
                Intermission počinje TEK SADA.
                Ne na početku game komponente.
            */
            const newIntermissionExpiresAt =
                Date.now() + 10 * 1000;

            setIntermissionExpiresAt(
                newIntermissionExpiresAt
            );

            setIntermissionTimeLeft(10);
            setPhase("intermission");
        } catch (err) {
            console.error(
                "Greška pri bodovanju:",
                err
            );

            onScoreSubmit(0, 0);

            const newIntermissionExpiresAt =
                Date.now() + 10 * 1000;

            setIntermissionExpiresAt(
                newIntermissionExpiresAt
            );

            setIntermissionTimeLeft(10);
            setPhase("intermission");
        }
    }

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[340px] gap-4 animate-in fade-in zoom-in-95">
            {phase === "selecting" ? (
                <div className="flex flex-col items-center justify-center w-full gap-5">
                    <div className="text-center">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                            Biranje slova
                        </div>

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
                            <span className="text-xs font-bold text-text-muted animate-pulse">
                                Proveravam reč...
                            </span>
                        )}

                        {!isChecking &&
                            wordStatus === "TAČNO" && (
                                <span className="text-xs font-black text-emerald-500 tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                                    TAČNO
                                </span>
                            )}

                        {!isChecking &&
                            wordStatus === "NETAČNO" && (
                                <span className="text-xs font-black text-red-500 tracking-wider uppercase bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
                                    NETAČNO
                                </span>
                            )}
                    </div>

                    <div className="w-full text-center py-4 px-4 bg-surface/90 backdrop-blur-md border-2 border-primary/60 rounded-3xl text-primary font-black text-2xl tracking-widest min-h-[64px] flex items-center justify-center overflow-x-auto shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                        {isMySubmitted ? myWord : currentWord || (
                            <span className="text-text-muted text-sm font-normal tracking-normal">
                                Sastavljajte reč klikom...
                            </span>
                        )}
                    </div>

                    {!isMySubmitted &&
                    phase === "playing" ? (
                        <>
                            <div className="flex flex-col gap-2.5 w-full">
                                <div className="grid grid-cols-6 gap-2">
                                    {tiles
                                        .slice(0, 6)
                                        .map(tile => (
                                            <button
                                                key={
                                                    tile.id
                                                }
                                                onClick={() =>
                                                    handleLetterClick(
                                                        tile
                                                    )
                                                }
                                                disabled={
                                                    tile.used
                                                }
                                                className={`flex h-12 items-center justify-center rounded-xl border text-lg font-black transition-all shadow-sm ${
                                                    tile.used
                                                        ? "bg-surface/30 border-border/40 text-text-muted opacity-40 cursor-not-allowed"
                                                        : "bg-surface border-border hover:bg-surface-light hover:border-primary/50 text-text active:scale-95 cursor-pointer"
                                                }`}
                                            >
                                                {
                                                    tile.value
                                                }
                                            </button>
                                        ))}
                                </div>

                                <div className="grid grid-cols-6 gap-2">
                                    {tiles
                                        .slice(6, 12)
                                        .map(tile => (
                                            <button
                                                key={
                                                    tile.id
                                                }
                                                onClick={() =>
                                                    handleLetterClick(
                                                        tile
                                                    )
                                                }
                                                disabled={
                                                    tile.used
                                                }
                                                className={`flex h-12 items-center justify-center rounded-xl border text-lg font-black transition-all shadow-sm ${
                                                    tile.used
                                                        ? "bg-surface/30 border-border/40 text-text-muted opacity-40 cursor-not-allowed"
                                                        : "bg-surface border-border hover:bg-surface-light hover:border-primary/50 text-text active:scale-95 cursor-pointer"
                                                }`}
                                            >
                                                {
                                                    tile.value
                                                }
                                            </button>
                                        ))}
                                </div>

                                <button
                                    onMouseDown={
                                        handleTouchStartOrMouseDown
                                    }
                                    onMouseUp={
                                        handleTouchEndOrMouseUp
                                    }
                                    onTouchStart={
                                        handleTouchStartOrMouseDown
                                    }
                                    onTouchEnd={
                                        handleTouchEndOrMouseUp
                                    }
                                    className="w-full flex items-center justify-center gap-2 py-3 mt-1 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500 font-bold text-sm transition-all active:scale-95 shadow-sm cursor-pointer select-none"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Obriši slovo (Drži za
                                    sve)
                                </button>
                            </div>

                            <button
                                onClick={
                                    handleUserSubmit
                                }
                                disabled={
                                    currentWord.length ===
                                    0
                                }
                                className="w-full py-4 mt-2 rounded-2xl bg-primary text-black font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(245,158,11,0.2)] cursor-pointer disabled:opacity-50"
                            >
                                Potvrdi reč
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-surface/60 border border-border rounded-3xl w-full gap-2">
                            <Sparkles className="h-8 w-8 text-primary animate-bounce" />

                            <span className="text-sm font-bold text-text">
                                {phase ===
                                "calculating"
                                    ? "Bodovanje u toku..."
                                    : "Reč uspešno poslata!"}
                            </span>

                            <span className="text-xs text-text-secondary">
                                {isOpponentSubmitted
                                    ? "Obračunavam rezultate..."
                                    : "Čekamo protivnika da završi..."}
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <div className="flex flex-col items-center justify-center w-full bg-surface border border-border p-5 rounded-3xl shadow-2xl gap-4 animate-in zoom-in-95">
                    <div className="flex items-center gap-2 text-primary font-black uppercase text-xs tracking-wider bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                        <Trophy className="h-4 w-4" />
                        Rezultat Runde {round}
                    </div>

                    <div className="flex flex-col gap-3 w-full my-1">
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] font-bold text-blue-400 uppercase">
                                    Plavi Igrač
                                </span>

                                <span className="text-base font-black text-text tracking-wider">
                                    {roundSummary?.blueWord || (
                                        <em className="text-text-muted text-xs font-normal">
                                            Bez reči
                                        </em>
                                    )}
                                </span>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                    {roundSummary?.isBlueValid ? (
                                        <Check className="h-5 w-5 text-emerald-500" />
                                    ) : (
                                        <X className="h-5 w-5 text-red-500" />
                                    )}

                                    <span className="text-lg font-black text-blue-400">
                                        +{roundSummary?.bluePts ?? 0}
                                    </span>
                                </div>

                                {roundSummary?.isBlueValid && (
                                    <div className="flex flex-col items-end text-[9px] font-bold leading-tight text-text-secondary">
                                        <span>Slova: +{roundSummary.blueBreakdown.letters}</span>
                                        {roundSummary.blueBreakdown.longerWordBonus > 0 && (
                                            <span>Duža reč: +{roundSummary.blueBreakdown.longerWordBonus}</span>
                                        )}
                                        {roundSummary.blueBreakdown.roundAdvantageBonus > 0 && (
                                            <span>Prednost runde: +{roundSummary.blueBreakdown.roundAdvantageBonus}</span>
                                        )}
                                        {roundSummary.blueBreakdown.computerBonus > 0 && (
                                            <span>
                                                {roundSummary.blueBreakdown.computerBonus === 3
                                                    ? "Kao najduža: "
                                                    : "Duže od najduže: "}
                                                +{roundSummary.blueBreakdown.computerBonus}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] font-bold text-red-400 uppercase">
                                    Crveni Igrač
                                </span>

                                <span className="text-base font-black text-text tracking-wider">
                                    {roundSummary?.redWord || (
                                        <em className="text-text-muted text-xs font-normal">
                                            Bez reči
                                        </em>
                                    )}
                                </span>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                    {roundSummary?.isRedValid ? (
                                        <Check className="h-5 w-5 text-emerald-500" />
                                    ) : (
                                        <X className="h-5 w-5 text-red-500" />
                                    )}

                                    <span className="text-lg font-black text-red-400">
                                        +{roundSummary?.redPts ?? 0}
                                    </span>
                                </div>

                                {roundSummary?.isRedValid && (
                                    <div className="flex flex-col items-end text-[9px] font-bold leading-tight text-text-secondary">
                                        <span>Slova: +{roundSummary.redBreakdown.letters}</span>
                                        {roundSummary.redBreakdown.longerWordBonus > 0 && (
                                            <span>Duža reč: +{roundSummary.redBreakdown.longerWordBonus}</span>
                                        )}
                                        {roundSummary.redBreakdown.roundAdvantageBonus > 0 && (
                                            <span>Prednost runde: +{roundSummary.redBreakdown.roundAdvantageBonus}</span>
                                        )}
                                        {roundSummary.redBreakdown.computerBonus > 0 && (
                                            <span>
                                                {roundSummary.redBreakdown.computerBonus === 3
                                                    ? "Kao najduža: "
                                                    : "Duže od najduže: "}
                                                +{roundSummary.redBreakdown.computerBonus}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="w-full flex flex-col items-center justify-center gap-1 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary">
                            Najduža reč
                        </span>

                        <span className="text-base font-black tracking-widest text-primary">
                            {roundSummary?.longestWord || initialTiles?.najduza_rec || "—"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-text-secondary bg-surface-light px-4 py-2 rounded-xl">
                        <Clock className="h-4 w-4 animate-spin text-primary" />

                        <span>
                            Sledeća runda za:{" "}
                            <strong className="text-primary font-black text-sm">
                                {
                                    intermissionTimeLeft
                                }
                                s
                            </strong>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}