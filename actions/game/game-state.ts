"use server";

import { Redis } from "@upstash/redis";

import {
    requireBlueGameCapability,
} from "@/lib/game/game-capability";

import {
    GAME_EVENT_MAP,
    type GameName,
    type GameProgressUpdate,
    type RestoredGameState,
    type SaveGameSnapshotInput,
    type SavedMiniGameSnapshot,
} from "@/lib/game/game-state-types";

const redis =
    Redis.fromEnv();

const GAME_STATE_TTL_SECONDS =
    60 * 60 * 6;

/*
    Sprječava da kompromitovan/maliciozan client
    napravi ogromne Redis payloadove.

    Po potrebi možeš kasnije povećati.
*/
const MAX_SNAPSHOT_BYTES =
    128 * 1024;

function getGameKey(
    roomId: string
) {
    return `game_${roomId}`;
}

function validateRoomId(
    roomId: unknown
): asserts roomId is string {
    if (
        typeof roomId !== "string" ||
        roomId.length < 1 ||
        roomId.length > 128
    ) {
        throw new Error(
            "Invalid roomId"
        );
    }
}

function validateFiniteNumber(
    value: unknown
) {
    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );
}

function validateNonNegativeNumber(
    value: unknown
) {
    return (
        validateFiniteNumber(
            value
        ) &&
        value as number >= 0 //dodao as a number da izbjegnem ts gresku
    );
}

function encode(
    value: unknown
) {
    return JSON.stringify(value);
}

function decode<T>(
    value: unknown
): T | undefined {
    if (
        value === undefined ||
        value === null
    ) {
        return undefined;
    }

    if (
        typeof value !== "string"
    ) {
        return value as T;
    }

    try {
        return JSON.parse(
            value
        ) as T;
    } catch {
        return undefined;
    }
}

function numberFromHash(
    value: unknown
) {
    const parsed =
        decode<unknown>(value);

    if (parsed === null) {
        return null;
    }

    return typeof parsed ===
        "number"
        ? parsed
        : undefined;
}

/*
    Server je jedino mjesto gdje kreiramo NOVI canonical timestamp.

    Npr:
        headerDurationMs: 60000

    postaje:
        headerExpiresAt: SERVER_NOW + 60000
*/
function buildProgressFields(
    progress: GameProgressUpdate
) {
    const fields:
        Record<string, string> = {};

    if (
        progress.gameIndex !==
        undefined
    ) {
        if (
            !Number.isInteger(
                progress.gameIndex
            ) ||
            progress.gameIndex < 0
        ) {
            throw new Error(
                "Invalid gameIndex"
            );
        }

        fields.gameIndex =
            encode(
                progress.gameIndex
            );
    }

    if (
        progress.round !==
        undefined
    ) {
        if (
            !Number.isInteger(
                progress.round
            ) ||
            progress.round < 1
        ) {
            throw new Error(
                "Invalid round"
            );
        }

        fields.round =
            encode(progress.round);
    }

    if (
        progress.blueScore !==
        undefined
    ) {
        if (
            !validateFiniteNumber(
                progress.blueScore
            )
        ) {
            throw new Error(
                "Invalid blueScore"
            );
        }

        fields.blueScore =
            encode(
                progress.blueScore
            );
    }

    if (
        progress.redScore !==
        undefined
    ) {
        if (
            !validateFiniteNumber(
                progress.redScore
            )
        ) {
            throw new Error(
                "Invalid redScore"
            );
        }

        fields.redScore =
            encode(
                progress.redScore
            );
    }

    if (
        progress.gameStartDelayMs !==
        undefined
    ) {
        if (
            progress.gameStartDelayMs ===
            null
        ) {
            fields.gameStartAt =
                encode(null);
        } else {
            if (
                !validateNonNegativeNumber(
                    progress.gameStartDelayMs
                )
            ) {
                throw new Error(
                    "Invalid gameStartDelayMs"
                );
            }

            fields.gameStartAt =
                encode(
                    Date.now() +
                        progress
                            .gameStartDelayMs
                );
        }
    } else if (
        progress.gameStartAt !==
        undefined
    ) {
        if (
            progress.gameStartAt !==
                null &&
            !validateFiniteNumber(
                progress.gameStartAt
            )
        ) {
            throw new Error(
                "Invalid gameStartAt"
            );
        }

        fields.gameStartAt =
            encode(
                progress.gameStartAt
            );
    }

    if (
        progress.headerDurationMs !==
        undefined
    ) {
        if (
            progress.headerDurationMs ===
            null
        ) {
            fields.headerExpiresAt =
                encode(null);
        } else {
            if (
                !validateNonNegativeNumber(
                    progress.headerDurationMs
                )
            ) {
                throw new Error(
                    "Invalid headerDurationMs"
                );
            }

            fields.headerExpiresAt =
                encode(
                    Date.now() +
                        progress
                            .headerDurationMs
                );
        }
    } else if (
        progress.headerExpiresAt !==
        undefined
    ) {
        if (
            progress.headerExpiresAt !==
                null &&
            !validateFiniteNumber(
                progress.headerExpiresAt
            )
        ) {
            throw new Error(
                "Invalid headerExpiresAt"
            );
        }

        fields.headerExpiresAt =
            encode(
                progress
                    .headerExpiresAt
            );
    }

    return fields;
}

