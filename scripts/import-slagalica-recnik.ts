import { loadEnvConfig } from "@next/env";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const MAX_WORDS = 263_000;
const BATCH_SIZE = 1000;

const SERBIAN_WORD_REGEX = /^[A-ZČĆŠŽĐ]+$/;
const SERBIAN_LETTERS_REGEX = /DŽ|LJ|NJ|[A-ZČĆŠŽĐ]/g;

function splitSerbianLetters(word: string) {
    return word.match(SERBIAN_LETTERS_REGEX) ?? [];
}

function normalizeWord(word: string) {
    return word
        .trim()
        .normalize("NFC")
        .toUpperCase();
}

function getWordLength(word: string) {
    return splitSerbianLetters(word).length;
}

function isValidWord(word: string) {
    if (!SERBIAN_WORD_REGEX.test(word)) {
        return false;
    }

    const length = getWordLength(word);

    return length >= 2 && length <= 12;
}

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error(
            "Nedostaje NEXT_PUBLIC_SUPABASE_URL ili SUPABASE_SECRET_KEY u .env.local"
        );
    }

    const supabase = createClient(url, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    const file = fs.readFileSync("./data/sr-Latn.dic", "utf8");

    const lines = file.split(/\r?\n/);
    const dictionaryLines = lines.slice(1);

    const uniqueWords = new Set<string>();

    for (const line of dictionaryLines) {
        if (uniqueWords.size >= MAX_WORDS) break;

        const rawWord = line.split("/", 1)[0];

        if (!rawWord) continue;

        const word = normalizeWord(rawWord);

        if (!isValidWord(word)) continue;

        uniqueWords.add(word);
    }

    console.log(`Validnih jedinstvenih riječi: ${uniqueWords.size}`);

    const rows = Array.from(uniqueWords, rec => ({
        rec,
        duzina: getWordLength(rec),
    }));

    console.log(`Ubacujem ${rows.length} riječi...`);

    let processed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);

        const { error } = await supabase
            .from("slagalica_recnik")
            .upsert(batch, {
                onConflict: "rec",
                ignoreDuplicates: true,
            });

        if (error) {
            throw new Error(
                `Greška na batchu ${i}-${i + batch.length}: ${error.message}`
            );
        }

        processed += batch.length;

        const percentage = (
            (processed / rows.length) *
            100
        ).toFixed(1);

        console.log(
            `${processed}/${rows.length} (${percentage}%)`
        );
    }

    console.log("Import završen.");
}

main().catch(error => {
    console.error("Import nije uspio:");
    console.error(error);

    process.exit(1);
});