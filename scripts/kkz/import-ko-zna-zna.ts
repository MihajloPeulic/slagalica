// scripts/import-ko-zna-zna.ts

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
);

const BATCH_SIZE = 100;

async function main() {
    const questions =
        JSON.parse(
            fs.readFileSync(
                "./data/ko-zna-zna-final.json",
                "utf8"
            )
        );

    for (
        let i = 0;
        i < questions.length;
        i += BATCH_SIZE
    ) {
        const batch =
            questions.slice(
                i,
                i + BATCH_SIZE
            );

        const { error } = await supabase
            .from("ko_zna_zna_pitanja")
            .insert(batch);

        if (error) {
            throw error;
        }

        console.log(
            `${Math.min(
                i + BATCH_SIZE,
                questions.length
            )}/${questions.length}`
        );
    }

    console.log("Import završen.");
}

main().catch(console.error);