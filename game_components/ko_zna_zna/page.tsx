"use client";

import { useState, useEffect, useRef } from "react";
import { HelpCircle, Clock, ArrowRight } from "lucide-react";

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
            <div className="flex flex-col items-center justify-center py-12 px-5 text-center bg-surface border border-border rounded-3xl w-full max-w-[340px] shadow-lg gap-3">
                <Clock className="h-8 w-8 text-primary animate-spin" />
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Učitavanje pitanja...
                </p>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return null;

    // ============================================================
    // 11. UI
    // ============================================================
    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[340px] gap-5 animate-in fade-in zoom-in-95">
            {phase !== "intermission" ? (
                <>
                    {/* QUESTION DOTS */}
                    <div className="flex items-center gap-1.5 p-2 rounded-2xl bg-surface/60 border border-border overflow-x-auto max-w-[320px]">
                        {questionResults.map((result, index) => {
                            let dotStyle =
                                "bg-surface-light border-border/70 opacity-80";

                            if (result === "blue") {
                                dotStyle =
                                    "bg-blue-500 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] opacity-100";
                            }

                            if (result === "red") {
                                dotStyle =
                                    "bg-red-500 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] opacity-100";
                            }

                            if (result === "tie") {
                                dotStyle =
                                    "bg-primary border-primary shadow-[0_0_8px_rgba(245,158,11,0.5)] opacity-100";
                            }

                            if (result === "gray") {
                                dotStyle =
                                    "bg-zinc-600/70 border-zinc-500/60 opacity-100";
                            }

                            const isCurrent = index === currentQuestionIndex && phase === "answering";

                            return (
                                <div
                                    key={index}
                                    className={`h-2.5 w-2.5 rounded-full border transition-all shrink-0 ${dotStyle} ${
                                        isCurrent ? "ring-2 ring-primary/50 scale-125 animate-pulse" : ""
                                    }`}
                                />
                            );
                        })}
                    </div>

                    {/* QUESTION */}
                    <div className="w-full max-w-[320px] text-center p-5 bg-surface/90 backdrop-blur-md border border-border rounded-3xl shadow-md min-h-[110px] flex items-center justify-center">
                        <span className="text-base font-bold text-text leading-snug">
                            {currentQuestion.question}
                        </span>
                    </div>

                    {/* REVEAL POINTS */}
                    {phase === "revealing" && (
                        <div className="grid grid-cols-2 gap-2 w-full max-w-[320px]">
                            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30">
                                <span className="text-[10px] font-black uppercase text-blue-400">Plavi</span>
                                <span className={`text-sm font-black ${
                                    questionPoints.blue > 0 ? "text-emerald-400" : questionPoints.blue < 0 ? "text-red-400" : "text-text-secondary"
                                }`}>
                                    {questionPoints.blue > 0 ? "+" : ""}{questionPoints.blue}
                                </span>
                            </div>

                            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30">
                                <span className="text-[10px] font-black uppercase text-red-400">Crveni</span>
                                <span className={`text-sm font-black ${
                                    questionPoints.red > 0 ? "text-emerald-400" : questionPoints.red < 0 ? "text-red-400" : "text-text-secondary"
                                }`}>
                                    {questionPoints.red > 0 ? "+" : ""}{questionPoints.red}
                                </span>
                            </div>
                        </div>
                    )}

                    {phase === "revealing" && (myPassed || oppPassed) && (
                        <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-[320px] text-[10px] font-black uppercase tracking-wider">
                            {myPassed && (
                                <span className="px-2.5 py-1 rounded-lg border border-border bg-surface-light text-text-secondary">
                                    Ti: Dalje
                                </span>
                            )}

                            {oppPassed && (
                                <span className="px-2.5 py-1 rounded-lg border border-border bg-surface-light text-text-secondary">
                                    Protivnik: Dalje
                                </span>
                            )}
                        </div>
                    )}

                    {phase === "revealing" && (
                        <button
                            onClick={handleContinueQuestion}
                            disabled={myRole !== "blue"}
                            className="w-full max-w-[320px] py-3 rounded-2xl bg-primary text-black font-black text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {myRole === "blue"
                                ? "Sledeće pitanje"
                                : "Čekamo sledeće pitanje..."}
                        </button>
                    )}

                    {/* OPTIONS */}
                    <div className="flex flex-col gap-2.5 w-full max-w-[320px]">
                        {currentQuestion.options.map((option, index) => {
                            const isCorrect = index === currentQuestion.correctIndex;
                            const didISelect = myAnswer?.index === index;
                            const didOppSelect = oppAnswer?.index === index;

                            let buttonStyle = "bg-surface border-border text-text";

                            if (phase === "revealing") {
                                if (isCorrect) {
                                    buttonStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-400";
                                } else if (didISelect || didOppSelect) {
                                    buttonStyle = "bg-red-500/20 border-red-500 text-red-400";
                                } else {
                                    buttonStyle = "bg-surface/30 border-border/40 opacity-40";
                                }
                            }

                            if (phase === "answering") {
                                if (didISelect) {
                                    buttonStyle = "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(245,158,11,0.2)]";
                                } else {
                                    buttonStyle = "hover:bg-surface-light cursor-pointer";
                                }
                            }

                            return (
                                <button
                                    key={index}
                                    onClick={() => handleOptionClick(index)}
                                    disabled={
                                        phase !== "answering" ||
                                        myAnswer !== null ||
                                        myPassed
                                    }
                                    className={`w-full relative flex flex-col p-3 rounded-2xl border text-sm font-bold transition-all shadow-sm ${buttonStyle}`}
                                >
                                    <div className="flex items-center justify-between w-full gap-3">
                                        <span className="text-left">{option}</span>
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border/60 text-xs font-black bg-background/50">
                                            {String.fromCharCode(65 + index)}
                                        </span>
                                    </div>

                                    {phase === "revealing" && (didISelect || didOppSelect) && (
                                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[9px] uppercase tracking-wider font-black">
                                            {didISelect && (
                                                <span className={`px-2 py-1 rounded-md border ${
                                                    myRole === "blue" ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-red-500/20 border-red-500/50 text-red-400"
                                                }`}>
                                                    Ti ({(myAnswer!.time / 1000).toFixed(2)}s)
                                                </span>
                                            )}
                                            {didOppSelect && (
                                                <span className={`px-2 py-1 rounded-md border ${
                                                    myRole === "blue" ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-blue-500/20 border-blue-500/50 text-blue-400"
                                                }`}>
                                                    Protivnik ({(oppAnswer!.time / 1000).toFixed(2)}s)
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {phase === "answering" && (
                        <div className="flex justify-center w-full max-w-[320px]">
                            <button
                                onClick={handlePass}
                                disabled={myAnswer !== null || myPassed}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-primary/40 bg-primary/10 text-primary font-black text-sm transition-all hover:bg-primary/15 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span>
                                    {myPassed
                                        ? "Čekamo..."
                                        : "Dalje"}
                                </span>
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </>
            ) : (
                /* INTERMISSION */
                <div className="flex flex-col items-center justify-center py-6 px-5 text-center bg-surface border border-border rounded-3xl w-full max-w-[340px] shadow-2xl gap-4">
                    <HelpCircle className="h-10 w-10 text-primary animate-pulse mb-1" />
                    <h2 className="text-lg font-black text-text">
                        Završena runda Ko zna zna!
                    </h2>
                    <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                        Runda {round} / 2
                    </div>

                    <div className="flex flex-col gap-2.5 w-full mt-2">
                        <div className="flex justify-between items-center p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                            <span className="text-xs font-bold text-blue-400 uppercase">Plavi Igrač</span>
                            <span className="text-lg font-black text-blue-400">
                                {blueScore > 0 ? "+" : ""}{blueScore}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                            <span className="text-xs font-bold text-red-400 uppercase">Crveni Igrač</span>
                            <span className="text-lg font-black text-red-400">
                                {redScore > 0 ? "+" : ""}{redScore}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-text-secondary bg-surface-light px-4 py-2 rounded-xl mt-3">
                        <Clock className="h-4 w-4 animate-spin text-primary" />
                        <span>
                            {round === 1 ? "Sledeća runda za: " : "Sledeća igra za: "}
                            <strong className="text-primary font-black text-sm">
                                {summaryTimeLeft}s
                            </strong>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}