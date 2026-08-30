import { chromium } from "playwright";

async function main() {
    const browser = await chromium.launch({
        headless: false,
    });

    try {
        const page = await browser.newPage();

        page.on("request", request => {
            const url = request.url();

            if (
                !url.includes("ludara.com") ||
                url.includes("/cdn-cgi/")
            ) {
                return;
            }

            console.log("\n===== LUDARA REQUEST =====");
            console.log("URL:", url);
            console.log("METHOD:", request.method());
            console.log("TYPE:", request.resourceType());
            console.log("BODY:", request.postData());
        });

        page.on("response", async response => {
            const url = response.url();

            if (
                !url.includes("ludara.com") ||
                url.includes("/cdn-cgi/")
            ) {
                return;
            }

            console.log("\n===== LUDARA RESPONSE =====");
            console.log("URL:", url);
            console.log("STATUS:", response.status());

            const type =
                response.request().resourceType();

            if (
                type === "xhr" ||
                type === "fetch" ||
                type === "document"
            ) {
                try {
                    const body =
                        await response.text();

                    console.log(
                        "BODY:",
                        body.slice(0, 3000)
                    );
                } catch {}
            }
        });

        await page.goto(
            "https://www.ludara.com/resenja-ko-zna-zna/",
            {
                waitUntil: "domcontentloaded",
            }
        );

        /*
         * -------------------------
         * INPUTI
         * -------------------------
         */

        const inputs = page.locator(
            "input, textarea"
        );

        const count =
            await inputs.count();

        console.log(
            "\n===== INPUTI ====="
        );

        console.log(
            "Broj:",
            count
        );

        for (
            let i = 0;
            i < count;
            i++
        ) {
            const input =
                inputs.nth(i);

            console.log(
                `\nINPUT ${i}:`
            );

            console.log(
                await input.evaluate(
                    el => el.outerHTML
                )
            );
        }

        /*
         * Prvi normalni text input.
         */

        const searchInput =
            page.locator(
                'input[type="text"], input:not([type])'
            ).first();

        if (
            !(await searchInput.count())
        ) {
            throw new Error(
                "Nisam pronašao search input"
            );
        }

        /*
         * -------------------------
         * SCRIPTOVI
         * -------------------------
         */

        console.log(
            "\n===== RELEVANTNI SCRIPTOVI ====="
        );

        const scripts = await page
            .locator("script")
            .evaluateAll(scripts =>
                scripts
                    .map(
                        script =>
                            script.textContent ??
                            ""
                    )
                    .filter(script =>
                        /ajax|xmlhttp|keyup|input|pretrag|search|kzz|zna/i.test(
                            script
                        )
                    )
            );

        for (
            const script of scripts
        ) {
            console.log(
                "\n-------------------"
            );

            console.log(
                script.slice(
                    0,
                    5000
                )
            );
        }

        /*
         * -------------------------
         * PRAVA PRETRAGA
         * -------------------------
         */

        console.log(
            "\n===== KUCAM ====="
        );

        await searchInput.click();

        /*
         * Kucamo kao čovjek:
         * g l a v n
         */
        await searchInput.type(
            "glavn",
            {
                delay: 200,
            }
        );

        console.log(
            "Vrijednost inputa:",
            await searchInput.inputValue()
        );

        /*
         * Daj AJAX-u vremena.
         */
        await page.waitForTimeout(
            3000
        );

        /*
         * -------------------------
         * ISPITAJ PROMJENE
         * -------------------------
         */

        console.log(
            "\n===== KRATKI ELEMENTI POSLIJE PRETRAGE ====="
        );

        const resultElements =
            await page
                .locator("body *")
                .evaluateAll(elements =>
                    elements
                        .map(el => ({
                            tag:
                                el.tagName,
                            id:
                                el.id,
                            className:
                                typeof el.className ===
                                "string"
                                    ? el.className
                                    : "",
                            text:
                                el.textContent
                                    ?.replace(
                                        /\s+/g,
                                        " "
                                    )
                                    .trim() ??
                                "",
                            html:
                                el.outerHTML.slice(
                                    0,
                                    700
                                ),
                        }))
                        .filter(
                            item =>
                                item.text &&
                                item.text.length <
                                    500
                        )
                );

        for (
            const element of
                resultElements
        ) {
            if (
                /glavn/i.test(
                    element.text
                ) ||
                /odgovor/i.test(
                    element.text
                )
            ) {
                console.log(
                    element
                );
            }
        }

        /*
         * Nemoj odmah zatvoriti browser.
         */
        await page.waitForTimeout(
            3000
        );
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});