"use client";

import { useEffect, useRef, useState } from "react";
import { redirect, useParams, useRouter } from "next/navigation";
import { joinGameRoomWithCapability } from "@/actions/game/game-session";

import { getGameStateAction, saveGameProgressAction, saveGameSnapshotAction } from "@/actions/game/game-state";
import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { createClientSupabaseClient } from "@/utils/supabase/client";
import { GameHeader } from "@/components/HeaderZaIgre";
import { EndScreen } from "@/game_components/EndScreen";
import {
    startDisconnectClaimAction,
    cancelMyDisconnectClaimAction,
    finalizeNormalGameAction,
    finalizeDisconnectGameAction,
} from "@/actions/game/game-finish";
import type { FinalGameResult } from "@/lib/game/game-result-types";
import { MojBroj } from "@/game_components/moj_broj/page";
import { Skocko } from "@/game_components/skocko/page";
import { Spojnice } from "@/game_components/spojnice/page";
import { KoZnaZna } from "@/game_components/ko_zna_zna/page";
import { Asocijacije } from "@/game_components/asocijacije/page";
import { PronadjiRec } from "@/game_components/rec/page";

const supabase = createClientSupabaseClient();

function getProfileUsername(profile: any): string | null {
    if (!profile) return null;

    if (Array.isArray(profile)) {
        return profile[0]?.username ?? null;
    }

    return profile.username ?? null;
}

function getRoleForPlayerId(room: any, playerId: string | null | undefined): "blue" | "red" | null {
    if (!playerId) return null;
    if (playerId === room?.player_blue_id) return "blue";
    if (playerId === room?.player_red_id) return "red";
    return null;
}

function getFinalResultFromRoom(room: any): FinalGameResult | null {
    if (room?.status !== "finished" || !room?.finish_reason || !room?.finished_at) {
        return null;
    }

    return {
        finishReason: room.finish_reason,
        winnerRole: getRoleForPlayerId(room, room.winner_id),
        forfeitedRole: getRoleForPlayerId(room, room.forfeited_player_id),
        blueScore: Number(room.blue_score ?? 0),
        redScore: Number(room.red_score ?? 0),
        blueXpChange: Number(room.blue_xp_change ?? 0),
        redXpChange: Number(room.red_xp_change ?? 0),
        finishedAt: room.finished_at,
    };
}

