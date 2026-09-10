import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = Redis.fromEnv();

export const rateLimits = {
    // Login:
    // IP jer još nemamo autentifikovanog usera.
    login: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        analytics: false,
        prefix: "ratelimit:login",
    }),

    // Register:
    // takođe IP jer user još ne postoji.
    register: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "10 m"),
        analytics: false,
        prefix: "ratelimit:register",
    }),

    // Slanje friend requesta:
    // ovdje imamo userId, pa limitiramo USERA, ne IP.
    friendRequest: new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(10, "5 m"),
        analytics: false,
        prefix: "ratelimit:friend-request",
    }),

    // Accept / reject:
    // puno blaži limit jer korisnik legitimno može
    // odjednom obraditi više zahtjeva.
    friendResponse: new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(30, "1 m"),
        analytics: false,
        prefix: "ratelimit:friend-response",
    }),

    // Kasnije za game rooms.
    createRoom: new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(5, "1 m"),
        analytics: false,
        prefix: "ratelimit:create-room",
    }),

    joinRoom: new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(15, "1 m"),
        analytics: false,
        prefix: "ratelimit:join-room",
    }),
};