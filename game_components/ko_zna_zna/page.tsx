"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { RoundIntermission } from "@/game_components/RoundIntermission";

interface Question {
    id: number;
    question: string;
    options: string[];
    correctIndex: number;
}

interface KoZnaZnaProps {
    myRole: "blue" | "red";
    syncEpoch?: number;
    preferPeerSync?: boolean;
    isPaused?: boolean;
    pauseVersion?: number;
    resumeShiftMs?: number;
    onPeerSyncComplete?: () => void;
    round: number;
    data: {
        pitanja: Question[];
    };
    initialState?: any;
    onPersistState?: (
        event: "state_sync" | "question_result" | "question_start" | "game_result",
        state: Record<string, unknown>
    ) => void;
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
    syncEpoch = 0,
    preferPeerSync = false,
    isPaused = false,
    pauseVersion = 0,
    resumeShiftMs = 0,
    onPeerSyncComplete,
    round,
    data,
    initialState,
    onPersistState,
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
    const syncRequestIdRef = useRef<string | null>(null);
    const syncRetryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const isSyncReadyRef = useRef(false);
    const hasPersistedGameRef = useRef(false);
    const lastAppliedPauseVersionRef = useRef(pauseVersion);

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
    // 1. INIT / REDIS RESTORE
    // ============================================================
    useEffect(() => {
        const incomingQuestions = data?.pitanja ?? [];
        if (!incomingQuestions.length) return;

        if (initializedRoundRef.current === round) {
            return;
        }

        initializedRoundRef.current = round;
        hasReceivedSyncRef.current = false;
        syncRequestIdRef.current = null;
        isSyncReadyRef.current = false;
        hasPersistedGameRef.current = false;

        setQuestions(incomingQuestions);

        /*
            BLUE vraća canonical snapshot iz Redisa.
            RED ga dobija preko KZK_SYNC_RESPONSE.
        */
        if (myRole === "blue" && !preferPeerSync && initialState && initialState.completed !== true) {
            const restoredIndex =
                typeof initialState.currentQuestionIndex === "number" ? initialState.currentQuestionIndex : 0;

            const restoredPhase: Phase =
                initialState.phase === "revealing" || initialState.phase === "intermission"
                    ? initialState.phase
                    : "answering";

            const restoredAnswerExpiresAt =
                typeof initialState.answerExpiresAt === "number"
                    ? initialState.answerExpiresAt
                    : Date.now() + 10 * 1000;

            const restoredRevealExpiresAt =
                typeof initialState.revealExpiresAt === "number" ? initialState.revealExpiresAt : 0;

            const restoredSummaryExpiresAt =
                typeof initialState.summaryExpiresAt === "number" ? initialState.summaryExpiresAt : 0;

            setCurrentQuestionIndex(restoredIndex);
            setPhase(restoredPhase);
            setAnswerExpiresAt(restoredAnswerExpiresAt);
            setRevealExpiresAt(restoredRevealExpiresAt);
            setSummaryExpiresAt(restoredSummaryExpiresAt);

            setTimeLeft(Math.max(0, Math.ceil((restoredAnswerExpiresAt - Date.now()) / 1000)));

            setTransitionTimer(
                restoredRevealExpiresAt > 0 ? Math.max(0, Math.ceil((restoredRevealExpiresAt - Date.now()) / 1000)) : 3
            );

            setSummaryTimeLeft(
                restoredSummaryExpiresAt > 0
                    ? Math.max(0, Math.ceil((restoredSummaryExpiresAt - Date.now()) / 1000))
                    : 10
            );

            setBlueScore(typeof initialState.blueScore === "number" ? initialState.blueScore : 0);

            setRedScore(typeof initialState.redScore === "number" ? initialState.redScore : 0);

            setMyAnswer(initialState.myAnswer ?? null);
            setOppAnswer(initialState.oppAnswer ?? null);
            setMyPassed(!!initialState.myPassed);
            setOppPassed(!!initialState.oppPassed);

            const restoredResults: QuestionResult[] = Array(10).fill("none");

            const incomingResults: QuestionResult[] = Array.isArray(initialState.questionResults)
                ? initialState.questionResults
                : [];

            incomingResults.slice(0, 10).forEach((result, index) => {
                restoredResults[index] = result;
            });

            setQuestionResults(restoredResults);

            setQuestionPoints(
                initialState.questionPoints && typeof initialState.questionPoints === "object"
                    ? initialState.questionPoints
                    : { blue: 0, red: 0 }
            );

            questionStartTime.current =
                typeof initialState.questionStartTime === "number"
                    ? initialState.questionStartTime
                    : restoredAnswerExpiresAt - 10 * 1000;

            evaluatedQuestionRef.current = restoredPhase === "revealing" ? restoredIndex : null;

            nextRoundTriggeredRef.current = false;

            /*
                React setState se primjenjuje tek na narednom renderu.
                Zato canonical snapshot upisujemo odmah u ref prije nego
                što BLUE smije odgovoriti na RED sync request.
            */
            stateSnapshot.current = {
                currentQuestionIndex: restoredIndex,
                phase: restoredPhase,
                answerExpiresAt: restoredAnswerExpiresAt,
                revealExpiresAt: restoredRevealExpiresAt,
                summaryExpiresAt: restoredSummaryExpiresAt,
                blueScore: typeof initialState.blueScore === "number" ? initialState.blueScore : 0,
                redScore: typeof initialState.redScore === "number" ? initialState.redScore : 0,
                myAnswer: initialState.myAnswer ?? null,
                oppAnswer: initialState.oppAnswer ?? null,
                myPassed: !!initialState.myPassed,
                oppPassed: !!initialState.oppPassed,
                questionResults: restoredResults,
                questionPoints:
                    initialState.questionPoints && typeof initialState.questionPoints === "object"
                        ? initialState.questionPoints
                        : { blue: 0, red: 0 },
            };

            isSyncReadyRef.current = true;

            return;
        }

        if (myRole === "red" || (myRole === "blue" && preferPeerSync)) {
            return;
        }

        const now = Date.now();
        const initialAnswerExpiresAt = now + 10 * 1000;

        setCurrentQuestionIndex(0);
        setPhase("answering");

        setAnswerExpiresAt(initialAnswerExpiresAt);
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

        /*
            Prvi question timer mora biti persistentan prije
            nego što je prvo pitanje završeno.
        */
        if (myRole === "blue") {
            const freshResults: QuestionResult[] = Array(10).fill("none");

            /*
                Fresh BLUE je odmah canonical.
                Ref punimo sinhrono da rani RED request ne dobije
                stanje iz prethodnog rendera.
            */
            stateSnapshot.current = {
                currentQuestionIndex: 0,
                phase: "answering",
                answerExpiresAt: initialAnswerExpiresAt,
                revealExpiresAt: 0,
                summaryExpiresAt: 0,
                blueScore: 0,
                redScore: 0,
                myAnswer: null,
                oppAnswer: null,
                myPassed: false,
                oppPassed: false,
                questionResults: freshResults,
                questionPoints: { blue: 0, red: 0 },
            };

            isSyncReadyRef.current = true;

            onPersistState?.("state_sync", {
                completed: false,
                currentQuestionIndex: 0,
                phase: "answering",
                answerExpiresAt: initialAnswerExpiresAt,
                revealExpiresAt: 0,
                summaryExpiresAt: 0,
                blueScore: 0,
                redScore: 0,
                myAnswer: null,
                oppAnswer: null,
                myPassed: false,
                oppPassed: false,
                questionResults: freshResults,
                questionPoints: { blue: 0, red: 0 },
                questionStartTime: now,
            });
        }
    }, [data, round, myRole, initialState]);

