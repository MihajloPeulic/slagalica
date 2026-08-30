// scripts/spojnice/process-spojnice-ai.ts

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
 * --------------------------------
 * CONFIG
 * --------------------------------
 */

const INPUT_FILE =
    "./data/spojnice-original.json";

const OUTPUT_FILE =
    "./data/spojnice-ai-preview.json";

const MODEL =
    "gpt-5.6-luna";

/*
 * Nemoj odmah stavljati 20.
 * Krenimo sa 10 da response bude
 * stabilan i lak za validaciju.
 */
const BATCH_SIZE = 10;

const DELAY_BETWEEN_BATCHES =
    500;

const MAX_RETRIES = 3;

/*
 * Čuva output poslije svakog batcha.
 */
const SAVE_EVERY_BATCH = true;

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

type OriginalGame = {
    id: number;
    tema: string;
    verzija: number;
    parovi: Pair[];
    created_at?: string;
};

type ProcessedGame = {
    id: number;

    /*
     * Još NE dodjeljujemo finalnu verziju.
     *
     * To ćemo uraditi tek kada svih
     * 1940 igara budu obrađene.
     */
    tema: string;

    /*
     * Interni canonical key.
     *
     * Primjer:
     * drzave-glavni-gradovi
     *
     * Ovo neće ići u Supabase.
     */
    themeKey: string;

    parovi: Pair[];
};

type AIResponse = {
    games: ProcessedGame[];
};

/*
 * --------------------------------
 * ENV
 * --------------------------------
 */

const OPENAI_API_KEY =
    process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    throw new Error(
        "Nedostaje OPENAI_API_KEY u .env.local"
    );
}

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

/*
 * --------------------------------
 * HELPERS
 * --------------------------------
 */

function sleep(ms: number) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

function normalizeThemeKey(
    value: string
) {
    return value
        .toLocaleLowerCase("sr-Latn")
        .replace(/č/g, "c")
        .replace(/ć/g, "c")
        .replace(/š/g, "s")
        .replace(/ž/g, "z")
        .replace(/đ/g, "dj")
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        );
}

/*
 * --------------------------------
 * LOAD JSON
 * --------------------------------
 */

function loadOriginalGames():
    OriginalGame[] {

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
        ) as OriginalGame[];

    if (
        !Array.isArray(
            games
        )
    ) {
        throw new Error(
            "Input JSON nije array."
        );
    }

    return games;
}

/*
 * --------------------------------
 * LOAD PREVIOUS CHECKPOINT
 * --------------------------------
 */

function loadProcessedGames():
    ProcessedGame[] {

    if (
        !fs.existsSync(
            OUTPUT_FILE
        )
    ) {
        return [];
    }

    try {
        const raw =
            fs.readFileSync(
                OUTPUT_FILE,
                "utf8"
            );

        const parsed =
            JSON.parse(
                raw
            ) as ProcessedGame[];

        if (
            !Array.isArray(
                parsed
            )
        ) {
            return [];
        }

        return parsed;
    } catch {
        console.warn(
            "⚠ AI preview JSON nije validan. Krećem bez checkpointa."
        );

        return [];
    }
}

/*
 * --------------------------------
 * SAFE SAVE
 * --------------------------------
 */

function saveProcessedGames(
    games: ProcessedGame[]
) {
    fs.mkdirSync(
        "./data",
        {
            recursive: true,
        }
    );

    const tempFile =
        OUTPUT_FILE +
        ".tmp";

    fs.writeFileSync(
        tempFile,
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
        tempFile,
        OUTPUT_FILE
    );
}

/*
 * --------------------------------
 * VALIDACIJA JEDNE IGRE
 * --------------------------------
 */

