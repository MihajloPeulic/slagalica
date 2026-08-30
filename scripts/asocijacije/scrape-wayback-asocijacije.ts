import fs from "fs";
import crypto from "crypto";

const OUTPUT_FILE =
    "./data/asocijacije-wayback.json";

const CDX_URL =
    "https://web.archive.org/cdx/search/cdx";

const ORIGINAL_URL =
    "http://www.slagalica.tv/game/asocijacije";



const DELAY = 1200;

type Asocijacija = {
    timestamp: string;
    archiveUrl: string;

    a: {
        polja: [string, string, string, string];
        resenje: string[];
    };

    b: {
        polja: [string, string, string, string];
        resenje: string[];
    };

    c: {
        polja: [string, string, string, string];
        resenje: string[];
    };

    d: {
        polja: [string, string, string, string];
        resenje: string[];
    };

    konacno: string[];
};

function sleep(ms: number) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

function cleanText(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .replace(/\s+/g, " ")
        .trim();
}

function normalize(value: string) {
    return value
        .toLocaleLowerCase("sr-Latn")
        .replace(/\s+/g, " ")
        .trim();
}

/*
 * Napravimo hash sadržaja igre.
 *
 * Timestamp nije uključen,
 * tako da isti sadržaj iz dva
 * Wayback snapshota postaje duplikat.
 */
function createGameKey(
    game: Omit<
        Asocijacija,
        "timestamp" | "archiveUrl"
    >
) {
    const data = [
        ...game.a.polja,
        ...game.a.resenje,

        ...game.b.polja,
        ...game.b.resenje,

        ...game.c.polja,
        ...game.c.resenje,

        ...game.d.polja,
        ...game.d.resenje,

        ...game.konacno,
    ]
        .map(normalize)
        .join("|");

    return crypto
        .createHash("sha1")
        .update(data)
        .digest("hex");
}

/*
 * --------------------------------
 * CDX
 * --------------------------------
 */

async function getSnapshots() {
    const url =
        new URL(CDX_URL);

    url.searchParams.set(
        "url",
        ORIGINAL_URL
    );

    url.searchParams.set(
        "output",
        "json"
    );

    url.searchParams.append(
        "filter",
        "statuscode:200"
    );

    /*
     * Ne koristimo collapse=digest ovdje
     * jer hoćemo prvo vidjeti sve snapshotove.
     *
     * Dedup igre radimo sami.
     */

    console.log(
        "Dohvatam Wayback snapshotove..."
    );

    const response =
        await fetch(
            url.toString(),
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0",
                },
            }
        );

    if (!response.ok) {
        throw new Error(
            `CDX HTTP ${response.status}`
        );
    }

    const rows =
        await response.json();

    /*
     * Prvi red CDX JSON-a su nazivi kolona.
     */
    if (
        !Array.isArray(rows) ||
        rows.length < 2
    ) {
        throw new Error(
            "Nema Wayback snapshotova."
        );
    }

    const headers =
        rows[0] as string[];

    const timestampIndex =
        headers.indexOf(
            "timestamp"
        );

    const originalIndex =
        headers.indexOf(
            "original"
        );

    if (
        timestampIndex === -1 ||
        originalIndex === -1
    ) {
        throw new Error(
            "CDX format nije očekivan."
        );
    }

    const snapshots =
        rows
            .slice(1)
            .map(
                (row: string[]) => ({
                    timestamp:
                        row[
                            timestampIndex
                        ],

                    original:
                        row[
                            originalIndex
                        ],
                })
            );

    console.log(
        `Wayback snapshotova: ${snapshots.length}`
    );

    return snapshots;
}

/*
 * --------------------------------
 * TRAŽI JSON/JS PODATKE U HTML-u
 * --------------------------------
 */

