// scripts/crawl-kzz-search.ts

import fs from "fs";

const ENDPOINT =
    "https://www.ludara.com/resenja-ko-zna-zna/kzz.php";

const INPUT_FILE =
    "./data/ko-zna-zna-raw.json";

const OUTPUT_FILE =
    "./data/ko-zna-zna-search.json";

const TARGET = 3000;

const REQUEST_DELAY = 350;

const RESULT_LIMIT = 15;

const CHECKPOINT_EVERY = 25;

type Question = {
    sourceId?: string;
    pitanje: string;
    odgovor: string;
};

type QueueItem = {
    query: string;
    priority: number;
};

/*
 * Riječi koje su previše generičke
 * i uglavnom samo troše requestove.
 */
const STOP_WORDS = new Set([
    "koje",
    "koja",
    "koji",
    "kojeg",
    "kojem",
    "kojoj",
    "kako",
    "kada",
    "gdje",
    "gde",
    "jedan",
    "jedna",
    "jedno",
    "godine",
    "godina",
    "prema",
    "nakon",
    "izmedju",
    "ovog",
    "ovom",
    "ovaj",
    "njegov",
    "njena",
    "njihov",
    "njihova",
    "njihovo",
    "poznat",
    "poznata",
    "poznato",
    "naziva",
    "zove",
    "zovu",
]);

function cleanText(value: string) {
    return value
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
}

function normalize(value: string) {
    return cleanText(value)
        .toLocaleLowerCase("sr-Latn");
}

function sleep(ms: number) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

/*
 * ------------------------------------
 * PARSIRAJ HTML RESPONSE
 * ------------------------------------
 */

function parseResults(
    html: string
): Question[] {
    const results: Question[] = [];

    const regex =
        /<h3>\s*<span[^>]*>(.*?)<\/span>\s*<br\s*\/?>\s*(.*?)<\/h3>/gis;

    for (
        const match of html.matchAll(regex)
    ) {
        const pitanje = cleanText(
            match[1].replace(
                /<[^>]+>/g,
                ""
            )
        );

        const odgovor = cleanText(
            match[2].replace(
                /<[^>]+>/g,
                ""
            )
        );

        if (
            !pitanje ||
            !odgovor
        ) {
            continue;
        }

        results.push({
            pitanje,
            odgovor,
        });
    }

    return results;
}

/*
 * ------------------------------------
 * SEARCH SA RETRY-em
 * ------------------------------------
 */

async function search(
    query: string
): Promise<Question[]> {
    const MAX_RETRIES = 3;

    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {
        try {
            const response =
                await fetch(
                    ENDPOINT,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded",

                            "User-Agent":
                                "Mozilla/5.0",
                        },

                        body:
                            new URLSearchParams({
                                s: query,
                            }).toString(),
                    }
                );

            if (
                response.status >= 500
            ) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const html =
                await response.text();

            return parseResults(
                html
            );
        } catch (error) {
            if (
                attempt ===
                MAX_RETRIES
            ) {
                throw error;
            }

            console.log(
                `↻ Retry ${attempt}/${MAX_RETRIES} za "${query}"`
            );

            await sleep(
                attempt * 1000
            );
        }
    }

    return [];
}

/*
 * ------------------------------------
 * GENERIŠI KVALITETNE QUERY-je
 * ------------------------------------
 */

