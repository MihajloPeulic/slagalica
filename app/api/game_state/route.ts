"use server";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createServerSupabaseClient } from "@/utils/supabase/server";

const redis = Redis.fromEnv();

const GAME_STATE_TTL_SECONDS = 60 * 60 * 6;

const GAMES = [
  "rec",
  "broj",
  "skocko",
  "ko_zna_zna",
  "spojnice",
  "asocijacije",
] as const;

type GameName = (typeof GAMES)[number];
type PlayerRole = "blue" | "red";

const ALLOWED_EVENTS: Record<GameName, readonly string[]> = {
  rec: ["submit_word"],
  broj: ["submit_combination"],
  skocko: ["row_check"],
  ko_zna_zna: ["answer"],
  spojnice: ["pair_attempt"],
  asocijacije: ["answer_solved", "final_solved"],
};

type RoomProgressInput = {
  gameIndex?: number;
  round?: number;
  blueScore?: number;
  redScore?: number;

  /*
    Možeš poslati već poznat apsolutni timestamp...
  */
  gameStartAt?: number | null;
  headerExpiresAt?: number | null;

  /*
    ...ili, još bolje, trajanje.

    Ako pošalješ headerDurationMs: 60000,
    SERVER će napraviti:

    headerExpiresAt = Date.now() + 60000

    i vratiti taj isti canonical timestamp.
  */
  gameStartDelayMs?: number | null;
  headerDurationMs?: number | null;
};

type GameEventBody = {
  roomId: string;
  game: GameName;
  round: number;
  event: string;

  /*
    OVDJE ŠALJEŠ CIJELI TRENUTNI SNAPSHOT TE IGRE.

    Primjeri:

    rec:
    {
      myWord,
      opponentWord,
      isMySubmitted,
      isOpponentSubmitted,
      phase,
      gameExpiresAt
    }

    skocko:
    {
      rows,
      hints,
      currentRow,
      currentCol,
      phase,
      gameExpiresAt,
      finalScores
    }

    itd.
  */
  state: Record<string, unknown>;

  /*
    Opcionalno u istom requestu ažuriraš i room meta state.
  */
  progress?: RoomProgressInput;
};

type PatchBody = {
  roomId: string;
} & RoomProgressInput;

function gameKey(roomId: string) {
  return `game_${roomId}`;
}

