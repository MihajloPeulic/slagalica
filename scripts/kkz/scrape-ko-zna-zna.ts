// scripts/scrape-ko-zna-zna.ts

import { chromium, Page } from "playwright";
import fs from "fs";

const TARGET_QUESTIONS = 3000;
const OUTPUT_FILE = "./data/ko-zna-zna-raw.json";

const BASE_URL =
    "https://www.ludara.com/trening/ko-zna-zna/";

type ScrapedQuestion = {
    sourceId: string;
    pitanje: string;
    odgovor: string;
};

function cleanText(value: string) {
    return value
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeQuestion(value: string) {
    return cleanText(value)
        .toLocaleLowerCase("sr-Latn");
}

/*
 * -----------------------------------------
 * SCRAPE JEDNOG PITANJA
 * -----------------------------------------
 */

async function scrapeQuestion(
    page: Page
): Promise<ScrapedQuestion> {
    const questionElement =
        page.locator(".polje70");

    await questionElement.waitFor({
        state: "visible",
        timeout: 10_000,
    });

    const pitanje = cleanText(
        await questionElement.innerText()
    );

    const sourceId =
        await questionElement.getAttribute("id");

    if (!sourceId) {
        throw new Error(
            `Pitanje nema ID: ${pitanje}`
        );
    }

    /*
     * Kliknemo sva ponuđena slova redom
     * da namjerno dobijemo pogrešan odgovor.
     */

    const letters = page.locator(
        ".dugme.kzz.slovo"
    );

    const letterCount =
        await letters.count();

    if (letterCount === 0) {
        throw new Error(
            `Nema ponuđenih slova za pitanje: ${pitanje}`
        );
    }

    for (
        let i = 0;
        i < letterCount;
        i++
    ) {
        await letters.nth(i).click();

        await page.waitForTimeout(20);
    }

    /*
     * Nakon pogrešnog odgovora Ludara napravi:
     *
     * <h4
     *   id="resenje"
     *   onclick="resi('PERIJECI');"
     * >
     */

    const solutionElement =
        page.locator("#resenje");

    await solutionElement.waitFor({
        state: "attached",
        timeout: 5000,
    });

    const onclick =
        await solutionElement.getAttribute(
            "onclick"
        );

    if (!onclick) {
        throw new Error(
            `#resenje nema onclick za: ${pitanje}`
        );
    }

    /*
     * resi('PERIJECI');
     *
     * ↓
     *
     * PERIJECI
     */

    const match = onclick.match(
        /resi\(\s*['"](.+?)['"]\s*\)/i
    );

    if (!match) {
        throw new Error(
            `Ne mogu parsirati odgovor iz: ${onclick}`
        );
    }

    const odgovor =
        cleanText(match[1]);

    if (!odgovor) {
        throw new Error(
            `Prazan odgovor za pitanje: ${pitanje}`
        );
    }

    return {
        sourceId,
        pitanje,
        odgovor,
    };
}

/*
 * -----------------------------------------
 * IDI NA NOVU IGRU
 * -----------------------------------------
 */

async function goToNextGame(
    page: Page
) {
    const newGame = page.locator(
        'a.button.alt:has-text("NOVA IGRA")'
    );

    await newGame.waitFor({
        state: "attached",
        timeout: 5000,
    });

    const href =
        await newGame.getAttribute("href");

    if (!href) {
        throw new Error(
            "NOVA IGRA nema href"
        );
    }

    const nextUrl = new URL(
        href,
        page.url()
    ).toString();

    await page.goto(
        nextUrl,
        {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
        }
    );

    /*
     * Malo uspori scraper.
     */
    await page.waitForTimeout(400);
}

/*
 * -----------------------------------------
 * SIGURNO ČUVANJE JSON-a
 * -----------------------------------------
 */

function saveQuestions(
    questions: Map<
        string,
        ScrapedQuestion
    >
) {
    fs.mkdirSync("./data", {
        recursive: true,
    });

    const tempFile =
        OUTPUT_FILE + ".tmp";

    const json =
        JSON.stringify(
            Array.from(
                questions.values()
            ),
            null,
            2
        );

    /*
     * Prvo upis u privremeni fajl.
     */
    fs.writeFileSync(
        tempFile,
        json,
        "utf8"
    );

    /*
     * Tek kada je kompletno zapisan,
     * zamijeni pravi JSON.
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
 * -----------------------------------------
 * UČITAJ POSTOJEĆI CHECKPOINT
 * -----------------------------------------
 */

function loadExistingQuestions() {
    const questions =
        new Map<
            string,
            ScrapedQuestion
        >();

    if (
        !fs.existsSync(
            OUTPUT_FILE
        )
    ) {
        return questions;
    }

    try {
        const raw = fs
            .readFileSync(
                OUTPUT_FILE,
                "utf8"
            )
            .trim();

        if (!raw) {
            return questions;
        }

        const existing:
            ScrapedQuestion[] =
                JSON.parse(raw);

        for (
            const item of existing
        ) {
            /*
             * Koristimo Ludara ID kao ključ.
             *
             * Mnogo pouzdanije nego tekst pitanja.
             */
            questions.set(
                item.sourceId,
                item
            );
        }

        console.log(
            `Učitano ${questions.size} postojećih pitanja.`
        );
    } catch (error) {
        console.warn(
            "Postojeći JSON je oštećen ili nevažeći."
        );

        console.warn(error);

        /*
         * Ne brišemo ga automatski.
         */
    }

    return questions;
}

/*
 * -----------------------------------------
 * MAIN
 * -----------------------------------------
 */

async function main() {
    const questions =
        loadExistingQuestions();

    if (
        questions.size >=
        TARGET_QUESTIONS
    ) {
        console.log(
            `Već imaš ${questions.size} pitanja.`
        );

        return;
    }

    const browser =
        await chromium.launch({
            headless: true,
        });

    try {
        const page =
            await browser.newPage();

        /*
         * Ne trebaju nam slike/fontovi/video.
         *
         * Smanjuje CPU, RAM i network.
         */
        await page.route(
            "**/*",
            async route => {
                const type =
                    route
                        .request()
                        .resourceType();

                if (
                    type === "image" ||
                    type === "font" ||
                    type === "media"
                ) {
                    await route.abort();
                    return;
                }

                await route.continue();
            }
        );

        /*
         * Prvu igru učitavamo samo jednom.
         */
        await page.goto(
            BASE_URL,
            {
                waitUntil:
                    "domcontentloaded",
                timeout: 30_000,
            }
        );

        let attempts = 0;

        let consecutiveDuplicates =
            0;

        while (
            questions.size <
            TARGET_QUESTIONS
        ) {
            attempts++;

            try {
                /*
                 * --------------------------
                 * SCRAPE
                 * --------------------------
                 */

                const item =
                    await scrapeQuestion(
                        page
                    );

                /*
                 * Ludara ID je glavni ključ.
                 */
                const key =
                    item.sourceId;

                /*
                 * --------------------------
                 * DUPLIKAT
                 * --------------------------
                 */

                if (
                    questions.has(key)
                ) {
                    consecutiveDuplicates++;

                    console.log(
                        `Duplikat #${consecutiveDuplicates} | ${questions.size}/${TARGET_QUESTIONS} | ID ${item.sourceId}`
                    );
                } else {
                    /*
                     * --------------------------
                     * NOVO PITANJE
                     * --------------------------
                     */

                    consecutiveDuplicates =
                        0;

                    questions.set(
                        key,
                        item
                    );

                    console.log(
                        `✓ ${questions.size}/${TARGET_QUESTIONS} | pokušaj ${attempts}`
                    );

                    console.log(
                        `[${item.sourceId}] ${item.pitanje} -> ${item.odgovor}`
                    );

                    /*
                     * Checkpoint svakih
                     * 25 novih pitanja.
                     */
                    if (
                        questions.size %
                            25 ===
                        0
                    ) {
                        saveQuestions(
                            questions
                        );

                        console.log(
                            `💾 Sačuvan checkpoint: ${questions.size}`
                        );
                    }
                }

                /*
                 * =================================
                 * NAJBITNIJI FIX
                 * =================================
                 *
                 * Na novu igru idemo I KADA JE
                 * PITANJE DUPLIKAT.
                 *
                 * Nema "continue" prije ovoga.
                 */

                await goToNextGame(
                    page
                );

                /*
                 * Ako dobijemo mnogo duplikata
                 * zaredom, resetuj session/page.
                 */
                if (
                    consecutiveDuplicates >=
                    30
                ) {
                    console.log(
                        "⚠ 30 duplikata zaredom — resetujem početnu stranicu..."
                    );

                    await page.goto(
                        BASE_URL,
                        {
                            waitUntil:
                                "domcontentloaded",
                            timeout: 30_000,
                        }
                    );

                    consecutiveDuplicates =
                        0;

                    await page.waitForTimeout(
                        1000
                    );
                }
            } catch (error) {
                console.error(
                    `Greška na pokušaju ${attempts}:`,
                    error
                );

                /*
                 * Sačuvaj sve što imamo.
                 */
                saveQuestions(
                    questions
                );

                await page.waitForTimeout(
                    1000
                );

                /*
                 * Resetuj stranicu da ne ostane
                 * u nekom pokvarenom stanju.
                 */
                try {
                    await page.goto(
                        BASE_URL,
                        {
                            waitUntil:
                                "domcontentloaded",
                            timeout: 30_000,
                        }
                    );
                } catch (
                    navigationError
                ) {
                    console.error(
                        "Neuspješan reset stranice:",
                        navigationError
                    );
                }
            }
        }

        /*
         * Finalno čuvanje.
         */
        saveQuestions(
            questions
        );

        console.log(
            "\n✓ GOTOVO"
        );

        console.log(
            `${questions.size} pitanja sačuvano u:`
        );

        console.log(
            OUTPUT_FILE
        );
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(
        "\nScraper nije uspio:"
    );

    console.error(error);

    process.exit(1);
});