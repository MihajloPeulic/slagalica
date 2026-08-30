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
    "./data/ko-zna-zna-final.json";

const TABLE =
    "ko_zna_zna_pitanja";

const BATCH_SIZE =
    200;

type KzzQuestion = {
    pitanje: string;
    opcije: string[];
    tacna_opcija: number;
};

function loadQuestions(): KzzQuestion[] {
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

    const questions =
        JSON.parse(
            raw
        ) as KzzQuestion[];

    if (
        !Array.isArray(
            questions
        )
    ) {
        throw new Error(
            "JSON nije array."
        );
    }

    return questions;
}

function validateQuestions(
    questions: KzzQuestion[]
) {
    if (
        questions.length === 0
    ) {
        throw new Error(
            "JSON je prazan."
        );
    }

    const seen =
        new Set<string>();

    for (
        let i = 0;
        i <
        questions.length;
        i++
    ) {
        const q =
            questions[i];

        if (
            !q.pitanje ||
            typeof q.pitanje !==
                "string"
        ) {
            throw new Error(
                `Index ${i}: neispravno pitanje`
            );
        }

        if (
            !Array.isArray(
                q.opcije
            ) ||
            q.opcije.length !==
                4
        ) {
            throw new Error(
                `Index ${i}: nema tačno 4 opcije`
            );
        }

        for (
            const option of
                q.opcije
        ) {
            if (
                typeof option !==
                    "string" ||
                !option.trim()
            ) {
                throw new Error(
                    `Index ${i}: prazna/neispravna opcija`
                );
            }
        }

        if (
            !Number.isInteger(
                q.tacna_opcija
            ) ||
            q.tacna_opcija <
                0 ||
            q.tacna_opcija >
                3
        ) {
            throw new Error(
                `Index ${i}: tacna_opcija mora biti 0-3`
            );
        }

        /*
         * Provjeri da su sve 4 opcije
         * različite.
         */
        const normalizedOptions =
            q.opcije.map(
                option =>
                    option
                        .toLocaleLowerCase(
                            "sr-Latn"
                        )
                        .trim()
            );

        if (
            new Set(
                normalizedOptions
            ).size !== 4
        ) {
            throw new Error(
                `Index ${i}: duplikat među opcijama`
            );
        }

        /*
         * Detekcija potpuno duplih pitanja.
         */
        const questionKey =
            q.pitanje
                .toLocaleLowerCase(
                    "sr-Latn"
                )
                .replace(
                    /[^\p{L}\p{N}\s]/gu,
                    ""
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        if (
            seen.has(
                questionKey
            )
        ) {
            console.warn(
                `⚠ Duplikat pitanja na indexu ${i}: ${q.pitanje}`
            );
        }

        seen.add(
            questionKey
        );
    }
}

async function main() {
    const questions =
        loadQuestions();

    console.log(
        `Učitano iz JSON-a: ${questions.length}`
    );

    validateQuestions(
        questions
    );

    console.log(
        "✓ Validacija prošla."
    );

    /*
     * Provjeri koliko već ima u tabeli.
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

    /*
     * Zaštita od slučajnog dupliranja.
     */
    if (
        count !== 0
    ) {
        throw new Error(
            `Tabela nije prazna. Ima ${count} redova. Očisti je prvo ako želiš ponovni insert.`
        );
    }

    let inserted =
        0;

    for (
        let i = 0;
        i <
        questions.length;
        i +=
            BATCH_SIZE
    ) {
        const batch =
            questions.slice(
                i,
                i +
                    BATCH_SIZE
            );

        /*
         * NAMJERNO NE ŠALJEMO:
         *
         * id
         * created_at
         *
         * njih Postgres generiše sam.
         */
        const rows =
            batch.map(
                q => ({
                    pitanje:
                        q.pitanje,

                    opcije:
                        q.opcije,

                    tacna_opcija:
                        q.tacna_opcija,
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
            `✓ Insertovano ${inserted}/${questions.length}`
        );
    }

    /*
     * Finalna provjera.
     */
    const {
        count: finalCount,
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
        "KO ZNA ZNA INSERT ZAVRŠEN"
    );

    console.log(
        `JSON pitanja: ${questions.length}`
    );

    console.log(
        `Insertovano: ${inserted}`
    );

    console.log(
        `U Supabase tabeli: ${finalCount}`
    );

    if (
        finalCount ===
        questions.length
    ) {
        console.log(
            "✓ Sve se poklapa."
        );
    } else {
        console.warn(
            "⚠ Broj redova se ne poklapa."
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