function validateProcessedGame(
    original:
        OriginalGame,

    processed:
        ProcessedGame
): string[] {

    const errors:
        string[] = [];

    /*
     * ID se ne smije promijeniti.
     */
    if (
        processed.id !==
        original.id
    ) {
        errors.push(
            `Pogrešan ID`
        );
    }

    /*
     * Mora imati temu.
     */
    if (
        !processed.tema ||
        typeof processed.tema !==
            "string"
    ) {
        errors.push(
            "Nema temu"
        );
    }

    /*
     * Tema mora počinjati sa Poveži.
     */
    if (
        processed.tema &&
        !processed.tema
            .toLocaleLowerCase(
                "sr-Latn"
            )
            .startsWith(
                "poveži "
            )
    ) {
        errors.push(
            `Tema ne počinje sa "Poveži"`
        );
    }

    /*
     * Mora imati themeKey.
     */
    if (
        !processed.themeKey ||
        typeof processed.themeKey !==
            "string"
    ) {
        errors.push(
            "Nema themeKey"
        );
    }

    /*
     * Mora vratiti isti broj parova.
     */
    if (
        !Array.isArray(
            processed.parovi
        )
    ) {
        errors.push(
            "Parovi nisu array"
        );

        return errors;
    }

    if (
        processed.parovi.length !==
        original.parovi.length
    ) {
        errors.push(
            `Broj parova promijenjen: ${original.parovi.length} -> ${processed.parovi.length}`
        );
    }

    /*
     * Pair ID-evi moraju ostati isti.
     */
    for (
        let i = 0;
        i <
        Math.min(
            original.parovi.length,
            processed.parovi.length
        );
        i++
    ) {
        const before =
            original.parovi[i];

        const after =
            processed.parovi[i];

        if (
            before.id !==
            after.id
        ) {
            errors.push(
                `Par ${i}: ID promijenjen`
            );
        }

        if (
            !after.left ||
            !after.right
        ) {
            errors.push(
                `Par ${i}: prazan left/right`
            );
        }
    }

    return errors;
}

/*
 * --------------------------------
 * PROMPT
 * --------------------------------
 */

