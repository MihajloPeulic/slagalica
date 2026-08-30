import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
    path: path.resolve(
        process.cwd(),
        ".env.local"
    ),
});

const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
    throw new Error(
        "Nedostaje NEXT_PUBLIC_SUPABASE_URL"
    );
}

if (!SUPABASE_SECRET_KEY) {
    throw new Error(
        "Nedostaje SUPABASE_SECRET_KEY"
    );
}

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

const INPUT_FILE =
    "./data/spojnice-final-preview.json";

const TABLE =
    "spojnice_igre";

const BATCH_SIZE =
    200;

type Pair = {
    id: number;
    left: string;
    right: string;
};

type FinalGame = {
    id?: number;
    tema: string;
    verzija: number;
    parovi: Pair[];
};

/*
 * --------------------------------
 * LOAD
 * --------------------------------
 */

function loadGames(): FinalGame[] {
    if (
        !fs.existsSync(
            INPUT_FILE
        )
    ) {
        throw new Error(
            `Ne postoji ${INPUT_FILE}`
        );
    }

    const raw =
        fs.readFileSync(
            INPUT_FILE,
            "utf8"
        );

    const games =
        JSON.parse(
            raw
        ) as FinalGame[];

    if (
        !Array.isArray(
            games
        )
    ) {
        throw new Error(
            "JSON nije array."
        );
    }

    return games;
}

/*
 * --------------------------------
 * VALIDACIJA
 * --------------------------------
 */

function validateGames(
    games: FinalGame[]
) {
    if (
        games.length === 0
    ) {
        throw new Error(
            "JSON je prazan."
        );
    }

    for (
        const game of games
    ) {
        if (
            !game.tema ||
            typeof game.tema !==
                "string"
        ) {
            throw new Error(
                `Neispravna tema: ${JSON.stringify(game)}`
            );
        }

        if (
            !game.tema.startsWith(
                "Poveži "
            )
        ) {
            throw new Error(
                `Tema nije u formatu "Poveži ...": ${game.tema}`
            );
        }

        if (
            !Number.isInteger(
                game.verzija
            ) ||
            game.verzija < 1
        ) {
            throw new Error(
                `Neispravna verzija za temu: ${game.tema}`
            );
        }

        if (
            !Array.isArray(
                game.parovi
            ) ||
            game.parovi.length !==
                8
        ) {
            throw new Error(
                `Tema "${game.tema}" nema 8 parova.`
            );
        }

        for (
            const pair of
                game.parovi
        ) {
            if (
                typeof pair.id !==
                    "number" ||
                !pair.left ||
                !pair.right
            ) {
                throw new Error(
                    `Neispravan par u temi "${game.tema}"`
                );
            }
        }
    }
}

/*
 * --------------------------------
 * MAIN
 * --------------------------------
 */

async function main() {
    const games =
        loadGames();

    console.log(
        `Učitano iz JSON-a: ${games.length}`
    );

    validateGames(
        games
    );

    console.log(
        "✓ Validacija prošla."
    );

    /*
     * --------------------------------
     * PROVJERI DA JE TABELA PRAZNA
     * --------------------------------
     */

    const {
        count,
        error: countError,
    } = await supabase
        .from(TABLE)
        .select(
            "*",
            {
                count: "exact",
                head: true,
            }
        );

    if (
        countError
    ) {
        throw countError;
    }

    console.log(
        `Trenutno u tabeli: ${count}`
    );

    if (
        count !== 0
    ) {
        throw new Error(
            `Tabela nije prazna. Ima ${count} redova. Prekidam da ne napravim duplikate.`
        );
    }

    /*
     * --------------------------------
     * INSERT
     * --------------------------------
     */

    let inserted =
        0;

    for (
        let i = 0;
        i <
        games.length;
        i +=
            BATCH_SIZE
    ) {
        const batch =
            games.slice(
                i,
                i +
                    BATCH_SIZE
            );

        /*
         * NAMJERNO NE ŠALJEMO id.
         *
         * Supabase/Postgres identity
         * kolona ga generiše sama.
         */
        const rows =
            batch.map(
                game => ({
                    tema:
                        game.tema,

                    verzija:
                        game.verzija,

                    parovi:
                        game.parovi,
                })
            );

        const {
            error,
        } = await supabase
            .from(TABLE)
            .insert(rows);

        if (
            error
        ) {
            throw new Error(
                `Batch ${i}-${i + batch.length - 1} nije uspio: ${error.message}`
            );
        }

        inserted +=
            batch.length;

        console.log(
            `✓ Insertovano ${inserted}/${games.length}`
        );
    }

    /*
     * --------------------------------
     * FINAL COUNT
     * --------------------------------
     */

    const {
        count:
            finalCount,
        error:
            finalCountError,
    } = await supabase
        .from(TABLE)
        .select(
            "*",
            {
                count: "exact",
                head: true,
            }
        );

    if (
        finalCountError
    ) {
        throw finalCountError;
    }

    console.log(
        "\n=========================="
    );

    console.log(
        "INSERT ZAVRŠEN"
    );

    console.log(
        `JSON igara: ${games.length}`
    );

    console.log(
        `Insertovano: ${inserted}`
    );

    console.log(
        `Redova u Supabaseu: ${finalCount}`
    );

    if (
        finalCount !==
        games.length
    ) {
        console.warn(
            "⚠ Broj redova se ne poklapa!"
        );
    } else {
        console.log(
            "✓ Sve se poklapa."
        );
    }

    console.log(
        "=========================="
    );
}

main().catch(
    error => {
        console.error(
            "\n❌ Insert nije uspio:"
        );

        console.error(
            error
        );

        process.exit(1);
    }
);