export default function GameRoomPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [roomData, setRoomData] = useState<any>(null);
    const [myRole, setMyRole] = useState<"blue" | "red" | null>(null);
    const [finalResult, setFinalResult] = useState<FinalGameResult | null>(null);
    const [disconnectSecondsLeft, setDisconnectSecondsLeft] = useState<number | null>(null);
    const [miniGameSyncEpoch, setMiniGameSyncEpoch] = useState(0);
    const [roomHydrated, setRoomHydrated] = useState(false);
    const roomHydratedRef = useRef(false);
    const [preferPeerMiniGameSync, setPreferPeerMiniGameSync] = useState(false);

    /*
        ENTRY MODE je odvojen od hydration statusa.

        fresh_red_join:
        - RED je upravo prvi put zauzeo slobodan slot
        - treba vidjeti normalni VS / 5s pre-game ekran
        - i dalje radi tihi room handshake da ne propusti ROOM_GAME_START

        existing_participant:
        - browser ulazi u već postojeću partiju (refresh/reconnect)
        - tada prikazujemo recovery UI i mini-game peer recovery
    */
    const [entryKind, setEntryKind] = useState<"fresh_red_join" | "existing_participant">("existing_participant");
    const entryKindRef = useRef<"fresh_red_join" | "existing_participant">("existing_participant");

    /*
        Sprečava dva paralelna canonical game-start writea/broadcasta.
        Ranije su isti start pokretali i postgres UPDATE callback i poseban
        useEffect, pa su mogla nastati dva različita startsAt timestamp-a.
    */
    const gameStartCreationRef = useRef(false);
    const redisFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const redisFallbackStartedRef = useRef(false);
    const lastAppliedPauseVersionRef = useRef<number | null>(null);

    const presenceHasSeenOpponentRef = useRef(false);
    const presenceInitialCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const presenceStartupGraceUntilRef = useRef(0);
    const presenceAbsenceStartedAtRef = useRef<number | null>(null);

    /*
        Samo browser koji je UŠAO u već pokrenutu partiju mora prvo
        potvrditi da je protivnik stvarno online. DB membership nije liveness.

        Ovo NAMJERNO ostaje false za:
        - BLUE koji je otvorio waiting room
        - fresh RED join

        tako da ne diramo postojeći normalni matchmaking / VS / 5s flow.
    */
    const requiresInitialOpponentPresenceCheckRef = useRef(false);

    /*
        Svaki reconnect/hard refresh dobija novi handshake id.
        Tako zakašnjeli ROOM_SYNC_RESPONSE iz prethodne browser sesije
        ne može hidratovati novu sesiju pogrešnim transitional state-om.
    */
    const roomSyncRequestIdRef = useRef<string | null>(null);

    /*
        Ako ROOM_SYNC_REQUEST stigne dok se ovaj peer još hidrira
        (npr. BLUE upravo radi Redis fallback), ne odbacujemo ga.
        Pamtimo ga i odgovorimo čim canonical room state bude spreman.
    */
    const pendingPeerRoomSyncRequestRef = useRef<{
        role: "blue" | "red";
        requestId: string;
    } | null>(null);

    const roomDataRef = useRef<any>(null);
    const disconnectClaimRequestRef = useRef(false);
    const disconnectCancelRequestRef = useRef(false);
    const disconnectCancelFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const disconnectFinalizeRequestRef = useRef(false);
    const normalFinalizeRequestRef = useRef(false);

    /*
        Round/game transition mora biti durable prije nego što UI lokalno
        pređe dalje. Ovaj guard sprečava dva paralelna transition commita
        ako intermission callback/timer slučajno okine više puta.
    */
    const transitionInFlightRef = useRef(false);

    /*
        BLUE na refreshu pamti zadnju poziciju koju je on već canonicalno
        commitovao. Ako RED vrati stariji/drugačiji room snapshot tačno na
        transition race-u, BLUE ga ne prihvata nego ide na Redis fallback.

        sessionStorage preživljava hard refresh iste kartice, ali ne pravi
        nikakav network/DB/Redis promet.
    */
    const expectedBluePositionRef = useRef<{
        gameIndex: number;
        round: number;
    } | null>(null);

    const transitionBroadcastTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const [gameState, setGameState] = useState<any>(null);
    const [restoredGameSnapshots, setRestoredGameSnapshots] = useState<any>({});

    const [localScoreBlue, setLocalScoreBlue] = useState(0);
    const [localScoreRed, setLocalScoreRed] = useState(0);
    const [gameIndex, setGameIndex] = useState(0);
    const [round, setRound] = useState(1);
    const [headerExpiresAt, setHeaderExpiresAt] = useState<number | null>(null);

    const [currentHeaderTime, setCurrentHeaderTime] = useState(0);

    // PRE-GAME / MATCHMAKING
    const [gameStartAt, setGameStartAt] = useState<number | null>(null);
    const [preGameCountdown, setPreGameCountdown] = useState(5);
    const [rollingLetter, setRollingLetter] = useState("A");

    const channelRef = useRef<any>(null);

    /*
        RED nakon refresha može poslati sync request prije nego što
        BLUE završi reconnect i počne slušati broadcast kanal.

        Zato RED ponavlja room-level sync request dok ne dobije
        canonical ROOM_SYNC_RESPONSE od BLUE-a.
    */
    const hasReceivedRoomSyncRef = useRef(false);

    const roomSyncRetryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    /*
        Snapshot write queue sprečava da brzi uzastopni
        game eventovi završe u Redisu obrnutim redoslijedom.
    */
    const miniGameSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

    /*
        Server clock calibration.

        Nakon server action response-a znamo približno:
        serverNow - localNow.

        Tako header/game countdown ne zavise direktno
        od sistemskog sata konkretnog browsera.
    */
    const serverTimeOffsetRef = useRef(0);

    const headerTimerRequestRef = useRef(false);

    const getEstimatedServerNow = () => Date.now() + serverTimeOffsetRef.current;

    const calibrateServerClock = (requestStartedAt: number, requestFinishedAt: number, serverNow: number) => {
        const midpoint = (requestStartedAt + requestFinishedAt) / 2;

        serverTimeOffsetRef.current = serverNow - midpoint;
    };

    const [isConnected, setIsConnected] = useState(false);
    const [lastBroadcastPayload, setLastBroadcastPayload] = useState<any>(null);

    /*
        MINI-GAME BROADCAST DELIVERY QUEUE

        Ranije je svaki Realtime event radio samo:
            setLastBroadcastPayload(msg)

        Ako dva eventa stignu dovoljno blizu (npr. SYNC_RESPONSE +
        ROOM_HEADER_TIMER_SYNC), React batching može ostaviti samo posljednji
        payload prije nego što child useEffect obradi prvi.

        Room-level evente obrađujemo odmah u ovom parentu, a mini-game evente
        sada isporučujemo CHILD-u jedan po jedan u odvojenim render ciklusima.
        Time sync response više ne može biti "pregazen" drugim broadcastom.
    */
    const miniGameBroadcastQueueRef = useRef<any[]>([]);
    const miniGameBroadcastDeliveryRef = useRef(false);
    const miniGameBroadcastSequenceRef = useRef(0);

    const pumpMiniGameBroadcastQueue = () => {
        if (miniGameBroadcastDeliveryRef.current) {
            return;
        }

        const next = miniGameBroadcastQueueRef.current.shift();

        if (!next) return;

        miniGameBroadcastDeliveryRef.current = true;

        miniGameBroadcastSequenceRef.current += 1;

        setLastBroadcastPayload({
            ...next,
            __deliverySequence: miniGameBroadcastSequenceRef.current,
        });
    };

    const enqueueMiniGameBroadcast = (message: any) => {
        if (!message || typeof message !== "object") {
            return;
        }

        /*
            Bounded best-effort queue. U normalnoj igri je praktično uvijek
            0-2 poruke; limit samo sprečava runaway memory ako transport poludi.
        */
        if (miniGameBroadcastQueueRef.current.length >= 100) {
            miniGameBroadcastQueueRef.current.shift();
        }

        miniGameBroadcastQueueRef.current.push(message);

        pumpMiniGameBroadcastQueue();
    };

    useEffect(() => {
        if (!lastBroadcastPayload) return;

        /*
            setTimeout(0) daje child useEffect-u cijeli render/effect ciklus
            da obradi trenutni event prije nego pošaljemo sljedeći.
        */
        const timer = setTimeout(() => {
            miniGameBroadcastDeliveryRef.current = false;
            pumpMiniGameBroadcastQueue();
        }, 0);

        return () => clearTimeout(timer);
    }, [lastBroadcastPayload]);

    /*
        ROOM SNAPSHOT

        Realtime callback ne treba direktno čitati:
        gameIndex, round, score...

        jer bi mogao imati stale closure.
    */
    const roomSnapshotRef = useRef({
        gameIndex,
        round,
        blueScore: localScoreBlue,
        redScore: localScoreRed,
        gameStartAt,
        headerExpiresAt,
    });

    useEffect(() => {
        roomSnapshotRef.current = {
            gameIndex,
            round,
            blueScore: localScoreBlue,
            redScore: localScoreRed,
            gameStartAt,
            headerExpiresAt,
        };
    }, [gameIndex, round, localScoreBlue, localScoreRed, gameStartAt, headerExpiresAt]);

    useEffect(() => {
        roomDataRef.current = roomData;
    }, [roomData]);

    const getPositionKey = (position: { gameIndex: number; round: number }) => {
        /*
            gameIndex je monotono rastući 0..6, a unutar igre je round 1..2.
            Faktor 10 ostavlja dovoljno prostora i čini poređenje jednostavnim.
        */
        return position.gameIndex * 10 + position.round;
    };

    const isValidPosition = (gameIndexValue: unknown, roundValue: unknown): gameIndexValue is number => {
        return (
            typeof gameIndexValue === "number" &&
            Number.isInteger(gameIndexValue) &&
            gameIndexValue >= 0 &&
            gameIndexValue <= 6 &&
            typeof roundValue === "number" &&
            Number.isInteger(roundValue) &&
            roundValue >= 1 &&
            roundValue <= 2
        );
    };

    const getExpectedPositionStorageKey = () => `game_expected_position:${roomId}`;

    const rememberExpectedBluePosition = (nextGameIndex: number, nextRound: number) => {
        if (!isValidPosition(nextGameIndex, nextRound)) {
            return;
        }

        const next = {
            gameIndex: nextGameIndex,
            round: nextRound,
        };

        expectedBluePositionRef.current = next;

        if (typeof window === "undefined") {
            return;
        }

        try {
            window.sessionStorage.setItem(getExpectedPositionStorageKey(), JSON.stringify(next));
        } catch {
            /*
                sessionStorage je samo local race guard.
                Canonical state i dalje ostaje Redis + peer sync.
            */
        }
    };

    const readExpectedBluePosition = () => {
        if (typeof window === "undefined") {
            return null;
        }

        try {
            const raw = window.sessionStorage.getItem(getExpectedPositionStorageKey());

            if (!raw) return null;

            const parsed = JSON.parse(raw);

            if (!isValidPosition(parsed?.gameIndex, parsed?.round)) {
                return null;
            }

            return {
                gameIndex: parsed.gameIndex,
                round: parsed.round,
            };
        } catch {
            return null;
        }
    };

    const clearTransitionBroadcastTimers = () => {
        transitionBroadcastTimersRef.current.forEach((timer) => clearTimeout(timer));
        transitionBroadcastTimersRef.current = [];
    };

    async function restoreBlueFromRedisFallback() {
        if (myRole !== "blue" || roomHydratedRef.current || redisFallbackStartedRef.current) {
            return;
        }

        redisFallbackStartedRef.current = true;
        let restoredSuccessfully = false;

        try {
            const requestStartedAt = Date.now();

            const restored = await getGameStateAction(roomId);

            const requestFinishedAt = Date.now();

            calibrateServerClock(requestStartedAt, requestFinishedAt, restored.serverNow);

            const progress = restored.progress;

            setRestoredGameSnapshots(restored.games ?? {});

            let restoredGameIndex = progress.gameIndex;

            let restoredRound = progress.round;

            let restoredBlueScore = progress.blueScore;

            let restoredRedScore = progress.redScore;

            let restoredHeaderExpiresAt = progress.headerExpiresAt;

            /*
                    PRONAĐI RIJEČ recovery

                    Ako Redis progress još pokazuje trenutnu
                    rundu, ali postoji `round_result` snapshot,
                    znači da je runda završila, a refresh se
                    desio tokom results/intermission ekrana.

                    Tada rezultat primjenjujemo TAČNO JEDNOM
                    i odmah nastavljamo na sljedeću rundu/igru.
                */
            if (progress.gameIndex === 0) {
                const roundKey = `r${progress.round}`;

                const recResult = restored.games.rec?.[roundKey];

                const resultState = recResult?.state;

                const roundCompleted = recResult?.event === "round_result" && resultState?.completed === true;

                if (roundCompleted) {
                    const bluePts = typeof resultState.bluePts === "number" ? resultState.bluePts : 0;

                    const redPts = typeof resultState.redPts === "number" ? resultState.redPts : 0;

                    restoredBlueScore += bluePts;

                    restoredRedScore += redPts;

                    if (progress.round === 1) {
                        restoredRound = 2;
                    } else {
                        restoredGameIndex = 1;
                        restoredRound = 1;
                    }

                    restoredHeaderExpiresAt = null;

                    /*
                            Normalizujemo Redis odmah.
                            Sljedeći refresh više neće ponovo
                            dodati poene, jer progress sada već
                            pokazuje sljedeću rundu/igru.
                        */
                    await saveGameProgressAction(roomId, {
                        gameIndex: restoredGameIndex,

                        round: restoredRound,

                        blueScore: restoredBlueScore,

                        redScore: restoredRedScore,

                        headerExpiresAt: null,
                    });
                }
            }

            /*
                    MOJ BROJ recovery

                    Isti princip kao Pronađi riječ:
                    ako progress još pokazuje trenutnu rundu,
                    ali postoji završni `round_result`,
                    refresh se desio tokom results/intermission.

                    Dodajemo poene tačno jednom i odmah
                    normalizujemo Redis na sljedeću rundu/igru.
                */
            if (progress.gameIndex === 1) {
                const roundKey = `r${progress.round}`;

                const brojResult = restored.games.broj?.[roundKey];

                const resultState = brojResult?.state;

                const roundCompleted = brojResult?.event === "round_result" && resultState?.completed === true;

                if (roundCompleted) {
                    const bluePts = typeof resultState.bluePts === "number" ? resultState.bluePts : 0;

                    const redPts = typeof resultState.redPts === "number" ? resultState.redPts : 0;

                    restoredBlueScore += bluePts;

                    restoredRedScore += redPts;

                    if (progress.round === 1) {
                        restoredRound = 2;
                    } else {
                        restoredGameIndex = 2;
                        restoredRound = 1;
                    }

                    restoredHeaderExpiresAt = null;

                    await saveGameProgressAction(roomId, {
                        gameIndex: restoredGameIndex,

                        round: restoredRound,

                        blueScore: restoredBlueScore,

                        redScore: restoredRedScore,

                        headerExpiresAt: null,
                    });
                }
            }

            /*
                    SKOČKO recovery

                    Mid-round snapshot se samo prosljeđuje
                    komponenti kroz initialState.

                    Ako postoji round_result, score je već
                    spremljen u room progress u ISTOM snapshot
                    requestu, pa ovdje NE dodajemo poene ponovo.
                */
            if (progress.gameIndex === 2) {
                const roundKey = `r${progress.round}`;

                const skockoResult = restored.games.skocko?.[roundKey];

                const resultState = skockoResult?.state;

                const roundCompleted = skockoResult?.event === "round_result" && resultState?.completed === true;

                if (roundCompleted) {
                    if (progress.round === 1) {
                        restoredRound = 2;
                    } else {
                        restoredGameIndex = 3;
                        restoredRound = 1;
                    }

                    restoredHeaderExpiresAt = null;

                    await saveGameProgressAction(roomId, {
                        gameIndex: restoredGameIndex,
                        round: restoredRound,
                        blueScore: restoredBlueScore,
                        redScore: restoredRedScore,
                        headerExpiresAt: null,
                    });
                }
            }

            /*
                    KO ZNA ZNA ima samo JEDAN set od 10 pitanja.
                    Ako je game_result već spremljen, odmah
                    prelazimo na Spojnice.
                */
            if (progress.gameIndex === 3) {
                const kzzResult = restored.games.ko_zna_zna?.r1;

                const resultState = kzzResult?.state;

                const gameCompleted = kzzResult?.event === "game_result" && resultState?.completed === true;

                if (gameCompleted) {
                    restoredGameIndex = 4;
                    restoredRound = 1;
                    restoredHeaderExpiresAt = null;

                    await saveGameProgressAction(roomId, {
                        gameIndex: 4,
                        round: 1,
                        blueScore: restoredBlueScore,
                        redScore: restoredRedScore,
                        headerExpiresAt: null,
                    });
                }
            }

            /*
                    SPOJNICE recovery
                */
            if (progress.gameIndex === 4) {
                const roundKey = `r${progress.round}`;

                const spojniceResult = restored.games.spojnice?.[roundKey];

                const resultState = spojniceResult?.state;

                const roundCompleted = spojniceResult?.event === "round_result" && resultState?.completed === true;

                if (roundCompleted) {
                    if (progress.round === 1) {
                        restoredRound = 2;
                    } else {
                        restoredGameIndex = 5;
                        restoredRound = 1;
                    }

                    restoredHeaderExpiresAt = null;

                    await saveGameProgressAction(roomId, {
                        gameIndex: restoredGameIndex,
                        round: restoredRound,
                        blueScore: restoredBlueScore,
                        redScore: restoredRedScore,
                        headerExpiresAt: null,
                    });
                }
            }

            /*
                    ASOCIJACIJE recovery
                */
            if (progress.gameIndex === 5) {
                const roundKey = `r${progress.round}`;

                const asocResult = restored.games.asocijacije?.[roundKey];

                const resultState = asocResult?.state;

                const roundCompleted = asocResult?.event === "round_result" && resultState?.completed === true;

                if (roundCompleted) {
                    if (progress.round === 1) {
                        restoredRound = 2;
                    } else {
                        restoredGameIndex = 6;
                        restoredRound = 1;
                    }

                    restoredHeaderExpiresAt = null;

                    await saveGameProgressAction(roomId, {
                        gameIndex: restoredGameIndex,
                        round: restoredRound,
                        blueScore: restoredBlueScore,
                        redScore: restoredRedScore,
                        headerExpiresAt: null,
                    });
                }
            }

            setGameIndex(restoredGameIndex);

            setRound(restoredRound);

            setLocalScoreBlue(restoredBlueScore);

            setLocalScoreRed(restoredRedScore);

            setGameStartAt(progress.gameStartAt);

            setHeaderExpiresAt(restoredHeaderExpiresAt);

            roomSnapshotRef.current = {
                gameIndex: restoredGameIndex,

                round: restoredRound,

                blueScore: restoredBlueScore,

                redScore: restoredRedScore,

                gameStartAt: progress.gameStartAt,

                headerExpiresAt: restoredHeaderExpiresAt,
            };

            rememberExpectedBluePosition(restoredGameIndex, restoredRound);

            restoredSuccessfully = true;
        } catch (restoreError) {
            console.error("Redis restore failed:", restoreError);
        }

        if (!restoredSuccessfully) {
            setError("Ne mogu vratiti stanje partije.");
            return;
        }

        roomHydratedRef.current = true;
        setRoomHydrated(true);
        setPreferPeerMiniGameSync(false);
        setMiniGameSyncEpoch((epoch) => epoch + 1);

        /*
            Ako je RED upravo vratio stale snapshot (ili je propustio
            NEXT_ROUND_SYNC), Redis fallback je sada authoritative.
            Objavimo ga cijelom roomu da se stabilni RED odmah poravna
            bez vlastitog refresha.

            Ovo je samo Realtime broadcast, bez dodatnog Redis requesta.
        */
        if (channelRef.current) {
            const canonical = roomSnapshotRef.current;

            void channelRef.current
                .send({
                    type: "broadcast",
                    event: "GAME_STATE",
                    payload: {
                        type: "ROOM_CANONICAL_STATE",
                        role: "blue",
                        gameIndex: canonical.gameIndex,
                        round: canonical.round,
                        blueScore: canonical.blueScore,
                        redScore: canonical.redScore,
                        gameStartAt: canonical.gameStartAt,
                        headerExpiresAt: canonical.headerExpiresAt,
                        serverNow: getEstimatedServerNow(),
                    },
                })
                .catch((syncError: Error) => {
                    console.error("ROOM_CANONICAL_STATE broadcast failed:", syncError);
                });
        }

        /*
            Ključni simultaneous-refresh fix:

            RED-ov posljednji retry je ranije mogao stići dok BLUE još
            završava Redis recovery/normalizaciju. BLUE bi request samo
            ignorisao, zatim postao hydrated, ali RED više nije pitao.

            Sada request ostaje pending i BLUE odmah po završetku fallbacka
            šalje odgovor na TAJ request. Nema potrebe za dodatnim refreshom.
        */
        const pendingRequest = pendingPeerRoomSyncRequestRef.current;

        if (pendingRequest && pendingRequest.role !== "blue" && channelRef.current) {
            pendingPeerRoomSyncRequestRef.current = null;
            const snapshot = roomSnapshotRef.current;

            void channelRef.current
                .send({
                    type: "broadcast",
                    event: "GAME_STATE",
                    payload: {
                        type: "ROOM_SYNC_RESPONSE",
                        role: "blue",
                        requestId: pendingRequest.requestId,
                        gameIndex: snapshot.gameIndex,
                        round: snapshot.round,
                        blueScore: snapshot.blueScore,
                        redScore: snapshot.redScore,
                        gameStartAt: snapshot.gameStartAt,
                        headerExpiresAt: snapshot.headerExpiresAt,
                        serverNow: getEstimatedServerNow(),
                    },
                })
                .catch((syncError: Error) => {
                    console.error("Deferred ROOM_SYNC_RESPONSE failed:", syncError);
                });
        }
    }

    /*
        1. PRVO UČITAJ SOBU I ROLE

        Ne pravimo channel prije nego što znamo myRole.
    */
    useEffect(() => {
        if (!roomId) return;

        let cancelled = false;

        async function initRoom() {
            setLoading(true);

            const res = await joinGameRoomWithCapability(roomId);

            if (cancelled) return;

            if (res.error) {
                setError(res.error);
                setLoading(false);
                return;
            }

            const role = res.role as "blue" | "red";

            const nextEntryKind =
                res.entryKind === "fresh_red_join" && role === "red" ? "fresh_red_join" : "existing_participant";

            entryKindRef.current = nextEntryKind;
            setEntryKind(nextEntryKind);
            setMyRole(role);
            roomHydratedRef.current = false;
            setRoomHydrated(false);
            setPreferPeerMiniGameSync(false);
            redisFallbackStartedRef.current = false;
            gameStartCreationRef.current = false;
            lastAppliedPauseVersionRef.current = null;
            roomSyncRequestIdRef.current = null;
            pendingPeerRoomSyncRequestRef.current = null;
            miniGameBroadcastQueueRef.current = [];
            miniGameBroadcastDeliveryRef.current = false;
            setLastBroadcastPayload(null);
            presenceStartupGraceUntilRef.current = 0;
            presenceAbsenceStartedAtRef.current = null;
            requiresInitialOpponentPresenceCheckRef.current = false;

            expectedBluePositionRef.current =
                role === "blue" && nextEntryKind === "existing_participant" ? readExpectedBluePosition() : null;

            /*
                BLUE prvo vraća canonical Redis state,
                pa tek onda otvaramo realtime channel.

                Tako RED ne može dobiti stale default snapshot
                dok BLUE još restore-a.
            */

            /*
                SAMO BLUE čita Redis.

                Ovo je jedini persistent restore request
                pri ulasku/refresu igre.

                joinGameRoomWithCapability() je upravo
                izdao HttpOnly capability ako je role blue.
            */

            if (cancelled) return;

            const { data, error: fetchErr } = await supabase
                .from("game_rooms")
                .select(
                    `
                    id,
                    status,
                    game_state,
                    player_blue_id,
                    player_red_id,
                    disconnected_player_id,
                    disconnect_claimed_by,
                    disconnect_started_at,
                    disconnect_deadline,
                    pause_version,
                    last_pause_duration_ms,
                    last_resumed_at,
                    finish_reason,
                    winner_id,
                    forfeited_player_id,
                    blue_score,
                    red_score,
                    blue_xp_change,
                    red_xp_change,
                    finished_at,
                    profiles_blue:player_blue_id(username),
                    profiles_red:player_red_id(username)
                `
                )
                .eq("id", roomId)
                .single();

            if (cancelled) return;

            if (fetchErr) {
                setError("Ne mogu da učitam podatke o sobi.");
                setLoading(false);
                return;
            }

            setRoomData(data);
            setGameState(data?.game_state);
            setFinalResult(getFinalResultFromRoom(data));

            /*
                Ako se postojeći participant vraća u već in_progress room,
                prije nastavka igre moramo potvrditi protivnika preko Presence-a.
                Sam player_red_id/player_blue_id u bazi NE znači da je browser online.
            */
            const mustCheckOpponentPresence =
                nextEntryKind === "existing_participant" && data?.status === "in_progress";

            requiresInitialOpponentPresenceCheckRef.current = mustCheckOpponentPresence;

            lastAppliedPauseVersionRef.current = Number(data?.pause_version ?? 0);

            if (data?.status !== "in_progress") {
                roomHydratedRef.current = true;
                setRoomHydrated(true);
                setPreferPeerMiniGameSync(false);
            } else if (nextEntryKind === "fresh_red_join") {
                /*
                    FRESH RED je lokalno spreman odmah.

                    Važna razlika:
                    roomHydrated više NE koristimo kao uslov da fresh RED
                    smije završiti VS ekran. On u pozadini i dalje traži
                    canonical gameStartAt od BLUE-a, ali taj bootstrap više
                    ne može ostaviti UI zauvijek na VS ekranu ako se jedan
                    ROOM_SYNC_RESPONSE izgubi.

                    gameReady i dalje zahtijeva gameStartAt + countdown 0,
                    pa RED ne može ući u rundu prije canonical starta.
                */
                roomHydratedRef.current = true;
                setRoomHydrated(true);
                setPreferPeerMiniGameSync(false);
            } else {
                /*
                    Pravi refresh/reconnect existing participanta i dalje
                    mora prvo dobiti canonical room snapshot od peer-a,
                    odnosno BLUE koristi Redis fallback ako peer nije usable.
                */
                roomHydratedRef.current = false;
                setRoomHydrated(false);
                setPreferPeerMiniGameSync(true);
            }

            /*
                Ako je room već in_progress:
                ne pravimo lokalni Date.now() + 5s na oba klijenta.

                BLUE će u fallback effect-u ispod napraviti
                canonical server timestamp i broadcastovati RED-u.
            */

            setLoading(false);
        }

        initRoom();

        return () => {
            cancelled = true;
        };
    }, [roomId]);

    /*
        2. CHANNEL PRAVIMO TEK KADA IMAMO ROLE

        Ovo uklanja:
        ROOM_SYNC_REQUEST role: null
    */
    useEffect(() => {
        if (!roomId || !myRole) return;

        const channelTopic = `game_session_${roomId}`;

        const existingChannel = supabase.getChannels().find((channel) => channel.topic === `realtime:${channelTopic}`);

        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const channel = supabase.channel(channelTopic, {
            config: {
                broadcast: {
                    ack: true,
                },
                presence: {
                    key: myRole,
                },
            },
        });

        /*
            VAŽNO:
            Postavljamo ref PRIJE subscribe(),
            da subscribe callback sigurno može slati.
        */
        channelRef.current = channel;

        const sendThroughChannel = async (payload: any) => {
            await channel.send({
                type: "broadcast",
                event: "GAME_STATE",
                payload,
            });
        };

        const clearRoomSyncRetryTimers = () => {
            roomSyncRetryTimersRef.current.forEach((timer) => clearTimeout(timer));

            roomSyncRetryTimersRef.current = [];
        };

        /*
            Postgres Realtime UPDATE je glavni način da oba browsera saznaju
            da je reconnect RPC poništio disconnect claim. Ipak, baš tokom
            reconnecta websocket može propustiti taj jedan UPDATE.

            Zato Presence povratak ima mali, ograničeni DB fallback:
            samo nekoliko pokušaja poslije stvarnog povratka protivnika,
            nikakav polling tokom normalne igre.
        */
        const resumeRefreshTimers: ReturnType<typeof setTimeout>[] = [];
        let resumeRefreshInFlight = false;

        /*
            Fresh-match start fallback.

            Postgres UPDATE (waiting -> in_progress) može pasti tačno između
            BLUE-ovog subscribe-a i RED-ovog join-a. Ako BLUE propusti taj jedan
            event, njegov local roomData ostane "waiting" i nikad ne kreira
            canonical gameStartAt.

            RED svakako šalje ROOM_SYNC_REQUEST i Presence track. Na ta dva
            signala BLUE radi samo jedan bounded DB refresh dok ne vidi da je
            player_red_id stvarno upisan. Nema polling-a.
        */
        let freshMatchStartRefreshInFlight = false;

        const mergeResumeFields = (freshRoom: any) => {
            setRoomData((previous: any) => {
                if (!previous) return previous;

                return {
                    ...previous,
                    status: freshRoom.status ?? previous.status,
                    disconnected_player_id: freshRoom.disconnected_player_id ?? null,
                    disconnect_claimed_by: freshRoom.disconnect_claimed_by ?? null,
                    disconnect_started_at: freshRoom.disconnect_started_at ?? null,
                    disconnect_deadline: freshRoom.disconnect_deadline ?? null,
                    pause_version: freshRoom.pause_version ?? previous.pause_version ?? 0,
                    last_pause_duration_ms: freshRoom.last_pause_duration_ms ?? previous.last_pause_duration_ms ?? 0,
                    last_resumed_at: freshRoom.last_resumed_at ?? previous.last_resumed_at ?? null,
                };
            });

            if (!freshRoom.disconnect_deadline) {
                setDisconnectSecondsLeft(null);
            }
        };

        const refreshResumeStateFromDb = async (attempt = 0) => {
            if (resumeRefreshInFlight || channelRef.current !== channel) {
                return;
            }

            resumeRefreshInFlight = true;

            try {
                const { data: freshRoom, error: refreshError } = await supabase
                    .from("game_rooms")
                    .select(
                        `
                            status,
                            disconnected_player_id,
                            disconnect_claimed_by,
                            disconnect_started_at,
                            disconnect_deadline,
                            pause_version,
                            last_pause_duration_ms,
                            last_resumed_at
                        `
                    )
                    .eq("id", roomId)
                    .single();

                if (refreshError || !freshRoom) {
                    console.error("Could not refresh reconnect state:", refreshError);
                    return;
                }

                mergeResumeFields(freshRoom);

                /*
                    Reconnecting peer možda još završava mini-game sync prije
                    cancel RPC-a. Ako claim još postoji, probamo još samo
                    nekoliko puta. Ovo je reconnect-only fallback, ne polling.
                */
                if (freshRoom.disconnect_started_at && attempt < 3 && channelRef.current === channel) {
                    const retry = setTimeout(() => void refreshResumeStateFromDb(attempt + 1), 700);
                    resumeRefreshTimers.push(retry);
                }
            } finally {
                resumeRefreshInFlight = false;
            }
        };

        const refreshFreshMatchStartFromDb = async () => {
            if (
                myRole !== "blue" ||
                freshMatchStartRefreshInFlight ||
                channelRef.current !== channel ||
                typeof roomSnapshotRef.current.gameStartAt === "number" ||
                roomDataRef.current?.status !== "waiting"
            ) {
                return;
            }

            freshMatchStartRefreshInFlight = true;

            try {
                const { data: freshRoom, error: refreshError } = await supabase
                    .from("game_rooms")
                    .select(
                        `
                        status,
                        player_red_id,
                        profiles_red:player_red_id(username)
                    `
                    )
                    .eq("id", roomId)
                    .single();

                if (refreshError || !freshRoom) {
                    console.error("Could not verify fresh opponent join:", refreshError);
                    return;
                }

                /*
                    Broadcast/Presence nije authority za membership.
                    Tek DB potvrda smije prebaciti BLUE iz waiting flow-a.
                */
                if (freshRoom.status !== "in_progress" || !freshRoom.player_red_id) {
                    return;
                }

                setRoomData((previous: any) =>
                    previous
                        ? {
                              ...previous,
                              status: freshRoom.status,
                              player_red_id: freshRoom.player_red_id,
                              profiles_red: freshRoom.profiles_red ?? previous.profiles_red,
                          }
                        : previous
                );
            } finally {
                freshMatchStartRefreshInFlight = false;
            }
        };

        const freshRedStillNeedsStartSync = () =>
            entryKindRef.current === "fresh_red_join" && typeof roomSnapshotRef.current.gameStartAt !== "number";

        const needsRoomSync = () => !roomHydratedRef.current || freshRedStillNeedsStartSync();

        const canServeRoomSnapshot = () => roomHydratedRef.current && !freshRedStillNeedsStartSync();

        const sendRoomSyncRequest = () => {
            if (!myRole || !needsRoomSync() || hasReceivedRoomSyncRef.current || channelRef.current !== channel) {
                return;
            }

            if (!roomSyncRequestIdRef.current) {
                roomSyncRequestIdRef.current = `${Date.now()}-${myRole}-${Math.random().toString(36).slice(2)}`;
            }

            void sendThroughChannel({
                type: "ROOM_SYNC_REQUEST",
                role: myRole,
                requestId: roomSyncRequestIdRef.current,
            }).catch((syncError) => {
                console.error("ROOM_SYNC_REQUEST failed:", syncError);
            });
        };

        const startOpponentDisconnectClaim = async () => {
            if (disconnectClaimRequestRef.current) return;

            disconnectClaimRequestRef.current = true;

            try {
                const result = await startDisconnectClaimAction(roomId);

                if (result?.error) {
                    console.error("Could not start disconnect claim:", result.error);
                }
            } catch (claimError) {
                console.error("Could not start disconnect claim:", claimError);
            } finally {
                disconnectClaimRequestRef.current = false;
            }
        };

        const handlePresenceSync = () => {
            const getPresentRoles = () => {
                const presence = channel.presenceState() as Record<string, Array<{ role?: "blue" | "red" }>>;

                const roles = new Set<"blue" | "red">();

                Object.values(presence).forEach((entries) => {
                    entries.forEach((entry) => {
                        if (entry.role === "blue" || entry.role === "red") {
                            roles.add(entry.role);
                        }
                    });
                });

                return roles;
            };

            const opponentRole = myRole === "blue" ? "red" : "blue";
            const roles = getPresentRoles();
            const opponentPresent = roles.has(opponentRole);

            if (opponentPresent) {
                const returnedAfterAbsence = presenceAbsenceStartedAtRef.current !== null;

                presenceHasSeenOpponentRef.current = true;
                presenceAbsenceStartedAtRef.current = null;

                /*
                    Ako je ovo upravo RED koji je joinovao, BLUE možda nije
                    dobio waiting -> in_progress Postgres UPDATE. Presence je
                    samo signal da provjerimo DB; DB i dalje ostaje authority.
                */
                if (
                    myRole === "blue" &&
                    roomDataRef.current?.status === "waiting" &&
                    typeof roomSnapshotRef.current.gameStartAt !== "number"
                ) {
                    void refreshFreshMatchStartFromDb();
                }

                if (presenceInitialCheckTimerRef.current) {
                    clearTimeout(presenceInitialCheckTimerRef.current);
                    presenceInitialCheckTimerRef.current = null;
                }

                /*
                    Ako smo u room ušli dok je opponent bio offline, početni
                    room-sync retry-i su možda već istekli prije njegovog povratka.
                    Presence sada potvrđuje da peer stvarno sluša kanal, pa ako
                    još nismo hydrated pošaljemo novi request odmah.

                    Ovo ne pravi Redis poziv; samo koristi postojeći Realtime
                    peer-first sync. BLUE će, ako još nije hydrated, request
                    sačuvati kao pending i odgovoriti nakon svog fallbacka.
                */
                if (needsRoomSync()) {
                    sendRoomSyncRequest();
                }

                /*
                    Ako smo baš čekali protivnika i sada se Presence vratio,
                    provjeri authoritative DB claim. Ovo zatvara slučaj gdje
                    cancel RPC uspije, ali survivor propusti postgres UPDATE.
                */
                if (returnedAfterAbsence && roomDataRef.current?.disconnect_started_at) {
                    const retry = setTimeout(() => void refreshResumeStateFromDb(0), 250);
                    resumeRefreshTimers.push(retry);
                }

                return;
            }

            /*
                Normalni flow ostaje isti: ako je ovo fresh room/join,
                ne otvaramo claim prije nego što smo protivnika barem jednom
                stvarno vidjeli u Presence-u. To sprečava početni false-positive.

                Jedini izuzetak je povratak u VEĆ in_progress partiju. Tu je
                upravo cilj ovog fixa da nakon startup grace-a odsutan opponent
                bude prepoznat čak i ako ga ova nova browser sesija nikad nije
                vidjela.
            */
            if (!presenceHasSeenOpponentRef.current && !requiresInitialOpponentPresenceCheckRef.current) {
                return;
            }

            if (presenceAbsenceStartedAtRef.current === null) {
                presenceAbsenceStartedAtRef.current = Date.now();
            }

            if (presenceInitialCheckTimerRef.current) {
                clearTimeout(presenceInitialCheckTimerRef.current);
            }

            /*
                SIMULTANEOUS REFRESH RACE:

                Novi RED može na prvom sync-u još kratko vidjeti STARI BLUE
                Presence entry. Stari tab zatim nestane, a novi BLUE još nije
                završio join/fetch/track. Sa starim 250ms debounce-om to je
                izgledalo kao pravi disconnect i pravilo lažni 40s claim.

                Zato nakon svakog vlastitog SUBSCRIBED-a imamo kratki startup
                grace, a poslije toga zahtijevamo stabilno odsustvo. U normalnoj
                već uspostavljenoj partiji leave se i dalje detektuje brzo.
            */
            const STABLE_ABSENCE_MS = 900;
            const now = Date.now();
            const graceRemaining = Math.max(0, presenceStartupGraceUntilRef.current - now);
            const absenceElapsed = Math.max(0, now - (presenceAbsenceStartedAtRef.current ?? now));
            const absenceRemaining = Math.max(0, STABLE_ABSENCE_MS - absenceElapsed);
            const delay = Math.max(graceRemaining, absenceRemaining, 50);

            presenceInitialCheckTimerRef.current = setTimeout(() => {
                presenceInitialCheckTimerRef.current = null;

                const latestRoles = getPresentRoles();

                if (latestRoles.has(opponentRole)) {
                    presenceHasSeenOpponentRef.current = true;
                    presenceAbsenceStartedAtRef.current = null;
                    return;
                }

                const checkNow = Date.now();
                const stillInsideStartupGrace = checkNow < presenceStartupGraceUntilRef.current;
                const stableAbsentFor = checkNow - (presenceAbsenceStartedAtRef.current ?? checkNow);

                if (stillInsideStartupGrace || stableAbsentFor < STABLE_ABSENCE_MS) {
                    handlePresenceSync();
                    return;
                }

                if (roomDataRef.current?.status === "in_progress") {
                    void startOpponentDisconnectClaim();
                }
            }, delay);
        };

        channel
            .on("presence", { event: "sync" }, handlePresenceSync)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "game_rooms",
                    filter: `id=eq.${roomId}`,
                },
                async (payload) => {
                    const { data: freshRoom, error: refreshError } = await supabase
                        .from("game_rooms")
                        .select(
                            `
                            id,
                            status,
                            game_state,
                            player_blue_id,
                            player_red_id,
                            disconnected_player_id,
                            disconnect_claimed_by,
                            disconnect_started_at,
                            disconnect_deadline,
                            pause_version,
                            last_pause_duration_ms,
                            last_resumed_at,
                            finish_reason,
                            winner_id,
                            forfeited_player_id,
                            blue_score,
                            red_score,
                            blue_xp_change,
                            red_xp_change,
                            finished_at,
                            profiles_blue:player_blue_id(username),
                            profiles_red:player_red_id(username)
                        `
                        )
                        .eq("id", roomId)
                        .single();

                    if (refreshError || !freshRoom) {
                        console.error("Ne mogu osvježiti podatke sobe:", refreshError);
                        return;
                    }

                    setRoomData(freshRoom);

                    /*
                        Disconnect claim/cancel mijenja game_rooms red,
                        ali NE mijenja game_state payload.

                        Ako ovdje svaki put ubacimo novi JS objekat u
                        setGameState(), mini-game dobije novi data/tiles
                        object identity i njegov init effect može pogrešno
                        protumačiti običan disconnect UPDATE kao novu rundu.

                        Zato zadržavamo postojeći gameState reference kada
                        sadržaj stvarno nije promijenjen.
                    */
                    setGameState((previousGameState: any) => {
                        const nextGameState = freshRoom.game_state;

                        if (previousGameState === nextGameState) {
                            return previousGameState;
                        }

                        try {
                            if (JSON.stringify(previousGameState) === JSON.stringify(nextGameState)) {
                                return previousGameState;
                            }
                        } catch {
                            // Ako payload nije serializable, uzmi fresh state.
                        }

                        return nextGameState;
                    });

                    setFinalResult(getFinalResultFromRoom(freshRoom));

                    /*
                        Canonical ROOM_GAME_START se NAMJERNO ne kreira ovdje.
                        Postgres callback samo osvježava room podatke. Jedini
                        creator je dedicated BLUE useEffect niže, sa single-flight
                        guardom. Time ne možemo napraviti dva startsAt timestamp-a.
                    */
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "game_rooms",
                    filter: `id=eq.${roomId}`,
                },
                (payload) => {
                    setRoomData(() => ({
                        status: "deleted",
                    }));
                }
            )
            .on(
                "broadcast",
                {
                    event: "GAME_STATE",
                },
                (payload) => {
                    const msg = payload?.payload;

                    /*
                        Realtime payload mora biti objekat.
                        Ne dozvoljavamo malformed broadcastu da sruši cijeli
                        room listener i prekine sve naredne sync poruke.
                    */
                    if (!msg || typeof msg !== "object") {
                        return;
                    }

                    /*
                        Room-level sync poruke se procesiraju direktno ispod.
                        Sve ostalo je mini-game event i ide kroz lossless queue
                        umjesto jednog "last payload" slota.
                    */
                    const isRoomLevelMessage =
                        msg?.type === "NEXT_ROUND_SYNC" ||
                        msg?.type === "ROOM_CANONICAL_STATE" ||
                        msg?.type === "ROOM_GAME_START" ||
                        msg?.type === "ROOM_HEADER_TIMER_SYNC" ||
                        msg?.type === "ROOM_SYNC_REQUEST" ||
                        msg?.type === "ROOM_SYNC_RESPONSE";

                    if (!isRoomLevelMessage) {
                        enqueueMiniGameBroadcast(msg);
                    }

                    /*
                        Protivnik mijenja rundu / igru.
                    */
                    if (msg.type === "NEXT_ROUND_SYNC") {
                        /*
                            Samo BLUE je transition authority.
                            RED broadcast ne smije pomjeriti room naprijed/nazad.
                        */
                        if (
                            msg.role !== "blue" ||
                            myRole !== "red" ||
                            !isValidPosition(msg.nextGameIndex, msg.nextRound)
                        ) {
                            return;
                        }

                        const currentPosition = {
                            gameIndex: roomSnapshotRef.current.gameIndex,
                            round: roomSnapshotRef.current.round,
                        };

                        const incomingPosition = {
                            gameIndex: msg.nextGameIndex,
                            round: msg.nextRound,
                        };

                        /*
                            Duplicate/retry broadcasti su očekivani.
                            Nikad ne dozvolimo da zakašnjeli stariji transition
                            vrati browser unazad.
                        */
                        if (getPositionKey(incomingPosition) < getPositionKey(currentPosition)) {
                            return;
                        }

                        roomSnapshotRef.current = {
                            ...roomSnapshotRef.current,
                            round: msg.nextRound,
                            gameIndex: msg.nextGameIndex,
                            headerExpiresAt: null,
                        };

                        setRound(msg.nextRound);

                        setGameIndex(msg.nextGameIndex);

                        setHeaderExpiresAt(null);

                        return;
                    }

                    if (msg.type === "ROOM_CANONICAL_STATE") {
                        /*
                            Samo BLUE smije objaviti ovaj recovery commit.
                            RED ga koristi da se poravna ako je propustio
                            transition broadcast dok se BLUE refreshao.
                        */
                        if (myRole !== "red" || msg.role !== "blue" || !isValidPosition(msg.gameIndex, msg.round)) {
                            return;
                        }

                        const currentPosition = {
                            gameIndex: roomSnapshotRef.current.gameIndex,
                            round: roomSnapshotRef.current.round,
                        };

                        const canonicalPosition = {
                            gameIndex: msg.gameIndex,
                            round: msg.round,
                        };

                        if (getPositionKey(canonicalPosition) < getPositionKey(currentPosition)) {
                            return;
                        }

                        roomSnapshotRef.current = {
                            gameIndex: msg.gameIndex,
                            round: msg.round,
                            blueScore:
                                typeof msg.blueScore === "number" ? msg.blueScore : roomSnapshotRef.current.blueScore,
                            redScore:
                                typeof msg.redScore === "number" ? msg.redScore : roomSnapshotRef.current.redScore,
                            gameStartAt:
                                typeof msg.gameStartAt === "number"
                                    ? msg.gameStartAt
                                    : roomSnapshotRef.current.gameStartAt,
                            headerExpiresAt:
                                msg.headerExpiresAt === null || typeof msg.headerExpiresAt === "number"
                                    ? msg.headerExpiresAt
                                    : roomSnapshotRef.current.headerExpiresAt,
                        };

                        if (typeof msg.serverNow === "number") {
                            serverTimeOffsetRef.current = msg.serverNow - Date.now();
                        }

                        setGameIndex(msg.gameIndex);
                        setRound(msg.round);

                        if (typeof msg.blueScore === "number") {
                            setLocalScoreBlue(msg.blueScore);
                        }

                        if (typeof msg.redScore === "number") {
                            setLocalScoreRed(msg.redScore);
                        }

                        if (typeof msg.gameStartAt === "number") {
                            setGameStartAt(msg.gameStartAt);
                            setPreGameCountdown(
                                Math.max(0, Math.ceil((msg.gameStartAt - getEstimatedServerNow()) / 1000))
                            );
                        }

                        if (msg.headerExpiresAt === null || typeof msg.headerExpiresAt === "number") {
                            setHeaderExpiresAt(msg.headerExpiresAt);
                        }

                        /*
                            Ako je RED bio u recovery-u, ovo je dovoljan
                            room-level canonical snapshot da hydration završi.
                            Mini-game zatim radi svoj postojeći peer sync.
                        */
                        if (!roomHydratedRef.current && entryKindRef.current === "existing_participant") {
                            roomHydratedRef.current = true;
                            setRoomHydrated(true);
                            setPreferPeerMiniGameSync(true);
                            hasReceivedRoomSyncRef.current = true;
                            clearRoomSyncRetryTimers();
                            roomSyncRequestIdRef.current = null;
                        }

                        /*
                            Room-level canonical correction treba odmah
                            pokrenuti i mini-game handshake. Tako RED koji je
                            propustio transition/event ne ostaje sa starim
                            board stateom čak ni kada su gameIndex/round isti.
                        */
                        setMiniGameSyncEpoch((epoch) => epoch + 1);

                        return;
                    }

                    if (msg.type === "ROOM_GAME_START") {
                        if (msg.role !== "blue") {
                            return;
                        }

                        if (typeof msg.serverNow === "number" && myRole === "red") {
                            serverTimeOffsetRef.current = msg.serverNow - Date.now();
                        }

                        if (typeof msg.startsAt === "number") {
                            roomSnapshotRef.current.gameStartAt = msg.startsAt;

                            setGameStartAt(msg.startsAt);

                            setPreGameCountdown(
                                Math.max(0, Math.ceil((msg.startsAt - getEstimatedServerNow()) / 1000))
                            );

                            /*
                                Fresh RED je radio tihi room handshake samo da
                                ne propusti canonical start. Čim start stigne,
                                bootstrap je gotov i retry-i više nisu potrebni.
                            */
                            if (entryKindRef.current === "fresh_red_join") {
                                /*
                                    Fresh RED je već lokalno hydrated; ovdje
                                    završavamo samo background start handshake.
                                */
                                roomHydratedRef.current = true;
                                setRoomHydrated(true);
                                setPreferPeerMiniGameSync(false);
                                hasReceivedRoomSyncRef.current = true;
                                clearRoomSyncRetryTimers();
                                roomSyncRequestIdRef.current = null;

                                const pendingRequest = pendingPeerRoomSyncRequestRef.current;

                                if (pendingRequest && pendingRequest.role !== myRole && canServeRoomSnapshot()) {
                                    pendingPeerRoomSyncRequestRef.current = null;

                                    const snapshot = roomSnapshotRef.current;

                                    void sendThroughChannel({
                                        type: "ROOM_SYNC_RESPONSE",
                                        role: myRole,
                                        requestId: pendingRequest.requestId,
                                        gameIndex: snapshot.gameIndex,
                                        round: snapshot.round,
                                        blueScore: snapshot.blueScore,
                                        redScore: snapshot.redScore,
                                        gameStartAt: snapshot.gameStartAt,
                                        headerExpiresAt: snapshot.headerExpiresAt,
                                        serverNow: getEstimatedServerNow(),
                                    });
                                }
                            }
                        }

                        return;
                    }

                    if (msg.type === "ROOM_HEADER_TIMER_SYNC") {
                        if (msg.role !== "blue") {
                            return;
                        }

                        if (typeof msg.serverNow === "number" && myRole === "red") {
                            serverTimeOffsetRef.current = msg.serverNow - Date.now();
                        }

                        if (typeof msg.expiresAt === "number") {
                            roomSnapshotRef.current.headerExpiresAt = msg.expiresAt;

                            setHeaderExpiresAt(msg.expiresAt);
                        }

                        return;
                    }

                    /*
                        Neko je refreshovao stranicu i traži
                        trenutno stanje Room komponente.
                    */
                    if (msg.type === "ROOM_SYNC_REQUEST") {
                        /*
                            Peer-first recovery:
                            bilo koji već hidratovan protivnik smije vratiti
                            svoj trenutni room snapshot.

                            Ako još NISMO hidratovani, request se više ne baca.
                            Pamtimo posljednji request i odgovaramo čim recovery
                            završi. Ovo zatvara race gdje RED potroši sve retry-e
                            dok BLUE radi Redis fallback na game transitionu.
                        */
                        if (msg.role === myRole || typeof msg.requestId !== "string" || !msg.requestId) {
                            return;
                        }

                        /*
                            Fresh RED može poslati request dok BLUE još lokalno
                            misli da je room "waiting". Sačuvamo isti requestId
                            i provjerimo DB. Kad BLUE kreira canonical start,
                            response se eksplicitno flushuje ovom RED-u.

                            Ovo uklanja zavisnost od jednog Postgres realtime
                            UPDATE eventa pri samom join-u.
                        */
                        if (
                            myRole === "blue" &&
                            msg.role === "red" &&
                            typeof roomSnapshotRef.current.gameStartAt !== "number"
                        ) {
                            pendingPeerRoomSyncRequestRef.current = {
                                role: msg.role,
                                requestId: msg.requestId,
                            };

                            if (roomDataRef.current?.status === "waiting") {
                                void refreshFreshMatchStartFromDb();
                            }
                        }

                        if (!canServeRoomSnapshot()) {
                            pendingPeerRoomSyncRequestRef.current = {
                                role: msg.role,
                                requestId: msg.requestId,
                            };
                            return;
                        }

                        const snapshot = roomSnapshotRef.current;

                        sendThroughChannel({
                            type: "ROOM_SYNC_RESPONSE",
                            role: myRole,
                            requestId: msg.requestId,
                            gameIndex: snapshot.gameIndex,
                            round: snapshot.round,
                            blueScore: snapshot.blueScore,
                            redScore: snapshot.redScore,
                            gameStartAt: snapshot.gameStartAt,

                            headerExpiresAt: snapshot.headerExpiresAt,

                            serverNow: getEstimatedServerNow(),
                        });

                        return;
                    }

                    /*
                        Mi smo refreshovali i dobili stanje
                        od protivnika.
                    */
                    if (msg.type === "ROOM_SYNC_RESPONSE") {
                        const freshJoinAwaitingStart = freshRedStillNeedsStartSync();

                        if (
                            !myRole ||
                            msg.role === myRole ||
                            (roomHydratedRef.current && !freshJoinAwaitingStart) ||
                            typeof msg.requestId !== "string" ||
                            msg.requestId !== roomSyncRequestIdRef.current ||
                            !isValidPosition(msg.gameIndex, msg.round)
                        ) {
                            return;
                        }

                        /*
                            BLUE refresh na samom transitionu:
                            ako smo prije refresha već canonicalno commitovali
                            novu gameIndex/round poziciju, RED smije završiti
                            peer-first recovery samo ako vraća ISTU poziciju.

                            Ako RED još nije primio NEXT_ROUND_SYNC, response je
                            stale. Ne prihvatamo ga i 2.2s Redis fallback vraća
                            već commitovan canonical progress.

                            Ovo zadržava 0 Redis readova kada je peer stvarno
                            usklađen, a koristi Redis samo na pravom race-u.
                        */
                        if (myRole === "blue" && expectedBluePositionRef.current) {
                            const expected = expectedBluePositionRef.current;

                            if (
                                !isValidPosition(msg.gameIndex, msg.round) ||
                                getPositionKey({
                                    gameIndex: msg.gameIndex,
                                    round: msg.round,
                                }) !== getPositionKey(expected)
                            ) {
                                return;
                            }
                        }

                        const freshJoinStillWaitingForStart =
                            entryKindRef.current === "fresh_red_join" && typeof msg.gameStartAt !== "number";

                        /*
                            Reconnect završava hydration čim dobije peer snapshot.

                            Fresh RED je poseban slučaj: BLUE može odgovoriti dok
                            canonical 5s start još nije kreiran. Tada NE gasimo
                            retry-e i NE proglašavamo room hydrated. UI i dalje
                            prikazuje normalni VS ekran, a handshake tiho nastavlja
                            dok ne dobijemo startsAt kroz response ili broadcast.
                        */
                        if (!freshJoinStillWaitingForStart) {
                            hasReceivedRoomSyncRef.current = true;
                            clearRoomSyncRetryTimers();

                            if (redisFallbackTimerRef.current) {
                                clearTimeout(redisFallbackTimerRef.current);
                                redisFallbackTimerRef.current = null;
                            }

                            roomHydratedRef.current = true;
                            setRoomHydrated(true);
                            setPreferPeerMiniGameSync(entryKindRef.current === "existing_participant");
                            roomSyncRequestIdRef.current = null;
                        }

                        roomSnapshotRef.current = {
                            gameIndex:
                                typeof msg.gameIndex === "number" ? msg.gameIndex : roomSnapshotRef.current.gameIndex,

                            round: typeof msg.round === "number" ? msg.round : roomSnapshotRef.current.round,

                            blueScore:
                                typeof msg.blueScore === "number" ? msg.blueScore : roomSnapshotRef.current.blueScore,

                            redScore:
                                typeof msg.redScore === "number" ? msg.redScore : roomSnapshotRef.current.redScore,

                            gameStartAt:
                                typeof msg.gameStartAt === "number"
                                    ? msg.gameStartAt
                                    : roomSnapshotRef.current.gameStartAt,

                            headerExpiresAt:
                                msg.headerExpiresAt === null || typeof msg.headerExpiresAt === "number"
                                    ? msg.headerExpiresAt
                                    : roomSnapshotRef.current.headerExpiresAt,
                        };

                        if (
                            myRole === "blue" &&
                            isValidPosition(roomSnapshotRef.current.gameIndex, roomSnapshotRef.current.round)
                        ) {
                            rememberExpectedBluePosition(
                                roomSnapshotRef.current.gameIndex,
                                roomSnapshotRef.current.round
                            );
                        }

                        if (typeof msg.serverNow === "number") {
                            serverTimeOffsetRef.current = msg.serverNow - Date.now();
                        }

                        if (typeof msg.gameIndex === "number") {
                            setGameIndex(msg.gameIndex);
                        }

                        if (typeof msg.round === "number") {
                            setRound(msg.round);
                        }

                        if (typeof msg.blueScore === "number") {
                            setLocalScoreBlue(msg.blueScore);
                        }

                        if (typeof msg.redScore === "number") {
                            setLocalScoreRed(msg.redScore);
                        }

                        if (typeof msg.gameStartAt === "number") {
                            roomSnapshotRef.current.gameStartAt = msg.gameStartAt;

                            setGameStartAt(msg.gameStartAt);
                            setPreGameCountdown(
                                Math.max(0, Math.ceil((msg.gameStartAt - getEstimatedServerNow()) / 1000))
                            );
                        }

                        if (msg.headerExpiresAt === null || typeof msg.headerExpiresAt === "number") {
                            roomSnapshotRef.current.headerExpiresAt = msg.headerExpiresAt;

                            setHeaderExpiresAt(msg.headerExpiresAt);
                        }

                        if (!freshJoinStillWaitingForStart) {
                            setMiniGameSyncEpoch((epoch) => epoch + 1);
                        }

                        /*
                            Ako je protivnik pitao NAS dok smo i mi još bili
                            unhydrated, sada već imamo canonical snapshot.
                            Odgovori odmah; peer možda više nema zakazan retry.
                        */
                        const pendingRequest = pendingPeerRoomSyncRequestRef.current;

                        if (pendingRequest && pendingRequest.role !== myRole) {
                            pendingPeerRoomSyncRequestRef.current = null;
                            const snapshot = roomSnapshotRef.current;

                            void sendThroughChannel({
                                type: "ROOM_SYNC_RESPONSE",
                                role: myRole,
                                requestId: pendingRequest.requestId,
                                gameIndex: snapshot.gameIndex,
                                round: snapshot.round,
                                blueScore: snapshot.blueScore,
                                redScore: snapshot.redScore,
                                gameStartAt: snapshot.gameStartAt,
                                headerExpiresAt: snapshot.headerExpiresAt,
                                serverNow: getEstimatedServerNow(),
                            });
                        }

                        return;
                    }
                }
            );

        channel.subscribe((status) => {
            if (status !== "SUBSCRIBED") {
                if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    setIsConnected(false);
                }

                return;
            }

            setIsConnected(true);
            setMiniGameSyncEpoch((epoch) => epoch + 1);

            /*
                Novi transport/session dobija grace da stari Presence entry
                nestane i novi peer stigne trackovati bez lažnog disconnecta.
            */
            presenceStartupGraceUntilRef.current = Date.now() + 3_000;
            presenceAbsenceStartedAtRef.current = null;

            void channel
                .track({
                    role: myRole,
                    connectedAt: new Date().toISOString(),
                })
                .catch((trackError) => {
                    console.error("Presence track failed:", trackError);
                });

            /*
                Pri POVRATKU u već aktivnu partiju eksplicitno pokrećemo
                Presence provjeru. Ne oslanjamo se samo na to da će još jedan
                presence sync event sigurno stići nakon našeg subscribe-a.

                handlePresenceSync i dalje koristi postojeći 3s startup grace,
                pa spor reconnect protivnika neće odmah napraviti lažni claim.
            */
            if (requiresInitialOpponentPresenceCheckRef.current) {
                const initialPresenceProbe = setTimeout(handlePresenceSync, 50);
                resumeRefreshTimers.push(initialPresenceProbe);
            }

            /*
                In-progress refresh: oba role-a prvo pitaju živog protivnika.
                Ako je BLUE refreshao, RED mu vraća in-memory state i nema
                Redis HGETALL komande. Ako su oba refresala, RED ne može
                odgovoriti jer još nije hidratovan; BLUE nakon kratkog timeouta
                radi jedini Redis fallback i zatim postaje source za RED-a.
            */
            if (needsRoomSync()) {
                hasReceivedRoomSyncRef.current = false;
                clearRoomSyncRetryTimers();

                /*
                    Novi SUBSCRIBED/reconnect = novi handshake generation.
                    Zakašnjeli response sa starog requestId-a se ignoriše.
                */
                roomSyncRequestIdRef.current = `${Date.now()}-${myRole}-${Math.random().toString(36).slice(2)}`;

                sendRoomSyncRequest();

                const retry350 = setTimeout(sendRoomSyncRequest, 350);
                const retry800 = setTimeout(sendRoomSyncRequest, 800);
                const retry1500 = setTimeout(sendRoomSyncRequest, 1_500);
                const retry3000 = setTimeout(sendRoomSyncRequest, 3_000);
                const retry5000 = setTimeout(sendRoomSyncRequest, 5_000);
                const retry8000 = setTimeout(sendRoomSyncRequest, 8_000);

                roomSyncRetryTimersRef.current = [retry350, retry800, retry1500, retry3000, retry5000, retry8000];

                if (myRole === "blue") {
                    if (redisFallbackTimerRef.current) {
                        clearTimeout(redisFallbackTimerRef.current);
                    }

                    redisFallbackTimerRef.current = setTimeout(() => {
                        redisFallbackTimerRef.current = null;
                        if (!roomHydratedRef.current) {
                            void restoreBlueFromRedisFallback();
                        }
                    }, 2_200);
                }
            }
        });

        return () => {
            clearRoomSyncRetryTimers();
            clearTransitionBroadcastTimers();
            resumeRefreshTimers.forEach((timer) => clearTimeout(timer));

            if (redisFallbackTimerRef.current) {
                clearTimeout(redisFallbackTimerRef.current);
                redisFallbackTimerRef.current = null;
            }

            if (presenceInitialCheckTimerRef.current) {
                clearTimeout(presenceInitialCheckTimerRef.current);
                presenceInitialCheckTimerRef.current = null;
            }

            presenceHasSeenOpponentRef.current = false;
            presenceStartupGraceUntilRef.current = 0;
            presenceAbsenceStartedAtRef.current = null;
            roomSyncRequestIdRef.current = null;
            pendingPeerRoomSyncRequestRef.current = null;

            hasReceivedRoomSyncRef.current = false;

            miniGameBroadcastQueueRef.current = [];
            miniGameBroadcastDeliveryRef.current = false;

            if (channelRef.current === channel) {
                channelRef.current = null;
            }

            setIsConnected(false);
            supabase.removeChannel(channel);
        };
    }, [roomId, myRole]);

    /*
        Ako smo mi označeni kao disconnected, to znači da smo se upravo
        reconnectovali. Authenticated SQL RPC smije poništiti samo claim
        protiv vlastitog user id-a i samo prije server deadline-a.
    */
    useEffect(() => {
        if (
            !myRole ||
            roomData?.status !== "in_progress" ||
            !roomData?.disconnected_player_id ||
            !roomData?.disconnect_deadline
        ) {
            if (disconnectCancelFallbackTimerRef.current) {
                clearTimeout(disconnectCancelFallbackTimerRef.current);
                disconnectCancelFallbackTimerRef.current = null;
            }
            return;
        }

        const myPlayerId = myRole === "blue" ? roomData.player_blue_id : roomData.player_red_id;

        if (roomData.disconnected_player_id !== myPlayerId) {
            return;
        }

        /*
            Važan ordering: prvo uzmemo room + trenutni mini-game snapshot
            od živog protivnika, TEK ONDA poništimo disconnect claim.

            Tako se server pause-duration primjenjuje na frozen peer snapshot,
            pa ne postoji race gdje se resume desi prije mini-game synca.
        */
        if (!roomHydratedRef.current) return;

        const activeMiniGameNeedsPeerRecovery =
            gameIndex >= 0 && gameIndex <= 5 && gameStartAt !== null && preGameCountdown <= 0;

        if (activeMiniGameNeedsPeerRecovery && preferPeerMiniGameSync) {
            /*
                Normalno čekamo mini-game peer sync prije resume-a. Ako se
                callback iz nekog razloga izgubi, ne smijemo ostaviti meč
                zauvijek zamrznut. Nakon 3.5s nastavljamo sa room-level
                canonical stateom i cancel RPC-om.
            */
            if (!disconnectCancelFallbackTimerRef.current) {
                disconnectCancelFallbackTimerRef.current = setTimeout(() => {
                    disconnectCancelFallbackTimerRef.current = null;
                    setPreferPeerMiniGameSync(false);
                }, 3_500);
            }

            return;
        }

        if (disconnectCancelFallbackTimerRef.current) {
            clearTimeout(disconnectCancelFallbackTimerRef.current);
            disconnectCancelFallbackTimerRef.current = null;
        }

        if (disconnectCancelRequestRef.current) return;

        disconnectCancelRequestRef.current = true;

        void cancelMyDisconnectClaimAction(roomId)
            .then(async (result) => {
                if (result?.error) {
                    console.error("Could not cancel my disconnect claim:", result.error);
                    return;
                }

                /*
                    Ne čekamo da vlastiti websocket ponovo primi UPDATE koji
                    je upravo izazvao ovaj RPC. RPC rezultat je već
                    authoritative, pa odmah lokalno očistimo pause/claim.
                    pause_version sprečava duplo pomjeranje timestampova ako
                    postgres UPDATE kasnije ipak stigne.
                */
                if (result?.cancelled) {
                    setRoomData((previous: any) => {
                        if (!previous) return previous;

                        return {
                            ...previous,
                            disconnected_player_id: null,
                            disconnect_claimed_by: null,
                            disconnect_started_at: null,
                            disconnect_deadline: null,
                            pause_version: Number(result.pauseVersion ?? previous.pause_version ?? 0),
                            last_pause_duration_ms: Number(result.pausedMs ?? 0),
                            last_resumed_at: result.serverNow ?? new Date().toISOString(),
                        };
                    });

                    setDisconnectSecondsLeft(null);
                    setPreferPeerMiniGameSync(false);
                    return;
                }

                /*
                    cancelled=false može značiti da je claim već očišćen drugim
                    authoritative putem, ali je ovaj browser ostao na stale rowu.
                    Jedan read odmah uskladi lokalni UI umjesto da ostane frozen.
                */
                const { data: freshResumeState } = await supabase
                    .from("game_rooms")
                    .select(
                        `
                        disconnected_player_id,
                        disconnect_claimed_by,
                        disconnect_started_at,
                        disconnect_deadline,
                        pause_version,
                        last_pause_duration_ms,
                        last_resumed_at
                    `
                    )
                    .eq("id", roomId)
                    .single();

                if (freshResumeState) {
                    setRoomData((previous: any) =>
                        previous
                            ? {
                                  ...previous,
                                  ...freshResumeState,
                              }
                            : previous
                    );

                    if (!freshResumeState.disconnect_deadline) {
                        setDisconnectSecondsLeft(null);
                        setPreferPeerMiniGameSync(false);
                    }
                }
            })
            .catch((cancelError) => {
                console.error("Could not cancel my disconnect claim:", cancelError);
            })
            .finally(() => {
                disconnectCancelRequestRef.current = false;
            });
    }, [
        roomId,
        myRole,
        roomData?.status,
        roomData?.disconnected_player_id,
        roomData?.disconnect_deadline,
        roomData?.player_blue_id,
        roomData?.player_red_id,
        roomHydrated,
        gameIndex,
        gameStartAt,
        preGameCountdown,
        preferPeerMiniGameSync,
    ]);

    /*
        GAME PAUSE / RESUME

        disconnect_started_at je authoritative pause start. SQL cancel RPC
        povećava pause_version i zapisuje tačan last_pause_duration_ms.
        Svaki browser pomjeri svoje apsolutne room-level timestampove tačno
        jednom po pause_version-u. Mini-igre dobijaju isti shift kroz props.
    */
    useEffect(() => {
        if (!roomData) return;

        const version = Number(roomData.pause_version ?? 0);

        if (lastAppliedPauseVersionRef.current === null) {
            lastAppliedPauseVersionRef.current = version;
            return;
        }

        if (version <= lastAppliedPauseVersionRef.current) {
            return;
        }

        lastAppliedPauseVersionRef.current = version;

        const shiftMs = Number(roomData.last_pause_duration_ms ?? 0);
        if (!Number.isFinite(shiftMs) || shiftMs <= 0) return;

        const snapshot = roomSnapshotRef.current;
        const resumeNow = getEstimatedServerNow();
        const pauseStartedAt = resumeNow - shiftMs;

        /*
            Pauza vraća samo vrijeme koje je stvarno bilo PREOSTALO kada je
            disconnect počeo, ali nikad ne smije napraviti timer duži od
            njegovog normalnog maksimuma.

            Ovo posebno zatvara race:
            nova runda napravi fresh 60s deadline, a tek render kasnije stigne
            pause_version. Staro `deadline + pausedMs` bi tada dalo 68s.
        */
        const shiftActiveDeadline = (deadline: number | null, maxDurationMs: number) => {
            if (typeof deadline !== "number" || deadline <= pauseStartedAt) {
                return deadline;
            }

            /*
                Ako deadline - pauseStartedAt prelazi normalni maksimum,
                taj timer nije postojao kada je pauza počela. Kreiran je
                tokom/poslije resume-a (tipičan race na prelazu runde) i
                na njega NE smijemo dodati staru pauzu.

                Primjer: pause 8s, nova Rec runda napravi 60s timer.
                deadline - pauseStartedAt ~= 68s > 60s -> ostaje 60s.
            */
            const remainingWhenPauseStarted = deadline - pauseStartedAt;

            if (remainingWhenPauseStarted > maxDurationMs + 250) {
                return deadline;
            }

            return Math.min(deadline + shiftMs, resumeNow + maxDurationMs);
        };

        const shiftedGameStartAt = shiftActiveDeadline(snapshot.gameStartAt, 5_000);

        /*
            Header prati child timer. Najduža gameplay faza je 60s, pa ga
            room-level fallback nikad ne smije prikazati iznad 60s.
            Child odmah zatim šalje precizniji phase-specific timeLeft.
        */
        const shiftedHeaderExpiresAt = shiftActiveDeadline(snapshot.headerExpiresAt, 60_000);

        roomSnapshotRef.current = {
            ...snapshot,
            gameStartAt: shiftedGameStartAt,
            headerExpiresAt: shiftedHeaderExpiresAt,
        };

        setGameStartAt(shiftedGameStartAt);
        setHeaderExpiresAt(shiftedHeaderExpiresAt);

        /*
            Jedan Redis write samo na stvarnom resume-u, i samo BLUE.
            Ovo čuva shifted room timer za simultaneous-refresh fallback.
        */
        if (myRole === "blue" && roomHydratedRef.current) {
            void saveGameProgressAction(roomId, {
                gameIndex: snapshot.gameIndex,
                round: snapshot.round,
                blueScore: snapshot.blueScore,
                redScore: snapshot.redScore,
                gameStartAt: shiftedGameStartAt,
                headerExpiresAt: shiftedHeaderExpiresAt,
            }).catch((pausePersistError) => {
                console.error("Could not persist resumed room timers:", pausePersistError);
            });
        }
    }, [roomId, myRole, roomData?.pause_version, roomData?.last_pause_duration_ms]);

    /* Client timer is display-only. Database clock is authoritative. */
    useEffect(() => {
        const deadline = roomData?.disconnect_deadline;

        if (roomData?.status !== "in_progress" || !deadline) {
            setDisconnectSecondsLeft(null);
            disconnectFinalizeRequestRef.current = false;
            return;
        }

        const deadlineMs = new Date(deadline).getTime();

        if (!Number.isFinite(deadlineMs)) {
            setDisconnectSecondsLeft(null);
            return;
        }

        const tick = () => {
            const seconds = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));

            setDisconnectSecondsLeft(seconds);

            if (seconds > 0 || disconnectFinalizeRequestRef.current) {
                return;
            }

            const myPlayerId = myRole === "blue" ? roomData?.player_blue_id : roomData?.player_red_id;

            if (!myPlayerId || roomData?.disconnected_player_id === myPlayerId) {
                return;
            }

            disconnectFinalizeRequestRef.current = true;

            void finalizeDisconnectGameAction(roomId)
                .then((result) => {
                    if (result?.result) {
                        setFinalResult(result.result);
                    } else if (result?.error) {
                        console.error("Disconnect finalization failed:", result.error);
                        disconnectFinalizeRequestRef.current = false;
                    }
                })
                .catch((finalizeError) => {
                    console.error("Disconnect finalization failed:", finalizeError);
                    disconnectFinalizeRequestRef.current = false;
                });
        };

        tick();
        const timer = setInterval(tick, 500);
        return () => clearInterval(timer);
    }, [
        roomId,
        myRole,
        roomData?.status,
        roomData?.disconnect_deadline,
        roomData?.disconnected_player_id,
        roomData?.player_blue_id,
        roomData?.player_red_id,
    ]);

    /*
        Normalan kraj finalizira samo BLUE, jednom. Server action čita score
        iz canonical Redis statea; browser ne šalje score niti XP.
    */
    useEffect(() => {
        if (gameIndex !== 6 || myRole !== "blue" || finalResult || normalFinalizeRequestRef.current) {
            return;
        }

        normalFinalizeRequestRef.current = true;

        void finalizeNormalGameAction(roomId)
            .then((result) => {
                if (result?.result) {
                    setFinalResult(result.result);
                } else if (result?.error) {
                    console.error("Normal game finalization failed:", result.error);
                    normalFinalizeRequestRef.current = false;
                }
            })
            .catch((finalizeError) => {
                console.error("Normal game finalization failed:", finalizeError);
                normalFinalizeRequestRef.current = false;
            });
    }, [roomId, gameIndex, myRole, finalResult]);

    useEffect(() => {
        if (!roomData || roomData.status !== "waiting" || getProfileUsername(roomData?.profiles_red)) {
            return;
        }

        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        const timer = setInterval(() => {
            setRollingLetter(letters[Math.floor(Math.random() * letters.length)]);
        }, 220);

        return () => clearInterval(timer);
    }, [roomData?.status, getProfileUsername(roomData?.profiles_red)]);

    useEffect(() => {
        /*
            Start ne smije zavisiti od profile join-a/username-a.
            player_red_id + in_progress su authoritative membership podaci.
            Profile relation može stići render kasnije bez razloga da blokira
            canonical 5s start.
        */
        const redPlayerId = roomData?.player_red_id;

        if (
            myRole !== "blue" ||
            !isConnected ||
            !roomHydrated ||
            !!roomData?.disconnect_started_at ||
            roomData?.status !== "in_progress" ||
            !redPlayerId ||
            gameStartAt !== null ||
            gameStartCreationRef.current
        ) {
            return;
        }

        let cancelled = false;
        gameStartCreationRef.current = true;

        async function createStart() {
            let created = false;

            try {
                const requestStartedAt = Date.now();

                const saved = await saveGameProgressAction(roomId, {
                    gameIndex: roomSnapshotRef.current.gameIndex,

                    round: roomSnapshotRef.current.round,

                    blueScore: roomSnapshotRef.current.blueScore,

                    redScore: roomSnapshotRef.current.redScore,

                    gameStartDelayMs: 5_000,
                });

                const requestFinishedAt = Date.now();

                if (cancelled) return;

                calibrateServerClock(requestStartedAt, requestFinishedAt, saved.serverNow);

                if (typeof saved.gameStartAt !== "number") {
                    return;
                }

                const startsAt = saved.gameStartAt;

                created = true;

                rememberExpectedBluePosition(roomSnapshotRef.current.gameIndex, roomSnapshotRef.current.round);

                roomSnapshotRef.current.gameStartAt = startsAt;

                setGameStartAt(startsAt);

                void sendBroadcast({
                    type: "ROOM_GAME_START",

                    role: "blue",

                    startsAt,

                    serverNow: saved.serverNow,
                }).catch((startBroadcastError) => {
                    console.error("ROOM_GAME_START broadcast failed:", startBroadcastError);
                });

                /*
                    Ako je fresh RED već pitao za room state dok gameStartAt
                    još nije postojao, ne čekamo njegov naredni retry.
                    Odmah mu vraćamo snapshot sa canonical startsAt.
                */
                const pendingRequest = pendingPeerRoomSyncRequestRef.current;

                if (pendingRequest && pendingRequest.role === "red") {
                    pendingPeerRoomSyncRequestRef.current = null;

                    const snapshot = roomSnapshotRef.current;

                    void sendBroadcast({
                        type: "ROOM_SYNC_RESPONSE",
                        role: "blue",
                        requestId: pendingRequest.requestId,
                        gameIndex: snapshot.gameIndex,
                        round: snapshot.round,
                        blueScore: snapshot.blueScore,
                        redScore: snapshot.redScore,
                        gameStartAt: startsAt,
                        headerExpiresAt: snapshot.headerExpiresAt,
                        serverNow: saved.serverNow,
                    }).catch((syncError) => {
                        console.error("Fresh RED start sync failed:", syncError);
                    });
                }
            } catch (startError) {
                console.error("Canonical start fallback failed:", startError);
            } finally {
                /*
                    Na uspjehu state uskoro dobija gameStartAt pa novi start
                    više nije moguć. Na grešci dozvoljavamo kontrolisani retry
                    pri sljedećem relevantnom rerenderu/reconnectu.
                */
                if (!created) {
                    gameStartCreationRef.current = false;
                }
            }
        }

        void createStart();

        return () => {
            cancelled = true;
        };
    }, [
        roomData?.status,
        roomData?.player_red_id,
        gameStartAt,
        myRole,
        roomId,
        roomHydrated,
        roomData?.disconnect_started_at,
        isConnected,
    ]);

    useEffect(() => {
        if (!gameStartAt || roomData?.disconnect_started_at) return;

        const tick = () => {
            const left = Math.max(0, Math.ceil((gameStartAt - getEstimatedServerNow()) / 1000));

            setPreGameCountdown(left);
        };

        tick();

        const timer = setInterval(tick, 100);

        return () => clearInterval(timer);
    }, [gameStartAt, roomData?.disconnect_started_at]);

    /*
        HEADER uvijek renderuje iz APSOLUTNOG timestamp-a.
    */
    useEffect(() => {
        if (!headerExpiresAt) {
            setCurrentHeaderTime(0);
            return;
        }

        if (roomData?.disconnect_started_at) {
            return;
        }

        const tick = () => {
            setCurrentHeaderTime(Math.max(0, Math.ceil((headerExpiresAt - getEstimatedServerNow()) / 1000)));
        };

        tick();

        const timer = setInterval(tick, 250);

        return () => clearInterval(timer);
    }, [headerExpiresAt, roomData?.disconnect_started_at]);

    const sendBroadcast = async (payload: any) => {
        const channel = channelRef.current;

        if (!channel) {
            return;
        }

        await channel.send({
            type: "broadcast",
            event: "GAME_STATE",
            payload,
        });
    };

    function persistRoomProgress(progress: Parameters<typeof saveGameProgressAction>[1]) {
        /*
            Client-side check = optimization.
            Server capability = actual security.
        */
        if (myRole !== "blue") {
            return;
        }

        void saveGameProgressAction(roomId, progress).catch((error) => {
            console.error("Room progress save failed:", error);
        });
    }

    function handleHeaderTimerTick(timeLeft: number) {
        /*
            RED nikada ne komunicira sa Redis/server actionom.
        */
        if (myRole !== "blue") {
            return;
        }

        const durationMs = Math.max(0, timeLeft) * 1000;

        const candidateExpiresAt = getEstimatedServerNow() + durationMs;

        const currentExpiresAt = roomSnapshotRef.current.headerExpiresAt;

        /*
            Dok isti timer ide 60,59,58...
            candidate ostaje ~isti timestamp.

            Novi request pravimo samo kad mini-game
            zaista pokrene NOVU timer fazu.
        */
        const needsNewTimestamp = !currentExpiresAt || Math.abs(candidateExpiresAt - currentExpiresAt) > 1_500;

        if (!needsNewTimestamp || headerTimerRequestRef.current) {
            return;
        }

        headerTimerRequestRef.current = true;

        void (async () => {
            try {
                const requestStartedAt = Date.now();

                const saved = await saveGameProgressAction(roomId, {
                    headerDurationMs: durationMs,
                });

                const requestFinishedAt = Date.now();

                calibrateServerClock(requestStartedAt, requestFinishedAt, saved.serverNow);

                if (typeof saved.headerExpiresAt !== "number") {
                    return;
                }

                const expiresAt = saved.headerExpiresAt;

                roomSnapshotRef.current.headerExpiresAt = expiresAt;

                setHeaderExpiresAt(expiresAt);

                sendBroadcast({
                    type: "ROOM_HEADER_TIMER_SYNC",

                    role: "blue",

                    expiresAt,

                    serverNow: saved.serverNow,
                });
            } catch (timerError) {
                console.error("Header timestamp save failed:", timerError);
            } finally {
                headerTimerRequestRef.current = false;
            }
        })();
    }

    function persistMiniGameState(
        game: "skocko" | "ko_zna_zna" | "spojnice" | "asocijacije",
        snapshotRound: number,
        event: string,
        state: Record<string, unknown>
    ) {
        if (myRole !== "blue") {
            return;
        }

        /*
            onScoreSubmit() ažurira roomSnapshotRef sinhrono,
            pa snapshot write može u ISTOM requestu sačuvati
            i najnoviji globalni score.
        */
        const roomProgress = roomSnapshotRef.current;

        miniGameSaveQueueRef.current = miniGameSaveQueueRef.current
            .then(async () => {
                await saveGameSnapshotAction({
                    roomId,
                    game,
                    round: snapshotRound,
                    event,
                    state,
                    progress: {
                        gameIndex: roomProgress.gameIndex,
                        round: roomProgress.round,
                        blueScore: roomProgress.blueScore,
                        redScore: roomProgress.redScore,
                    },
                });
            })
            .catch((error) => {
                console.error(`${game} snapshot save failed:`, error);
            });
    }

    async function handleNextRound(forcedRound?: number, forcedGameIndex?: number) {
        /*
            Samo BLUE je room transition authority.
            Mini-gameovi već zovu onNextRound samo sa BLUE strane,
            ali ovaj guard drži parent siguran i ako callback ikad
            slučajno stigne sa RED-a.
        */
        if (myRole !== "blue" || transitionInFlightRef.current) {
            return;
        }

        const currentSnapshot = roomSnapshotRef.current;

        const activeGameIndex = forcedGameIndex ?? currentSnapshot.gameIndex;

        const activeRound = forcedRound ?? currentSnapshot.round;

        /*
            Callback dolazi iz mini-game rendera za TAČNO određenu
            gameIndex/round poziciju. Ako je taj component već postao stale
            nakon prethodnog transitiona, njegov drugi callback ne smije
            preskočiti još jednu rundu.
        */
        if (currentSnapshot.gameIndex !== activeGameIndex || currentSnapshot.round !== activeRound) {
            return;
        }

        let nextGameIndex = activeGameIndex;

        let nextRound = 1;

        /*
            Ko Zna Zna ima samo jedan set od 10 pitanja.
        */
        if (activeGameIndex === 3) {
            nextGameIndex = 4;
            nextRound = 1;
        } else if (activeRound === 1) {
            nextGameIndex = activeGameIndex;
            nextRound = 2;
        } else {
            nextGameIndex = activeGameIndex + 1;
            nextRound = 1;
        }

        if (!isValidPosition(nextGameIndex, nextRound)) {
            return;
        }

        transitionInFlightRef.current = true;

        try {
            /*
                KRITIČNO ZA REFRESH NA PRELAZU:

                Prvo čekamo sve starije mini-game Redis writeove.
                Inače bi spor `round_result` write mogao završiti NAKON
                ovog transition writea i vratiti Redis progress na staru
                rundu/gameIndex.
            */
            await miniGameSaveQueueRef.current;

            /*
                Transition je prvo canonicalno commitovan u Redis.

                Tek KADA OVAJ await uspije mijenjamo lokalni React state.
                Zato hard refresh više ne može uhvatiti UI na novoj rundi
                dok persistent state još pokazuje staru.
            */
            let savedTransition: Awaited<ReturnType<typeof saveGameProgressAction>> | null = null;

            let lastTransitionError: unknown = null;

            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    savedTransition = await saveGameProgressAction(roomId, {
                        gameIndex: nextGameIndex,
                        round: nextRound,
                        blueScore: roomSnapshotRef.current.blueScore,
                        redScore: roomSnapshotRef.current.redScore,
                        headerExpiresAt: null,
                    });

                    break;
                } catch (transitionError) {
                    lastTransitionError = transitionError;

                    if (attempt < 2) {
                        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 200 : 500));
                    }
                }
            }

            if (!savedTransition) {
                throw lastTransitionError ?? new Error("Transition save failed");
            }

            /*
                Od ovog momenta je nova pozicija canonicalna.
                Spremimo je lokalno PRIJE React state updatea.
                Ako korisnik sad pritisne refresh, novi BLUE zna koju
                poziciju mora dobiti od RED-a; stale peer se odbija.
            */
            rememberExpectedBluePosition(nextGameIndex, nextRound);

            roomSnapshotRef.current = {
                ...roomSnapshotRef.current,
                gameIndex: nextGameIndex,
                round: nextRound,
                headerExpiresAt: null,
            };

            setGameIndex(nextGameIndex);
            setRound(nextRound);
            setHeaderExpiresAt(null);

            const transitionPayload = {
                type: "NEXT_ROUND_SYNC",
                role: "blue" as const,
                nextRound,
                nextGameIndex,
                serverNow: savedTransition.serverNow,
            };

            /*
                Prvi broadcast čekamo (channel je sa ack:true).
                Zatim dva jeftina Realtime retry-a pokriju kratki
                subscribe/reconnect race. Duplicate je harmless jer
                receiver odbija svaki transition koji bi išao unazad.
            */
            await sendBroadcast(transitionPayload);

            clearTransitionBroadcastTimers();

            const retry200 = setTimeout(() => {
                const current = roomSnapshotRef.current;

                if (current.gameIndex === nextGameIndex && current.round === nextRound) {
                    void sendBroadcast(transitionPayload);
                }
            }, 200);

            const retry700 = setTimeout(() => {
                const current = roomSnapshotRef.current;

                if (current.gameIndex === nextGameIndex && current.round === nextRound) {
                    void sendBroadcast(transitionPayload);
                }
            }, 700);

            transitionBroadcastTimersRef.current = [retry200, retry700];
        } catch (transitionError) {
            /*
                Ne prelazimo lokalno ako Redis commit nije potvrđen.
                Tako refresh nikad ne može učiniti novu rundu "fantomskom".
            */
            console.error("Could not commit next round/game transition:", transitionError);
        } finally {
            transitionInFlightRef.current = false;
        }
    }

    const handleScoreSubmit = (bluePts: number, redPts: number) => {
        const nextBlue = roomSnapshotRef.current.blueScore + bluePts;

        const nextRed = roomSnapshotRef.current.redScore + redPts;

        roomSnapshotRef.current = {
            ...roomSnapshotRef.current,
            blueScore: nextBlue,
            redScore: nextRed,
        };

        setLocalScoreBlue(nextBlue);

        setLocalScoreRed(nextRed);

        /*
            NEMA Redis requesta ovdje.

            Score ostaje odmah u canonical roomSnapshotRef-u,
            a zajedno sa round/game transitionom se spremi
            u jednom server action requestu.
        */
    };

    const handleLeaveGame = () => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);

            channelRef.current = null;
        }

        router.push("/home");
    };

    const blueUsername = getProfileUsername(roomData?.profiles_blue) || "Plavi";

    const redUsername = getProfileUsername(roomData?.profiles_red);

    const blueInitial = blueUsername.charAt(0).toUpperCase();

    const redInitial = redUsername ? redUsername.charAt(0).toUpperCase() : rollingLetter;

    const opponentMatched = roomData?.status === "in_progress" && !!roomData?.player_red_id;

    /*
        VAŽNO: Presence i gameplay hydration su dvije odvojene stvari.

        Presence služi samo da utvrdi disconnect i aktivira pause/forfeit.
        Ne smije gasiti/unmountati mini-game tree, jer bi tada stabilni peer
        izgubio svoj in-memory snapshot baš kada se drugi igrač reconnectuje.

        Fresh RED: nakon canonical 5s starta odmah mounta trenutnu igru i
        mini-game komponenta povlači BLUE snapshot preko broadcasta.

        Existing participant: prvo room-level peer recovery (BLUE -> RED ili
        RED -> BLUE; BLUE ima Redis fallback), pa tek onda mount igre.
    */
    const matchStartReady = opponentMatched && gameStartAt !== null && preGameCountdown <= 0;

    const gameReady = entryKind === "fresh_red_join" ? matchStartReady : roomHydrated && matchStartReady;

    const showRoomRecovery =
        !roomHydrated && roomData?.status === "in_progress" && entryKind === "existing_participant";

    if (loading) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />

                    <p className="secondary-text">Učitavanje igre...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-background px-4">
                <div className="flex max-w-xs flex-col items-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                        <ShieldAlert className="h-5 w-5" />
                    </div>

                    <p className="card-title text-red-400">{error}</p>
                </div>
                <Link
                    href="/home"
                    className="mt-6 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                    Nazad na početnu
                </Link>
            </div>
        );
    }

    if (roomData.status === "deleted") {
        setTimeout(() => {
            redirect("/home");
        }, 3000);

        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
                <div className="flex max-w-xs flex-col items-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                        <ShieldAlert className="h-5 w-5" />
                    </div>

                    <p className="card-title">Igrač je odbio poziv.</p>

                    <p className="secondary-text mt-1.5">Povratak na početnu stranicu...</p>
                </div>
            </div>
        );
    }

    const gameNames = ["Slagalica", "Moj Broj", "Skocko", "Ko Zna Zna", "Spojnice", "Asocijacije", "Rezultati"];

    return (
        <div className="page-container flex min-h-[100dvh] flex-col bg-background py-4 text-text">
            {/* HEADER */}
            <GameHeader
                role={myRole}
                player1Score={localScoreBlue}
                player2Score={localScoreRed}
                timeLeft={currentHeaderTime}
                isSubmitted={false}
                blueName={blueUsername}
                redName={redUsername ?? undefined}
            />

            {/* GAME AREA */}
            <main className="flex w-full flex-1 items-center justify-center py-6">
                {finalResult ? (
                    myRole ? (
                        <EndScreen
                            myRole={myRole}
                            result={finalResult}
                            blueName={blueUsername}
                            redName={redUsername || "Crveni"}
                            onLeave={handleLeaveGame}
                        />
                    ) : null
                ) : showRoomRecovery ? (
                    <div className="card-base card-padding flex w-full flex-col items-center justify-center gap-3 text-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div>
                            <p className="card-title">Vraćam partiju...</p>
                            <p className="secondary-text mt-1">Pokušavam prvo direktan sync sa protivnikom.</p>
                        </div>
                    </div>
                ) : !gameReady ? (
                    <div className="card-base card-padding flex w-full flex-col items-center">
                        {/* PLAYERS */}
                        <div className="flex w-full items-center justify-center gap-5">
                            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-2xl font-black text-blue-400">
                                    {blueInitial}
                                </div>

                                <span className="w-full truncate text-center text-xs font-black text-text">
                                    {blueUsername}
                                </span>
                            </div>

                            <span className="shrink-0 text-xs font-black text-text-muted">VS</span>

                            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
                                    <span
                                        key={redInitial}
                                        className="animate-in fade-in slide-in-from-top-2 text-2xl font-black duration-200"
                                    >
                                        {redInitial}
                                    </span>
                                </div>

                                <span className="w-full truncate text-center text-xs font-black text-text">
                                    {redUsername || "Tražimo igrača..."}
                                </span>
                            </div>
                        </div>

                        {/* STATUS */}
                        <div className="mt-8 flex min-h-24 items-center justify-center">
                            {!opponentMatched ? (
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />

                                    <div>
                                        <p className="card-title">Tražimo protivnika</p>

                                        <p className="secondary-text mt-1">Čekamo drugog igrača da uđe u partiju.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-center animate-in fade-in">
                                    <p className="eyebrow">Protivnik pronađen</p>

                                    <div className="mt-3 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-2xl font-black tabular-nums text-primary">
                                        {preGameCountdown}
                                    </div>

                                    <p className="secondary-text mt-3">Igra počinje za {preGameCountdown}s</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex w-full flex-col items-center justify-center">
                        {/* GAME LABEL */}
                        <div className="mb-5 flex items-center justify-center">
                            <span className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-text-secondary">
                                {gameNames[gameIndex] ?? ""}

                                {gameIndex !== 6 && gameIndex !== 3 && ` / Runda ${round} / 2`}
                            </span>
                        </div>

                        {/* GAME */}
                        <div className="flex w-full items-center justify-center">
                            {gameIndex === 0 && myRole && gameState?.rec && (
                                <PronadjiRec
                                    roomId={roomId}
                                    myRole={myRole}
                                    syncEpoch={miniGameSyncEpoch}
                                    preferPeerSync={preferPeerMiniGameSync}
                                    isPaused={!!roomData?.disconnect_started_at}
                                    pauseVersion={Number(roomData?.pause_version ?? 0)}
                                    resumeShiftMs={Number(roomData?.last_pause_duration_ms ?? 0)}
                                    onPeerSyncComplete={() => setPreferPeerMiniGameSync(false)}
                                    round={round}
                                    tiles={round === 1 ? gameState.rec.runda_1 : gameState.rec.runda_2}
                                    initialState={restoredGameSnapshots?.rec?.[`r${round}`]?.state ?? null}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={handleScoreSubmit}
                                    onNextRound={() => void handleNextRound(round, gameIndex)}
                                    onTimerTick={handleHeaderTimerTick}
                                />
                            )}

                            {gameIndex === 1 && myRole && gameState?.broj && (
                                <MojBroj
                                    roomId={roomId}
                                    myRole={myRole}
                                    syncEpoch={miniGameSyncEpoch}
                                    preferPeerSync={preferPeerMiniGameSync}
                                    isPaused={!!roomData?.disconnect_started_at}
                                    pauseVersion={Number(roomData?.pause_version ?? 0)}
                                    resumeShiftMs={Number(roomData?.last_pause_duration_ms ?? 0)}
                                    onPeerSyncComplete={() => setPreferPeerMiniGameSync(false)}
                                    round={round}
                                    data={round === 1 ? gameState.broj.runda_1 : gameState.broj.runda_2}
                                    initialState={restoredGameSnapshots?.broj?.[`r${round}`]?.state ?? null}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={handleScoreSubmit}
                                    onNextRound={() => void handleNextRound(round, gameIndex)}
                                    onTimerTick={handleHeaderTimerTick}
                                />
                            )}

                            {gameIndex === 2 && myRole && gameState?.skocko && (
                                <Skocko
                                    myRole={myRole}
                                    syncEpoch={miniGameSyncEpoch}
                                    preferPeerSync={preferPeerMiniGameSync}
                                    isPaused={!!roomData?.disconnect_started_at}
                                    pauseVersion={Number(roomData?.pause_version ?? 0)}
                                    resumeShiftMs={Number(roomData?.last_pause_duration_ms ?? 0)}
                                    onPeerSyncComplete={() => setPreferPeerMiniGameSync(false)}
                                    round={round}
                                    initialState={restoredGameSnapshots?.skocko?.[`r${round}`]?.state ?? null}
                                    onPersistState={(event, state) =>
                                        persistMiniGameState("skocko", round, event, state)
                                    }
                                    data={round === 1 ? gameState.skocko.runda_1 : gameState.skocko.runda_2}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={handleScoreSubmit}
                                    onNextRound={() => void handleNextRound(round, gameIndex)}
                                    onTimerTick={handleHeaderTimerTick}
                                />
                            )}

                            {gameIndex === 3 && myRole && gameState?.ko_zna_zna && (
                                <KoZnaZna
                                    myRole={myRole}
                                    syncEpoch={miniGameSyncEpoch}
                                    preferPeerSync={preferPeerMiniGameSync}
                                    isPaused={!!roomData?.disconnect_started_at}
                                    pauseVersion={Number(roomData?.pause_version ?? 0)}
                                    resumeShiftMs={Number(roomData?.last_pause_duration_ms ?? 0)}
                                    onPeerSyncComplete={() => setPreferPeerMiniGameSync(false)}
                                    round={1}
                                    initialState={restoredGameSnapshots?.ko_zna_zna?.r1?.state ?? null}
                                    onPersistState={(event, state) =>
                                        persistMiniGameState("ko_zna_zna", 1, event, state)
                                    }
                                    data={gameState.ko_zna_zna}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={handleScoreSubmit}
                                    onNextRound={() => void handleNextRound(round, gameIndex)}
                                    onTimerTick={handleHeaderTimerTick}
                                />
                            )}

                            {gameIndex === 4 && myRole && gameState?.spojnice && (
                                <Spojnice
                                    myRole={myRole}
                                    syncEpoch={miniGameSyncEpoch}
                                    preferPeerSync={preferPeerMiniGameSync}
                                    isPaused={!!roomData?.disconnect_started_at}
                                    pauseVersion={Number(roomData?.pause_version ?? 0)}
                                    resumeShiftMs={Number(roomData?.last_pause_duration_ms ?? 0)}
                                    onPeerSyncComplete={() => setPreferPeerMiniGameSync(false)}
                                    round={round}
                                    initialState={restoredGameSnapshots?.spojnice?.[`r${round}`]?.state ?? null}
                                    onPersistState={(event, state) =>
                                        persistMiniGameState("spojnice", round, event, state)
                                    }
                                    data={round === 1 ? gameState.spojnice.runda_1 : gameState.spojnice.runda_2}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={handleScoreSubmit}
                                    onNextRound={() => void handleNextRound(round, gameIndex)}
                                    onTimerTick={handleHeaderTimerTick}
                                />
                            )}

                            {gameIndex === 5 && myRole && gameState?.asocijacije && (
                                <Asocijacije
                                    myRole={myRole}
                                    syncEpoch={miniGameSyncEpoch}
                                    preferPeerSync={preferPeerMiniGameSync}
                                    isPaused={!!roomData?.disconnect_started_at}
                                    pauseVersion={Number(roomData?.pause_version ?? 0)}
                                    resumeShiftMs={Number(roomData?.last_pause_duration_ms ?? 0)}
                                    onPeerSyncComplete={() => setPreferPeerMiniGameSync(false)}
                                    initialState={restoredGameSnapshots?.asocijacije?.[`r${round}`]?.state ?? null}
                                    onPersistState={(event, state) =>
                                        persistMiniGameState("asocijacije", round, event, state)
                                    }
                                    data={round === 1 ? gameState.asocijacije.runda_1 : gameState.asocijacije.runda_2}
                                    round={round}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={handleScoreSubmit}
                                    onNextRound={() => void handleNextRound(round, gameIndex)}
                                    onTimerTick={handleHeaderTimerTick}
                                />
                            )}

                            {gameIndex === 6 && myRole && !finalResult && (
                                <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Potvrđujem rezultat...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {!finalResult && gameReady && !isConnected && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
                        <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
                        <h2 className="mt-4 text-lg font-black text-text">Ponovno povezivanje...</h2>
                        <p className="mt-2 text-sm text-text-secondary">
                            Stanje runde ostaje sačuvano dok se Realtime veza vraća.
                        </p>
                    </div>
                </div>
            )}

            {!finalResult &&
                roomData?.status === "in_progress" &&
                roomData?.disconnect_deadline &&
                disconnectSecondsLeft !== null &&
                getRoleForPlayerId(roomData, roomData.disconnected_player_id) !== myRole && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
                            <ShieldAlert className="mx-auto h-8 w-8 text-primary" />

                            <h2 className="mt-4 text-xl font-black text-text">
                                {getRoleForPlayerId(roomData, roomData.disconnected_player_id) === myRole
                                    ? "Ponovo se povezujemo..."
                                    : "Protivnik je napustio meč"}
                            </h2>

                            <p className="mt-2 text-sm text-text-secondary">
                                {getRoleForPlayerId(roomData, roomData.disconnected_player_id) === myRole
                                    ? "Ako se reconnect završi prije isteka vremena, partija se nastavlja."
                                    : "Ako se protivnik ne vrati na vrijeme, pobjeđuješ predajom."}
                            </p>

                            <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-2xl font-black tabular-nums text-primary">
                                {disconnectSecondsLeft}
                            </div>

                            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                sekundi do prekida meča
                            </p>
                        </div>
                    </div>
                )}

            {/* FOOTER */}
            <footer className="shrink-0 pb-1 text-center">
                <p className="text-[10px] font-semibold text-text-muted">Room {roomId.slice(0, 8)}</p>
            </footer>
        </div>
    );
}