function buildPrompt(
    games: OriginalGame[]
) {

    /*
     * AI-u šaljemo samo ono
     * što mu treba.
     */
    const payload =
        games.map(game => ({
            id: game.id,

            parovi:
                game.parovi.map(
                    pair => ({
                        id:
                            pair.id,

                        left:
                            pair.left,

                        right:
                            pair.right,
                    })
                ),
        }));

    return `
Ti uređuješ podatke za srpsku kviz igru "Spojnice".

Dobićeš više igara odjednom.

Za SVAKU igru moraš:

1. Pročitati SVIH 8 parova prije nego što odlučiš temu.

2. Odrediti PRECIZNU zajedničku vezu između lijeve i desne kolone.

3. Napisati temu OBAVEZNO u formatu:

"Poveži X i Y"

Primjeri:

"Poveži države i glavne gradove"
"Poveži pisce i književna djela"
"Poveži glumce i filmske uloge"
"Poveži države i valute"
"Poveži fudbalere i klubove"
"Poveži hemijske elemente i simbole"
"Poveži istorijske ličnosti i događaje"
"Poveži planine i države"

Nemoj koristiti generičke teme:

"Opšte znanje"
"Razno"
"Poveži pojmove"
"Poveži osobe i pojmove"

Tema mora jasno opisati odnos između lijeve i desne strane.

JEZIK I STIL TEME

Sve teme piši na srpskom jeziku, latinicom i ekavicom.


Tema mora biti što kraća i sastojati se uglavnom od dvije kategorije:

"Poveži X i Y"

Preferiraj:
"Poveži muzičke grupe i gradove"

umjesto:
"Poveži muzičke grupe i gradove iz kojih potiču"

Preferiraj:
"Poveži novčanice i ličnosti"

umjesto:
"Poveži novčanice i ličnosti prikazane na njima"

Ne koristi riječi:
- njihove
- njihova
- njihov
- na kojima
- iz kojih
- koji su
- koje su

osim ako su apsolutno neophodne da tema bude tačna.

Ne koristi "ili" u temi ako se može pronaći jedna zajednička kategorija.

Primjer:
NE:
"Poveži znamenitosti i države ili gradove"

DA:
"Poveži znamenitosti i lokacije"

--------------------------------------------------

VEOMA VAŽNO ZA ISTE TEME

Ako više igara predstavljaju isti tip veze,
koristi POTPUNO ISTU temu.

Na primjer:

Ako jedna igra ima:

Srbija -> Beograd
Francuska -> Pariz

a druga:

Italija -> Rim
Njemačka -> Berlin

obje moraju dobiti:

"Poveži države i glavne gradove"

Nemoj jednom napisati:

"Poveži države i glavne gradove"

a drugi put:

"Poveži zemlje i njihove prestonice"

Koristi jedan canonical naziv.

--------------------------------------------------

THEME KEY

Za svaku temu napravi i themeKey.

Primjer:

tema:
"Poveži države i glavne gradove"

themeKey:
"drzave-glavni-gradovi"

Za isti tip veze themeKey MORA biti isti.

themeKey piši:
- malim slovima
- bez dijakritike
- riječi odvojene crticama
- bez "povezi"

--------------------------------------------------

ISPRAVLJANJE OŠIŠANE LATINICE

Svi left i right tekstovi mogu biti zapisani
bez srpskih znakova.

Moraš ih vratiti u pravilnu srpsku latinicu.

Koristi:

č
ć
š
ž
đ

Primjeri:

"Svajcarska"
->
"Švajcarska"

"Djordje Balasevic"
->
"Đorđe Balašević"

"knjizevnost"
->
"književnost"

"Milosevic"
->
"Milošević"

"Nemacka"
->
"Nemačka"

--------------------------------------------------

ALI:

Ne mijenjaj stvarni sadržaj para.

Smiješ:
- vratiti č ć š ž đ
- popraviti velika/mala slova kada je očigledno
- popraviti očigledan pravopis nastao zbog ošišane latinice

NE smiješ:
- zamijeniti odgovor drugim odgovorom
- dodavati informacije
- brisati informacije
- mijenjati značenje
- mijenjati ID igre
- mijenjati ID para
- mijenjati redoslijed parova

Ako nisi potpuno siguran da neka riječ treba dijakritiku,
radije ostavi original nego da izmisliš novu riječ.

--------------------------------------------------

Posebno pazi na vlastita imena.

Primjer:

"Cacak" -> "Čačak"
"Zeljko" -> "Željko"
"Djokovic" -> "Đoković"
"Novak Djokovic" -> "Novak Đoković"

Ali strana vlastita imena NE prevodi.

"George Washington"
ostaje
"George Washington"

--------------------------------------------------

Vrati ISKLJUČIVO validan JSON.

Tačno ova struktura:

{
  "games": [
    {
      "id": 123,
      "tema": "Poveži države i glavne gradove",
      "themeKey": "drzave-glavni-gradovi",
      "parovi": [
        {
          "id": 1,
          "left": "Srbija",
          "right": "Beograd"
        }
      ]
    }
  ]
}

Moraš vratiti TAČNO ${games.length} igara.

Ulaz:

${JSON.stringify(payload, null, 2)}
`;
}

/*
 * --------------------------------
 * CALL OPENAI
 * --------------------------------
 */

async function processBatch(
    games: OriginalGame[]
): Promise<
    ProcessedGame[]
