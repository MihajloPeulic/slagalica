// scripts/generate-ko-zna-zna-options.ts

import fs from "fs";
import OpenAI from "openai";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

type RawQuestion = {
    pitanje: string;
    odgovor: string;
};

type FinalQuestion = {
    pitanje: string;
    opcije: string[];
    tacna_opcija: number;
};

function normalize(value: string) {
    return value
        .trim()
        .toLocaleLowerCase("sr-Latn");
}

function shuffle<T>(array: T[]) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(
            Math.random() * (i + 1)
        );

        [copy[i], copy[j]] = [
            copy[j],
            copy[i],
        ];
    }

    return copy;
}

function validateWrongOptions(
    correct: string,
    wrong: string[]
) {
    if (wrong.length !== 3) {
        return false;
    }

    const normalizedCorrect =
        normalize(correct);

    const normalizedWrong =
        wrong.map(normalize);

    if (
        normalizedWrong.includes(
            normalizedCorrect
        )
    ) {
        return false;
    }

    if (
        new Set(normalizedWrong).size !== 3
    ) {
        return false;
    }

    return true;
}

async function generateWrongOptions(
    pitanje: string,
    odgovor: string
) {
    const response = await openai.responses.create({
        model: "gpt-5.6",
        input: `
Ti praviš kvalitetna pitanja za kviz.

Pitanje:
${pitanje}

Tačan odgovor:
${odgovor}

Generiši TAČNO 3 netačna ali vrlo uvjerljiva odgovora.

Pravila:
- sva 3 moraju biti istog semantičkog tipa kao tačan odgovor
- ako je odgovor osoba, koristi druge relevantne osobe
- ako je grad, koristi druge gradove
- ako je država, koristi druge države
- ako je godina, koristi bliske realistične godine
- ako je knjiga, koristi druga relevantna književna djela
- nijedan odgovor ne smije takođe biti tačan
- nijedan ne smije biti besmislen
- ne ponavljaj tačan odgovor
- ne ponavljaj opcije
- koristi pravilne srpske dijakritike
- vrati samo JSON array od 3 stringa

Primjer:
["Toronto","Montreal","Vankuver"]
`,
    });

    const text = response.output_text.trim();

    const wrong = JSON.parse(text);

    if (!Array.isArray(wrong)) {
        throw new Error(
            "Model nije vratio array"
        );
    }

    return wrong.map(String);
}

async function main() {
    const raw: RawQuestion[] =
        JSON.parse(
            fs.readFileSync(
                "./data/ko-zna-zna-raw.json",
                "utf8"
            )
        );

    const finalQuestions: FinalQuestion[] = [];

    for (
        let i = 0;
        i < raw.length;
        i++
    ) {
        const item = raw[i];

        let wrong: string[] = [];

        for (
            let attempt = 0;
            attempt < 3;
            attempt++
        ) {
            wrong =
                await generateWrongOptions(
                    item.pitanje,
                    item.odgovor
                );

            if (
                validateWrongOptions(
                    item.odgovor,
                    wrong
                )
            ) {
                break;
            }
        }

        if (
            !validateWrongOptions(
                item.odgovor,
                wrong
            )
        ) {
            console.error(
                `Preskačem: ${item.pitanje}`
            );

            continue;
        }

        const correct =
            item.odgovor.trim();

        const options = shuffle([
            correct,
            ...wrong,
        ]);

        const correctIndex =
            options.findIndex(
                option =>
                    normalize(option) ===
                    normalize(correct)
            );

        finalQuestions.push({
            pitanje: item.pitanje,
            opcije: options,
            tacna_opcija: correctIndex,
        });

        console.log(
            `${i + 1}/${raw.length}`
        );

        /*
         * Čuvaj checkpoint poslije svakih 25.
         */
        if ((i + 1) % 25 === 0) {
            fs.writeFileSync(
                "./data/ko-zna-zna-final.json",
                JSON.stringify(
                    finalQuestions,
                    null,
                    2
                )
            );
        }
    }

    fs.writeFileSync(
        "./data/ko-zna-zna-final.json",
        JSON.stringify(
            finalQuestions,
            null,
            2
        )
    );

    console.log(
        `Gotovo: ${finalQuestions.length}`
    );
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});