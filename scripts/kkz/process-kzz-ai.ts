import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({
    path: path.resolve(
        process.cwd(),
        ".env.local"
    ),
});

/*
 * ========================================
 * CONFIG
 * ========================================
 */

const INPUT_FILE =
    "./data/ko-zna-zna-search.json";

const CHECKPOINT_FILE =
    "./data/ko-zna-zna-ai-checkpoint.json";

const OUTPUT_FILE =
    "./data/ko-zna-zna-final.json";

const MODEL =
    "gpt-5.6-luna";

const BATCH_SIZE = 10;

const MAX_RETRIES = 3;

const DELAY_BETWEEN_BATCHES =
    500;

/*
 * ========================================
 * TYPES
 * ========================================
 */

type RawQuestion = {
    sourceId?: string;
    pitanje: string;
    odgovor: string;
};

/*
 * Ono što tražimo od AI-a.
 */
type AIProcessedQuestion = {
    key: number;
    pitanje: string;
    odgovor: string;
    pogresneOpcije: [
        string,
        string,
        string
    ];
};

type AIResponse = {
    questions:
        AIProcessedQuestion[];
};

/*
 * Interni checkpoint.
 *
 * sourceIndex koristimo samo da znamo
 * koje pitanje je već obrađeno.
 *
 * NEĆE završiti u finalnom JSON-u.
 */
type CheckpointQuestion = {
    sourceIndex: number;
    pitanje: string;
    opcije: [
        string,
        string,
        string,
        string
    ];
    tacna_opcija: number;
};

/*
 * Ovo je TAČNO format tvoje
 * Supabase tabele.
 */
type FinalQuestion = {
    pitanje: string;
    opcije: [
        string,
        string,
        string,
        string
    ];
    tacna_opcija: number;
};

/*
 * ========================================
 * OPENAI
 * ========================================
 */

const OPENAI_API_KEY =
    process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    throw new Error(
        "Nedostaje OPENAI_API_KEY u .env.local"
    );
}

const openai =
    new OpenAI({
        apiKey:
            OPENAI_API_KEY,
    });

/*
 * ========================================
 * HELPERS
 * ========================================
 */

function sleep(
    ms: number
) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

/*
 * Normalizacija samo za poređenje
 * odgovora i detekciju duplikata.
 */
