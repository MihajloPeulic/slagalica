import { chromium, Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const TARGET_GAMES = 2000;
const INSERT_BATCH_SIZE = 50;

type Pair = {
    id: number;
    left: string;
    right: string;
};

type SpojnicaGame = {
    tema: string;
    parovi: Pair[];
};

function cleanText(value: string) {
    return value
        .replace(/\s+/g, " ")
        .trim();
}

function createGameKey(game: SpojnicaGame) {
    return JSON.stringify(
        game.parovi
            .map(pair => [
                pair.left.toLocaleLowerCase("sr"),
                pair.right.toLocaleLowerCase("sr"),
            ])
            .sort()
    );
}

async function debugPage(page: Page) {
    const elements = await page
        .locator("body *")
        .evaluateAll(elements => {
            return elements
                .map(element => {
                    const text =
                        element.textContent
                            ?.replace(/\s+/g, " ")
                            .trim() ?? "";

                    return {
                        tag: element.tagName,
                        text,
                        id: element.id,
                        className:
                            typeof element.className === "string"
                                ? element.className
                                : "",
                        html: element.outerHTML.slice(0, 500),
                    };
                })
                .filter(item => {
                    if (!item.text) return false;

                    // tražimo male elemente koji vjerovatno predstavljaju
                    // pojedinačne pojmove spojnice
                    if (item.text.length > 40) return false;

                    return true;
                });
        });

    for (const element of elements) {
        console.log("\n---------------------");
        console.log("TAG:", element.tag);
        console.log("TEXT:", element.text);
        console.log("ID:", element.id);
        console.log("CLASS:", element.className);
        console.log("HTML:", element.html);
    }
}

/*
 * OVO JE PRIVREMENI PLACEHOLDER.
 *
 * Kad vidimo stvarni DOM Ludare,
 * ovdje ćemo napraviti pravo čitanje 8 parova.
 */
async function scrapeGame(page: Page): Promise<SpojnicaGame> {
    const leftElements = page.locator(".polje");

    const count = await leftElements.count();

    if (count !== 8) {
        throw new Error(
            `Očekivano 8 lijevih pojmova, pronađeno ${count}`
        );
    }

    const parovi: Pair[] = [];

    for (let i = 0; i < count; i++) {
        const element = leftElements.nth(i);

        const left = cleanText(await element.innerText());
        const sourceId = await element.getAttribute("id");

        if (!sourceId) {
            throw new Error(
                `Lijevi pojam "${left}" nema ID`
            );
        }

        const right = await page.evaluate(
            async ({ sourceId }) => {
                const response = await fetch(
                    "/trening/spojnice/s.php",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded",
                        },
                        body: new URLSearchParams({
                            id: sourceId,
                        }).toString(),
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }

                return await response.text();
            },
            { sourceId }
        );

        parovi.push({
            id: i + 1,
            left,
            right: cleanText(right),
        });
    }

    return {
        // Ludara nema eksplicitno navedenu temu
        tema: "SPOJNICE",
        parovi,
    };
}
async function debugAjax(page: Page) {
    console.log("\n===== LIJEVA KOLONA =====");

    const left = page.locator(".polje");

    for (let i = 0; i < await left.count(); i++) {
        const el = left.nth(i);

        console.log(i, {
            id: await el.getAttribute("id"),
            class: await el.getAttribute("class"),
            text: cleanText(await el.innerText()),
        });
    }

    console.log("\n===== DESNA KOLONA =====");

    const right = page.locator(".dugme.spojnica");

    for (let i = 0; i < await right.count(); i++) {
        const el = right.nth(i);

        console.log(i, {
            id: await el.getAttribute("id"),
            onclick: await el.getAttribute("onclick"),
            text: cleanText(await el.innerText()),
        });
    }

    console.log("\n===== PRATIM REQUEST =====");

    page.on("request", request => {
        const type = request.resourceType();

        if (
            type === "xhr" ||
            type === "fetch"
        ) {
            console.log("\nXHR/FETCH REQUEST");

            console.log("URL:", request.url());
            console.log("METHOD:", request.method());
            console.log("POST DATA:", request.postData());
        }
    });

    page.on("response", async response => {
        const request = response.request();

        const type = request.resourceType();

        if (
            type === "xhr" ||
            type === "fetch"
        ) {
            console.log("\nXHR/FETCH RESPONSE");

            console.log("URL:", response.url());
            console.log("STATUS:", response.status());

            try {
                console.log(
                    "BODY:",
                    await response.text()
                );
            } catch {}
        }
    });

    /*
     * Kliknemo samo prvo ponuđeno desno polje.
     */
    await page.locator("#d0").click();

    await page.waitForTimeout(2000);
}
async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
        process.env.SUPABASE_SECRET_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error(
            "Nedostaje NEXT_PUBLIC_SUPABASE_URL ili SUPABASE_SECRET_KEY"
        );
    }

    const supabase = createClient(
        url,
        serviceRoleKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        }
    );

    const browser = await chromium.launch({
        headless: true,
    });

    try {
        const page = await browser.newPage();

        /*
         * ----------------------------------------
         * 1. UČITAJ POSTOJEĆE IGRE IZ SUPABASEA
         * ----------------------------------------
         */

        const seenGames = new Set<string>();

        let from = 0;
        const DB_BATCH = 1000;

        while (true) {
            const { data, error } = await supabase
                .from("spojnice_igre")
                .select("parovi")
                .range(from, from + DB_BATCH - 1);

            if (error) {
                throw new Error(
                    `Ne mogu učitati postojeće igre: ${error.message}`
                );
            }

            if (!data || data.length === 0) {
                break;
            }

            for (const row of data) {
                const game: SpojnicaGame = {
                    tema: "SPOJNICE",
                    parovi: row.parovi as Pair[],
                };

                seenGames.add(
                    createGameKey(game)
                );
            }

            if (data.length < DB_BATCH) {
                break;
            }

            from += DB_BATCH;
        }

        let totalSaved = seenGames.size;

        console.log(
            `U bazi već postoji ${totalSaved} jedinstvenih spojnica.`
        );

        if (totalSaved >= TARGET_GAMES) {
            console.log(
                `Već imaš najmanje ${TARGET_GAMES} igara. Nema potrebe za scrapingom.`
            );

            return;
        }

        /*
         * ----------------------------------------
         * 2. SCRAPING
         * ----------------------------------------
         */

        let attempts = 0;
        let consecutiveDuplicates = 0;

        while (totalSaved < TARGET_GAMES) {
            attempts++;

            try {
                /*
                 * Svaki put generišemo potpuno novi URL,
                 * umjesto da vjerujemo Ludara NOVA IGRA href-u.
                 */

                const random =
                    Date.now() +
                    Math.floor(
                        Math.random() * 1_000_000_000
                    );

                const gameUrl =
                    `https://www.ludara.com/trening/spojnice/?${random}`;

                await page.goto(
                    gameUrl,
                    {
                        waitUntil: "domcontentloaded",
                        timeout: 30_000,
                    }
                );

                const game =
                    await scrapeGame(page);

                const key =
                    createGameKey(game);

                /*
                 * ----------------------------------------
                 * DUPLIKAT
                 * ----------------------------------------
                 */

                if (seenGames.has(key)) {
                    consecutiveDuplicates++;

                    console.log(
                        `Duplikat #${consecutiveDuplicates} | ${totalSaved}/${TARGET_GAMES}`
                    );

                    /*
                     * Ako dugo dobijamo samo duplikate,
                     * napravi malo dužu pauzu.
                     */
                    if (
                        consecutiveDuplicates % 25 ===
                        0
                    ) {
                        console.log(
                            "Puno duplikata — pravim kratku pauzu..."
                        );

                        await page.waitForTimeout(
                            2000
                        );
                    }

                    continue;
                }

                /*
                 * ----------------------------------------
                 * NOVA IGRA
                 * ----------------------------------------
                 */

                const { error } = await supabase
                    .from("spojnice_igre")
                    .insert({
                        tema: game.tema,
                        verzija: 1,
                        parovi: game.parovi,
                    });

                if (error) {
                    throw new Error(
                        `Supabase: ${error.message}`
                    );
                }

                seenGames.add(key);

                totalSaved++;
                consecutiveDuplicates = 0;

                console.log(
                    `✓ ${totalSaved}/${TARGET_GAMES} | pokušaj ${attempts}`
                );

                console.log(
                    game.parovi
                        .map(
                            pair =>
                                `${pair.left} -> ${pair.right}`
                        )
                        .join(" | ")
                );

                /*
                 * Nemoj bombardovati Ludara server.
                 */
                await page.waitForTimeout(500);
            } catch (error) {
                console.error(
                    `Greška na pokušaju ${attempts}:`,
                    error
                );

                /*
                 * Nastavi poslije greške.
                 */
                await page.waitForTimeout(1500);
            }
        }

        console.log(
            `\n✓ GOTOVO — ukupno ${totalSaved} jedinstvenih spojnica u bazi.`
        );
    } finally {
        await browser.close();
    }
}
main().catch(error => {
    console.error("\nScraping nije uspio:");
    console.error(error);

    process.exit(1);
});