function extractFromPodaci(
    html: string
):
    | Omit<
        Asocijacija,
        "timestamp" | "archiveUrl"
    >
    | null {

    /*
     * Nova/stara implementacija može imati:
     *
     * var podaci = {...};
     */
    const match =
        html.match(
            /var\s+podaci\s*=\s*(\{[\s\S]*?\});/
        );

    if (!match) {
        return null;
    }

    try {
        const data =
            JSON.parse(
                match[1]
            );

        const a =
            data?.asocijacije;

        if (!a) {
            return null;
        }

        if (
            !a.a1 ||
            !a.a2 ||
            !a.a3 ||
            !a.a4 ||
            !a.a5 ||
            !a.b1 ||
            !a.b2 ||
            !a.b3 ||
            !a.b4 ||
            !a.b5 ||
            !a.c1 ||
            !a.c2 ||
            !a.c3 ||
            !a.c4 ||
            !a.c5 ||
            !a.d1 ||
            !a.d2 ||
            !a.d3 ||
            !a.d4 ||
            !a.d5 ||
            !a.rr
        ) {
            return null;
        }

        return {
            a: {
                polja: [
                    cleanText(a.a1),
                    cleanText(a.a2),
                    cleanText(a.a3),
                    cleanText(a.a4),
                ],

                resenje:
                    Array.isArray(
                        a.a5
                    )
                        ? a.a5.map(
                            cleanText
                        )
                        : [
                            cleanText(
                                a.a5
                            )
                        ],
            },

            b: {
                polja: [
                    cleanText(a.b1),
                    cleanText(a.b2),
                    cleanText(a.b3),
                    cleanText(a.b4),
                ],

                resenje:
                    Array.isArray(
                        a.b5
                    )
                        ? a.b5.map(
                            cleanText
                        )
                        : [
                            cleanText(
                                a.b5
                            )
                        ],
            },

            c: {
                polja: [
                    cleanText(a.c1),
                    cleanText(a.c2),
                    cleanText(a.c3),
                    cleanText(a.c4),
                ],

                resenje:
                    Array.isArray(
                        a.c5
                    )
                        ? a.c5.map(
                            cleanText
                        )
                        : [
                            cleanText(
                                a.c5
                            )
                        ],
            },

            d: {
                polja: [
                    cleanText(a.d1),
                    cleanText(a.d2),
                    cleanText(a.d3),
                    cleanText(a.d4),
                ],

                resenje:
                    Array.isArray(
                        a.d5
                    )
                        ? a.d5.map(
                            cleanText
                        )
                        : [
                            cleanText(
                                a.d5
                            )
                        ],
            },

            konacno:
                Array.isArray(
                    a.rr
                )
                    ? a.rr.map(
                        cleanText
                    )
                    : [
                        cleanText(
                            a.rr
                        )
                    ],
        };

    } catch {
        return null;
    }
}

/*
 * --------------------------------
 * STARI FORMAT
 * --------------------------------
 *
 * Wayback 2012 verzija možda neće imati
 * "var podaci".
 *
 * Zato pokušavamo i da pronađemo
 * asocijacije[...] dodjele.
 */

