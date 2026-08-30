import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

dotenv.config({
  path: path.join(ROOT, ".env.local"),
});

const INPUT_PATH = path.join(ROOT, "data", "asocijacije.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl) {
  throw new Error("Nedostaje NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Nedostaje SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type Kolona = {
  sol: string[];
  fields: string[];
};

type Asocijacija = {
  konacno: string[];
  kolone: {
    A: Kolona;
    B: Kolona;
    C: Kolona;
    D: Kolona;
  };
};

async function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`JSON nije pronađen: ${INPUT_PATH}`);
  }

  const raw = fs.readFileSync(INPUT_PATH, "utf8");
  const asocijacije: Asocijacija[] = JSON.parse(raw);

  console.log(`Pronađeno ${asocijacije.length} asocijacija.`);

  const BATCH_SIZE = 100;

  let inserted = 0;

  for (let i = 0; i < asocijacije.length; i += BATCH_SIZE) {
    const batch = asocijacije.slice(i, i + BATCH_SIZE);

    const rows = batch.map((igra) => ({
      konacno: igra.konacno,
      kolone: igra.kolone,
    }));

    const { error } = await supabase
      .from("asocijacije_igre")
      .insert(rows);

    if (error) {
      console.error(`Greška u batchu ${i}-${i + batch.length - 1}:`);
      console.error(error);

      process.exit(1);
    }

    inserted += batch.length;

    console.log(
      `Uneseno ${inserted}/${asocijacije.length}`
    );
  }

  console.log("================================");
  console.log("Import završen.");
  console.log(`Ukupno uneseno: ${inserted}`);
  console.log("================================");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

