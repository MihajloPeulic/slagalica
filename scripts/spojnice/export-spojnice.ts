// scripts/spojnice/export-spojnice.ts

import dotenv from "dotenv";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
    path: ".env.local",
});

/*
 * --------------------------------
 * ENV
 * --------------------------------
 */

const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
    throw new Error(
        "Nedostaje NEXT_PUBLIC_SUPABASE_URL u .env.local"
    );
}

if (!SUPABASE_SECRET_KEY) {
    throw new Error(
        "Nedostaje SUPABASE_SECRET_KEY u .env.local"
    );
}

/*
 * --------------------------------
 * SUPABASE
 * --------------------------------
 */

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

/*
 * --------------------------------
 * CONFIG
 * --------------------------------
 */

const TABLE_NAME =
    "spojnice_igre";

const OUTPUT_FILE =
    "./data/spojnice-original.json";

const PAGE_SIZE = 1000;

/*
 * --------------------------------
 * TYPES
 * --------------------------------
 */

type Pair = {
    id: number;
    left: string;
    right: string;
};

type SpojnicaGame = {
    id: number;
    tema: string;
    verzija: number;
    parovi: Pair[];
    created_at?: string;
};

/*
 * --------------------------------
 * VALIDACIJA PARA
 * --------------------------------
 */

function isValidPair(
    pair: unknown
): pair is Pair {
    if (
        !pair ||
        typeof pair !== "object"
    ) {
        return false;
    }

    const value =
        pair as Record<
            string,
            unknown
        >;

    return (
        typeof value.id === "number" &&
        typeof value.left === "string" &&
        typeof value.right === "string" &&
        value.left.trim().length > 0 &&
        value.right.trim().length > 0
    );
}

/*
 * --------------------------------
 * SIGURNO ČUVANJE
 * --------------------------------
 */

function saveJson(
    games: SpojnicaGame[]
) {
    fs.mkdirSync(
        "./data",
        {
            recursive: true,
        }
    );

    const tempFile =
        OUTPUT_FILE + ".tmp";

    const json =
        JSON.stringify(
            games,
            null,
            2
        );

    /*
     * Prvo pišemo u temp file.
     * Ako proces pukne tokom pisanja,
     * originalni export ostaje netaknut.
     */
    fs.writeFileSync(
        tempFile,
        json,
        "utf8"
    );

    /*
     * Ako već postoji prethodni export,
     * ukloni ga tek kada je novi temp
     * uspješno zapisan.
     */
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
        tempFile,
        OUTPUT_FILE
    );
}

/*
 * --------------------------------
 * MAIN
 * --------------------------------
 */

async function main() {
    console.log(
        "Počinjem export Spojnica..."
    );

    console.log(
        `Tabela: ${TABLE_NAME}`
    );

    /*
     * Samo provjera da su ENV varijable
     * učitane. Ne ispisujemo njihove
     * stvarne vrijednosti.
     */
    console.log({
        hasSupabaseUrl:
            Boolean(
                SUPABASE_URL
            ),

        hasSupabaseSecret:
            Boolean(
                SUPABASE_SECRET_KEY
            ),
    });

    const allGames:
        SpojnicaGame[] = [];

    let from = 0;
    let page = 1;

    /*
     * --------------------------------
     * PAGINATION
     * --------------------------------
     */

    while (true) {
        const to =
            from +
            PAGE_SIZE -
            1;

        console.log(
            `Učitavam stranicu ${page}: ${from}-${to}`
        );

        const {
            data,
            error,
        } = await supabase
            .from(
                TABLE_NAME
            )
            .select(
                `
                id,
                tema,
                verzija,
                parovi,
                created_at
                `
            )
            .order(
                "id",
                {
                    ascending: true,
                }
            )
            .range(
                from,
                to
            );

        if (error) {
            throw new Error(
                `Supabase error: ${error.message}`
            );
        }

        if (
            !data ||
            data.length === 0
        ) {
            break;
        }

        for (
            const game of data
        ) {
            allGames.push(
                game as SpojnicaGame
            );
        }

        console.log(
            `✓ Ukupno učitano: ${allGames.length}`
        );

        /*
         * Ako smo dobili manje od PAGE_SIZE,
         * ovo je posljednja stranica.
         */
        if (
            data.length <
            PAGE_SIZE
        ) {
            break;
        }

        from +=
            PAGE_SIZE;

        page++;
    }

    /*
     * --------------------------------
     * VALIDACIJA
     * --------------------------------
     */

    console.log(
        "\nValidiram igre..."
    );

    let invalidGames = 0;

    let invalidPairs = 0;

    let gamesWithoutTema =
        0;

    const ids =
        new Set<number>();

    let duplicateIds =
        0;

    for (
        const game of allGames
    ) {
        /*
         * ID
         */
        if (
            ids.has(
                game.id
            )
        ) {
            console.warn(
                `⚠ Duplikat ID-a: ${game.id}`
            );

            duplicateIds++;
        }

        ids.add(
            game.id
        );

        /*
         * Tema
         */
        if (
            !game.tema ||
            !game.tema.trim()
        ) {
            gamesWithoutTema++;

            console.warn(
                `⚠ ID ${game.id}: nema temu`
            );
        }

        /*
         * Parovi moraju biti array.
         */
        if (
            !Array.isArray(
                game.parovi
            )
        ) {
            console.warn(
                `⚠ ID ${game.id}: parovi nisu array`
            );

            invalidGames++;

            continue;
        }

        /*
         * Očekujemo 8 parova.
         */
        if (
            game.parovi.length !==
            8
        ) {
            console.warn(
                `⚠ ID ${game.id}: ima ${game.parovi.length} parova umjesto 8`
            );

            invalidGames++;
        }

        /*
         * Validacija svakog para.
         */
        for (
            const pair of
                game.parovi
        ) {
            if (
                !isValidPair(
                    pair
                )
            ) {
                console.warn(
                    `⚠ ID ${game.id}: neispravan par`,
                    pair
                );

                invalidPairs++;
            }
        }
    }

    /*
     * --------------------------------
     * SAVE
     * --------------------------------
     */

    saveJson(
        allGames
    );

    /*
     * --------------------------------
     * SUMMARY
     * --------------------------------
     */

    console.log(
        "\n========================="
    );

    console.log(
        "EXPORT ZAVRŠEN"
    );

    console.log(
        `✓ Exportovano igara: ${allGames.length}`
    );

    console.log(
        `✓ Jedinstvenih ID-eva: ${ids.size}`
    );

    console.log(
        `⚠ Igre sa pogrešnim brojem/parovima: ${invalidGames}`
    );

    console.log(
        `⚠ Neispravnih parova: ${invalidPairs}`
    );

    console.log(
        `⚠ Igre bez teme: ${gamesWithoutTema}`
    );

    console.log(
        `⚠ Duplikat ID-eva: ${duplicateIds}`
    );

    console.log(
        `💾 Sačuvano u: ${OUTPUT_FILE}`
    );

    console.log(
        "=========================\n"
    );
}

/*
 * --------------------------------
 * START
 * --------------------------------
 */

main().catch(
    error => {
        console.error(
            "\nExport nije uspio:"
        );

        console.error(
            error
        );

        process.exit(1);
    }
);