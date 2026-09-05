"use client";

import { useEffect, useRef, useState } from "react";
import { redirect, useParams, useRouter } from "next/navigation";
import { joinGameRoom } from "@/actions/game";
import { Loader2, ShieldAlert } from "lucide-react";
import { createClientSupabaseClient } from "@/utils/supabase/client";
import { GameHeader } from "@/components/HeaderZaIgre";
import { EndScreen } from "@/game_components/EndScreen";
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

export default function GameRoomPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [roomData, setRoomData] = useState<any>(null);
    const [myRole, setMyRole] = useState<"blue" | "red" | null>(null);
    const [gameState, setGameState] = useState<any>(null);

    const [localScoreBlue, setLocalScoreBlue] = useState(0);
    const [localScoreRed, setLocalScoreRed] = useState(0);
    const [gameIndex, setGameIndex] = useState(0);
    const [round, setRound] = useState(1);
    const [currentHeaderTime, setCurrentHeaderTime] = useState(60);

    // PRE-GAME / MATCHMAKING
    const [gameStartAt, setGameStartAt] = useState<number | null>(null);
    const [preGameCountdown, setPreGameCountdown] = useState(5);
    const [rollingLetter, setRollingLetter] = useState("A");

    const channelRef = useRef<any>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastBroadcastPayload, setLastBroadcastPayload] = useState<any>(null);

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
    });

    useEffect(() => {
        console.log(roomSnapshotRef.current.blueScore, roomSnapshotRef.current.redScore)
        roomSnapshotRef.current = {
            gameIndex,
            round,
            blueScore: localScoreBlue,
            redScore: localScoreRed,
            gameStartAt,
        };
    }, [
        gameIndex,
        round,
        localScoreBlue,
        localScoreRed,
        gameStartAt,
    ]);

    /*
        1. PRVO UČITAJ SOBU I ROLE

        Ne pravimo channel prije nego što znamo myRole.
    */
    useEffect(() => {
        if (!roomId) return;

        let cancelled = false;

        async function initRoom() {
            setLoading(true);

            const res = await joinGameRoom(roomId);

            if (cancelled) return;

            if (res.error) {
                setError(res.error);
                setLoading(false);
                return;
            }

            const role = res.role as "blue" | "red";
            setMyRole(role);

            const { data, error: fetchErr } = await supabase
                .from("game_rooms")
                .select(`
                    status,
                    game_state,
                    profiles_blue:player_blue_id(username),
                    profiles_red:player_red_id(username)
                `)
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

            // Ako je soba već postala in_progress prije nego što smo
            // stigli na realtime channel, pokreni fallback countdown.
            // ROOM_GAME_START / ROOM_SYNC_RESPONSE će ga zatim uskladiti.
            if (
                data?.status === "in_progress" &&
                getProfileUsername(data?.profiles_red)
            ) {
                const fallbackStartAt = Date.now() + 5_000;

                roomSnapshotRef.current.gameStartAt =
                    roomSnapshotRef.current.gameStartAt ?? fallbackStartAt;

                setGameStartAt(prev => prev ?? fallbackStartAt);
                setPreGameCountdown(5);
            }

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

        const existingChannel = supabase
            .getChannels()
            .find(
                channel =>
                    channel.topic ===
                    `realtime:${channelTopic}`
            );

        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const channel = supabase.channel(channelTopic, {
            config: {
                broadcast: {
                    ack: true,
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

        channel
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "game_rooms",
                    filter: `id=eq.${roomId}`,
                },
                async payload => {
                    const {
                        data: freshRoom,
                        error: refreshError,
                    } = await supabase
                        .from("game_rooms")
                        .select(`
                            status,
                            game_state,
                            profiles_blue:player_blue_id(username),
                            profiles_red:player_red_id(username)
                        `)
                        .eq("id", roomId)
                        .single();

                    if (refreshError || !freshRoom) {
                        console.error(
                            "Ne mogu osvježiti podatke sobe:",
                            refreshError
                        );
                        return;
                    }

                    setRoomData(freshRoom);
                    setGameState(freshRoom.game_state);

                    const opponentJoined =
                        freshRoom.status === "in_progress" &&
                        !!getProfileUsername(freshRoom.profiles_red);

                    if (
                        opponentJoined &&
                        !roomSnapshotRef.current.gameStartAt
                    ) {
                        const startsAt = Date.now() + 5_000;

                        roomSnapshotRef.current.gameStartAt = startsAt;
                        setGameStartAt(startsAt);
                        setPreGameCountdown(5);

                        if (myRole === "blue") {
                            sendThroughChannel({
                                type: "ROOM_GAME_START",
                                role: myRole,
                                startsAt,
                            });
                        }
                    }
                }
            ).on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "game_rooms",
                    filter: `id=eq.${roomId}`,
                },
                payload => {
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
                payload => {
                    const msg = payload.payload;


                    setLastBroadcastPayload(msg);

                    /*
                        Protivnik mijenja rundu / igru.
                    */
                    if (msg.type === "NEXT_ROUND_SYNC") {
                        setRound(msg.nextRound);
                        setGameIndex(msg.nextGameIndex);
                        return;
                    }

                    if (msg.type === "ROOM_GAME_START") {
                        if (typeof msg.startsAt === "number") {
                            roomSnapshotRef.current.gameStartAt = msg.startsAt;
                            setGameStartAt(msg.startsAt);
                            setPreGameCountdown(
                                Math.max(
                                    0,
                                    Math.ceil(
                                        (msg.startsAt - Date.now()) / 1000
                                    )
                                )
                            );
                        }

                        return;
                    }

                    /*
                        Neko je refreshovao stranicu i traži
                        trenutno stanje Room komponente.
                    */
                    if (msg.type === "ROOM_SYNC_REQUEST") {
                        if (msg.role === myRole) return;

                        const snapshot =
                            roomSnapshotRef.current;

                        
                        sendThroughChannel({
                            type: "ROOM_SYNC_RESPONSE",
                            role: myRole,
                            gameIndex:
                                snapshot.gameIndex,
                            round:
                                snapshot.round,
                            blueScore:
                                snapshot.blueScore,
                            redScore:
                                snapshot.redScore,
                            gameStartAt:
                                snapshot.gameStartAt,
                        });

                        return;
                    }

                    /*
                        Mi smo refreshovali i dobili stanje
                        od protivnika.
                    */
                    if (msg.type === "ROOM_SYNC_RESPONSE") {
                        if (msg.role === myRole) return;

                        

                        if (
                            typeof msg.gameIndex ===
                            "number"
                        ) {
                            setGameIndex(msg.gameIndex);
                        }

                        if (
                            typeof msg.round === "number"
                        ) {
                            setRound(msg.round);
                        }

                        if (
                            typeof msg.blueScore ===
                            "number"
                        ) {
                            setLocalScoreBlue(
                                msg.blueScore
                            );
                        }

                        if (
                            typeof msg.redScore ===
                            "number"
                        ) {
                            setLocalScoreRed(
                                msg.redScore
                            );
                        }

                        if (
                            typeof msg.gameStartAt === "number"
                        ) {
                            roomSnapshotRef.current.gameStartAt =
                                msg.gameStartAt;

                            setGameStartAt(msg.gameStartAt);
                            setPreGameCountdown(
                                Math.max(
                                    0,
                                    Math.ceil(
                                        (msg.gameStartAt - Date.now()) / 1000
                                    )
                                )
                            );
                        }

                        return;
                    }
                }
            );

        channel.subscribe(status => {
           

            if (status !== "SUBSCRIBED") return;

            setIsConnected(true);

            /*
                OVDJE myRole VIŠE NE MOŽE BITI null,
                zato što effect nije ni pokrenut dok
                !myRole.
            */
            sendThroughChannel({
                type: "ROOM_SYNC_REQUEST",
                role: myRole,
            });
        });

        return () => {
            if (channelRef.current === channel) {
                channelRef.current = null;
            }

            setIsConnected(false);
            supabase.removeChannel(channel);
        };
    }, [roomId, myRole]);

    useEffect(() => {
        if (
            !roomData ||
            roomData.status !== "waiting" ||
            getProfileUsername(roomData?.profiles_red)
        ) {
            return;
        }

        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        const timer = setInterval(() => {
            setRollingLetter(
                letters[Math.floor(Math.random() * letters.length)]
            );
        }, 220);

        return () => clearInterval(timer);
    }, [
        roomData?.status,
        getProfileUsername(roomData?.profiles_red),
    ]);

    useEffect(() => {
        const currentRedUsername =
            getProfileUsername(roomData?.profiles_red);

        if (
            roomData?.status !== "in_progress" ||
            !currentRedUsername ||
            gameStartAt !== null
        ) {
            return;
        }

        const startsAt = Date.now() + 5_000;

        roomSnapshotRef.current.gameStartAt = startsAt;
        setGameStartAt(startsAt);
        setPreGameCountdown(5);
    }, [
        roomData?.status,
        roomData?.profiles_red,
        gameStartAt,
    ]);

    useEffect(() => {
        if (!gameStartAt) return;

        const tick = () => {
            const left = Math.max(
                0,
                Math.ceil(
                    (gameStartAt - Date.now()) / 1000
                )
            );

            setPreGameCountdown(left);
        };

        tick();

        const timer = setInterval(tick, 100);

        return () => clearInterval(timer);
    }, [gameStartAt]);

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

    function handleNextRound(forcedRound?: number) {
        const activeRound = forcedRound ?? round;

        if (activeRound === 1) {
            const nextRound = 2;

            /*
                Update snapshot odmah.

                Ovo dodatno smanjuje mogućnost da sync
                request dođe između setState i useEffect-a.
            */
            roomSnapshotRef.current = {
                ...roomSnapshotRef.current,
                round: nextRound,
            };

            setRound(nextRound);

            sendBroadcast({
                type: "NEXT_ROUND_SYNC",
                nextRound,
                nextGameIndex: gameIndex,
            });

            return;
        }

        const nextGameIndex = gameIndex + 1;

        roomSnapshotRef.current = {
            ...roomSnapshotRef.current,
            gameIndex: nextGameIndex,
            round: 1,
        };

        setGameIndex(nextGameIndex);
        setRound(1);

        sendBroadcast({
            type: "NEXT_ROUND_SYNC",
            nextRound: 1,
            nextGameIndex,
        });
    }

    const handleScoreSubmit = (
        bluePts: number,
        redPts: number
    ) => {
        setLocalScoreBlue(prev => {
            const newScore = prev + bluePts;

            roomSnapshotRef.current.blueScore =
                newScore;

            return newScore;
        });

        setLocalScoreRed(prev => {
            const newScore = prev + redPts;

            roomSnapshotRef.current.redScore =
                newScore;

            return newScore;
        });
    };

    const handleLeaveGame = () => {
        if (channelRef.current) {
            supabase.removeChannel(
                channelRef.current
            );

            channelRef.current = null;
        }

        router.push("/home");
    };

    const blueUsername =
        getProfileUsername(roomData?.profiles_blue) || "Plavi";

    const redUsername =
        getProfileUsername(roomData?.profiles_red);

    const blueInitial =
        blueUsername.charAt(0).toUpperCase();

    const redInitial =
        redUsername
            ? redUsername.charAt(0).toUpperCase()
            : rollingLetter;

    const opponentMatched =
        roomData?.status === "in_progress" &&
        !!redUsername;

    const gameReady =
        opponentMatched &&
        gameStartAt !== null &&
        preGameCountdown <= 0;

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-background text-red-500 gap-2">
                <ShieldAlert className="h-10 w-10" />
                <p className="font-bold">
                    {error}
                </p>
            </div>
        );
    }

    if(roomData.status === "deleted"){
        setTimeout(() => {
            redirect('/home')
        }, 3000)
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-background text-red-500 gap-2">
                <ShieldAlert className="h-10 w-10" />
                <p className="font-bold">
                    Igrač je odbio poziv.
                </p>
            </div>
        );
    }

    const gameNames = [
        "Slagalica",
        "Moj Broj",
        "Skocko",
        "Ko Zna Zna",
        "Spojnice",
        "Asocijacije",
        "Rezultati",
    ];

    return (
        <div className="flex flex-col w-full items-center justify-between min-h-screen p-6 bg-background text-text">
            <GameHeader
                role={myRole}
                player1Score={localScoreBlue}
                player2Score={localScoreRed}
                timeLeft={currentHeaderTime}
                isSubmitted={false}
                blueName={blueUsername}
                redName={redUsername ?? undefined}
            />

            <main className="mt-5 flex flex-col items-center justify-center text-center my-auto w-full max-w-md gap-4">
                {!gameReady ? (
                    <div className="flex flex-col items-center gap-5 p-6 bg-surface border border-border rounded-3xl w-full shadow-xl overflow-hidden">
                        <div className="flex items-center justify-center gap-5 w-full">
                            <div className="flex flex-col items-center gap-2 min-w-[92px]">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-400 text-2xl font-black shadow-[0_0_24px_rgba(59,130,246,0.12)]">
                                    {blueInitial}
                                </div>

                                <span className="max-w-[92px] truncate text-xs font-bold text-text">
                                    {blueUsername}
                                </span>
                            </div>

                            <div className="text-text-muted text-xs font-black uppercase">
                                VS
                            </div>

                            <div className="flex flex-col items-center gap-2 min-w-[92px]">
                                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-red-500/15 border border-red-500/40 text-red-400 shadow-[0_0_24px_rgba(239,68,68,0.12)]">
                                    <span
                                        key={redInitial}
                                        className="text-2xl font-black animate-in slide-in-from-top-6 fade-in duration-200"
                                    >
                                        {redInitial}
                                    </span>
                                </div>

                                <span className="max-w-[92px] truncate text-xs font-bold text-text">
                                    {redUsername || "Tražimo igrača..."}
                                </span>
                            </div>
                        </div>

                        {!opponentMatched ? (
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />

                                <span className="text-xs font-bold text-text-secondary">
                                    Čekamo protivnika da uđe...
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95">
                                <span className="text-[10px] uppercase tracking-widest font-black text-emerald-500">
                                    Protivnik pronađen
                                </span>

                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary text-2xl font-black">
                                    {preGameCountdown}
                                </div>

                                <span className="text-xs font-bold text-text-secondary">
                                    Igra počinje za {preGameCountdown}s
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 w-full">
                        <span className="text-[10px] uppercase font-bold text-text-secondary bg-surface-light px-2 py-1 rounded-md">
                            {gameNames[gameIndex] ?? ""}
                            {gameIndex !== 6 && ` / Runda ${round} / 2`}
                        </span>

                          {isConnected &&
                            gameIndex === 0 &&
                            myRole &&
                            gameState?.rec && (
                                <PronadjiRec
                                    myRole={myRole}
                                    round={round}
                                    tiles={round === 1 ? gameState.rec.runda_1: gameState.rec.runda_2}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={ handleScoreSubmit }
                                    onNextRound={ handleNextRound }
                                    onTimerTick={time => setCurrentHeaderTime(time)}
                                />
                            )} 
                            
                            {isConnected &&
                            gameIndex === 1 &&
                            myRole &&
                            gameState?.rec && (
                                <MojBroj
                                    myRole={myRole}
                                    round={round}
                                    data={round === 1 ? gameState.broj.runda_1: gameState.broj.runda_2}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={ handleScoreSubmit }
                                    onNextRound={ handleNextRound }
                                    onTimerTick={time => setCurrentHeaderTime(time)}
                                />
                            )} 

                         {isConnected &&
                            gameIndex === 2 &&
                            myRole &&
                            gameState?.rec && (
                                <Skocko
                                    myRole={myRole}
                                    round={round}
                                    data={round === 1 ? gameState.skocko.runda_1: gameState.skocko.runda_2}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={ handleScoreSubmit }
                                    onNextRound={ handleNextRound }
                                    onTimerTick={time => setCurrentHeaderTime(time)}
                                />
                            )}  


                             {isConnected &&
                            gameIndex === 3 &&
                            myRole &&
                            gameState?.rec && (
                                <KoZnaZna
                                    myRole={myRole}
                                    round={round}
                                    data={ gameState.ko_zna_zna}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={ handleScoreSubmit }
                                    onNextRound={ handleNextRound }
                                    onTimerTick={time => setCurrentHeaderTime(time)}
                                />
                            )}  

                             {isConnected &&
                            gameIndex === 4 &&
                            myRole &&
                            gameState?.rec && (
                                <Spojnice
                                    myRole={myRole}
                                    round={round}
                                    data={round === 1 ? gameState.spojnice.runda_1 : gameState.spojnice.runda_2}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={ handleScoreSubmit }
                                    onNextRound={ handleNextRound }
                                    onTimerTick={time => setCurrentHeaderTime(time)}
                                />
                            )}  

                           {isConnected &&
                            gameIndex === 5 &&
                            myRole &&
                            gameState?.rec && (
                                <Asocijacije
                                    myRole={myRole}
                                    data={round === 1 ? gameState.asocijacije.runda_1: gameState.asocijacije.runda_2}
                                    round={round}
                                    sendBroadcast={sendBroadcast}
                                    incomingBroadcast={lastBroadcastPayload}
                                    onScoreSubmit={ handleScoreSubmit }
                                    onNextRound={ handleNextRound }
                                    onTimerTick={time => setCurrentHeaderTime(time)}
                                />
                            )}

                        {isConnected &&
                            gameIndex === 6 &&
                            myRole && (
                                <EndScreen
                                    myRole={myRole}
                                    blueScore={localScoreBlue}
                                    redScore={localScoreRed}
                                    blueName={blueUsername}
                                    redName={redUsername || "Crveni"}
                                    roomId={roomId}
                                    onLeave={handleLeaveGame}
                                />
                            )} 
                    </div>
                )}
            </main>

            <footer className="text-center text-[10px] text-text-secondary/40 uppercase tracking-widest">
                Realtime Multiplayer Room:{" "}
                {roomId.slice(0, 8)}
            </footer>
        </div>
    );
}