function extractLegacy(
    html: string
):
    | Omit<
        Asocijacija,
        "timestamp" | "archiveUrl"
    >
    | null {

    const values =
        new Map<
            string,
            string[]
        >();

    /*
     * Primjeri koje pokušavamo uhvatiti:
     *
     * asocijacije['a1'] = 'NEŠTO';
     *
     * asocijacije['a5'] = ['prvo','prvi'];
     */

    const regex =
        /asocijacije\s*\[\s*['"]([abcd][1-5]|rr)['"]\s*\]\s*=\s*([^;]+);/gi;

    for (
        const match of
            html.matchAll(regex)
    ) {
        const key =
            match[1]
                .toLowerCase();

        const raw =
            match[2]
                .trim();

        try {
            /*
             * JSON array.
             */
            if (
                raw.startsWith("[")
            ) {
                const fixed =
                    raw
                        .replace(
                            /'/g,
                            '"'
                        );

                const parsed =
                    JSON.parse(
                        fixed
                    );

                if (
                    Array.isArray(
                        parsed
                    )
                ) {
                    values.set(
                        key,
                        parsed.map(
                            value =>
                                cleanText(
                                    String(
                                        value
                                    )
                                )
                        )
                    );
                }

                continue;
            }

            /*
             * Običan JS string.
             */
            const stringMatch =
                raw.match(
                    /^['"]([\s\S]*?)['"]$/
                );

            if (
                stringMatch
            ) {
                values.set(
                    key,
                    [
                        cleanText(
                            stringMatch[
                                1
                            ]
                        )
                    ]
                );
            }
        } catch {
            // ignoriši pojedinačno loš zapis
        }
    }

    const required = [
        "a1",
        "a2",
        "a3",
        "a4",
        "a5",

        "b1",
        "b2",
        "b3",
        "b4",
        "b5",

        "c1",
        "c2",
        "c3",
        "c4",
        "c5",

        "d1",
        "d2",
        "d3",
        "d4",
        "d5",

        "rr",
    ];

    if (
        !required.every(
            key =>
                values.has(key)
        )
    ) {
        return null;
    }

    return {
        a: {
            polja: [
                values.get("a1")![0],
                values.get("a2")![0],
                values.get("a3")![0],
                values.get("a4")![0],
            ],

            resenje:
                values.get(
                    "a5"
                )!,
        },

        b: {
            polja: [
                values.get("b1")![0],
                values.get("b2")![0],
                values.get("b3")![0],
                values.get("b4")![0],
            ],

            resenje:
                values.get(
                    "b5"
                )!,
        },

        c: {
            polja: [
                values.get("c1")![0],
                values.get("c2")![0],
                values.get("c3")![0],
                values.get("c4")![0],
            ],

            resenje:
                values.get(
                    "c5"
                )!,
        },

        d: {
            polja: [
                values.get("d1")![0],
                values.get("d2")![0],
                values.get("d3")![0],
                values.get("d4")![0],
            ],

            resenje:
                values.get(
                    "d5"
                )!,
        },

        konacno:
            values.get(
                "rr"
            )!,
    };
}

/*
 * --------------------------------
 * FETCH SNAPSHOT
 * --------------------------------
 */

async function fetchSnapshot(
    timestamp: string,
    originalUrl: string
) {
    /*
     * id_ govori Waybacku da pokuša vratiti
     * originalni sadržaj bez rewrite UI-a.
     */
    const archiveUrl =
        `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;

    const response =
        await fetch(
            archiveUrl,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0",
                },

                redirect:
                    "follow",
            }
        );

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}`
        );
    }

    return {
        html:
            await response.text(),

        archiveUrl,
    };
}

/*
 * --------------------------------
 * SAVE
 * --------------------------------
 */

function save(
    games: Asocijacija[]
) {
    fs.mkdirSync(
        "./data",
        {
            recursive: true,
        }
    );

    const temp =
        OUTPUT_FILE +
        ".tmp";

    fs.writeFileSync(
        temp,
        JSON.stringify(
            games,
            null,
            2
        ),
        "utf8"
    );

    if (
        fs.existsSync(
            OUTPUT_FILE
        )
    ) {
        fs.rmSync(
            OUTPUT_FILE
        );
    }

    fs.renameSync(
        temp,
        OUTPUT_FILE
    );
}

/*
 * --------------------------------
 * MAIN
 * --------------------------------
 */

async function main() {
    const snapshots =
        await getSnapshots();

    const games:
        Asocijacija[] = [];

    const seen =
        new Set<string>();

    let requests =
        0;

    let duplicates =
        0;

    let failed =
        0;

    let noGame =
        0;

    for (
        let i = 0;
        i <
        snapshots.length;
        i++
    ) {
        const snapshot =
            snapshots[i];

        requests++;

        try {
            const {
                html,
                archiveUrl,
            } =
                await fetchSnapshot(
                    snapshot.timestamp,
                    snapshot.original
                );

            /*
             * Prvo probamo lakši format.
             */
            let parsed =
                extractFromPodaci(
                    html
                );

            /*
             * Ako ga nema, probaj legacy.
             */
            if (!parsed) {
                parsed =
                    extractLegacy(
                        html
                    );
            }

            if (!parsed) {
                noGame++;

                console.log(
                    `[${i + 1}/${snapshots.length}] ${snapshot.timestamp} | nema igre`
                );

                await sleep(
                    DELAY
                );

                continue;
            }

            const key =
                createGameKey(
                    parsed
                );

            if (
                seen.has(key)
            ) {
                duplicates++;

                console.log(
                    `[${i + 1}/${snapshots.length}] ${snapshot.timestamp} | DUPLIKAT`
                );

                await sleep(
                    DELAY
                );

                continue;
            }

            seen.add(key);

            games.push({
                timestamp:
                    snapshot.timestamp,

                archiveUrl,

                ...parsed,
            });

            save(games);

            console.log(
                `[${i + 1}/${snapshots.length}] ${snapshot.timestamp} | ✓ NOVA | ukupno ${games.length}`
            );

        } catch (error) {
            failed++;

            console.warn(
                `[${i + 1}/${snapshots.length}] ${snapshot.timestamp} | ERROR`,
                error
            );
        }

        await sleep(
            DELAY
        );
    }

    save(
        games
    );

    console.log(
        "\n========================="
    );

    console.log(
        "WAYBACK SCRAPE GOTOV"
    );

    console.log(
        `Snapshotova: ${snapshots.length}`
    );

    console.log(
        `Requestova: ${requests}`
    );

    console.log(
        `Jedinstvenih igara: ${games.length}`
    );

    console.log(
        `Duplikata: ${duplicates}`
    );

    console.log(
        `Bez parsirane igre: ${noGame}`
    );

    console.log(
        `Grešaka: ${failed}`
    );

    console.log(
        `File: ${OUTPUT_FILE}`
    );

    console.log(
        "========================="
    );
}

main().catch(
    error => {
        console.error(
            error
        );

        process.exit(1);
    }
);