function isGameName(value: unknown): value is GameName {
  return typeof value === "string" && (GAMES as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function encode(value: unknown) {
  return JSON.stringify(value);
}

function decode(value: unknown) {
  if (value === undefined || value === null) {
    return value;
  }

  /*
    Upstash SDK ponekad može vratiti već deserijalizovanu vrijednost.
  */
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asNumberOrNull(value: unknown) {
  const parsed = decode(value);

  if (parsed === null) {
    return null;
  }

  return typeof parsed === "number" ? parsed : undefined;
}

async function getRoomAccess(roomId: string): Promise<
  | { ok: true; role: PlayerRole }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select("player_blue_id, player_red_id")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return { ok: false, status: 404, error: "Game room not found" };
  }

  if (room.player_blue_id === user.id) {
    return { ok: true, role: "blue" };
  }

  if (room.player_red_id === user.id) {
    return { ok: true, role: "red" };
  }

  return { ok: false, status: 403, error: "You are not a player in this room" };
}

function validateFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateNonNegativeNumber(value: unknown) {
  return validateFiniteNumber(value) && (value as number) >= 0;
}

function buildProgressFields(progress: RoomProgressInput) {
  const fields: Record<string, string> = {};

  if (progress.gameIndex !== undefined) {
    if (!Number.isInteger(progress.gameIndex) || progress.gameIndex < 0) {
      throw new Error("Invalid gameIndex");
    }
    fields.gameIndex = encode(progress.gameIndex);
  }

  if (progress.round !== undefined) {
    if (!Number.isInteger(progress.round) || progress.round < 1) {
      throw new Error("Invalid round");
    }
    fields.round = encode(progress.round);
  }

  if (progress.blueScore !== undefined) {
    if (!validateFiniteNumber(progress.blueScore)) {
      throw new Error("Invalid blueScore");
    }
    fields.blueScore = encode(progress.blueScore);
  }

  if (progress.redScore !== undefined) {
    if (!validateFiniteNumber(progress.redScore)) {
      throw new Error("Invalid redScore");
    }
    fields.redScore = encode(progress.redScore);
  }

  /*
    Ako je poslano trajanje, server generiše canonical timestamp.
    Duration ima prednost nad direktnim timestampom.
  */
  if (progress.gameStartDelayMs !== undefined) {
    if (progress.gameStartDelayMs === null) {
      fields.gameStartAt = encode(null);
    } else {
      if (!validateNonNegativeNumber(progress.gameStartDelayMs)) {
        throw new Error("Invalid gameStartDelayMs");
      }
      fields.gameStartAt = encode(Date.now() + progress.gameStartDelayMs);
    }
  } else if (progress.gameStartAt !== undefined) {
    if (progress.gameStartAt !== null && !validateFiniteNumber(progress.gameStartAt)) {
      throw new Error("Invalid gameStartAt");
    }
    fields.gameStartAt = encode(progress.gameStartAt);
  }

  if (progress.headerDurationMs !== undefined) {
    if (progress.headerDurationMs === null) {
      fields.headerExpiresAt = encode(null);
    } else {
      if (!validateNonNegativeNumber(progress.headerDurationMs)) {
        throw new Error("Invalid headerDurationMs");
      }
      fields.headerExpiresAt = encode(Date.now() + progress.headerDurationMs);
    }
  } else if (progress.headerExpiresAt !== undefined) {
    if (progress.headerExpiresAt !== null && !validateFiniteNumber(progress.headerExpiresAt)) {
      throw new Error("Invalid headerExpiresAt");
    }
    fields.headerExpiresAt = encode(progress.headerExpiresAt);
  }

  return fields;
}

async function writeHashFields(key: string, fields: Record<string, string>) {
  if (Object.keys(fields).length === 0) {
    return;
  }

  await redis.hset(key, fields);

  /*
    Svaka aktivnost produžava život runtime state-a.
  */
  await redis.expire(key, GAME_STATE_TTL_SECONDS);
}

function parseGameStates(hash: Record<string, unknown>) {
  const games: Record<
    string,
    Record<string, Record<PlayerRole, unknown>>
  > = {};

  for (const [field, rawValue] of Object.entries(hash)) {
    if (!field.startsWith("state:")) {
      continue;
    }

    /*
      state:skocko:r1:blue
    */
    const parts = field.split(":");

    if (parts.length !== 4) {
      continue;
    }

    const [, game, roundKey, role] = parts;

    if (role !== "blue" && role !== "red") {
      continue;
    }

    games[game] ??= {};
    games[game][roundKey] ??= {
      blue: null,
      red: null,
    } as Record<PlayerRole, unknown>;

    games[game][roundKey][role] = decode(rawValue);
  }

  return games;
}

/*
  GET /api/game_state?roomId=...

  Vraća room progress + latest snapshot svake igre/runde/igrača.
*/
export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("roomId");

  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  const access = await getRoomAccess(roomId);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const hash = (await redis.hgetall<Record<string, unknown>>(gameKey(roomId))) ?? {};

    return NextResponse.json({
      roomId,
      role: access.role,

      /*
        Server timestamp je koristan da client
        kalibriše svoj Date.now().
      */
      serverNow: Date.now(),

      progress: {
        gameIndex: asNumberOrNull(hash.gameIndex) ?? 0,
        round: asNumberOrNull(hash.round) ?? 1,
        blueScore: asNumberOrNull(hash.blueScore) ?? 0,
        redScore: asNumberOrNull(hash.redScore) ?? 0,
        gameStartAt: asNumberOrNull(hash.gameStartAt) ?? null,
        headerExpiresAt: asNumberOrNull(hash.headerExpiresAt) ?? null,
        updatedAt: asNumberOrNull(hash.updatedAt) ?? null,
      },

      games: parseGameStates(hash),
    });
  } catch (error) {
    console.error("GET /api/game_state failed:", error);
    return NextResponse.json({ error: "Could not read game state" }, { status: 500 });
  }
}

