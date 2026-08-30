"use client";

import { useState, useEffect, useRef } from "react";
import { HelpCircle, Clock } from "lucide-react";

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
    const [timeLeft, setTimeLeft] = useState(20);
    const [transitionTimer, setTransitionTimer] = useState(3);
    const [summaryTimeLeft, setSummaryTimeLeft] = useState(10);

    const [blueScore, setBlueScore] = useState(0);
    const [redScore, setRedScore] = useState(0);

    const [myAnswer, setMyAnswer] = useState<AnswerData | null>(null);
    const [oppAnswer, setOppAnswer] = useState<AnswerData | null>(null);

    const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
    const [questionPoints, setQuestionPoints] = useState<QuestionPoints>({ blue: 0, red: 0 });

    const questionStartTime = useRef<number>(Date.now());
    const evaluatedQuestionRef = useRef<number | null>(null);
    const nextRoundTriggeredRef = useRef(false);
    const initializedRoundRef = useRef<number | null>(null);

    // ============================================================
    // 👉 NOVO: Hvatamo "snapshot" najnovijeg state-a kako bismo
    // izbegli infinite loop u Broadcast Listeneru
    // ============================================================
    const stateSnapshot = useRef({
        currentQuestionIndex,
        phase,
        timeLeft,
        transitionTimer,
        summaryTimeLeft,
        blueScore,
        redScore,
        myAnswer,
        oppAnswer,
        questionResults,
        questionPoints,
    });

    useEffect(() => {
        stateSnapshot.current = {
            currentQuestionIndex,
            phase,
            timeLeft,
            transitionTimer,
            summaryTimeLeft,
            blueScore,
            redScore,
            myAnswer,
            oppAnswer,
            questionResults,
            questionPoints,
        };
    });

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

        setQuestions(incomingQuestions);
        setCurrentQuestionIndex(0);
        setPhase("answering");
        setTimeLeft(20);
        setTransitionTimer(3);
        setSummaryTimeLeft(10);
        setBlueScore(0);
        setRedScore(0);
        setMyAnswer(null);
        setOppAnswer(null);
        setQuestionResults(Array(incomingQuestions.length).fill("none"));
        setQuestionPoints({ blue: 0, red: 0 });
        questionStartTime.current = Date.now();
        evaluatedQuestionRef.current = null;
        nextRoundTriggeredRef.current = false;
    }, [data, round]);

    // ============================================================
    // 2. BROADCAST LISTENER
    // ============================================================
    useEffect(() => {
        if (!incomingBroadcast || incomingBroadcast.role === myRole) return;

        // Čitamo trenutno stanje direktno iz ref-a, 
        // kako ne bismo izazvali re-render ukoliko se nešto promeni!
        const state = stateSnapshot.current;

        if (incomingBroadcast.type === "KZK_MOVE") {
            if (incomingBroadcast.questionIndex !== state.currentQuestionIndex) return;
            setOppAnswer(incomingBroadcast.answer);
            return;
        }

        if (incomingBroadcast.type === "KZK_NEXT_QUESTION") {
            setCurrentQuestionIndex(incomingBroadcast.questionIndex);
            setMyAnswer(null);
            setOppAnswer(null);
            setPhase("answering");
            setTimeLeft(20);
            setTransitionTimer(3);
            setQuestionPoints({ blue: 0, red: 0 });
            evaluatedQuestionRef.current = null;
            
            questionStartTime.current = typeof incomingBroadcast.questionStartTime === "number" 
                ? incomingBroadcast.questionStartTime 
                : Date.now();
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
            setMyAnswer(incomingBroadcast.myAnswer ?? null);
            setOppAnswer(incomingBroadcast.oppAnswer ?? null);
            setPhase("revealing");
            setTransitionTimer(3);

            evaluatedQuestionRef.current = state.currentQuestionIndex;

            if (myRole !== "blue") {
                onScoreSubmit(incomingBroadcast.redDelta, incomingBroadcast.blueDelta);
            }
            return;
        }

        // SYNC REQUEST
        if (incomingBroadcast.type === "KZK_SYNC_REQUEST") {
            sendBroadcast({
                type: "KZK_SYNC_RESPONSE",
                role: myRole,

                currentQuestionIndex: state.currentQuestionIndex,
                phase: state.phase,
                
                timeLeft: state.timeLeft,
                transitionTimer: state.transitionTimer,
                summaryTimeLeft: state.summaryTimeLeft,

                blueScore: state.blueScore,
                redScore: state.redScore,

                myAnswer: state.myAnswer,
                oppAnswer: state.oppAnswer,

                questionResults: state.questionResults,
                questionPoints: state.questionPoints,
                
                questionStartTime: questionStartTime.current,
            });
            return;
        }

        // SYNC RESPONSE
        if (incomingBroadcast.type === "KZK_SYNC_RESPONSE") {
            setCurrentQuestionIndex(incomingBroadcast.currentQuestionIndex);
            setPhase(incomingBroadcast.phase);
            
            setTimeLeft(incomingBroadcast.timeLeft);
            if (incomingBroadcast.transitionTimer !== undefined) setTransitionTimer(incomingBroadcast.transitionTimer);
            if (incomingBroadcast.summaryTimeLeft !== undefined) setSummaryTimeLeft(incomingBroadcast.summaryTimeLeft);

            setBlueScore(incomingBroadcast.blueScore);
            setRedScore(incomingBroadcast.redScore);
            setQuestionResults(incomingBroadcast.questionResults ?? []);
            setQuestionPoints(incomingBroadcast.questionPoints ?? { blue: 0, red: 0 });

            setMyAnswer(incomingBroadcast.oppAnswer ?? null);
            setOppAnswer(incomingBroadcast.myAnswer ?? null);

            if (typeof incomingBroadcast.questionStartTime === "number") {
                questionStartTime.current = incomingBroadcast.questionStartTime;
            }

            if (incomingBroadcast.phase === "revealing" || incomingBroadcast.phase === "intermission") {
                evaluatedQuestionRef.current = incomingBroadcast.currentQuestionIndex;
            } else {
                evaluatedQuestionRef.current = null;
            }
            
            nextRoundTriggeredRef.current = false;
            return;
        }
        
    // 👉 OVO JE BIO PROBLEM: Ovde ostaje isključivo incomingBroadcast
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [incomingBroadcast, myRole]); 

    // ============================================================
    // 3. REQUEST SYNC
    // ============================================================
    useEffect(() => {
        if (!questions.length) return;
        sendBroadcast({
            type: "KZK_SYNC_REQUEST",
            role: myRole,
        });
    }, [questions.length, round]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 4. TIMER ZA ODGOVARANJE
    // ============================================================
    useEffect(() => {
        if (phase !== "answering") return;

        onTimerTick(timeLeft);

        if (myAnswer !== null && oppAnswer !== null) {
            if (myRole === "blue") evaluateQuestion();
            return;
        }

        if (timeLeft <= 0) {
            if (myRole === "blue") evaluateQuestion();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, phase, myAnswer, oppAnswer, myRole]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const correctIndex = currentQuestion.correctIndex;

        const blueCorrect = blueAnswer !== null && blueAnswer.index === correctIndex;
        const redCorrect = redAnswer !== null && redAnswer.index === correctIndex;

        let blueDelta = 0;
        let redDelta = 0;

        if (blueCorrect && redCorrect) {
            if (blueAnswer!.time < redAnswer!.time) {
                blueDelta = 6; redDelta = 0;
            } else if (redAnswer!.time < blueAnswer!.time) {
                blueDelta = 0; redDelta = 6;
            } else {
                blueDelta = 6; redDelta = 6;
            }
        } else if (blueCorrect) {
            blueDelta = 6;
            if (redAnswer !== null) redDelta = -3;
        } else if (redCorrect) {
            redDelta = 6;
            if (blueAnswer !== null) blueDelta = -3;
        } else {
            if (blueAnswer !== null) blueDelta = -3;
            if (redAnswer !== null) redDelta = -3;
        }

        let questionResult: QuestionResult = "gray";
        if (blueDelta === 6 && redDelta === 6) questionResult = "tie";
        else if (blueDelta > redDelta) questionResult = "blue";
        else if (redDelta > blueDelta) questionResult = "red";

        const newBlueScore = blueScore + blueDelta;
        const newRedScore = redScore + redDelta;

        setQuestionPoints({ blue: blueDelta, red: redDelta });
        setQuestionResults((prev) => {
            const updated = [...prev];
            updated[currentQuestionIndex] = questionResult;
            return updated;
        });

        setBlueScore(newBlueScore);
        setRedScore(newRedScore);
        setPhase("revealing");
        setTransitionTimer(3);

        onScoreSubmit(blueDelta, redDelta);

        sendBroadcast({
            type: "KZK_RESULT",
            role: myRole,
            questionIndex: currentQuestionIndex,
            blueDelta,
            redDelta,
            blueScore: newBlueScore,
            redScore: newRedScore,
            questionResult,
            myAnswer: blueAnswer,
            oppAnswer: redAnswer,
        });
    }

    // ============================================================
    // 6. REVEAL TIMER
    // ============================================================
    useEffect(() => {
        if (phase !== "revealing") return;

        onTimerTick(transitionTimer);

        if (transitionTimer <= 0) {
            const nextIndex = currentQuestionIndex + 1;
            if (nextIndex < questions.length) {
                startNextQuestion(nextIndex);
            } else {
                setPhase("intermission");
                setSummaryTimeLeft(10);
            }
            return;
        }

        const timer = setInterval(() => {
            setTransitionTimer((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [phase, transitionTimer, currentQuestionIndex, questions.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 7. START NEXT QUESTION
    // ============================================================
    function startNextQuestion(index: number) {
        setCurrentQuestionIndex(index);
        setMyAnswer(null);
        setOppAnswer(null);
        setQuestionPoints({ blue: 0, red: 0 });
        setPhase("answering");
        setTimeLeft(20);
        setTransitionTimer(3);
        questionStartTime.current = Date.now();
        evaluatedQuestionRef.current = null;

        sendBroadcast({
            type: "KZK_NEXT_QUESTION",
            role: myRole,
            questionIndex: index,
            questionStartTime: questionStartTime.current,
        });
    }

    // ============================================================
    // 8. INTERMISSION
    // ============================================================
    useEffect(() => {
        if (phase !== "intermission") return;

        onTimerTick(summaryTimeLeft);

        if (summaryTimeLeft <= 0) {
            if (myRole === "blue" && !nextRoundTriggeredRef.current) {
                nextRoundTriggeredRef.current = true;
                onNextRound(2);
            }
            return;
        }

        const timer = setInterval(() => {
            setSummaryTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [phase, summaryTimeLeft, myRole]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 9. HANDLE OPTION CLICK
    // ============================================================
    function handleOptionClick(optionIndex: number) {
        if (phase !== "answering" || myAnswer !== null) return;

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
            questionIndex: currentQuestionIndex,
            answer: answerData,
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
                            let dotStyle = "bg-surface-light border-border";

                            if (result === "blue") dotStyle = "bg-blue-500 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]";
                            if (result === "red") dotStyle = "bg-red-500 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
                            if (result === "tie") dotStyle = "bg-primary border-primary shadow-[0_0_8px_rgba(245,158,11,0.5)]";
                            if (result === "gray") dotStyle = "bg-surface-light border-border opacity-30";

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
                                    disabled={phase !== "answering" || myAnswer !== null}
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