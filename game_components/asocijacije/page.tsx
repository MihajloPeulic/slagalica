"use client";

import { useEffect, useRef, useState } from "react";
import {
    Sparkles,
    X,
    Check,
    ArrowRight,
    HelpCircle,
    Clock
} from "lucide-react";

type Player = "blue" | "red";
type ColKey = "A" | "B" | "C" | "D";

interface GuessPreview {
    target: ColKey | "FINAL";
    value: string;
    player: Player;
}
type Phase =
    | "preparing"
    | "playing"
    | "transition"
    | "intermission"
    | "celebration";

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
    round: number;
    data: AsocijacijeRoundData;
    sendBroadcast: (payload: any) => void;
    incomingBroadcast?: any;
    onScoreSubmit: (
        bluePoints: number,
        redPoints: number
    ) => void;
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
    const roundStarter: Player =
        round === 1 ? "blue" : "red";

    const [activePlayer, setActivePlayer] =
        useState<Player>(roundStarter);

    const [phase, setPhase] =
        useState<Phase>("preparing");

    const [blueScore, setBlueScore] =
        useState(0);

    const [redScore, setRedScore] =
        useState(0);

    // Timestampovi su source of truth za sve vremenske faze.
    const [
        prepareExpiresAt,
        setPrepareExpiresAt
    ] = useState(
        () => Date.now() + 5 * 1000
    );

    const [
        expiresAt,
        setExpiresAt
    ] = useState<number | null>(null);

    const [
        transitionExpiresAt,
        setTransitionExpiresAt
    ] = useState<number | null>(null);

    const [
        celebrationExpiresAt,
        setCelebrationExpiresAt
    ] = useState<number | null>(null);

    const [
        summaryExpiresAt,
        setSummaryExpiresAt
    ] = useState<number | null>(null);

    // UI countdown stateovi.
    const [
        prepareTimeLeft,
        setPrepareTimeLeft
    ] = useState(5);

    const [
        timeLeft,
        setTimeLeft
    ] = useState(30);

    const [
        transitionTimer,
        setTransitionTimer
    ] = useState(0);

    const [
        summaryTimeLeft,
        setSummaryTimeLeft
    ] = useState(10);

    const [
        openedFields,
        setOpenedFields
    ] = useState<string[]>([]);

    const [
        solvedCols,
        setSolvedCols
    ] = useState<
        Record<ColKey, Player | null>
    >({
        A: null,
        B: null,
        C: null,
        D: null
    });

    const [
        lastSolvedCol,
        setLastSolvedCol
    ] = useState<{
        col: ColKey;
        time: number;
    } | null>(null);

    const [
        finalSolvedBy,
        setFinalSolvedBy
    ] = useState<Player | null>(
        null
    );

    const [
        canOpenField,
        setCanOpenField
    ] = useState(true);

    const [
        remainingAttempts,
        setRemainingAttempts
    ] = useState({
        blue: 2,
        red: 2
    });

    const [
        modalTarget,
        setModalTarget
    ] = useState<
        ColKey | "FINAL" | null
    >(null);

    const [
        inputValue,
        setInputValue
    ] = useState("");

    const [
        isError,
        setIsError
    ] = useState(false);

    // Poslednji pokušaj se kratko prikazuje protivniku
    // u polju kolone / konačnog rešenja.
    const [
        lastAttempt,
        setLastAttempt
    ] = useState<GuessPreview | null>(null);

    const inputRef =
        useRef<HTMLInputElement>(null);

    const turnEndingRef =
        useRef(false);

    const gameEndedRef =
        useRef(false);

    const hasReceivedSyncRef =
        useRef(false);

    const gameSnapshot = useRef({
        activePlayer,
        phase,
        blueScore,
        redScore,
        prepareExpiresAt,
        expiresAt,
        transitionExpiresAt,
        celebrationExpiresAt,
        summaryExpiresAt,
        openedFields,
        solvedCols,
        lastSolvedCol,
        finalSolvedBy,
        canOpenField,
        remainingAttempts,
        modalTarget,
        inputValue,
        isError,
        lastAttempt
    });

    useEffect(() => {
        gameSnapshot.current = {
            activePlayer,
            phase,
            blueScore,
            redScore,
            prepareExpiresAt,
            expiresAt,
            transitionExpiresAt,
            celebrationExpiresAt,
            summaryExpiresAt,
            openedFields,
            solvedCols,
            lastSolvedCol,
            finalSolvedBy,
            canOpenField,
            remainingAttempts,
            modalTarget,
            inputValue,
            isError,
            lastAttempt
        };
    }, [
        activePlayer,
        phase,
        blueScore,
        redScore,
        prepareExpiresAt,
        expiresAt,
        transitionExpiresAt,
        celebrationExpiresAt,
        summaryExpiresAt,
        openedFields,
        solvedCols,
        lastSolvedCol,
        finalSolvedBy,
        canOpenField,
        remainingAttempts,
        modalTarget,
        inputValue,
        isError,
        lastAttempt
    ]);

    // Polje je završeno ako je ručno otvoreno ili je njegova kolona riješena.
    const allFieldsOpened =
        COLS.every(col =>
            solvedCols[col] !== null ||
            [1, 2, 3, 4].every(row =>
                openedFields.includes(`${col}${row}`)
            )
        );

    const hasAnyOpenableField =
        COLS.some(col =>
            solvedCols[col] === null &&
            [1, 2, 3, 4].some(row =>
                !openedFields.includes(`${col}${row}`)
            )
        );

    const isMyTurn =
        myRole === activePlayer;

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

    function addPoints(
        player: Player,
        points: number
    ) {
        if (player === "blue") {
            setBlueScore(
                prev => prev + points
            );

            onScoreSubmit(
                points,
                0
            );
        } else {
            setRedScore(
                prev => prev + points
            );

            onScoreSubmit(
                0,
                points
            );
        }
    }

    function calculateColPoints(
        col: ColKey
    ) {
        const unopened = [
            1,
            2,
            3,
            4
        ]
            .map(
                num =>
                    `${col}${num}`
            )
            .filter(
                field =>
                    !openedFields.includes(
                        field
                    )
            )
            .length;

        return 2 + unopened;
    }

    function calculateFinalPoints() {
        let points = 5;

        COLS.forEach(col => {
            if (!solvedCols[col]) {
                points +=
                    calculateColPoints(
                        col
                    );
            }
        });

        return points;
    }

    function hasOpenedFieldInCol(
        col: ColKey
    ) {
        return openedFields.some(
            field =>
                field.startsWith(
                    col
                )
        );
    }

    function triggerEndGame() {
        if (
            gameEndedRef.current
        ) {
            return;
        }

        gameEndedRef.current =
            true;

        turnEndingRef.current =
            true;

        const newSummaryExpiresAt =
            Date.now() +
            10 * 1000;

        setPhase(
            "intermission"
        );

        setSummaryExpiresAt(
            newSummaryExpiresAt
        );

        setSummaryTimeLeft(10);
        setExpiresAt(null);
        setTransitionExpiresAt(
            null
        );
        setCelebrationExpiresAt(
            null
        );
        setModalTarget(null);
        setInputValue("");
        setLastAttempt(null);
    }

    function triggerCelebration(
        player: Player,
        pts: number
    ) {
        if (
            gameEndedRef.current
        ) {
            return;
        }

        gameEndedRef.current =
            true;

        turnEndingRef.current =
            true;

        const newCelebrationExpiresAt =
            Date.now() +
            4 * 1000;

        setPhase(
            "celebration"
        );

        setCelebrationExpiresAt(
            newCelebrationExpiresAt
        );

        setExpiresAt(null);
        setTransitionExpiresAt(
            null
        );
        setModalTarget(null);
        setInputValue("");
        setLastAttempt(null);

        setSolvedCols(prev => {
            const updated = {
                ...prev
            };

            COLS.forEach(col => {
                if (!updated[col]) {
                    updated[col] =
                        player;
                }
            });

            return updated;
        });

        setFinalSolvedBy(
            player
        );

        addPoints(
            player,
            pts
        );
    }

    function handlePassTurnLocal() {
        if (
            turnEndingRef.current ||
            phase !== "playing"
        ) {
            return false;
        }

        turnEndingRef.current =
            true;

        setModalTarget(null);

        if (allFieldsOpened) {
            const attempts = {
                ...remainingAttempts
            };

            // Posle otvaranja svih 16 polja svaki igrač ima
            // još tačno 2 neuspešna pokušaja / prolaza.
            attempts[activePlayer] =
                Math.max(
                    0,
                    attempts[activePlayer] - 1
                );

            setRemainingAttempts(
                attempts
            );

            if (
                attempts.blue ===
                    0 &&
                attempts.red === 0
            ) {
                triggerEndGame();
                return true;
            }
        }

        const newTransitionExpiresAt =
            Date.now() +
            3 * 1000;

        setPhase(
            "transition"
        );

        setTransitionExpiresAt(
            newTransitionExpiresAt
        );

        setTransitionTimer(3);

        return true;
    }

    // ============================================================
    // INIT
    // ============================================================

    useEffect(() => {
        const now =
            Date.now();

        setActivePlayer(
            roundStarter
        );

        setPhase(
            "preparing"
        );

        setBlueScore(0);
        setRedScore(0);

        setOpenedFields([]);

        setSolvedCols({
            A: null,
            B: null,
            C: null,
            D: null
        });

        setLastSolvedCol(
            null
        );

        setFinalSolvedBy(
            null
        );

        setCanOpenField(
            true
        );

        setRemainingAttempts({
            blue: 2,
            red: 2
        });

        setPrepareExpiresAt(
            now + 5 * 1000
        );

        setExpiresAt(null);

        setTransitionExpiresAt(
            null
        );

        setCelebrationExpiresAt(
            null
        );

        setSummaryExpiresAt(
            null
        );

        setPrepareTimeLeft(5);
        setTimeLeft(30);
        setTransitionTimer(0);
        setSummaryTimeLeft(10);

        setModalTarget(null);
        setInputValue("");
        setIsError(false);
        setLastAttempt(null);

        turnEndingRef.current =
            false;

        gameEndedRef.current =
            false;

        hasReceivedSyncRef.current =
            false;
    }, [
        round,
        roundStarter
    ]);

    // ============================================================
    // BROADCAST
    // ============================================================

    useEffect(() => {
        if (
            !incomingBroadcast ||
            incomingBroadcast.role ===
                myRole
        ) {
            return;
        }

        const msg =
            incomingBroadcast;

        if (
            typeof msg.round ===
                "number" &&
            msg.round !== round
        ) {
            return;
        }

        if (
            msg.type ===
            "ASOC_SYNC_REQUEST"
        ) {
            const snapshot =
                gameSnapshot.current;

            sendBroadcast({
                type:
                    "ASOC_SYNC_RESPONSE",
                role: myRole,
                round,

                activePlayer:
                    snapshot.activePlayer,

                phase:
                    snapshot.phase,

                blueScore:
                    snapshot.blueScore,

                redScore:
                    snapshot.redScore,

                prepareExpiresAt:
                    snapshot.prepareExpiresAt,

                expiresAt:
                    snapshot.expiresAt,

                transitionExpiresAt:
                    snapshot.transitionExpiresAt,

                celebrationExpiresAt:
                    snapshot.celebrationExpiresAt,

                summaryExpiresAt:
                    snapshot.summaryExpiresAt,

                openedFields:
                    snapshot.openedFields,

                solvedCols:
                    snapshot.solvedCols,

                lastSolvedCol:
                    snapshot.lastSolvedCol,

                finalSolvedBy:
                    snapshot.finalSolvedBy,

                canOpenField:
                    snapshot.canOpenField,

                remainingAttempts:
                    snapshot.remainingAttempts,

                modalTarget:
                    snapshot.modalTarget,

                inputValue:
                    snapshot.inputValue,

                isError:
                    snapshot.isError,

                lastAttempt:
                    snapshot.lastAttempt
            });

            return;
        }

        if (
            msg.type ===
            "ASOC_SYNC_RESPONSE"
        ) {
            if (
                hasReceivedSyncRef.current
            ) {
                return;
            }

            hasReceivedSyncRef.current =
                true;

            setPhase(
                msg.phase
            );

            setActivePlayer(
                msg.activePlayer
            );

            setBlueScore(
                msg.blueScore ?? 0
            );

            setRedScore(
                msg.redScore ?? 0
            );

            setOpenedFields(
                msg.openedFields ??
                    []
            );

            setSolvedCols(
                msg.solvedCols ?? {
                    A: null,
                    B: null,
                    C: null,
                    D: null
                }
            );

            setLastSolvedCol(
                msg.lastSolvedCol ??
                    null
            );

            setFinalSolvedBy(
                msg.finalSolvedBy ??
                    null
            );

            setCanOpenField(
                msg.canOpenField ??
                    true
            );

            setRemainingAttempts(
                msg.remainingAttempts ?? {
                    blue: 2,
                    red: 2
                }
            );

            setModalTarget(
                msg.modalTarget ??
                    null
            );

            setInputValue(
                typeof msg.inputValue ===
                    "string"
                    ? msg.inputValue
                    : ""
            );

            setIsError(
                !!msg.isError
            );

            setLastAttempt(
                msg.lastAttempt ?? null
            );

            if (
                typeof msg.prepareExpiresAt ===
                "number"
            ) {
                setPrepareExpiresAt(
                    msg.prepareExpiresAt
                );

                setPrepareTimeLeft(
                    Math.max(
                        0,
                        Math.ceil(
                            (
                                msg.prepareExpiresAt -
                                Date.now()
                            ) / 1000
                        )
                    )
                );
            }

            setExpiresAt(
                typeof msg.expiresAt ===
                    "number"
                    ? msg.expiresAt
                    : null
            );

            if (
                typeof msg.expiresAt ===
                "number"
            ) {
                setTimeLeft(
                    Math.max(
                        0,
                        Math.ceil(
                            (
                                msg.expiresAt -
                                Date.now()
                            ) / 1000
                        )
                    )
                );
            }

            setTransitionExpiresAt(
                typeof msg.transitionExpiresAt ===
                    "number"
                    ? msg.transitionExpiresAt
                    : null
            );

            if (
                typeof msg.transitionExpiresAt ===
                "number"
            ) {
                setTransitionTimer(
                    Math.max(
                        0,
                        Math.ceil(
                            (
                                msg.transitionExpiresAt -
                                Date.now()
                            ) / 1000
                        )
                    )
                );
            }

            setCelebrationExpiresAt(
                typeof msg.celebrationExpiresAt ===
                    "number"
                    ? msg.celebrationExpiresAt
                    : null
            );

            setSummaryExpiresAt(
                typeof msg.summaryExpiresAt ===
                    "number"
                    ? msg.summaryExpiresAt
                    : null
            );

            if (
                typeof msg.summaryExpiresAt ===
                "number"
            ) {
                setSummaryTimeLeft(
                    Math.max(
                        0,
                        Math.ceil(
                            (
                                msg.summaryExpiresAt -
                                Date.now()
                            ) / 1000
                        )
                    )
                );
            }

            if (
                msg.phase ===
                    "intermission" ||
                msg.phase ===
                    "celebration"
            ) {
                gameEndedRef.current =
                    true;

                turnEndingRef.current =
                    true;
            } else if (
                msg.phase ===
                "transition"
            ) {
                gameEndedRef.current =
                    false;

                turnEndingRef.current =
                    true;
            } else {
                gameEndedRef.current =
                    false;

                turnEndingRef.current =
                    false;
            }

            return;
        }

        if (
            msg.type !==
            "ASOC_MOVE"
        ) {
            return;
        }

        if (
            msg.action === "OPEN"
        ) {
            setOpenedFields(
                prev =>
                    prev.includes(
                        msg.field
                    )
                        ? prev
                        : [
                              ...prev,
                              msg.field
                          ]
            );

            setCanOpenField(
                false
            );

            return;
        }

        if (
            msg.action ===
            "SOLVE_COL"
        ) {
            setLastSolvedCol({
                col: msg.col,
                time: Date.now()
            });

            setSolvedCols(
                prev => ({
                    ...prev,
                    [msg.col]:
                        msg.player
                })
            );

            addPoints(
                msg.player,
                msg.pts
            );

            setCanOpenField(
                false
            );

            if (
                msg.newExpiresAt
            ) {
                setExpiresAt(
                    msg.newExpiresAt
                );
            }

            return;
        }

        if (
            msg.action ===
            "SOLVE_FINAL"
        ) {
            triggerCelebration(
                msg.player,
                msg.pts
            );

            return;
        }

        if (
            msg.action ===
            "GUESS_PREVIEW"
        ) {
            setLastAttempt({
                target: msg.target,
                value: msg.value,
                player: msg.player
            });

            return;
        }

        if (
            msg.action === "PASS"
        ) {
            handlePassTurnLocal();
        }
    }, [
        incomingBroadcast,
        myRole,
        round
    ]);

    useEffect(() => {
        sendBroadcast({
            type:
                "ASOC_SYNC_REQUEST",
            role: myRole,
            round
        });
    }, [
        myRole,
        round
    ]);

    // ============================================================
    // FIELD CLICK & ANSWERS
    // ============================================================

    function handleFieldClick(
        field: string
    ) {
        if (
            !isMyTurn ||
            phase !== "playing" ||
            !canOpenField ||
            !hasAnyOpenableField ||
            openedFields.includes(
                field
            ) ||
            turnEndingRef.current
        ) {
            return;
        }

        setOpenedFields(
            prev => [
                ...prev,
                field
            ]
        );

        setCanOpenField(
            false
        );

        sendBroadcast({
            type: "ASOC_MOVE",
            role: myRole,
            round,
            action: "OPEN",
            field
        });
    }

    function handleGuessSubmit(
        e: React.FormEvent
    ) {
        e.preventDefault();

        if (
            !modalTarget ||
            !inputValue.trim() ||
            !isMyTurn ||
            phase !== "playing" ||
            turnEndingRef.current
        ) {
            return;
        }

        const submittedValue =
            inputValue.trim();

        const preview: GuessPreview = {
            target: modalTarget,
            value: submittedValue,
            player: myRole
        };

        setLastAttempt(preview);

        sendBroadcast({
            type: "ASOC_MOVE",
            role: myRole,
            round,
            action: "GUESS_PREVIEW",
            target: modalTarget,
            value: submittedValue,
            player: myRole
        });

        const correctAnswers =
            modalTarget ===
            "FINAL"
                ? data.konacno
                : data.kolone[
                      modalTarget
                  ].sol;

        const correct =
            correctAnswers.some(
                answer =>
                    normalize(
                        inputValue
                    ) ===
                    normalize(
                        answer
                    )
            );

        if (correct) {
            if (
                modalTarget ===
                "FINAL"
            ) {
                handleCorrectFinal();
            } else {
                handleCorrectColumn(
                    modalTarget
                );
            }

            setModalTarget(
                null
            );

            setInputValue("");

            return;
        }

        setIsError(true);

        setTimeout(() => {
            setIsError(false);
            setModalTarget(null);
            setInputValue("");

            const processed =
                handlePassTurnLocal();

            if (processed) {
                sendBroadcast({
                    type:
                        "ASOC_MOVE",
                    role: myRole,
                    round,
                    action:
                        "PASS"
                });
            }
        }, 800);
    }

    function handleCorrectColumn(
        col: ColKey
    ) {
        if (
            solvedCols[col]
        ) {
            return;
        }

        const pts =
            calculateColPoints(
                col
            );

        setLastSolvedCol({
            col,
            time: Date.now()
        });

        setSolvedCols(
            prev => ({
                ...prev,
                [col]: myRole
            })
        );

        addPoints(
            myRole,
            pts
        );

        setCanOpenField(
            false
        );

        sendBroadcast({
            type: "ASOC_MOVE",
            role: myRole,
            round,
            action: "SOLVE_COL",
            col,
            player: myRole,
            pts,
            newExpiresAt:
                expiresAt
        });
    }

    function handleCorrectFinal() {
        if (
            finalSolvedBy
        ) {
            return;
        }

        const pts =
            calculateFinalPoints();

        sendBroadcast({
            type: "ASOC_MOVE",
            role: myRole,
            round,
            action:
                "SOLVE_FINAL",
            player: myRole,
            pts
        });

        triggerCelebration(
            myRole,
            pts
        );
    }

    // ============================================================
    // TAJMERI
    // ============================================================

    useEffect(() => {
        if (
            phase !==
            "preparing"
        ) {
            return;
        }

        const tick = () => {
            const left =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            prepareExpiresAt -
                            Date.now()
                        ) / 1000
                    )
                );

            setPrepareTimeLeft(
                left
            );

            onTimerTick(left);

            if (
                left <= 0
            ) {
                const newExpiresAt =
                    Date.now() +
                    30 * 1000;

                setExpiresAt(
                    newExpiresAt
                );

                setTimeLeft(30);

                setCanOpenField(
                    true
                );

                turnEndingRef.current =
                    false;

                setPhase(
                    "playing"
                );

                return true;
            }

            return false;
        };

        if (tick()) {
            return;
        }

        const timer =
            setInterval(() => {
                if (tick()) {
                    clearInterval(
                        timer
                    );
                }
            }, 250);

        return () =>
            clearInterval(
                timer
            );
    }, [
        phase,
        prepareExpiresAt
    ]);

    useEffect(() => {
        if (
            phase !==
                "playing" ||
            !expiresAt
        ) {
            return;
        }

        const timer =
            setInterval(() => {
                const left =
                    Math.max(
                        0,
                        Math.ceil(
                            (
                                expiresAt -
                                Date.now()
                            ) / 1000
                        )
                    );

                setTimeLeft(
                    left
                );

                onTimerTick(
                    left
                );

                if (
                    left === 0 &&
                    isMyTurn &&
                    !turnEndingRef.current
                ) {
                    const processed =
                        handlePassTurnLocal();

                    if (
                        processed
                    ) {
                        sendBroadcast({
                            type:
                                "ASOC_MOVE",
                            role:
                                myRole,
                            round,
                            action:
                                "PASS"
                        });
                    }
                }
            }, 250);

        return () =>
            clearInterval(
                timer
            );
    }, [
        phase,
        expiresAt,
        isMyTurn,
        activePlayer,
        allFieldsOpened,
        remainingAttempts,
        round
    ]);

    useEffect(() => {
        if (
            phase !==
                "transition" ||
            !transitionExpiresAt
        ) {
            return;
        }

        const tick = () => {
            const left =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            transitionExpiresAt -
                            Date.now()
                        ) / 1000
                    )
                );

            setTransitionTimer(
                left
            );

            onTimerTick(left);

            if (
                left <= 0
            ) {
                const newExpiresAt =
                    Date.now() +
                    30 * 1000;

                setActivePlayer(
                    activePlayer ===
                        "blue"
                        ? "red"
                        : "blue"
                );

                // Pokušaj prethodnog igrača nestaje čim počne novi potez.
                setLastAttempt(null);

                setCanOpenField(
                    hasAnyOpenableField
                );

                setExpiresAt(
                    newExpiresAt
                );

                setTransitionExpiresAt(
                    null
                );

                setTimeLeft(30);

                turnEndingRef.current =
                    false;

                setPhase(
                    "playing"
                );

                return true;
            }

            return false;
        };

        if (tick()) {
            return;
        }

        const timer =
            setInterval(() => {
                if (tick()) {
                    clearInterval(
                        timer
                    );
                }
            }, 250);

        return () =>
            clearInterval(
                timer
            );
    }, [
        phase,
        transitionExpiresAt,
        activePlayer,
        allFieldsOpened,
        hasAnyOpenableField
    ]);

    useEffect(() => {
        if (
            phase !==
                "celebration" ||
            !celebrationExpiresAt
        ) {
            return;
        }

        const timer =
            setInterval(() => {
                const left =
                    celebrationExpiresAt -
                    Date.now();

                if (
                    left <= 0
                ) {
                    const newSummaryExpiresAt =
                        Date.now() +
                        10 * 1000;

                    setPhase(
                        "intermission"
                    );

                    setCelebrationExpiresAt(
                        null
                    );

                    setSummaryExpiresAt(
                        newSummaryExpiresAt
                    );

                    setSummaryTimeLeft(
                        10
                    );

                    clearInterval(
                        timer
                    );
                }
            }, 250);

        return () =>
            clearInterval(
                timer
            );
    }, [
        phase,
        celebrationExpiresAt
    ]);

    useEffect(() => {
        if (
            phase !==
                "intermission" ||
            !summaryExpiresAt
        ) {
            return;
        }

        const tick = () => {
            const left =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            summaryExpiresAt -
                            Date.now()
                        ) / 1000
                    )
                );

            setSummaryTimeLeft(
                left
            );

            onTimerTick(left);

            if (
                left <= 0
            ) {
                if (
                    myRole ===
                    "blue"
                ) {
                    onNextRound();
                }

                return true;
            }

            return false;
        };

        if (tick()) {
            return;
        }

        const timer =
            setInterval(() => {
                if (tick()) {
                    clearInterval(
                        timer
                    );
                }
            }, 250);

        return () =>
            clearInterval(
                timer
            );
    }, [
        phase,
        summaryExpiresAt,
        myRole
    ]);

    useEffect(() => {
        if (
            modalTarget &&
            inputRef.current
        ) {
            inputRef.current.focus();
        }
    }, [modalTarget]);

    // ============================================================
    // FIELD UI
    // ============================================================

    function renderField(
        col: ColKey,
        row: number
    ) {
        const fieldKey =
            `${col}${row}`;

        const manuallyOpened =
            openedFields.includes(
                fieldKey
            );

        const solved =
            solvedCols[col] !==
            null;

        const solver =
            solvedCols[col];

        let delayMs = 0;

        if (
            phase ===
            "celebration"
        ) {
            delayMs =
                col === "A" ||
                col === "B"
                    ? (row - 1) *
                      200
                    : (4 - row) *
                      200;
        } else if (
            lastSolvedCol?.col ===
                col &&
            Date.now() -
                lastSolvedCol.time <
                2000
        ) {
            delayMs =
                col === "A" ||
                col === "B"
                    ? (row - 1) *
                      150
                    : (4 - row) *
                      150;
        }

        let style =
            "bg-surface/50 border-border text-text hover:bg-surface-light";

        let content =
            fieldKey;

        if (solved) {
            style =
                solver === "blue"
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                    : "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]";

            content =
                data.kolone[
                    col
                ].fields[
                    row - 1
                ];
        } else if (
            manuallyOpened
        ) {
            style =
                "bg-surface border-primary/50 text-text shadow-[0_0_8px_rgba(245,158,11,0.1)]";

            content =
                data.kolone[
                    col
                ].fields[
                    row - 1
                ];
        }

        const disabled =
            manuallyOpened ||
            solved ||
            phase !== "playing" ||
            !isMyTurn ||
            !canOpenField ||
            turnEndingRef.current;

        return (
            <button
                key={fieldKey}
                onClick={() =>
                    handleFieldClick(
                        fieldKey
                    )
                }
                disabled={
                    disabled
                }
                style={{
                    transitionDelay:
                        `${delayMs}ms`
                }}
                className={`
                    h-[clamp(30px,4.8dvh,42px)]
                    min-h-[30px]
                    w-full
                    flex
                    items-center
                    justify-center
                    rounded-[clamp(6px,1dvh,9px)]
                    border
                    text-[clamp(8px,1.25dvh,10px)]
                    leading-none
                    font-bold
                    transition-all
                    duration-700
                    ease-in-out
                    ${style}
                    ${
                        disabled
                            ? "cursor-default"
                            : "cursor-pointer active:scale-95"
                    }
                `}
            >
                <span className="truncate px-1">
                    {content}
                </span>
            </button>
        );
    }

    function renderColSolution(
        col: ColKey
    ) {
        const solved =
            solvedCols[col] !==
            null;

        const solver =
            solvedCols[col];

        const hasOpened =
            hasOpenedFieldInCol(
                col
            );

        let delayMs = 0;

        if (
            phase ===
            "celebration"
        ) {
            delayMs = 800;
        } else if (
            lastSolvedCol?.col ===
                col &&
            Date.now() -
                lastSolvedCol.time <
                2000
        ) {
            delayMs = 600;
        }

        // Igrač prvo mora otvoriti jedno polje u svom potezu.
        // Nakon toga može pokušati svaku ranije "aktiviranu" kolonu
        // (kolonu koja ima bar jedno otvoreno polje).
        const canGuess =
            !solved &&
            phase === "playing" &&
            isMyTurn &&
            (
                !canOpenField ||
                !hasAnyOpenableField
            ) &&
            hasOpened &&
            !turnEndingRef.current;

        const opponentPreview =
            lastAttempt &&
            lastAttempt.player !== myRole &&
            lastAttempt.target === col
                ? lastAttempt
                : null;

        let style =
            "bg-surface/80 border-border text-text-secondary";

        if (solved) {
            style =
                solver === "blue"
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                    : "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.25)]";
        } else if (
            opponentPreview
        ) {
            style =
                "bg-yellow-500/10 border-yellow-500/40 text-yellow-300";
        } else if (
            canGuess
        ) {
            style =
                "bg-surface border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 cursor-pointer";
        }

        return (
            <button
                key={`sol-${col}`}
                onClick={() =>
                    setModalTarget(
                        col
                    )
                }
                disabled={
                    !canGuess
                }
                style={{
                    transitionDelay:
                        `${delayMs}ms`
                }}
                className={`
                    h-[clamp(30px,4.8dvh,42px)]
                    min-h-[30px]
                    w-full
                    flex
                    items-center
                    justify-center
                    rounded-[clamp(6px,1dvh,9px)]
                    border
                    text-[clamp(8px,1.25dvh,10px)]
                    leading-none
                    font-black
                    uppercase
                    transition-all
                    duration-700
                    ease-in-out
                    shadow-sm
                    ${style}
                `}
            >
                <span className="truncate px-1">
                    {solved
                        ? data.kolone[
                              col
                          ].sol[0]
                        : opponentPreview
                        ? opponentPreview.value
                        : `KOLONA ${col}`}
                </span>
            </button>
        );
    }

    const opponentFinalPreview =
        lastAttempt &&
        lastAttempt.player !== myRole &&
        lastAttempt.target === "FINAL"
            ? lastAttempt
            : null;

    // Konačno rešenje je dostupno čim igrač u svom potezu
    // otvori bilo koje polje.
    const canGuessFinal =
        !finalSolvedBy &&
        phase === "playing" &&
        isMyTurn &&
        openedFields.length > 0 &&
        (
            !canOpenField ||
            !hasAnyOpenableField
        ) &&
        !turnEndingRef.current;

    return (
        <div
            className="
                w-full
                max-w-[360px]
                mx-auto
                min-h-0
                flex
                flex-col
                items-center
                animate-in
                fade-in
                zoom-in-95
            "
        >
            {/* ================================================= */}
            {/* PREPARING - ostavljen praktično isti */}
            {/* ================================================= */}

            {phase === "preparing" ? (
                <>
                    <div className="flex flex-col items-center mb-5 z-10">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5" />
                            Asocijacije (Runda {round})
                        </span>

                        <span className="text-[10px] font-black uppercase px-4 py-1.5 rounded-full border bg-primary/10 border-primary/30 text-primary">
                            Igra počinje za {prepareTimeLeft}s
                        </span>
                    </div>

                    <div className="flex flex-col items-center justify-center py-10 px-5 text-center bg-surface border border-border rounded-3xl w-full shadow-xl gap-4">
                        <Sparkles className="h-10 w-10 text-primary animate-pulse" />

                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                            Priprema
                        </span>

                        <div className="text-5xl font-black text-primary">
                            {prepareTimeLeft}
                        </div>

                        <p className="text-xs font-bold text-text-secondary">
                            Asocijacije uskoro počinju
                        </p>
                    </div>
                </>
            ) : phase === "intermission" ? (
                /* ================================================= */
                /* INTERMISSION */
                /* ================================================= */

                <div
                    className="
                        w-full
                        flex
                        flex-col
                        items-center
                        justify-center
                        py-[clamp(12px,2dvh,24px)]
                        px-4
                        text-center
                        bg-surface
                        border
                        border-border
                        rounded-3xl
                        shadow-2xl
                        gap-[clamp(8px,1.5dvh,16px)]
                    "
                >
                    <HelpCircle className="h-8 w-8 text-primary animate-pulse" />

                    <h2 className="text-base font-black text-text">
                        Završene Asocijacije!
                    </h2>

                    <div className="grid grid-cols-2 gap-2 w-full">
                        {COLS.map(col => (
                            <div
                                key={`summary-${col}`}
                                className="flex flex-col items-center justify-center px-2 py-2 rounded-xl bg-surface-light border border-border"
                            >
                                <span className="text-[8px] font-black uppercase text-text-muted">
                                    Kolona {col}
                                </span>
                                <span className="text-[10px] font-black text-text">
                                    {data.kolone[col].sol[0]}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="w-full px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                        <div className="text-[8px] font-black uppercase text-text-muted">
                            Konačno rešenje
                        </div>
                        <div className="text-xs font-black text-primary">
                            {data.konacno[0]}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <span className="text-[10px] font-bold text-blue-400 uppercase">
                                Plavi Igrač
                            </span>

                            <span className="text-base font-black text-blue-400">
                                {blueScore > 0
                                    ? "+"
                                    : ""}
                                {blueScore}
                            </span>
                        </div>

                        <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                            <span className="text-[10px] font-bold text-red-400 uppercase">
                                Crveni Igrač
                            </span>

                            <span className="text-base font-black text-red-400">
                                {redScore > 0
                                    ? "+"
                                    : ""}
                                {redScore}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold text-text-secondary bg-surface-light px-3 py-1.5 rounded-xl">
                        <Clock className="h-3.5 w-3.5 text-primary" />

                        Sledeća igra za:

                        <strong className="text-primary">
                            {summaryTimeLeft}s
                        </strong>
                    </div>
                </div>
            ) : (
                /* ================================================= */
                /* ACTIVE GAME */
                /* ================================================= */

                <div
                    className="
                        w-full
                        min-h-0
                        flex
                        flex-col
                        justify-center
                    "
                >
                    {/* HEADER */}
                    <div
                        className="
                            shrink-0
                            flex
                            flex-col
                            items-center
                            mb-[clamp(8px,1.7dvh,16px)]
                        "
                    >
                        <span
                            className="
                                text-[9px]
                                font-bold
                                text-primary
                                uppercase
                                tracking-[0.16em]
                                flex
                                items-center
                                gap-1
                                mb-[clamp(4px,0.7dvh,7px)]
                            "
                        >
                            <Sparkles className="h-3 w-3" />

                            Asocijacije
                            <span className="opacity-60">
                                •
                            </span>
                            Runda {round}
                        </span>

                        <span
                            className={`
                                text-[9px]
                                font-black
                                uppercase
                                px-3
                                py-[5px]
                                rounded-full
                                border
                                shadow-sm
                                transition-colors
                                duration-500
                                ${
                                    phase ===
                                    "celebration"
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                        : phase ===
                                          "transition"
                                        ? "bg-surface-light border-border text-text-secondary"
                                        : activePlayer ===
                                          "blue"
                                        ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                                        : "bg-red-500/10 border-red-500/30 text-red-500"
                                }
                            `}
                        >
                            {phase ===
                            "celebration"
                                ? "Svaka čast! Rešeno!"
                                : phase ===
                                  "transition"
                                ? `Sledeći igrač za ${transitionTimer}s`
                                : isMyTurn
                                ? `Tvoj potez • ${timeLeft}s`
                                : `Protivnik razmišlja • ${timeLeft}s`}
                        </span>

                        {allFieldsOpened &&
                            phase !==
                                "celebration" && (
                                <div className="flex gap-1.5 mt-1">
                                    <span className="text-[8px] leading-none font-black uppercase px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                        Plavi:{" "}
                                        {
                                            remainingAttempts.blue
                                        }
                                    </span>

                                    <span className="text-[8px] leading-none font-black uppercase px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
                                        Crveni:{" "}
                                        {
                                            remainingAttempts.red
                                        }
                                    </span>
                                </div>
                            )}
                    </div>

                    {/* BOARD */}
                    <div
                        className="
                            w-full
                            flex
                            flex-col
                            gap-[clamp(3px,0.65dvh,6px)]
                        "
                    >
                        {/* A + B */}
                        <div className="flex gap-[clamp(5px,1vw,10px)]">
                            <div className="flex-1 min-w-0 flex flex-col gap-[clamp(2px,0.45dvh,5px)]">
                                {[1, 2, 3, 4].map(
                                    n =>
                                        renderField(
                                            "A",
                                            n
                                        )
                                )}

                                <div className="mt-[clamp(1px,0.25dvh,3px)]">
                                    {renderColSolution(
                                        "A"
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col gap-[clamp(2px,0.45dvh,5px)]">
                                {[1, 2, 3, 4].map(
                                    n =>
                                        renderField(
                                            "B",
                                            n
                                        )
                                )}

                                <div className="mt-[clamp(1px,0.25dvh,3px)]">
                                    {renderColSolution(
                                        "B"
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* FINAL */}
                        <button
                            onClick={() =>
                                setModalTarget(
                                    "FINAL"
                                )
                            }
                            disabled={
                                !canGuessFinal
                            }
                            style={{
                                transitionDelay:
                                    phase ===
                                    "celebration"
                                        ? "1100ms"
                                        : "0ms"
                            }}
                            className={`
                                h-[clamp(36px,5.4dvh,48px)]
                                shrink-0
                                w-full
                                flex
                                items-center
                                justify-center
                                rounded-[clamp(9px,1.5dvh,14px)]
                                border
                                text-[clamp(10px,1.45dvh,13px)]
                                leading-none
                                font-black
                                uppercase
                                transition-all
                                duration-700
                                ease-in-out
                                shadow-sm
                                ${
                                    finalSolvedBy
                                        ? finalSolvedBy ===
                                          "blue"
                                            ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.4)]"
                                            : "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_18px_rgba(239,68,68,0.4)]"
                                        : opponentFinalPreview
                                        ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-300"
                                        : canGuessFinal
                                        ? "bg-surface border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                                        : "bg-surface/30 border-border/50 text-text-muted cursor-not-allowed"
                                }
                            `}
                        >
                            <span className="truncate px-2">
                                {finalSolvedBy
                                    ? data
                                          .konacno[0]
                                    : opponentFinalPreview
                                    ? opponentFinalPreview.value
                                    : "KONAČNO REŠENJE"}
                            </span>
                        </button>

                        {/* C + D */}
                        <div className="flex gap-[clamp(5px,1vw,10px)]">
                            <div className="flex-1 min-w-0 flex flex-col gap-[clamp(2px,0.45dvh,5px)]">
                                <div className="mb-[clamp(1px,0.25dvh,3px)]">
                                    {renderColSolution(
                                        "C"
                                    )}
                                </div>

                                {[1, 2, 3, 4].map(
                                    n =>
                                        renderField(
                                            "C",
                                            n
                                        )
                                )}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col gap-[clamp(2px,0.45dvh,5px)]">
                                <div className="mb-[clamp(1px,0.25dvh,3px)]">
                                    {renderColSolution(
                                        "D"
                                    )}
                                </div>

                                {[1, 2, 3, 4].map(
                                    n =>
                                        renderField(
                                            "D",
                                            n
                                        )
                                )}
                            </div>
                        </div>
                    </div>

                    {/* PASS */}
                    {isMyTurn &&
                        phase ===
                            "playing" && (
                            <div
                                className="
                                    shrink-0
                                    w-full
                                    flex
                                    justify-center
                                    mt-[clamp(5px,1dvh,10px)]
                                "
                            >
                                <button
                                    onClick={() => {
                                        const processed =
                                            handlePassTurnLocal();

                                        if (
                                            processed
                                        ) {
                                            sendBroadcast(
                                                {
                                                    type:
                                                        "ASOC_MOVE",
                                                    role:
                                                        myRole,
                                                    round,
                                                    action:
                                                        "PASS"
                                                }
                                            );
                                        }
                                    }}
                                    className="
                                        h-[clamp(30px,4.5dvh,38px)]
                                        flex
                                        items-center
                                        justify-center
                                        gap-1.5
                                        px-5
                                        rounded-full
                                        bg-surface
                                        border
                                        border-border
                                        text-text
                                        text-[10px]
                                        font-bold
                                        hover:bg-surface-light
                                        active:scale-95
                                        transition-all
                                    "
                                >
                                    Dalje

                                    <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                </div>
            )}

            {/* ================================================= */}
            {/* MODAL */}
            {/* ================================================= */}

            {modalTarget &&
                isMyTurn &&
                phase !==
                    "celebration" && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
                        <div
                            className={`
                                w-full
                                max-w-[310px]
                                bg-surface
                                border
                                rounded-2xl
                                p-4
                                shadow-2xl
                                ${
                                    isError
                                        ? "border-red-500"
                                        : "border-border"
                                }
                            `}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold text-text uppercase">
                                    {modalTarget ===
                                    "FINAL"
                                        ? "Konačno rešenje"
                                        : `Rešenje kolone ${modalTarget}`}
                                </h3>

                                <button
                                    onClick={() => {
                                        setModalTarget(
                                            null
                                        );

                                        setInputValue(
                                            ""
                                        );
                                    }}
                                    className="p-1.5 rounded-full bg-surface-light text-text-muted hover:text-text"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form
                                onSubmit={
                                    handleGuessSubmit
                                }
                                className="flex flex-col gap-2.5"
                            >
                                <input
                                    ref={
                                        inputRef
                                    }
                                    value={
                                        inputValue
                                    }
                                    onChange={
                                        e =>
                                            setInputValue(
                                                e
                                                    .target
                                                    .value
                                            )
                                    }
                                    placeholder="Unesi reč..."
                                    className={`
                                        w-full
                                        bg-background
                                        border
                                        rounded-xl
                                        px-3.5
                                        py-2.5
                                        text-sm
                                        font-bold
                                        text-text
                                        focus:outline-none
                                        ${
                                            isError
                                                ? "border-red-500"
                                                : "border-border focus:border-primary"
                                        }
                                    `}
                                />

                                <button
                                    type="submit"
                                    className={`
                                        w-full
                                        flex
                                        items-center
                                        justify-center
                                        gap-2
                                        py-2.5
                                        rounded-xl
                                        font-black
                                        text-sm
                                        ${
                                            isError
                                                ? "bg-red-500 text-white"
                                                : "bg-primary text-black"
                                        }
                                    `}
                                >
                                    {isError
                                        ? "Netačno!"
                                        : "Potvrdi"}

                                    <Check className="h-4 w-4" />
                                </button>
                            </form>
                        </div>
                    </div>
                )}
        </div>
    );
}