function generateQueries(
    question: string
): string[] {
    const text =
        normalize(question)
            .replace(
                /[^a-z0-9čćšžđ\s]/gi,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    const queries =
        new Set<string>();

    const words =
        text
            .split(" ")
            .filter(Boolean);

    /*
     * --------------------------------
     * 1. CIJELE RIJEČI
     * --------------------------------
     */

    for (const word of words) {
        if (
            word.length < 5
        ) {
            continue;
        }

        if (
            STOP_WORDS.has(word)
        ) {
            continue;
        }

        /*
         * Endpoint pretraga koristi substring,
         * tako da cijela riječ često daje
         * dovoljno širok, ali smislen rezultat.
         */
        queries.add(
            word.slice(0, 20)
        );
    }

    /*
     * --------------------------------
     * 2. DVIJE RIJEČI
     * --------------------------------
     */

    for (
        let i = 0;
        i <
        words.length - 1;
        i++
    ) {
        const first =
            words[i];

        const second =
            words[i + 1];

        const pair =
            `${first} ${second}`;

        if (
            pair.length < 5 ||
            pair.length > 30
        ) {
            continue;
        }

        /*
         * Ako su obje riječi potpuno
         * beznačajne, ne treba nam query.
         */
        if (
            STOP_WORDS.has(first) &&
            STOP_WORDS.has(second)
        ) {
            continue;
        }

        queries.add(pair);
    }

    /*
     * --------------------------------
     * 3. TRI RIJEČI
     * --------------------------------
     */

    for (
        let i = 0;
        i <
        words.length - 2;
        i++
    ) {
        const a =
            words[i];

        const b =
            words[i + 1];

        const c =
            words[i + 2];

        const triple =
            `${a} ${b} ${c}`;

        if (
            triple.length < 5 ||
            triple.length > 35
        ) {
            continue;
        }

        const meaningful =
            [a, b, c].filter(
                word =>
                    !STOP_WORDS.has(
                        word
                    )
            ).length;

        /*
         * Tražimo da barem jedna riječ
         * bude smislenija.
         */
        if (
            meaningful === 0
        ) {
            continue;
        }

        queries.add(
            triple
        );
    }

    return [
        ...queries
    ];
}

/*
 * ------------------------------------
 * SIGURNO ČUVANJE
 * ------------------------------------
 */

function save(
    questions: Map<
        string,
        Question
    >
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

    const json =
        JSON.stringify(
            [
                ...questions.values()
            ],
            null,
            2
        );

    fs.writeFileSync(
        temp,
        json,
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
 * ------------------------------------
 * UČITAJ EXISTING FILE
 * ------------------------------------
 */

function loadQuestionsFromFile(
    file: string,
    questions: Map<
        string,
        Question
    >
) {
    if (
        !fs.existsSync(file)
    ) {
        return;
    }

    try {
        const raw =
            fs
                .readFileSync(
                    file,
                    "utf8"
                )
                .trim();

        if (!raw) {
            return;
        }

        const items:
            Question[] =
                JSON.parse(raw);

        for (
            const item of items
        ) {
            if (
                !item.pitanje ||
                !item.odgovor
            ) {
                continue;
            }

            questions.set(
                normalize(
                    item.pitanje
                ),
                item
            );
        }
    } catch (error) {
        console.warn(
            `Ne mogu učitati ${file}`
        );

        console.warn(error);
    }
}

/*
 * ------------------------------------
 * MAIN
 * ------------------------------------
 */

async function main() {
    const questions =
        new Map<
            string,
            Question
        >();

    /*
     * Originalnih ~1150 pitanja.
     */
    loadQuestionsFromFile(
        INPUT_FILE,
        questions
    );

    /*
     * Sve što je crawler već našao.
     */
    loadQuestionsFromFile(
        OUTPUT_FILE,
        questions
    );

    console.log(
        `Start: ${questions.size} pitanja`
    );

    if (
        questions.size >=
        TARGET
    ) {
        console.log(
            `Već imaš ${questions.size}/${TARGET}`
        );

        return;
    }

    /*
     * --------------------------------
     * QUEUE
     * --------------------------------
     */

    const queue:
        QueueItem[] = [];

    const queued =
        new Set<string>();

    const searched =
        new Set<string>();

    /*
     * Mala statistika.
     */
    const queryStats =
        new Map<
            string,
            {
                results: number;
                added: number;
            }
        >();

    function addQuery(
        query: string,
        priority = 0
    ) {
        query =
            normalize(query);

        if (
            query.length < 5
        ) {
            return;
        }

        if (
            queued.has(query) ||
            searched.has(query)
        ) {
            return;
        }

        queued.add(query);

        queue.push({
            query,
            priority,
        });
    }

    /*
     * --------------------------------
     * SEED QUEUE
     * --------------------------------
     */

    for (
        const question of
        questions.values()
    ) {
        const generated =
            generateQueries(
                question.pitanje
            );

        for (
            const query of generated
        ) {
            /*
             * Cijele početne seed query-je
             * stavimo na priority 1.
             */
            addQuery(
                query,
                1
            );
        }
    }

    console.log(
        `Početnih query-ja: ${queue.length}`
    );

    /*
     * --------------------------------
     * CRAWL
     * --------------------------------
     */

    let requests = 0;

    let totalNew = 0;

    let requestsSinceNew =
        0;

    let lastCheckpoint =
        questions.size;

    while (
        queue.length > 0 &&
        questions.size <
            TARGET
    ) {
        /*
         * Priority queue.
         *
         * Veći priority ide prvi.
         */
        queue.sort(
            (a, b) =>
                b.priority -
                a.priority
        );

        const next =
            queue.shift()!;

        const query =
            next.query;

        queued.delete(query);

        if (
            searched.has(query)
        ) {
            continue;
        }

        searched.add(query);

        requests++;

        try {
            const results =
                await search(query);

            let added = 0;

            const newItems:
                Question[] = [];

            for (
                const item of results
            ) {
                const key =
                    normalize(
                        item.pitanje
                    );

                if (
                    questions.has(key)
                ) {
                    continue;
                }

                questions.set(
                    key,
                    item
                );

                newItems.push(
                    item
                );

                added++;
                totalNew++;
            }

            queryStats.set(
                query,
                {
                    results:
                        results.length,

                    added,
                }
            );

            /*
             * --------------------------------
             * PRIORITET
             * --------------------------------
             *
             * Query koji je našao mnogo novih
             * pitanja je veoma koristan.
             */

            let childPriority =
                0;

            if (
                added >= 5
            ) {
                childPriority = 100;
            } else if (
                added >= 3
            ) {
                childPriority = 60;
            } else if (
                added === 2
            ) {
                childPriority = 35;
            } else if (
                added === 1
            ) {
                childPriority = 15;
            }

            /*
             * Ako je server vratio svih 15,
             * query vjerovatno ima još pogodaka
             * iza LIMIT-a.
             *
             * Malo povećamo priority potomaka.
             */
            if (
                results.length ===
                RESULT_LIMIT
            ) {
                childPriority +=
                    15;
            }

            /*
             * --------------------------------
             * GENERIŠI QUERY-je SAMO IZ NOVIH
             * PITANJA
             * --------------------------------
             *
             * Ovo je velika optimizacija.
             *
             * Nema potrebe svaki put ponovno
             * širiti preko svih 15 rezultata.
             */

            for (
                const item of
                    newItems
            ) {
                const generated =
                    generateQueries(
                        item.pitanje
                    );

                for (
                    const newQuery of
                        generated
                ) {
                    addQuery(
                        newQuery,
                        childPriority
                    );
                }
            }

            /*
             * --------------------------------
             * LOG
             * --------------------------------
             */

            const efficiency =
                results.length > 0
                    ? (
                        added /
                        results.length
                    ) *
                    100
                    : 0;

            console.log(
                `[${requests}] "${query}" -> ${results.length} rezultata | +${added} | eff ${efficiency.toFixed(0)}% | ${questions.size}/${TARGET} | queue ${queue.length}`
            );

            /*
             * --------------------------------
             * PRAĆENJE STAGNACIJE
             * --------------------------------
             */

            if (
                added > 0
            ) {
                requestsSinceNew =
                    0;
            } else {
                requestsSinceNew++;
            }

            if (
                requestsSinceNew ===
                250
            ) {
                console.log(
                    "⚠ 250 requestova bez novog pitanja."
                );
            }

            /*
             * --------------------------------
             * CHECKPOINT
             * --------------------------------
             */

            if (
                questions.size -
                    lastCheckpoint >=
                CHECKPOINT_EVERY
            ) {
                save(
                    questions
                );

                lastCheckpoint =
                    questions.size;

                console.log(
                    `💾 checkpoint ${questions.size}`
                );
            }

            await sleep(
                REQUEST_DELAY
            );
        } catch (error) {
            console.error(
                `Greška "${query}":`,
                error
            );

            /*
             * Ako search potpuno pukne
             * nakon svih retry-a,
             * sačuvaj stanje.
             */
            save(
                questions
            );

            await sleep(
                1500
            );
        }
    }

    /*
     * --------------------------------
     * FINAL SAVE
     * --------------------------------
     */

    save(
        questions
    );

    console.log(
        "\n=========================="
    );

    console.log(
        "GOTOVO"
    );

    console.log(
        `Pitanja: ${questions.size}`
    );

    console.log(
        `Novih pronađeno u ovom runu: ${totalNew}`
    );

    console.log(
        `Requestova: ${requests}`
    );

    console.log(
        `Preostalih query-ja: ${queue.length}`
    );

    console.log(
        `File: ${OUTPUT_FILE}`
    );
}

main().catch(error => {
    console.error(
        "\nCrawler pukao:"
    );

    console.error(error);

    process.exit(1);
});