    // ============================================================
    // 2. BROADCAST LISTENER
    // ============================================================
    useEffect(() => {
        if (!incomingBroadcast || incomingBroadcast.role === myRole) return;

        if (typeof incomingBroadcast.round === "number" && incomingBroadcast.round !== round) {
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
            setTimeLeft(Math.max(0, Math.ceil((newAnswerExpiresAt - Date.now()) / 1000)));
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
            setTransitionTimer(Math.max(0, Math.ceil((newRevealExpiresAt - Date.now()) / 1000)));

            evaluatedQuestionRef.current = state.currentQuestionIndex;

            if (myRole !== "blue") {
                onScoreSubmit(incomingBroadcast.blueDelta, incomingBroadcast.redDelta);
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
            setSummaryTimeLeft(Math.max(0, Math.ceil((newSummaryExpiresAt - Date.now()) / 1000)));
            return;
        }

        if (incomingBroadcast.type === "KZK_SYNC_REQUEST") {
            if (incomingBroadcast.role === myRole || !isSyncReadyRef.current) return;

            sendBroadcast({
                type: "KZK_SYNC_RESPONSE",
                role: myRole,
                round,
                requestId: incomingBroadcast.requestId,

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
            if (
                typeof incomingBroadcast.requestId !== "string" ||
                incomingBroadcast.requestId !== syncRequestIdRef.current
            ) {
                return;
            }

            const shouldAcceptPeerSync = myRole === "red" || (myRole === "blue" && preferPeerSync);

            if (!shouldAcceptPeerSync || incomingBroadcast.role === myRole) return;

            if (hasReceivedSyncRef.current) return;
            hasReceivedSyncRef.current = true;
            syncRequestIdRef.current = null;
            clearSyncRetryTimers();
            isSyncReadyRef.current = true;

            onPeerSyncComplete?.();

            setCurrentQuestionIndex(incomingBroadcast.currentQuestionIndex);
            setPhase(incomingBroadcast.phase);

            if (typeof incomingBroadcast.answerExpiresAt === "number") {
                setAnswerExpiresAt(incomingBroadcast.answerExpiresAt);
                setTimeLeft(Math.max(0, Math.ceil((incomingBroadcast.answerExpiresAt - Date.now()) / 1000)));
            }

            if (typeof incomingBroadcast.revealExpiresAt === "number") {
                setRevealExpiresAt(incomingBroadcast.revealExpiresAt);
                setTransitionTimer(Math.max(0, Math.ceil((incomingBroadcast.revealExpiresAt - Date.now()) / 1000)));
            }

            if (typeof incomingBroadcast.summaryExpiresAt === "number") {
                setSummaryExpiresAt(incomingBroadcast.summaryExpiresAt);
                setSummaryTimeLeft(Math.max(0, Math.ceil((incomingBroadcast.summaryExpiresAt - Date.now()) / 1000)));
            }

            setBlueScore(incomingBroadcast.blueScore);
            setRedScore(incomingBroadcast.redScore);
            const syncedResults: QuestionResult[] = Array(10).fill("none");
            const incomingResults: QuestionResult[] = incomingBroadcast.questionResults ?? [];

            incomingResults.slice(0, 10).forEach((result, index) => {
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

            if (incomingBroadcast.phase === "revealing" || incomingBroadcast.phase === "intermission") {
                evaluatedQuestionRef.current = incomingBroadcast.currentQuestionIndex;
            } else {
                evaluatedQuestionRef.current = null;
            }

            nextRoundTriggeredRef.current = false;
            return;
        }
    }, [incomingBroadcast, myRole, round, preferPeerSync]);

    // ============================================================
    // 3. REQUEST SYNC
    // ============================================================
    function clearSyncRetryTimers() {
        syncRetryTimersRef.current.forEach((timer) => clearTimeout(timer));
        syncRetryTimersRef.current = [];
    }

    function sendInitialSyncRequest() {
        const shouldRequest = myRole === "red" || (myRole === "blue" && preferPeerSync);

        if (!shouldRequest || hasReceivedSyncRef.current || !questions.length) return;

        if (!syncRequestIdRef.current) {
            syncRequestIdRef.current = `${Date.now()}-${myRole}-${round}-${syncEpoch}-${Math.random().toString(36).slice(2)}`;
        }

        sendBroadcast({
            type: "KZK_SYNC_REQUEST",
            role: myRole,
            round,
            requestId: syncRequestIdRef.current,
        });
    }

    /*
        RED traži canonical KZZ state od BLUE-a.
        Ako prvi request ode prije nego što je BLUE spreman,
        pokušava opet nakon 500 ms i 1500 ms.
    */
    useEffect(() => {
        clearSyncRetryTimers();
        hasReceivedSyncRef.current = false;

        if (!(myRole === "red" || (myRole === "blue" && preferPeerSync)) || !questions.length) {
            return;
        }

        sendInitialSyncRequest();

        const retry500 = setTimeout(sendInitialSyncRequest, 500);

        const retry1500 = setTimeout(sendInitialSyncRequest, 1_500);

        const retry3000 = setTimeout(sendInitialSyncRequest, 3_000);

        const retry5000 = setTimeout(sendInitialSyncRequest, 5_000);

        const retry8000 = setTimeout(sendInitialSyncRequest, 8_000);

        syncRetryTimersRef.current = [retry500, retry1500, retry3000, retry5000, retry8000];

        return () => {
            clearSyncRetryTimers();
            hasReceivedSyncRef.current = false;
            syncRequestIdRef.current = null;
        };
    }, [questions.length, round, myRole, syncEpoch, preferPeerSync]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (pauseVersion <= lastAppliedPauseVersionRef.current) return;
        lastAppliedPauseVersionRef.current = pauseVersion;
        if (!Number.isFinite(resumeShiftMs) || resumeShiftMs <= 0) return;

        const snapshot = stateSnapshot.current;
        const resumeNow = Date.now();
        const pauseStartedAt = resumeNow - resumeShiftMs;

        const shiftActiveDeadline = (value: number, maxDurationMs: number) => {
            if (value <= 0 || value <= pauseStartedAt) {
                return value;
            }

            /*
                Timer koji je već postojao na početku pauze može imati
                najviše maxDurationMs preostalog vremena. Ako je razlika
                veća od maksimuma, timer je kreiran tokom/poslije pauze
                (npr. nova runda) i staru pauzu NE dodajemo na njega.
            */
            const remainingWhenPauseStarted = value - pauseStartedAt;

            if (remainingWhenPauseStarted > maxDurationMs + 250) {
                return value;
            }

            return Math.min(value + resumeShiftMs, resumeNow + maxDurationMs);
        };

        let nextAnswerExpiresAt = snapshot.answerExpiresAt;
        let nextRevealExpiresAt = snapshot.revealExpiresAt;
        let nextSummaryExpiresAt = snapshot.summaryExpiresAt;
        let nextQuestionStartTime = questionStartTime.current;

        if (snapshot.phase === "answering") {
            nextAnswerExpiresAt = shiftActiveDeadline(snapshot.answerExpiresAt, 10_000);

            /*
                answer speed koristi questionStartTime. Vežemo ga za capped
                10s answer window da reconnect nikad ne napravi negativno
                elapsed vrijeme niti pitanje duže od 10 sekundi.
            */
            if (nextAnswerExpiresAt > 0) {
                nextQuestionStartTime = nextAnswerExpiresAt - 10_000;
            }
        } else if (snapshot.phase === "revealing") {
            nextRevealExpiresAt = shiftActiveDeadline(snapshot.revealExpiresAt, 3_000);
        } else if (snapshot.phase === "intermission") {
            nextSummaryExpiresAt = shiftActiveDeadline(snapshot.summaryExpiresAt, 10_000);
        }

        setAnswerExpiresAt(nextAnswerExpiresAt);
        setRevealExpiresAt(nextRevealExpiresAt);
        setSummaryExpiresAt(nextSummaryExpiresAt);
        questionStartTime.current = nextQuestionStartTime;

        stateSnapshot.current = {
            ...snapshot,
            answerExpiresAt: nextAnswerExpiresAt,
            revealExpiresAt: nextRevealExpiresAt,
            summaryExpiresAt: nextSummaryExpiresAt,
        };

        if (myRole === "blue" && isSyncReadyRef.current) {
            onPersistState?.("state_sync", {
                completed: false,
                ...stateSnapshot.current,
                questionStartTime: nextQuestionStartTime,
            });
        }
    }, [pauseVersion, resumeShiftMs, myRole]);

    // ============================================================
    // 4. TIMER ZA ODGOVARANJE
    // ============================================================
    useEffect(() => {
        if (phase !== "answering" || isPaused) return;

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((answerExpiresAt - Date.now()) / 1000));

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
    }, [answerExpiresAt, phase, myAnswer, oppAnswer, myPassed, oppPassed, myRole, isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 5. EVALUACIJA
    // ============================================================
    function evaluateQuestion() {
        if (isPaused || myRole !== "blue") return;

        const currentQuestion = questions[currentQuestionIndex];
        if (!currentQuestion) return;

        if (evaluatedQuestionRef.current === currentQuestionIndex) return;
        evaluatedQuestionRef.current = currentQuestionIndex;

        const blueAnswer = myAnswer;
        const redAnswer = oppAnswer;
        const bluePassed = myPassed;
        const redPassed = oppPassed;
        const correctIndex = currentQuestion.correctIndex;

        const blueCorrect = !bluePassed && blueAnswer !== null && blueAnswer.index === correctIndex;

        const redCorrect = !redPassed && redAnswer !== null && redAnswer.index === correctIndex;

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

        const newBlueScore = blueScore + blueDelta;

        const newRedScore = redScore + redDelta;

        let questionResult: QuestionResult = "gray";

        if (blueDelta > redDelta && blueDelta > 0) {
            questionResult = "blue";
        } else if (redDelta > blueDelta && redDelta > 0) {
            questionResult = "red";
        } else if (blueCorrect && redCorrect && blueAnswer?.answeredAt === redAnswer?.answeredAt) {
            questionResult = "tie";
        }

        setQuestionPoints({
            blue: blueDelta,
            red: redDelta,
        });

        const updatedResults = [...questionResults];

        updatedResults[currentQuestionIndex] = questionResult;

        setQuestionResults(updatedResults);

        const newRevealExpiresAt = Date.now() + 3 * 1000;

        setBlueScore(newBlueScore);
        setRedScore(newRedScore);
        setPhase("revealing");
        setRevealExpiresAt(newRevealExpiresAt);
        setTransitionTimer(3);

        onScoreSubmit(blueDelta, redDelta);

        /*
            Jedan canonical snapshot po završenom pitanju.
            Ovdje su i rezultat i apsolutni reveal timestamp.
        */
        onPersistState?.("question_result", {
            completed: false,
            currentQuestionIndex,
            phase: "revealing",
            answerExpiresAt,
            revealExpiresAt: newRevealExpiresAt,
            summaryExpiresAt: 0,
            blueScore: newBlueScore,
            redScore: newRedScore,
            myAnswer: blueAnswer,
            oppAnswer: redAnswer,
            myPassed: bluePassed,
            oppPassed: redPassed,
            questionResults: updatedResults,
            questionPoints: {
                blue: blueDelta,
                red: redDelta,
            },
            questionStartTime: questionStartTime.current,
        });

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
        if (isPaused || phase !== "revealing") return;
        if (myRole !== "blue") return;

        const nextIndex = currentQuestionIndex + 1;

        if (nextIndex < questions.length) {
            startNextQuestion(nextIndex);
            return;
        }

        const newSummaryExpiresAt = Date.now() + 10 * 1000;

        setPhase("intermission");
        setSummaryExpiresAt(newSummaryExpiresAt);
        setSummaryTimeLeft(10);

        if (!hasPersistedGameRef.current) {
            hasPersistedGameRef.current = true;

            onPersistState?.("game_result", {
                completed: true,
                currentQuestionIndex,
                phase: "intermission",
                answerExpiresAt,
                revealExpiresAt,
                summaryExpiresAt: newSummaryExpiresAt,
                blueScore,
                redScore,
                myAnswer,
                oppAnswer,
                myPassed,
                oppPassed,
                questionResults,
                questionPoints,
                questionStartTime: questionStartTime.current,
            });
        }

        sendBroadcast({
            type: "KZK_INTERMISSION",
            role: myRole,
            round,
            summaryExpiresAt: newSummaryExpiresAt,
        });
    }

    // ============================================================
    // 6. REVEAL TIMER
    // ============================================================
    useEffect(() => {
        if (phase !== "revealing" || isPaused) return;

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((revealExpiresAt - Date.now()) / 1000));

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
    }, [phase, revealExpiresAt, currentQuestionIndex, questions.length, myRole, isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 7. START NEXT QUESTION
    // ============================================================
    function startNextQuestion(index: number) {
        if (isPaused || myRole !== "blue") return;

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

        /*
            Čuvamo novi answerExpiresAt odmah.
            Bez ovoga bi refresh usred novog pitanja mogao
            ponovo dati punih 10 sekundi.
        */
        onPersistState?.("question_start", {
            completed: false,
            currentQuestionIndex: index,
            phase: "answering",
            answerExpiresAt: newAnswerExpiresAt,
            revealExpiresAt: 0,
            summaryExpiresAt: 0,
            blueScore,
            redScore,
            myAnswer: null,
            oppAnswer: null,
            myPassed: false,
            oppPassed: false,
            questionResults,
            questionPoints: {
                blue: 0,
                red: 0,
            },
            questionStartTime: newQuestionStartTime,
        });

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
        if (phase !== "intermission" || isPaused) return;
        if (summaryExpiresAt <= 0) return;

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((summaryExpiresAt - Date.now()) / 1000));

            setSummaryTimeLeft(remaining);
            onTimerTick(remaining);

            if (remaining <= 0) {
                if (myRole === "blue" && !nextRoundTriggeredRef.current) {
                    nextRoundTriggeredRef.current = true;
                    onNextRound();
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
    }, [phase, summaryExpiresAt, myRole, isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================================
    // 9. HANDLE OPTION CLICK
    // ============================================================
    function handleOptionClick(optionIndex: number) {
        if (isPaused || phase !== "answering" || myAnswer !== null || myPassed) return;

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
        if (isPaused || phase !== "answering") return;
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

                <p className="secondary-text">Učitavanje pitanja...</p>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];

    if (!currentQuestion) return null;

    // ============================================================
    // 11. UI
    // ============================================================

    const nobodyAnsweredCorrectly =
        phase === "revealing" &&
        myAnswer?.index !== currentQuestion.correctIndex &&
        oppAnswer?.index !== currentQuestion.correctIndex;

    return (
        <div className="flex w-full max-w-sm flex-col items-center justify-center">
            {phase !== "intermission" ? (
                <div className="flex w-full flex-col items-center gap-4">
                    {/* =========================================
                    QUESTION PROGRESS
                    ========================================= */}

                    <div className="flex items-center justify-center gap-1.5">
                        {questionResults.map((result, index) => {
                            let dotStyle = "border-border bg-surface-light";

                            if (result === "blue") {
                                dotStyle = "border-blue-500 bg-blue-500";
                            }

                            if (result === "red") {
                                dotStyle = "border-red-500 bg-red-500";
                            }

                            if (result === "tie") {
                                dotStyle = "border-primary bg-primary";
                            }

                            if (result === "gray") {
                                dotStyle = "border-text-muted bg-text-muted";
                            }

                            const isCurrent = index === currentQuestionIndex && phase === "answering";

                            return (
                                <div
                                    key={index}
                                    className={`
                                        h-2
                                        w-2
                                        shrink-0
                                        rounded-full
                                        border
                                        transition
                                        ${dotStyle}
                                        ${isCurrent ? "scale-125 ring-2 ring-primary/30" : ""}
                                    `}
                                />
                            );
                        })}
                    </div>

                    {/* =========================================
                    QUESTION
                    ========================================= */}

                    <div className="card-base flex min-h-28 w-full items-center justify-center p-5 text-center">
                        <p className="text-base font-black leading-relaxed text-text">{currentQuestion.question}</p>
                    </div>

                    {/* =========================================
                    REVEAL SCORE
                    ========================================= */}

                    {phase === "revealing" && (
                        <div className="grid w-full grid-cols-2 gap-2">
                            <div className="flex h-11 items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/5 px-3">
                                <span className="text-xs font-black text-blue-400">Plavi</span>

                                <span
                                    className={`
                                    text-sm
                                    font-black
                                    tabular-nums
                                    ${
                                        questionPoints.blue > 0
                                            ? "text-emerald-400"
                                            : questionPoints.blue < 0
                                              ? "text-red-400"
                                              : "text-text-secondary"
                                    }
                                `}
                                >
                                    {questionPoints.blue > 0 ? "+" : ""}
                                    {questionPoints.blue}
                                </span>
                            </div>

                            <div className="flex h-11 items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-3">
                                <span className="text-xs font-black text-red-400">Crveni</span>

                                <span
                                    className={`
                                    text-sm
                                    font-black
                                    tabular-nums
                                    ${
                                        questionPoints.red > 0
                                            ? "text-emerald-400"
                                            : questionPoints.red < 0
                                              ? "text-red-400"
                                              : "text-text-secondary"
                                    }
                                `}
                                >
                                    {questionPoints.red > 0 ? "+" : ""}
                                    {questionPoints.red}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* =========================================
                    PASSED INFO
                    ========================================= */}

                    {phase === "revealing" && (myPassed || oppPassed) && (
                        <div className="flex w-full flex-wrap items-center justify-center gap-2">
                            {myPassed && (
                                <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[10px] font-black text-text-secondary">
                                    Ti: Dalje
                                </span>
                            )}

                            {oppPassed && (
                                <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[10px] font-black text-text-secondary">
                                    Protivnik: Dalje
                                </span>
                            )}
                        </div>
                    )}

                    {/* =========================================
                    OPTIONS
                    ========================================= */}

                    <div className="flex w-full flex-col gap-2">
                        {currentQuestion.options.map((option, index) => {
                            const isCorrect = index === currentQuestion.correctIndex;

                            const didISelect = myAnswer?.index === index;

                            const didOppSelect = oppAnswer?.index === index;

                            let buttonStyle = "border-border bg-surface text-text";

                            if (phase === "revealing") {
                                if (isCorrect) {
                                    buttonStyle = nobodyAnsweredCorrectly
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
                                } else if (didISelect || didOppSelect) {
                                    buttonStyle = "border-red-500/40 bg-red-500/10 text-red-400";
                                } else {
                                    buttonStyle = "border-border bg-surface text-text-muted opacity-50";
                                }
                            }

                            if (phase === "answering") {
                                if (didISelect) {
                                    buttonStyle = "border-primary bg-primary/10 text-primary";
                                } else {
                                    buttonStyle = "border-border bg-surface text-text hover:bg-surface-light";
                                }
                            }

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleOptionClick(index)}
                                    disabled={phase !== "answering" || myAnswer !== null || myPassed}
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
                                            {String.fromCharCode(65 + index)}
                                        </span>

                                        <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{option}</span>
                                    </div>

                                    {phase === "revealing" && (didISelect || didOppSelect) && (
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
                                                                myRole === "blue"
                                                                    ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                                                    : "border-red-500/30 bg-red-500/10 text-red-400"
                                                            }
                                                        `}
                                                >
                                                    Ti {(myAnswer!.time / 1000).toFixed(2)}s
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
                                                                myRole === "blue"
                                                                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                                                                    : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                                            }
                                                        `}
                                                >
                                                    Protivnik {(oppAnswer!.time / 1000).toFixed(2)}s
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* =========================================
                    PASS
                    ========================================= */}

                    {phase === "answering" && (
                        <button
                            type="button"
                            onClick={handlePass}
                            disabled={myAnswer !== null || myPassed}
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
                            <span>{myPassed ? "Čekamo..." : "Dalje"}</span>

                            <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            ) : (
                <RoundIntermission
                    gameTitle="Ko zna zna"
                    round={round}
                    bluePoints={blueScore}
                    redPoints={redScore}
                    timeLeft={summaryTimeLeft}
                    nextLabel="Sledeća igra za"
                />
            )}
        </div>
    );
}