/*
  PATCH /api/game_state

  Koristi parent GameRoom komponenta:
  - nova runda
  - nova igra
  - score update
  - novi header timer
  - pre-game start timestamp

  Primjer:
  {
    roomId,
    gameIndex: 2,
    round: 1,
    blueScore: 40,
    redScore: 32,
    headerDurationMs: 60000
  }

  Route vraća canonical headerExpiresAt koji je napravio server.
*/
export async function PATCH(request: NextRequest) {
  let body: PatchBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.roomId || typeof body.roomId !== "string") {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  const access = await getRoomAccess(body.roomId);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const fields = buildProgressFields(body);
    fields.updatedAt = encode(Date.now());

    await writeHashFields(gameKey(body.roomId), fields);

    return NextResponse.json({
      success: true,
      serverNow: Date.now(),

      /*
        Vraćamo timestampove koji su ZAISTA zapisani,
        naročito ako ih je server generisao iz duration-a.
      */
      gameStartAt: fields.gameStartAt !== undefined ? decode(fields.gameStartAt) : undefined,
      headerExpiresAt: fields.headerExpiresAt !== undefined ? decode(fields.headerExpiresAt) : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid progress state";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/*
  POST /api/game_state

  Pozivaju mini-game komponente NA DOGAĐAJIMA koje si naveo.

  Svaki request overwritea latest snapshot za:
    game + round + role

  Dakle Redis ne raste beskonačno, ali nakon refresh-a
  uvijek imaš najnoviji poznati state tog igrača.
*/
export async function POST(request: NextRequest) {
  let body: GameEventBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.roomId || typeof body.roomId !== "string") {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  if (!isGameName(body.game)) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }

  if (!Number.isInteger(body.round) || body.round < 1) {
    return NextResponse.json({ error: "Invalid round" }, { status: 400 });
  }

  if (typeof body.event !== "string" || !ALLOWED_EVENTS[body.game].includes(body.event)) {
    return NextResponse.json({ error: `Invalid event for ${body.game}` }, { status: 400 });
  }

  if (!isPlainObject(body.state)) {
    return NextResponse.json({ error: "state must be an object" }, { status: 400 });
  }

  const access = await getRoomAccess(body.roomId);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const now = Date.now();

    const fields: Record<string, string> = {
      /*
        Npr:
        state:skocko:r1:blue
        state:rec:r2:red
      */
      [`state:${body.game}:r${body.round}:${access.role}`]: encode({
        event: body.event,
        role: access.role,
        round: body.round,
        state: body.state,
        updatedAt: now,
      }),

      /*
        Brzi indikator koji je posljednji event
        stigao za tu igru/rundu.
      */
      [`last:${body.game}:r${body.round}`]: encode({
        event: body.event,
        role: access.role,
        updatedAt: now,
      }),

      updatedAt: encode(now),
    };

    if (body.progress) {
      Object.assign(fields, buildProgressFields(body.progress));
    }

    await writeHashFields(gameKey(body.roomId), fields);

    return NextResponse.json({
      success: true,
      role: access.role,
      serverNow: Date.now(),

      gameStartAt: fields.gameStartAt !== undefined ? decode(fields.gameStartAt) : undefined,
      headerExpiresAt: fields.headerExpiresAt !== undefined ? decode(fields.headerExpiresAt) : undefined,
    });
  } catch (error) {
    console.error("POST /api/game_state failed:", error);
    const message = error instanceof Error ? error.message : "Could not save game state";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}