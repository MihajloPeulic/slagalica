import fs from "fs";

const INPUT_FILE =
    "./data/spojnice-ai-preview.json";

const OUTPUT_FILE =
    "./data/spojnice-final-preview.json";

type Pair = {
    id: number;
    left: string;
    right: string;
};

type AIProcessedGame = {
    id: number;
    tema: string;
    themeKey: string;
    parovi: Pair[];
};

type FinalGame = {
    id: number;
    tema: string;
    verzija: number;
    parovi: Pair[];
};

/*
 * --------------------------------
 * LOAD
 * --------------------------------
 */

function loadGames(): AIProcessedGame[] {
    if (
        !fs.existsSync(INPUT_FILE)
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
        JSON.parse(raw) as AIProcessedGame[];

    if (!Array.isArray(games)) {
        throw new Error(
            "Input nije array."
        );
    }

    return games;
}

/*
 * --------------------------------
 * SAVE
 * --------------------------------
 */

function saveGames(
    games: FinalGame[]
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

function main() {
    const games =
        loadGames();

    console.log(
        `Učitano: ${games.length} igara`
    );

    /*
     * --------------------------------
     * GROUP BY themeKey
     * --------------------------------
     */

    const groups =
        new Map<
            string,
            AIProcessedGame[]
        >();

    for (const game of games) {
        if (!game.themeKey) {
            throw new Error(
                `ID ${game.id} nema themeKey`
            );
        }

        if (
            !groups.has(
                game.themeKey
            )
        ) {
            groups.set(
                game.themeKey,
                []
            );
        }

        groups
            .get(game.themeKey)!
            .push(game);
    }

    console.log(
        `Jedinstvenih tema: ${groups.size}`
    );

    /*
     * --------------------------------
     * DODIJELI VERZIJE
     * --------------------------------
     */

    const finalGames:
        FinalGame[] = [];

    for (
        const [
            themeKey,
            group,
        ] of groups.entries()
    ) {
        /*
         * Sort po ID-u da verzije
         * uvijek budu determinističke.
         */
        group.sort(
            (a, b) =>
                a.id - b.id
        );

        /*
         * Provjera da svi imaju
         * potpuno istu temu.
         */
        const themes =
            new Set(
                group.map(
                    game =>
                        game.tema
                )
            );

        if (
            themes.size > 1
        ) {
            console.warn(
                `⚠ themeKey "${themeKey}" ima više različitih tema:`
            );

            for (
                const tema of themes
            ) {
                console.warn(
                    `   - ${tema}`
                );
            }
        }

        /*
         * Uzimamo temu prve igre
         * kao canonical temu grupe.
         */
        const canonicalTema =
            group[0].tema;

        for (
            let i = 0;
            i < group.length;
            i++
        ) {
            const game =
                group[i];

            finalGames.push({
                id:
                    game.id,

                tema:
                    canonicalTema,

                verzija:
                    i + 1,

                parovi:
                    game.parovi,
            });
        }
    }

    /*
     * --------------------------------
     * SORT FINAL OUTPUT
     * --------------------------------
     */

    finalGames.sort(
        (a, b) =>
            a.id - b.id
    );

    /*
     * --------------------------------
     * VALIDACIJA VERZIJA
     * --------------------------------
     */

    let versionErrors = 0;

    for (
        const [
            themeKey,
            group,
        ] of groups.entries()
    ) {
        const matching =
            finalGames
                .filter(game =>
                    group.some(
                        original =>
                            original.id ===
                            game.id
                    )
                )
                .sort(
                    (a, b) =>
                        a.verzija -
                        b.verzija
                );

        for (
            let i = 0;
            i <
            matching.length;
            i++
        ) {
            const expected =
                i + 1;

            if (
                matching[i]
                    .verzija !==
                expected
            ) {
                console.warn(
                    `⚠ ${themeKey}: očekivana verzija ${expected}, pronađena ${matching[i].verzija}`
                );

                versionErrors++;
            }
        }
    }

    saveGames(
        finalGames
    );

    /*
     * --------------------------------
     * SUMMARY
     * --------------------------------
     */

    const biggestGroups =
        [
            ...groups.entries()
        ]
            .map(
                ([
                    themeKey,
                    group,
                ]) => ({
                    themeKey,
                    tema:
                        group[0]
                            .tema,
                    count:
                        group.length,
                })
            )
            .sort(
                (a, b) =>
                    b.count -
                    a.count
            )
            .slice(
                0,
                20
            );

    console.log(
        "\n=========================="
    );

    console.log(
        "FINALIZACIJA ZAVRŠENA"
    );

    console.log(
        `Igara: ${finalGames.length}`
    );

    console.log(
        `Tema: ${groups.size}`
    );

    console.log(
        `Grešaka verzija: ${versionErrors}`
    );

    console.log(
        `File: ${OUTPUT_FILE}`
    );

    console.log(
        "\nNajveće grupe:"
    );

    for (
        const group of
        biggestGroups
    ) {
        console.log(
            `${group.count}x | ${group.tema} | ${group.themeKey}`
        );
    }

    console.log(
        "=========================="
    );
}

main();