function normalize(
    value: string
) {
    return value
        .toLocaleLowerCase(
            "sr-Latn"
        )
        .normalize("NFKC")
        .replace(
            /[.,!?;:"'()[\]{}]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

/*
 * ========================================
 * LOAD INPUT
 * ========================================
 */

function loadRawQuestions():
    RawQuestion[] {

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
        ) as RawQuestion[];

    if (
        !Array.isArray(
            questions
        )
    ) {
        throw new Error(
            "Input JSON nije array."
        );
    }

    return questions;
}

/*
 * ========================================
 * LOAD CHECKPOINT
 * ========================================
 */

function loadCheckpoint():
    CheckpointQuestion[] {

    if (
        !fs.existsSync(
            CHECKPOINT_FILE
        )
    ) {
        return [];
    }

    try {
        const raw =
            fs.readFileSync(
                CHECKPOINT_FILE,
                "utf8"
            );

        const data =
            JSON.parse(
                raw
            ) as CheckpointQuestion[];

        if (
            !Array.isArray(
                data
            )
        ) {
            return [];
        }

        return data;
    } catch {
        console.warn(
            "⚠ Checkpoint nije validan."
        );

        return [];
    }
}

/*
 * ========================================
 * SAFE SAVE
 * ========================================
 */

function safeWriteJson(
    filename: string,
    data: unknown
) {
    fs.mkdirSync(
        "./data",
        {
            recursive: true,
        }
    );

    const temp =
        filename +
        ".tmp";

    fs.writeFileSync(
        temp,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );

    if (
        fs.existsSync(
            filename
        )
    ) {
        fs.rmSync(
            filename
        );
    }

    fs.renameSync(
        temp,
        filename
    );
}

function saveCheckpoint(
    questions:
        CheckpointQuestion[]
) {
    questions.sort(
        (a, b) =>
            a.sourceIndex -
            b.sourceIndex
    );

    safeWriteJson(
        CHECKPOINT_FILE,
        questions
    );
}

/*
 * ========================================
 * SHUFFLE
 * ========================================
 */

function shuffleOptions(
    correct: string,
    wrong:
        [string, string, string]
): {
    opcije:
        [
            string,
            string,
            string,
            string
        ];

    tacna_opcija: number;
} {

    const options = [
        correct,
        ...wrong,
    ];

    /*
     * Fisher-Yates shuffle.
     */
    for (
        let i =
            options.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            options[i],
            options[j],
        ] = [
            options[j],
            options[i],
        ];
    }

    const correctIndex =
        options.findIndex(
            option =>
                option ===
                correct
        );

    if (
        correctIndex === -1
    ) {
        throw new Error(
            "Tačan odgovor nestao tokom shuffle-a."
        );
    }

    return {
        opcije:
            options as [
                string,
                string,
                string,
                string
            ],

        tacna_opcija:
            correctIndex,
    };
}

/*
 * ========================================
 * PROMPT
 * ========================================
 */

function buildPrompt(
    batch: {
        key: number;
        pitanje: string;
        odgovor: string;
    }[]
) {
    return `
Ti uređuješ pitanja za srpsku kviz igru
"Ko zna zna".

Za svako pitanje dobijaš:

- key
- pitanje
- tačan odgovor

Tvoj posao je:

1. Ispraviti pitanje iz ošišane latinice
   u pravilnu srpsku latinicu.

2. Ispraviti tačan odgovor iz ošišane
   latinice u pravilnu srpsku latinicu.

3. Generisati TAČNO TRI pogrešne,
   ali uvjerljive opcije odgovora.

==================================================

JEZIK

Koristi pravilnu srpsku latinicu:

č
ć
š
ž
đ

Primjeri:

Svajcarska
->
Švajcarska

Djordje
->
Đorđe

Nemacka
->
Nemačka

knjizevnost
->
književnost

Milosevic
->
Milošević

==================================================

VEOMA VAŽNO

NE MIJENJAJ činjenicu niti značenje pitanja.

Originalni "odgovor" je TAČAN odgovor.

Smiješ ga samo:

- ispraviti u č/ć/š/ž/đ
- ispraviti velika i mala slova
- ispraviti očigledan pravopis nastao
  zbog ošišane latinice

NE SMIJEŠ zamijeniti tačan odgovor
nekim drugim odgovorom čak ni ako misliš
da postoji bolji način da se napiše.

Ako nisi siguran treba li strani naziv imati
srpsku dijakritiku, nemoj izmišljati.

Strana imena ne prevodi bez razloga.

==================================================

POGREŠNE OPCIJE

Moraš generisati TAČNO 3 pogrešne opcije.

Sve 3 moraju:

- biti različite jedna od druge
- biti različite od tačnog odgovora
- biti uvjerljive
- pripadati istoj kategoriji kao tačan odgovor
- gramatički odgovarati pitanju
- imati smisla kao mogući odgovor

Primjer:

Pitanje:
"Glavni grad Austrije je?"

Tačan odgovor:
"Beč"

DOBRO:

[
    "Salzburg",
    "Graz",
    "Inzbruk"
]

LOŠE:

[
    "Nikola Tesla",
    "1987",
    "Atlantik"
]

==================================================

Ako je odgovor OSOBA:

ostale opcije treba uglavnom da budu osobe
sličnog istorijskog, sportskog, umjetničkog
ili drugog konteksta.

Ako je odgovor DRŽAVA:

distraktori treba da budu države.

Ako je odgovor GRAD:

distraktori treba da budu gradovi.

Ako je odgovor GODINA:

distraktori treba da budu realistične godine
iz približnog perioda.

Ako je odgovor BROJ:

distraktori treba da budu realistični brojevi.

Ako je odgovor KNJIŽEVNO DJELO:

distraktori treba da budu druga književna djela.

Ako je odgovor AUTOR:

distraktori treba da budu drugi relevantni autori.

Ako je odgovor HEMIJSKI ELEMENT:

distraktori treba da budu elementi.

Isto pravilo primijeni na sve druge kategorije.

==================================================

NE PRAVI PRELAKE DISTRAKTORE.

Ako je pitanje:

"Ko je napisao Na Drini ćuprija?"

nemoj dati:

- Pariz
- 1945
- kiseonik

nego druge pisce, npr. iz sličnog
književnog konteksta.

==================================================

PAZI DA POGREŠNA OPCIJA NIJE TAKOĐE TAČNA.

Ako pitanje može imati više mogućih odgovora,
izaberi distraktore koji definitivno nisu
ispravni odgovori na postavljeno pitanje.

==================================================

PITANJE

Ispravi i interpunkciju kada je očigledna.

Ako je prirodno pitanje, može završiti sa "?".

Ne prepravljaj stil nepotrebno.
Ne proširuj pitanje.
Ne dodaj objašnjenja.

==================================================

VRATI ISKLJUČIVO JSON.

Struktura:

{
  "questions": [
    {
      "key": 123,
      "pitanje": "Ispravljeno pitanje?",
      "odgovor": "Tačan odgovor",
      "pogresneOpcije": [
        "Pogrešan odgovor 1",
        "Pogrešan odgovor 2",
        "Pogrešan odgovor 3"
      ]
    }
  ]
}

Moraš vratiti TAČNO ${batch.length} pitanja.

key se NE SMIJE promijeniti.

INPUT:

${JSON.stringify(batch, null, 2)}
`;
}

/*
 * ========================================
 * VALIDATE AI QUESTION
 * ========================================
 */

function validateAIQuestion(
    original: RawQuestion,
    result:
        AIProcessedQuestion
): string[] {

    const errors:
        string[] = [];

    if (
        !result.pitanje?.trim()
    ) {
        errors.push(
            "Nema pitanje"
        );
    }

    if (
        !result.odgovor?.trim()
    ) {
        errors.push(
            "Nema odgovor"
        );
    }

    if (
        !Array.isArray(
            result.pogresneOpcije
        ) ||
        result
            .pogresneOpcije
            .length !== 3
    ) {
        errors.push(
            "Nema tačno 3 pogrešne opcije"
        );

        return errors;
    }

    const correct =
        normalize(
            result.odgovor
        );

    const wrongNormalized =
        result
            .pogresneOpcije
            .map(normalize);

    /*
     * Nijedan distractor ne smije
     * biti isti kao tačan odgovor.
     */
    for (
        const wrong of
            wrongNormalized
    ) {
        if (
            wrong === correct
        ) {
            errors.push(
                "Pogrešna opcija jednaka tačnom odgovoru"
            );
        }
    }

    /*
     * Sve pogrešne opcije moraju
     * biti međusobno različite.
     */
    const uniqueWrong =
        new Set(
            wrongNormalized
        );

    if (
        uniqueWrong.size !==
        3
    ) {
        errors.push(
            "Duplikati među pogrešnim opcijama"
        );
    }

    /*
     * Zaštita od praznih stringova.
     */
    for (
        const wrong of
            result.pogresneOpcije
    ) {
        if (
            !wrong?.trim()
        ) {
            errors.push(
                "Prazna pogrešna opcija"
            );
        }
    }

    return errors;
}

/*
 * ========================================
 * PROCESS BATCH
 * ========================================
 */

async function repairQuestion(
    key: number,
    original: RawQuestion,
    previous: AIProcessedQuestion
): Promise<AIProcessedQuestion> {

    const prompt = `
Popravi samo ovo jedno kviz pitanje.

Originalno pitanje:
${original.pitanje}

Originalni tačan odgovor:
${original.odgovor}

Prethodni AI rezultat:

${JSON.stringify(previous, null, 2)}

Problem je što rezultat nije prošao validaciju.

Pravila:

1. Tačan odgovor mora ostati isti po značenju.
2. Ispravi ošišanu latinicu.
3. Vrati TAČNO 3 pogrešne opcije.
4. Nijedna pogrešna opcija NE SMIJE biti ista kao tačan odgovor.
5. Pogrešne opcije moraju biti međusobno različite.
6. Sve opcije moraju biti realistični odgovori iste vrste/kategorije.
7. Pogrešna opcija ne smije takođe biti tačan odgovor na pitanje.

Vrati SAMO JSON:

{
  "key": ${key},
  "pitanje": "...",
  "odgovor": "...",
  "pogresneOpcije": [
    "...",
    "...",
    "..."
  ]
}
`;

    for (
        let attempt = 1;
        attempt <= 3;
        attempt++
    ) {
        const response =
            await openai.responses.create({
                model: MODEL,

                reasoning: {
                    effort: "low",
                },

                input: prompt,

                text: {
                    format: {
                        type: "json_object",
                    },
                },
            });

        if (
            !response.output_text
        ) {
            continue;
        }

        const result =
            JSON.parse(
                response.output_text
            ) as AIProcessedQuestion;

        const errors =
            validateAIQuestion(
                original,
                result
            );

        if (
            errors.length === 0
        ) {
            console.log(
                `✓ Key ${key} popravljen posebnim requestom`
            );

            return result;
        }

        console.warn(
            `⚠ Repair pokušaj ${attempt}/3 za key ${key}: ${errors.join(", ")}`
        );
    }

    throw new Error(
        `Nije moguće popraviti key ${key}`
    );
}

async function processBatch(
    batch: {
        key: number;
        question:
            RawQuestion;
    }[]
): Promise<
    AIProcessedQuestion[]
> {


    const promptInput =
        batch.map(
            item => ({
                key:
                    item.key,

                pitanje:
                    item
                        .question
                        .pitanje,

                odgovor:
                    item
                        .question
                        .odgovor,
            })
        );

    const prompt =
        buildPrompt(
            promptInput
        );

    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {
        try {
            const response =
                await openai
                    .responses
                    .create({
                        model:
                            MODEL,

                        reasoning: {
                            effort:
                                "low",
                        },

                        input:
                            prompt,

                        text: {
                            format: {
                                type:
                                    "json_object",
                            },
                        },
                    });

            if (
                !response.output_text
            ) {
                throw new Error(
                    "AI nije vratio output."
                );
            }

            const parsed =
                JSON.parse(
                    response
                        .output_text
                ) as AIResponse;

            if (
                !parsed ||
                !Array.isArray(
                    parsed.questions
                )
            ) {
                throw new Error(
                    "Response nema questions array."
                );
            }

            if (
                parsed
                    .questions
                    .length !==
                batch.length
            ) {
                throw new Error(
                    `AI vratio ${parsed.questions.length}, očekivano ${batch.length}`
                );
            }

            /*
             * Map po key-u.
             */
            const byKey =
                new Map<
                    number,
                    AIProcessedQuestion
                >();

            for (
                const item of
                    parsed.questions
            ) {
                byKey.set(
                    item.key,
                    item
                );
            }

            const ordered:
                AIProcessedQuestion[] =
                [];

            for (
                const item of batch
            ) {
                const result =
                    byKey.get(
                        item.key
                    );

                if (!result) {
                    throw new Error(
                        `AI nije vratio key ${item.key}`
                    );
                }

                const errors =
                    validateAIQuestion(
                        item.question,
                        result
                    );

                if (
                    errors.length
                ) {
                    console.warn(
                        `⚠ Key ${item.key} nije validan: ${errors.join(", ")}`
                    );

                    const fixed =
                        await repairQuestion(
                            item.key,
                            item.question,
                            result
                        );

                    ordered.push(
                        fixed
                    );

                    continue;
                }

                ordered.push(
                    result
                );
            }

            return ordered;

        } catch (error: any) {

            /*
             * Nema smisla retry ako
             * nemaš API kredita.
             */
            if (
                error?.code ===
                    "insufficient_quota"
            ) {
                throw error;
            }

            console.error(
                `⚠ AI pokušaj ${attempt}/${MAX_RETRIES} nije uspio`
            );

            console.error(
                error
            );

            if (
                attempt ===
                MAX_RETRIES
            ) {
                throw error;
            }

            await sleep(
                attempt *
                2000
            );
        }
    }

    throw new Error(
        "Batch nije obrađen."
    );
}

/*
 * ========================================
 * FINAL OUTPUT
 * ========================================
 */

function createFinalOutput(
    checkpoint:
        CheckpointQuestion[]
): FinalQuestion[] {

    return checkpoint
        .sort(
            (a, b) =>
                a.sourceIndex -
                b.sourceIndex
        )
        .map(
            item => ({
                pitanje:
                    item.pitanje,

                opcije:
                    item.opcije,

                tacna_opcija:
                    item
                        .tacna_opcija,
            })
        );
}

/*
 * ========================================
 * MAIN
 * ========================================
 */

async function main() {

    const rawQuestions =
        loadRawQuestions();

    console.log(
        `Input pitanja: ${rawQuestions.length}`
    );

    /*
     * SOURCE ID SE NIGDJE DALJE
     * NE KORISTI.
     */

    const checkpoint =
        loadCheckpoint();

    const processedIndexes =
        new Set(
            checkpoint.map(
                item =>
                    item.sourceIndex
            )
        );

    console.log(
        `Već obrađeno: ${processedIndexes.size}`
    );

    /*
     * Napravimo listu samo
     * neobrađenih pitanja.
     */
    const remaining =
        rawQuestions
            .map(
                (
                    question,
                    index
                ) => ({
                    key:
                        index,

                    question,
                })
            )
            .filter(
                item =>
                    !processedIndexes
                        .has(
                            item.key
                        )
            );

    console.log(
        `Preostalo: ${remaining.length}`
    );

    /*
     * ====================================
     * BATCH LOOP
     * ====================================
     */

    for (
        let start = 0;
        start <
        remaining.length;
        start +=
            BATCH_SIZE
    ) {
        const batch =
            remaining.slice(
                start,
                start +
                    BATCH_SIZE
            );

        const batchNumber =
            Math.floor(
                start /
                    BATCH_SIZE
            ) + 1;

        const totalBatches =
            Math.ceil(
                remaining.length /
                    BATCH_SIZE
            );

        console.log(
            "\n-----------------------------"
        );

        console.log(
            `Batch ${batchNumber}/${totalBatches}`
        );

        console.log(
            `Index ${batch[0].key} -> ${batch[batch.length - 1].key}`
        );

        try {
            const results =
                await processBatch(
                    batch
                );

            for (
                const result of
                    results
            ) {
                /*
                 * Pronađemo original
                 * po key-u/indexu.
                 */
                const original =
                    rawQuestions[
                        result.key
                    ];

                if (!original) {
                    throw new Error(
                        `Ne postoji original za key ${result.key}`
                    );
                }

                /*
                 * AI vrati:
                 *
                 * correct
                 * + 3 wrong
                 *
                 * Mi radimo shuffle.
                 */
                const {
                    opcije,
                    tacna_opcija,
                } =
                    shuffleOptions(
                        result.odgovor,
                        result
                            .pogresneOpcije
                    );

                checkpoint.push({
                    sourceIndex:
                        result.key,

                    pitanje:
                        result.pitanje,

                    opcije,

                    tacna_opcija,
                });

                processedIndexes.add(
                    result.key
                );

                console.log(
                    `✓ ${result.key} | ${result.pitanje}`
                );

                console.log(
                    `   ${tacna_opcija} -> ${opcije[tacna_opcija]}`
                );
            }

            /*
             * Checkpoint poslije
             * SVAKOG batcha.
             */
            saveCheckpoint(
                checkpoint
            );

            console.log(
                `💾 ${checkpoint.length}/${rawQuestions.length}`
            );

        } catch (error) {

            /*
             * Nikad ne gubimo prethodno
             * obrađene podatke.
             */
            saveCheckpoint(
                checkpoint
            );

            console.error(
                "\n❌ Batch nije obrađen."
            );

            console.error(
                "Checkpoint je sačuvan."
            );

            console.error(
                error
            );

            process.exit(1);
        }

        await sleep(
            DELAY_BETWEEN_BATCHES
        );
    }

    /*
     * ====================================
     * FINAL VALIDATION
     * ====================================
     */

    if (
        checkpoint.length !==
        rawQuestions.length
    ) {
        throw new Error(
            `Nisu obrađena sva pitanja: ${checkpoint.length}/${rawQuestions.length}`
        );
    }

    /*
     * ====================================
     * FINAL JSON
     * ====================================
     */

    const final =
        createFinalOutput(
            checkpoint
        );

    safeWriteJson(
        OUTPUT_FILE,
        final
    );

    console.log(
        "\n=============================="
    );

    console.log(
        "KO ZNA ZNA OBRADA ZAVRŠENA"
    );

    console.log(
        `Pitanja: ${final.length}`
    );

    console.log(
        `Final file: ${OUTPUT_FILE}`
    );

    console.log(
        "=============================="
    );
}

main().catch(
    error => {

        console.error(
            "\nFatal error:"
        );

        console.error(
            error
        );

        process.exit(1);
    }
);