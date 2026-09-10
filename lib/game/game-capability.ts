import "server-only";

import {
    SignJWT,
    jwtVerify,
} from "jose";

import { cookies } from "next/headers";

const CAPABILITY_ISSUER =
    "slagalica-game";

const CAPABILITY_AUDIENCE =
    "slagalica-game-state";

const CAPABILITY_TTL_SECONDS =
    60 * 60 * 6;

type GameCapabilityPayload = {
    roomId: string;
    role: "blue";
    scope: "game-state-write";
};

function getSecret() {
    const secret =
        process.env
            .GAME_STATE_CAPABILITY_SECRET;

    if (!secret) {
        throw new Error(
            "GAME_STATE_CAPABILITY_SECRET is not configured"
        );
    }

    return new TextEncoder().encode(
        secret
    );
}

function getCookieName(
    roomId: string
) {
    return `game_cap_${roomId}`;
}

/*
    Poziva se SAMO nakon što je postojeći joinGameRoom()
    već server-side utvrdio da je korisnik blue.
*/
export async function issueBlueGameCapability(
    roomId: string
) {
    const payload:
        GameCapabilityPayload = {
        roomId,
        role: "blue",
        scope: "game-state-write",
    };

    const token =
        await new SignJWT(payload)
            .setProtectedHeader({
                alg: "HS256",
                typ: "JWT",
            })
            .setIssuer(
                CAPABILITY_ISSUER
            )
            .setAudience(
                CAPABILITY_AUDIENCE
            )
            .setIssuedAt()
            .setExpirationTime(
                `${CAPABILITY_TTL_SECONDS}s`
            )
            .sign(getSecret());

    const cookieStore =
        await cookies();

    cookieStore.set(
        getCookieName(roomId),
        token,
        {
            httpOnly: true,

            secure:
                process.env.NODE_ENV ===
                "production",

            sameSite: "strict",

            path: "/",

            maxAge:
                CAPABILITY_TTL_SECONDS,
        }
    );
}

export async function clearGameCapability(
    roomId: string
) {
    const cookieStore =
        await cookies();

    cookieStore.delete(
        getCookieName(roomId)
    );
}

/*
    NEMA Supabase query-ja.

    Ovo je samo:
    1. pročitaj HttpOnly cookie
    2. HMAC verify JWT-a
    3. provjeri roomId + role + scope
*/
export async function requireBlueGameCapability(
    roomId: string
) {
    const cookieStore =
        await cookies();

    const token =
        cookieStore.get(
            getCookieName(roomId)
        )?.value;

    if (!token) {
        throw new Error(
            "Missing game capability"
        );
    }

    try {
        const { payload } =
            await jwtVerify(
                token,
                getSecret(),
                {
                    issuer:
                        CAPABILITY_ISSUER,

                    audience:
                        CAPABILITY_AUDIENCE,
                }
            );

        if (
            payload.roomId !== roomId ||
            payload.role !== "blue" ||
            payload.scope !==
                "game-state-write"
        ) {
            throw new Error(
                "Invalid game capability"
            );
        }

        return true;
    } catch {
        throw new Error(
            "Invalid or expired game capability"
        );
    }
}