async function writeFields(
    roomId: string,
    fields: Record<string, string>,
    setInitialTtl = false
) {
    fields.updatedAt =
        encode(Date.now());

    /*
        Normalan snapshot je samo JEDAN HSET = 1 Redis komanda.

        TTL postavljamo samo kada BLUE kreira canonical gameStartAt
        na početku meča. Nema potrebe da radimo EXPIRE uz svaki
        snapshot i tako dupliramo Upstash command usage.
    */
    if (!setInitialTtl) {
        await redis.hset(
            getGameKey(roomId),
            fields
        );

        return;
    }

    const pipeline = redis.pipeline();

    pipeline.hset(
        getGameKey(roomId),
        fields
    );

    pipeline.expire(
        getGameKey(roomId),
        GAME_STATE_TTL_SECONDS
    );

    await pipeline.exec();
}

function validateGameEvent(
    game: GameName,
    event: string
) {
    const allowed =
        GAME_EVENT_MAP[game] as
            readonly string[];

    if (
        !allowed.includes(event)
    ) {
        throw new Error(
            `Invalid event "${event}" for ${game}`
        );
    }
}

function validateSnapshotSize(
    state: Record<
        string,
        unknown
    >
) {
    const json =
        JSON.stringify(state);

    const bytes =
        new TextEncoder().encode(
            json
        ).byteLength;

    if (
        bytes >
        MAX_SNAPSHOT_BYTES
    ) {
        throw new Error(
            "Game snapshot is too large"
        );
    }

    return json;
}

/*
    ROOM-LEVEL SAVE

    Koristi GameRoomPage:
    - score
    - gameIndex
    - round
    - pregame timestamp
    - header timestamp

    Samo BLUE capability može proći.
*/
export async function saveGameProgressAction(
    roomId: string,
    progress: GameProgressUpdate
) {
    validateRoomId(roomId);

    await requireBlueGameCapability(
        roomId
    );

    const fields =
        buildProgressFields(
            progress
        );

    const shouldSetInitialTtl =
        progress.gameStartDelayMs !== undefined &&
        progress.gameStartDelayMs !== null;

    await writeFields(
        roomId,
        fields,
        shouldSetInitialTtl
    );

    return {
        success: true,
        serverNow: Date.now(),

        gameStartAt:
            fields.gameStartAt !==
            undefined
                ? decode<
                      number | null
                  >(
                      fields.gameStartAt
                  )
                : undefined,

        headerExpiresAt:
            fields
                .headerExpiresAt !==
            undefined
                ? decode<
                      number | null
                  >(
                      fields
                          .headerExpiresAt
                  )
                : undefined,
    };
}

