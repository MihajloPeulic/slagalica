"use client";

import { useState, useEffect, useRef } from "react";
import { HelpCircle, Clock, ArrowRight, Loader2 } from "lucide-react";

interface Question {
    id: number;
    question: string;
    options: string[];
    correctIndex: number;
}

interface KoZnaZnaProps {
    myRole: "blue" | "red";
    round: number;
    data: {
        pitanja: Question[];
    };
    sendBroadcast: (payload: any) => void;
    incomingBroadcast?: any;
    onScoreSubmit: (bluePoints: number, redPoints: number) => void;
    onNextRound: (round?: number) => void;
    onTimerTick: (timeLeft: number) => void;
}

interface AnswerData {
    index: number;
    time: number;
    answeredAt: number;
}

type Phase = "answering" | "revealing" | "intermission";
type QuestionResult = "none" | "blue" | "red" | "tie" | "gray";

interface QuestionPoints {
    blue: number;
    red: number;
}

export function KoZnaZna({
    myRole,
    round,
    data,
    sendBroadcast,
    incomingBroadcast,
    onScoreSubmit,
    onNextRound,
    onTimerTick,
}: KoZnaZnaProps) {
    const [questions, setQuestions] = useState<Question[]>([]);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [phase, setPhase] = useState<Phase>("answering");
    const [answerExpiresAt, setAnswerExpiresAt] = useState(() => Date.now() + 10 * 1000);
    const [revealExpiresAt, setRevealExpiresAt] = useState(0);
    const [summaryExpiresAt, setSummaryExpiresAt] = useState(0);

    const [timeLeft, setTimeLeft] = useState(10);
    const [transitionTimer, setTransitionTimer] = useState(3);
    const [summaryTimeLeft, setSummaryTimeLeft] = useState(10);

    const [blueScore, setBlueScore] = useState(0);
    const [redScore, setRedScore] = useState(0);

    const [myAnswer, setMyAnswer] = useState<AnswerData | null>(null);
    const [oppAnswer, setOppAnswer] = useState<AnswerData | null>(null);

    // "Dalje" tokom odgovaranja znači: ne znam / preskačem.
    const [myPassed, setMyPassed] = useState(false);
    const [oppPassed, setOppPassed] = useState(false);

    const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
    const [questionPoints, setQuestionPoints] = useState<QuestionPoints>({ blue: 0, red: 0 });

    const questionStartTime = useRef<number>(Date.now());
    const evaluatedQuestionRef = useRef<number | null>(null);
    const nextRoundTriggeredRef = useRef(false);
    const initializedRoundRef = useRef<number | null>(null);
    const hasReceivedSyncRef = useRef(false);

    // ============================================================
    // SNAPSHOT NAJNOVIJEG STANJA ZA REFRESH SYNC
    // ============================================================
    const stateSnapshot = useRef({
        currentQuestionIndex,
        phase,
        answerExpiresAt,
        revealExpiresAt,
        summaryExpiresAt,
        blueScore,
        redScore,
        myAnswer,
        oppAnswer,
        myPassed,
        oppPassed,
        questionResults,
        questionPoints,
    });

    useEffect(() => {
        stateSnapshot.current = {
            currentQuestionIndex,
            phase,
            answerExpiresAt,
            revealExpiresAt,
            summaryExpiresAt,
            blueScore,
            redScore,
            myAnswer,
            oppAnswer,
            myPassed,
            oppPassed,
            questionResults,
            questionPoints,
        };
    }, [
        currentQuestionIndex,
        phase,
        answerExpiresAt,
        revealExpiresAt,
        summaryExpiresAt,
        blueScore,
        redScore,
        myAnswer,
        oppAnswer,
        myPassed,
        oppPassed,
        questionResults,
        questionPoints,
    ]);

    // ============================================================
    // 1. INIT / RESET RUNDE
    // ============================================================
    useEffect(() => {
        const incomingQuestions = data?.pitanja ?? [];
        if (!incomingQuestions.length) return;

        if (initializedRoundRef.current === round) {
            return; 
        }
        initializedRoundRef.current = round;

        const now = Date.now();

        setQuestions(incomingQuestions);
        setCurrentQuestionIndex(0);
        setPhase("answering");

        setAnswerExpiresAt(now + 10 * 1000);
        setRevealExpiresAt(0);
        setSummaryExpiresAt(0);

        setTimeLeft(10);
        setTransitionTimer(3);
        setSummaryTimeLeft(10);

        setBlueScore(0);
        setRedScore(0);
        setMyAnswer(null);
        setOppAnswer(null);
        setMyPassed(false);
        setOppPassed(false);
        setQuestionResults(Array(10).fill("none"));
        setQuestionPoints({ blue: 0, red: 0 });

        questionStartTime.current = now;
        evaluatedQuestionRef.current = null;
        nextRoundTriggeredRef.current = false;
        hasReceivedSyncRef.current = false;
    }, [data, round]);

    // ============================================================
    // 2. BROADCAST LISTENER
    // ============================================================
    useEffect(() => {
        if (!incomingBroadcast || incomingBroadcast.role === myRole) return;

        if (
            typeof incomingBroadcast.round === "number" &&
            incomingBroadcast.round !== round
        ) {
            return;
        }

        const state = stateSnapshot.current;

        if (incomingBroadcast.type === "KZK_MOVE") {
            if (incomingBroadcast.questionIndex !== state.currentQuestionIndex) return;
            setOppAnswer(incomingBroadcast.answer);
            return;
        }

        if (incomingBroadcast.type === "KZK_PASS") {
            if (incomingBroadcast.questionIndex !== state.currentQuestionIndex) return;

            setOppPassed(true);
            return;
        }

        if (incomingBroadcast.type === "KZK_NEXT_QUESTION") {
            setCurrentQuestionIndex(incomingBroadcast.questionIndex);
            setMyAnswer(null);
            setOppAnswer(null);
            setMyPassed(false);
            setOppPassed(false);
            setPhase("answering");
            setQuestionPoints({ blue: 0, red: 0 });
            evaluatedQuestionRef.current = null;

            const newStart =
                typeof incomingBroadcast.questionStartTime === "number"
                    ? incomingBroadcast.questionStartTime
                    : Date.now();

            const newAnswerExpiresAt =
                typeof incomingBroadcast.answerExpiresAt === "number"
                    ? incomingBroadcast.answerExpiresAt
                    : newStart + 10 * 1000;

            questionStartTime.current = newStart;
            setAnswerExpiresAt(newAnswerExpiresAt);
            setRevealExpiresAt(0);
            setTimeLeft(
                Math.max(0, Math.ceil((newAnswerExpiresAt - Date.now()) / 1000))
            );
            setTransitionTimer(3);
            return;
        }

        if (incomingBroadcast.type === "KZK_RESULT") {
            if (incomingBroadcast.questionIndex !== state.currentQuestionIndex) return;

            setQuestionPoints({
                blue: incomingBroadcast.blueDelta,
                red: incomingBroadcast.redDelta,
            });

            setQuestionResults((prev) => {
                const updated = [...prev];
                updated[state.currentQuestionIndex] = incomingBroadcast.questionResult;
                return updated;
            });

            setBlueScore(incomingBroadcast.blueScore);
            setRedScore(incomingBroadcast.redScore);

            if (myRole === "blue") {
                setMyAnswer(incomingBroadcast.myAnswer ?? null);
                setOppAnswer(incomingBroadcast.oppAnswer ?? null);
                setMyPassed(!!incomingBroadcast.bluePassed);
                setOppPassed(!!incomingBroadcast.redPassed);
            } else {
                setMyAnswer(incomingBroadcast.oppAnswer ?? null);
                setOppAnswer(incomingBroadcast.myAnswer ?? null);
                setMyPassed(!!incomingBroadcast.redPassed);
                setOppPassed(!!incomingBroadcast.bluePassed);
            }

            setPhase("revealing");

            const newRevealExpiresAt =
                typeof incomingBroadcast.revealExpiresAt === "number"
                    ? incomingBroadcast.revealExpiresAt
                    : Date.now() + 3 * 1000;

            setRevealExpiresAt(newRevealExpiresAt);
            setTransitionTimer(
                Math.max(0, Math.ceil((newRevealExpiresAt - Date.now()) / 1000))
            );

            evaluatedQuestionRef.current = state.currentQuestionIndex;

            if (myRole !== "blue") {
                onScoreSubmit(
                    incomingBroadcast.blueDelta,
                    incomingBroadcast.redDelta
                );
            }

            return;
        }

        if (incomingBroadcast.type === "KZK_INTERMISSION") {
            const newSummaryExpiresAt =
                typeof incomingBroadcast.summaryExpiresAt === "number"
                    ? incomingBroadcast.summaryExpiresAt
                    : Date.now() + 10 * 1000;

            setPhase("intermission");
            setSummaryExpiresAt(newSummaryExpiresAt);
            setSummaryTimeLeft(
                Math.max(0, Math.ceil((newSummaryExpiresAt - Date.now()) / 1000))
            );
            return;
        }

        if (incomingBroadcast.type === "KZK_SYNC_REQUEST") {
            sendBroadcast({
                type: "KZK_SYNC_RESPONSE",
                role: myRole,
                round,

                currentQuestionIndex: state.currentQuestionIndex,
                phase: state.phase,

                answerExpiresAt: state.answerExpiresAt,
                revealExpiresAt: state.revealExpiresAt,
                summaryExpiresAt: state.summaryExpiresAt,

                blueScore: state.blueScore,
                redScore: state.redScore,

                myAnswer: state.oppAnswer,
                oppAnswer: state.myAnswer,
                myPassed: state.oppPassed,
                oppPassed: state.myPassed,

                questionResults: state.questionResults,
                questionPoints: state.questionPoints,

                questionStartTime: questionStartTime.current,
            });

            return;
        }

        if (incomingBroadcast.type === "KZK_SYNC_RESPONSE") {
            if (hasReceivedSyncRef.current) return;
            hasReceivedSyncRef.current = true;

            setCurrentQuestionIndex(incomingBroadcast.currentQuestionIndex);
            setPhase(incomingBroadcast.phase);

            if (typeof incomingBroadcast.answerExpiresAt === "number") {
                setAnswerExpiresAt(incomingBroadcast.answerExpiresAt);
                setTimeLeft(
                    Math.max(
                        0,
                        Math.ceil((incomingBroadcast.answerExpiresAt - Date.now()) / 1000)
                    )
                );
            }

            if (typeof incomingBroadcast.revealExpiresAt === "number") {
                setRevealExpiresAt(incomingBroadcast.revealExpiresAt);
                setTransitionTimer(
                    Math.max(
                        0,
                        Math.ceil((incomingBroadcast.revealExpiresAt - Date.now()) / 1000)
                    )
                );
            }

            if (typeof incomingBroadcast.summaryExpiresAt === "number") {
                setSummaryExpiresAt(incomingBroadcast.summaryExpiresAt);
                setSummaryTimeLeft(
                    Math.max(
                        0,
                        Math.ceil((incomingBroadcast.summaryExpiresAt - Date.now()) / 1000)
                    )
                );
            }

            setBlueScore(incomingBroadcast.blueScore);
            setRedScore(incomingBroadcast.redScore);
            const syncedResults: QuestionResult[] = Array(10).fill("none");
            const incomingResults: QuestionResult[] =
                incomingBroadcast.questionResults ?? [];

            incomingResults
                .slice(0, 10)
                .forEach((result, index) => {
                    syncedResults[index] = result;
                });

            setQuestionResults(syncedResults);
            setQuestionPoints(incomingBroadcast.questionPoints ?? { blue: 0, red: 0 });

            setMyAnswer(incomingBroadcast.myAnswer ?? null);
            setOppAnswer(incomingBroadcast.oppAnswer ?? null);
            setMyPassed(!!incomingBroadcast.myPassed);
            setOppPassed(!!incomingBroadcast.oppPassed);

            if (typeof incomingBroadcast.questionStartTime === "number") {
                questionStartTime.current = incomingBroadcast.questionStartTime;
            }

            if (
                incomingBroadcast.phase === "revealing" ||
                incomingBroadcast.phase === "intermission"
            ) {
                evaluatedQuestionRef.current = incomingBroadcast.currentQuestionIndex;
            } else {
                evaluatedQuestionRef.current = null;
            }

            nextRoundTriggeredRef.current = false;
            return;
        }
    }, [incomingBroadcast, myRole, round]);

    // ============================================================
    // 3. REQUEST SYNC
    // ============================================================
    useEffect(() => {
        if (!questions.length) return;

        hasReceivedSyncRef.current = false;

        sendBroadcast({
            type: "KZK_SYNC_REQUEST",
            role: myRole,
            round,
        });
    }, [questions.length, round]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 4. TIMER ZA ODGOVARANJE
    // ============================================================
    useEffect(() => {
        if (phase !== "answering") return;

        const tick = () => {
            const remaining = Math.max(
                0,
                Math.ceil((answerExpiresAt - Date.now()) / 1000)
            );

            setTimeLeft(remaining);
            onTimerTick(remaining);

            const myResolved = myAnswer !== null || myPassed;
            const oppResolved = oppAnswer !== null || oppPassed;

            if (myResolved && oppResolved) {
                if (myRole === "blue") evaluateQuestion();
                return true;
            }

            if (remaining <= 0) {
                if (myRole === "blue") evaluateQuestion();
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
        answerExpiresAt,
        phase,
        myAnswer,
        oppAnswer,
        myPassed,
        oppPassed,
        myRole
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 5. EVALUACIJA
    // ============================================================
    function evaluateQuestion() {
        if (myRole !== "blue") return;

        const currentQuestion = questions[currentQuestionIndex];
        if (!currentQuestion) return;

        if (evaluatedQuestionRef.current === currentQuestionIndex) return;
        evaluatedQuestionRef.current = currentQuestionIndex;

        const blueAnswer = myAnswer;
        const redAnswer = oppAnswer;
        const bluePassed = myPassed;
        const redPassed = oppPassed;
        const correctIndex = currentQuestion.correctIndex;

        const blueCorrect =
            !bluePassed &&
            blueAnswer !== null &&
            blueAnswer.index === correctIndex;

        const redCorrect =
            !redPassed &&
            redAnswer !== null &&
            redAnswer.index === correctIndex;

        let blueDelta = 0;
        let redDelta = 0;

        // OBOJICA SU KLIKNULA DALJE:
        // obojica dobijaju 0 i odmah se otkriva odgovor.
        if (bluePassed && redPassed) {
            blueDelta = 0;
            redDelta = 0;
        }

        // Jedan je preskočio, drugi odgovorio.
        else if (bluePassed) {
            blueDelta = 0;

            if (redAnswer !== null) {
                redDelta = redCorrect ? 6 : -3;
            }
        } else if (redPassed) {
            redDelta = 0;

            if (blueAnswer !== null) {
                blueDelta = blueCorrect ? 6 : -3;
            }
        }

        // OBOJICA TAČNO:
        // brži dobija +6, sporiji 0.
        // Ista milisekunda -> 0 / 0.
        else if (blueCorrect && redCorrect) {
            if (blueAnswer!.answeredAt < redAnswer!.answeredAt) {
                blueDelta = 6;
                redDelta = 0;
            } else if (redAnswer!.answeredAt < blueAnswer!.answeredAt) {
                blueDelta = 0;
                redDelta = 6;
            } else {
                blueDelta = 0;
                redDelta = 0;
            }
        }

        // Samo plavi tačan.
        else if (blueCorrect) {
            blueDelta = 6;

            if (redAnswer !== null) {
                redDelta = -3;
            }
        }

        // Samo crveni tačan.
        else if (redCorrect) {
            redDelta = 6;

            if (blueAnswer !== null) {
                blueDelta = -3;
            }
        }

        // Niko nije tačan.
        else {
            if (blueAnswer !== null) {
                blueDelta = -3;
            }

            if (redAnswer !== null) {
                redDelta = -3;
            }

            // Ako neko nije odgovorio do timeouta,
            // to nije isto što i netačan klik -> 0.
        }

        const newBlueScore =
            blueScore + blueDelta;

        const newRedScore =
            redScore + redDelta;

        let questionResult: QuestionResult = "gray";

        if (
            blueDelta > redDelta &&
            blueDelta > 0
        ) {
            questionResult = "blue";
        } else if (
            redDelta > blueDelta &&
            redDelta > 0
        ) {
            questionResult = "red";
        } else if (
            blueCorrect &&
            redCorrect &&
            blueAnswer?.answeredAt === redAnswer?.answeredAt
        ) {
            questionResult = "tie";
        }

        setQuestionPoints({
            blue: blueDelta,
            red: redDelta,
        });

        setQuestionResults((prev) => {
            const updated = [...prev];
            updated[currentQuestionIndex] = questionResult;
            return updated;
        });

        const newRevealExpiresAt =
            Date.now() + 3 * 1000;

        setBlueScore(newBlueScore);
        setRedScore(newRedScore);
        setPhase("revealing");
        setRevealExpiresAt(newRevealExpiresAt);
        setTransitionTimer(3);

        onScoreSubmit(
            blueDelta,
            redDelta
        );

        sendBroadcast({
            type: "KZK_RESULT",
            role: myRole,
            round,
            questionIndex: currentQuestionIndex,
            blueDelta,
            redDelta,
            blueScore: newBlueScore,
            redScore: newRedScore,
            questionResult,
            myAnswer: blueAnswer,
            oppAnswer: redAnswer,
            bluePassed,
            redPassed,
            revealExpiresAt: newRevealExpiresAt,
        });
    }

    function handleContinueQuestion() {
        if (phase !== "revealing") return;
        if (myRole !== "blue") return;

        const nextIndex = currentQuestionIndex + 1;

        if (nextIndex < questions.length) {
            startNextQuestion(nextIndex);
            return;
        }

        const newSummaryExpiresAt =
            Date.now() + 10 * 1000;

        setPhase("intermission");
        setSummaryExpiresAt(
            newSummaryExpiresAt
        );
        setSummaryTimeLeft(10);

        sendBroadcast({
            type: "KZK_INTERMISSION",
            role: myRole,
            round,
            summaryExpiresAt:
                newSummaryExpiresAt,
        });
    }

    // ============================================================
    // 6. REVEAL TIMER
    // ============================================================
    useEffect(() => {
        if (phase !== "revealing") return;

        const tick = () => {
            const remaining = Math.max(
                0,
                Math.ceil((revealExpiresAt - Date.now()) / 1000)
            );

            setTransitionTimer(remaining);
            onTimerTick(remaining);

            if (remaining <= 0) {
                if (myRole === "blue") {
                    handleContinueQuestion();
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
    }, [
        phase,
        revealExpiresAt,
        currentQuestionIndex,
        questions.length,
        myRole
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 7. START NEXT QUESTION
    // ============================================================
    function startNextQuestion(index: number) {
        const newQuestionStartTime = Date.now();
        const newAnswerExpiresAt = newQuestionStartTime + 10 * 1000;

        setCurrentQuestionIndex(index);
        setMyAnswer(null);
        setOppAnswer(null);
        setMyPassed(false);
        setOppPassed(false);
        setQuestionPoints({ blue: 0, red: 0 });
        setPhase("answering");

        setAnswerExpiresAt(newAnswerExpiresAt);
        setRevealExpiresAt(0);

        setTimeLeft(10);
        setTransitionTimer(3);

        questionStartTime.current = newQuestionStartTime;
        evaluatedQuestionRef.current = null;

        sendBroadcast({
            type: "KZK_NEXT_QUESTION",
            role: myRole,
            round,
            questionIndex: index,
            questionStartTime: newQuestionStartTime,
            answerExpiresAt: newAnswerExpiresAt,
        });
    }

    // ============================================================
    // 8. INTERMISSION
    // ============================================================
    useEffect(() => {
        if (phase !== "intermission") return;
        if (summaryExpiresAt <= 0) return;

        const tick = () => {
            const remaining = Math.max(
                0,
                Math.ceil((summaryExpiresAt - Date.now()) / 1000)
            );

            setSummaryTimeLeft(remaining);
            onTimerTick(remaining);

            if (remaining <= 0) {
                if (myRole === "blue" && !nextRoundTriggeredRef.current) {
                    nextRoundTriggeredRef.current = true;
                    onNextRound(2);
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
    }, [phase, summaryExpiresAt, myRole]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 9. HANDLE OPTION CLICK
    // ============================================================
    function handleOptionClick(optionIndex: number) {
        if (
            phase !== "answering" ||
            myAnswer !== null ||
            myPassed
        ) return;

        const elapsed = Date.now() - questionStartTime.current;
        const answerData: AnswerData = {
            index: optionIndex,
            time: elapsed,
            answeredAt: Date.now(),
        };

        setMyAnswer(answerData);

        sendBroadcast({
            type: "KZK_MOVE",
            role: myRole,
            round,
            questionIndex: currentQuestionIndex,
            answer: answerData,
        });
    }

    function handlePass() {
        if (phase !== "answering") return;
        if (myAnswer !== null || myPassed) return;

        setMyPassed(true);

        sendBroadcast({
            type: "KZK_PASS",
            role: myRole,
            round,
            questionIndex: currentQuestionIndex,
        });
    }

    // ============================================================
// 10. LOADING
// ============================================================

if (!questions.length) {
    return (
        <div className="card-base flex min-h-48 w-full max-w-sm flex-col items-center justify-center gap-3 p-6 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />

            <p className="secondary-text">
                Učitavanje pitanja...
            </p>
        </div>
    );
}

const currentQuestion =
    questions[currentQuestionIndex];

if (!currentQuestion) return null;

// ============================================================
// 11. UI
// ============================================================

const nobodyAnsweredCorrectly =
    phase === "revealing" &&
    myAnswer?.index !==
        currentQuestion.correctIndex &&
    oppAnswer?.index !==
        currentQuestion.correctIndex;

return (
    <div className="flex w-full max-w-sm flex-col items-center justify-center">
        {phase !== "intermission" ? (
            <div className="flex w-full flex-col items-center gap-4">

                {/* =========================================
                    QUESTION PROGRESS
                    ========================================= */}

                <div className="flex items-center justify-center gap-1.5">
                    {questionResults.map(
                        (result, index) => {
                            let dotStyle =
                                "border-border bg-surface-light";

                            if (
                                result === "blue"
                            ) {
                                dotStyle =
                                    "border-blue-500 bg-blue-500";
                            }

                            if (
                                result === "red"
                            ) {
                                dotStyle =
                                    "border-red-500 bg-red-500";
                            }

                            if (
                                result === "tie"
                            ) {
                                dotStyle =
                                    "border-primary bg-primary";
                            }

                            if (
                                result === "gray"
                            ) {
                                dotStyle =
                                    "border-text-muted bg-text-muted";
                            }

                            const isCurrent =
                                index ===
                                    currentQuestionIndex &&
                                phase ===
                                    "answering";

                            return (
                                <div
                                    key={
                                        index
                                    }
                                    className={`
                                        h-2
                                        w-2
                                        shrink-0
                                        rounded-full
                                        border
                                        transition
                                        ${dotStyle}
                                        ${
                                            isCurrent
                                                ? "scale-125 ring-2 ring-primary/30"
                                                : ""
                                        }
                                    `}
                                />
                            );
                        },
                    )}
                </div>

                {/* =========================================
                    QUESTION
                    ========================================= */}

                <div className="card-base flex min-h-28 w-full items-center justify-center p-5 text-center">
                    <p className="text-base font-black leading-relaxed text-text">
                        {
                            currentQuestion.question
                        }
                    </p>
                </div>

                {/* =========================================
                    REVEAL SCORE
                    ========================================= */}

                {phase === "revealing" && (
                    <div className="grid w-full grid-cols-2 gap-2">
                        <div className="flex h-11 items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/5 px-3">
                            <span className="text-xs font-black text-blue-400">
                                Plavi
                            </span>

                            <span
                                className={`
                                    text-sm
                                    font-black
                                    tabular-nums
                                    ${
                                        questionPoints.blue >
                                        0
                                            ? "text-emerald-400"
                                            : questionPoints.blue <
                                                0
                                              ? "text-red-400"
                                              : "text-text-secondary"
                                    }
                                `}
                            >
                                {questionPoints.blue >
                                0
                                    ? "+"
                                    : ""}
                                {
                                    questionPoints.blue
                                }
                            </span>
                        </div>

                        <div className="flex h-11 items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-3">
                            <span className="text-xs font-black text-red-400">
                                Crveni
                            </span>

                            <span
                                className={`
                                    text-sm
                                    font-black
                                    tabular-nums
                                    ${
                                        questionPoints.red >
                                        0
                                            ? "text-emerald-400"
                                            : questionPoints.red <
                                                0
                                              ? "text-red-400"
                                              : "text-text-secondary"
                                    }
                                `}
                            >
                                {questionPoints.red >
                                0
                                    ? "+"
                                    : ""}
                                {
                                    questionPoints.red
                                }
                            </span>
                        </div>
                    </div>
                )}

                {/* =========================================
                    PASSED INFO
                    ========================================= */}

                {phase === "revealing" &&
                    (myPassed ||
                        oppPassed) && (
                        <div className="flex w-full flex-wrap items-center justify-center gap-2">
                            {myPassed && (
                                <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[10px] font-black text-text-secondary">
                                    Ti: Dalje
                                </span>
                            )}

                            {oppPassed && (
                                <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[10px] font-black text-text-secondary">
                                    Protivnik:
                                    Dalje
                                </span>
                            )}
                        </div>
                    )}

                {/* =========================================
                    OPTIONS
                    ========================================= */}

                <div className="flex w-full flex-col gap-2">
                    {currentQuestion.options.map(
                        (option, index) => {
                            const isCorrect =
                                index ===
                                currentQuestion.correctIndex;

                            const didISelect =
                                myAnswer?.index ===
                                index;

                            const didOppSelect =
                                oppAnswer?.index ===
                                index;

                            let buttonStyle =
                                "border-border bg-surface text-text";

                            if (
                                phase ===
                                "revealing"
                            ) {
                                if (
                                    isCorrect
                                ) {
                                    buttonStyle =
                                        nobodyAnsweredCorrectly
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
                                } else if (
                                    didISelect ||
                                    didOppSelect
                                ) {
                                    buttonStyle =
                                        "border-red-500/40 bg-red-500/10 text-red-400";
                                } else {
                                    buttonStyle =
                                        "border-border bg-surface text-text-muted opacity-50";
                                }
                            }

                            if (
                                phase ===
                                "answering"
                            ) {
                                if (
                                    didISelect
                                ) {
                                    buttonStyle =
                                        "border-primary bg-primary/10 text-primary";
                                } else {
                                    buttonStyle =
                                        "border-border bg-surface text-text hover:bg-surface-light";
                                }
                            }

                            return (
                                <button
                                    key={
                                        index
                                    }
                                    type="button"
                                    onClick={() =>
                                        handleOptionClick(
                                            index,
                                        )
                                    }
                                    disabled={
                                        phase !==
                                            "answering" ||
                                        myAnswer !==
                                            null ||
                                        myPassed
                                    }
                                    className={`
                                        w-full
                                        rounded-xl
                                        border
                                        p-3
                                        text-left
                                        transition-colors
                                        active:scale-[0.99]
                                        disabled:cursor-default
                                        ${buttonStyle}
                                    `}
                                >
                                    <div className="flex w-full items-center gap-3">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current/20 text-xs font-black">
                                            {String.fromCharCode(
                                                65 +
                                                    index,
                                            )}
                                        </span>

                                        <span className="min-w-0 flex-1 text-sm font-bold leading-snug">
                                            {
                                                option
                                            }
                                        </span>
                                    </div>

                                    {phase ===
                                        "revealing" &&
                                        (didISelect ||
                                            didOppSelect) && (
                                            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-10">
                                                {didISelect && (
                                                    <span
                                                        className={`
                                                            rounded-md
                                                            border
                                                            px-2
                                                            py-1
                                                            text-[10px]
                                                            font-black
                                                            ${
                                                                myRole ===
                                                                "blue"
                                                                    ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                                                    : "border-red-500/30 bg-red-500/10 text-red-400"
                                                            }
                                                        `}
                                                    >
                                                        Ti{" "}
                                                        {(
                                                            myAnswer!
                                                                .time /
                                                            1000
                                                        ).toFixed(
                                                            2,
                                                        )}
                                                        s
                                                    </span>
                                                )}

                                                {didOppSelect && (
                                                    <span
                                                        className={`
                                                            rounded-md
                                                            border
                                                            px-2
                                                            py-1
                                                            text-[10px]
                                                            font-black
                                                            ${
                                                                myRole ===
                                                                "blue"
                                                                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                                                                    : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                                            }
                                                        `}
                                                    >
                                                        Protivnik{" "}
                                                        {(
                                                            oppAnswer!
                                                                .time /
                                                            1000
                                                        ).toFixed(
                                                            2,
                                                        )}
                                                        s
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                </button>
                            );
                        },
                    )}
                </div>

                {/* =========================================
                    PASS
                    ========================================= */}

                {phase === "answering" && (
                    <button
                        type="button"
                        onClick={handlePass}
                        disabled={
                            myAnswer !== null ||
                            myPassed
                        }
                        className="
                            mt-1
                            inline-flex
                            h-10
                            items-center
                            justify-center
                            gap-2
                            rounded-xl
                            border
                            border-border
                            bg-surface
                            px-4
                            text-sm
                            font-black
                            text-text-secondary
                            transition-colors
                            hover:bg-surface-light
                            hover:text-text
                            active:scale-[0.98]
                            disabled:cursor-not-allowed
                            disabled:opacity-40
                        "
                    >
                        <span>
                            {myPassed
                                ? "Čekamo..."
                                : "Dalje"}
                        </span>

                        <ArrowRight className="h-4 w-4" />
                    </button>
                )}

            </div>
        ) : (
            /* =========================================
               INTERMISSION
               ========================================= */

            <div className="card-base card-padding flex w-full flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <HelpCircle className="h-5 w-5" />
                </div>

                <p className="eyebrow mt-4">
                    Runda {round} / 2
                </p>

                <h2 className="section-title mt-1">
                    Ko zna zna završeno
                </h2>

                <div className="mt-5 grid w-full grid-cols-2 gap-2">
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                        <p className="secondary-text text-blue-400">
                            Plavi
                        </p>

                        <p className="mt-1 text-xl font-black tabular-nums text-blue-400">
                            {blueScore >
                            0
                                ? "+"
                                : ""}
                            {blueScore}
                        </p>
                    </div>

                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                        <p className="secondary-text text-red-400">
                            Crveni
                        </p>

                        <p className="mt-1 text-xl font-black tabular-nums text-red-400">
                            {redScore > 0
                                ? "+"
                                : ""}
                            {redScore}
                        </p>
                    </div>
                </div>

                <div className="mt-5 flex items-center gap-2 rounded-xl bg-background px-3 py-2">
                    <Clock className="h-4 w-4 text-primary" />

                    <span className="secondary-text">
                        {round === 1
                            ? "Sledeća runda za"
                            : "Sledeća igra za"}
                    </span>

                    <span className="text-sm font-black tabular-nums text-primary">
                        {
                            summaryTimeLeft
                        }
                        s
                    </span>
                </div>
            </div>
        )}
    </div>
);

}