> {

    const prompt =
        buildPrompt(games);

    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {
        try {
            const response =
                await openai.responses.create({
                    model:
                        MODEL,

                    input:
                        prompt,

                    /*
                     * Tražimo običan JSON.
                     *
                     * Dodatno ga svakako
                     * validiramo lokalno.
                     */
                    text: {
                        format: {
                            type:
                                "json_object",
                        },
                    },
                });

            const text =
                response.output_text;

            if (!text) {
                throw new Error(
                    "AI nije vratio tekst."
                );
            }

            const parsed =
                JSON.parse(
                    text
                ) as AIResponse;

            if (
                !parsed ||
                !Array.isArray(
                    parsed.games
                )
            ) {
                throw new Error(
                    "AI response nema games array."
                );
            }

            if (
                parsed.games.length !==
                games.length
            ) {
                throw new Error(
                    `AI vratio ${parsed.games.length}, očekivano ${games.length}`
                );
            }

            /*
             * --------------------------------
             * SORTIRAJ PO ORIGINALNOM ID-u
             * --------------------------------
             */

            const byId =
                new Map<
                    number,
                    ProcessedGame
                >();

            for (
                const game of
                    parsed.games
            ) {
                byId.set(
                    game.id,
                    game
                );
            }

            const ordered:
                ProcessedGame[] = [];

            for (
                const original of
                    games
            ) {
                const processed =
                    byId.get(
                        original.id
                    );

                if (!processed) {
                    throw new Error(
                        `AI nije vratio ID ${original.id}`
                    );
                }

                /*
                 * Canonicalizujemo themeKey
                 * i sa naše strane.
                 */
                processed.themeKey =
                    normalizeThemeKey(
                        processed.themeKey ||
                        processed.tema
                            .replace(
                                /^poveži\s+/i,
                                ""
                            )
                    );

                const errors =
                    validateProcessedGame(
                        original,
                        processed
                    );

                if (
                    errors.length >
                    0
                ) {
                    throw new Error(
                        `ID ${original.id}: ${errors.join(", ")}`
                    );
                }

                ordered.push(
                    processed
                );
            }

            return ordered;
        } catch (error) {
            console.error(
                `AI batch pokušaj ${attempt}/${MAX_RETRIES} nije uspio:`
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
 * --------------------------------
 * MAIN
 * --------------------------------
 */

async function main() {

    const originalGames =
        loadOriginalGames();

    console.log(
        `Originalnih igara: ${originalGames.length}`
    );

    /*
     * --------------------------------
     * LOAD CHECKPOINT
     * --------------------------------
     */

    const processedGames =
        loadProcessedGames();

    const processedIds =
        new Set(
            processedGames.map(
                game =>
                    game.id
            )
        );

    console.log(
        `Već obrađeno: ${processedIds.size}`
    );

    /*
     * --------------------------------
     * PRONAĐI PREOSTALE
     * --------------------------------
     */

    const remaining =
        originalGames.filter(
            game =>
                !processedIds.has(
                    game.id
                )
        );

    console.log(
        `Preostalo: ${remaining.length}`
    );

    if (
        remaining.length ===
        0
    ) {
        console.log(
            "Sve igre su već obrađene."
        );

        return;
    }

    /*
     * --------------------------------
     * BATCH LOOP
     * --------------------------------
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
            ) +
            1;

        const totalBatches =
            Math.ceil(
                remaining.length /
                    BATCH_SIZE
            );

        console.log(
            "\n--------------------------------"
        );

        console.log(
            `Batch ${batchNumber}/${totalBatches}`
        );

        console.log(
            `ID: ${batch[0].id} -> ${batch[batch.length - 1].id}`
        );

        try {
            const result =
                await processBatch(
                    batch
                );

            for (
                const game of result
            ) {
                processedGames.push(
                    game
                );

                processedIds.add(
                    game.id
                );

                console.log(
                    `✓ ${game.id} | ${game.tema}`
                );
            }

            /*
             * Držimo output sortiran
             * po originalnom ID-u.
             */
            processedGames.sort(
                (a, b) =>
                    a.id -
                    b.id
            );

            if (
                SAVE_EVERY_BATCH
            ) {
                saveProcessedGames(
                    processedGames
                );

                console.log(
                    `💾 Checkpoint: ${processedGames.length}/${originalGames.length}`
                );
            }
        } catch (error) {
            /*
             * Bitno:
             *
             * Ne preskačemo pokvaren batch,
             * jer bismo poslije imali rupe.
             */
            saveProcessedGames(
                processedGames
            );

            console.error(
                "\n❌ Batch nije moguće obraditi."
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
     * --------------------------------
     * FINAL SAVE
     * --------------------------------
     */

    processedGames.sort(
        (a, b) =>
            a.id -
            b.id
    );

    saveProcessedGames(
        processedGames
    );

    console.log(
        "\n=============================="
    );

    console.log(
        "AI OBRADA ZAVRŠENA"
    );

    console.log(
        `Originalnih: ${originalGames.length}`
    );

    console.log(
        `Obrađenih: ${processedGames.length}`
    );

    console.log(
        `File: ${OUTPUT_FILE}`
    );

    console.log(
        "=============================="
    );
}

main().catch(error => {

    console.error(
        "\nFatal error:"
    );

    console.error(
        error
    );

    process.exit(1);
});