/*
    MINI-GAME SAVE

    Poziva se samo na:
    - rec submit
    - broj submit
    - skocko row check
    - KZZ odgovor
    - spojnica pokušaj
    - asocijacija tačno polje/final

    Pošto samo blue poziva action:
    Redis field nema :blue/:red suffix.
    Blue čuva CANONICAL snapshot cijele igre.
*/
export async function saveGameSnapshotAction(
    input: SaveGameSnapshotInput
) {
    validateRoomId(
        input.roomId
    );

    await requireBlueGameCapability(
        input.roomId
    );

    if (
        !Number.isInteger(
            input.round
        ) ||
        input.round < 1
    ) {
        throw new Error(
            "Invalid round"
        );
    }

    if (
        !Object.prototype.hasOwnProperty.call(
            GAME_EVENT_MAP,
            input.game
        )
    ) {
        throw new Error(
            "Invalid game"
        );
    }

    validateGameEvent(
        input.game,
        input.event
    );

    if (
        !input.state ||
        typeof input.state !==
            "object" ||
        Array.isArray(
            input.state
        )
    ) {
        throw new Error(
            "state must be an object"
        );
    }

    /*
        Serialize samo jednom.
    */
    validateSnapshotSize(
        input.state
    );

    const now =
        Date.now();

    const snapshot:
        SavedMiniGameSnapshot = {
        game:
            input.game,

        round:
            input.round,

        event:
            input.event,

        state:
            input.state,

        updatedAt:
            now,
    };

    const fields:
        Record<string, string> = {
        /*
            Npr:
                state:skocko:r1
                state:spojnice:r2
        */
        [
            `state:${input.game}:r${input.round}`
        ]: encode(snapshot),

        [
            `last:${input.game}:r${input.round}`
        ]: encode({
            event:
                input.event,

            updatedAt:
                now,
        }),
    };

    /*
        Ako snapshot event istovremeno završava rundu,
        možeš u ISTOM requestu poslati score/progress.
    */
    if (input.progress) {
        Object.assign(
            fields,
            buildProgressFields(
                input.progress
            )
        );
    }

    await writeFields(
        input.roomId,
        fields
    );

    return {
        success: true,
        serverNow: Date.now(),

        gameStartAt:
            fields.gameStartAt !==
            undefined
                ? decode<
                      number | null
                  >(
                      fields.gameStartAt
                  )
                : undefined,

        headerExpiresAt:
            fields
                .headerExpiresAt !==
            undefined
                ? decode<
                      number | null
                  >(
                      fields
                          .headerExpiresAt
                  )
                : undefined,
    };
}

/*
    RESTORE

    Samo blue treba Redis restore.
    Red će nakon toga dobiti canonical state
    od blue-a preko postojećeg realtime sync sistema.
*/
export async function getGameStateAction(
    roomId: string
): Promise<RestoredGameState> {
    validateRoomId(roomId);

    await requireBlueGameCapability(
        roomId
    );

    const hash =
        (
            await redis.hgetall<
                Record<
                    string,
                    unknown
                >
            >(
                getGameKey(roomId)
            )
        ) ?? {};

    const games:
        RestoredGameState["games"] =
        {};

    for (
        const [
            field,
            rawValue,
        ] of Object.entries(hash)
    ) {
        if (
            !field.startsWith(
                "state:"
            )
        ) {
            continue;
        }

        /*
            state:skocko:r1
        */
        const parts =
            field.split(":");

        if (
            parts.length !== 3
        ) {
            continue;
        }

        const [
            ,
            game,
            roundKey,
        ] = parts;

        if (
            !Object.prototype
                .hasOwnProperty.call(
                    GAME_EVENT_MAP,
                    game
                )
        ) {
            continue;
        }

        const snapshot =
            decode<
                SavedMiniGameSnapshot
            >(rawValue);

        if (!snapshot) {
            continue;
        }

        const gameName =
            game as GameName;

        games[gameName] ??= {};

        games[gameName]![
            roundKey
        ] = snapshot;
    }

    return {
        serverNow:
            Date.now(),

        progress: {
            gameIndex:
                numberFromHash(
                    hash.gameIndex
                ) ?? 0,

            round:
                numberFromHash(
                    hash.round
                ) ?? 1,

            blueScore:
                numberFromHash(
                    hash.blueScore
                ) ?? 0,

            redScore:
                numberFromHash(
                    hash.redScore
                ) ?? 0,

            gameStartAt:
                numberFromHash(
                    hash.gameStartAt
                ) ?? null,

            headerExpiresAt:
                numberFromHash(
                    hash
                        .headerExpiresAt
                ) ?? null,

            updatedAt:
                numberFromHash(
                    hash.updatedAt
                ) ?? null,
        },

        games,
    };
}
