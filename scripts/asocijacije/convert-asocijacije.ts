import fs from "fs";
import path from "path";

const ROOT = process.cwd();

// Promijeni ovo ako ti je txt negdje drugo
const INPUT_PATH = path.join(ROOT, "data", "asoc_decoded.txt");

const DATA_DIR = path.join(ROOT, "data");
const OUTPUT_PATH = path.join(DATA_DIR, "asocijacije.json");

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

function clean(value: string): string {
  return value.trim().toUpperCase();
}

function parseSolutions(value: string): string[] {
  return value
    .split(";")
    .map(clean)
    .filter(Boolean);
}

function parseLine(line: string, lineNumber: number): Asocijacija | null {
  const parts = line.split(",").map((part) => part.trim());

  // 4 polja + solution × 4 kolone + final = 21
  if (parts.length !== 21) {
    console.warn(
      `Preskačem red ${lineNumber}: očekivano 21 polje, dobijeno ${parts.length}`
    );

    return null;
  }

  return {
    kolone: {
      A: {
        fields: parts.slice(0, 4).map(clean),
        sol: parseSolutions(parts[4]),
      },

      B: {
        fields: parts.slice(5, 9).map(clean),
        sol: parseSolutions(parts[9]),
      },

      C: {
        fields: parts.slice(10, 14).map(clean),
        sol: parseSolutions(parts[14]),
      },

      D: {
        fields: parts.slice(15, 19).map(clean),
        sol: parseSolutions(parts[19]),
      },
    },

    konacno: parseSolutions(parts[20]),
  };
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input fajl nije pronađen:\n${INPUT_PATH}`);
  }

  const text = fs.readFileSync(INPUT_PATH, "utf8");

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const asocijacije: Asocijacija[] = [];

  let invalid = 0;

  lines.forEach((line, index) => {
    const parsed = parseLine(line, index + 1);

    if (parsed) {
      asocijacije.push(parsed);
    } else {
      invalid++;
    }
  });

  fs.mkdirSync(DATA_DIR, {
    recursive: true,
  });

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(asocijacije, null, 2),
    "utf8"
  );

  console.log("====================================");
  console.log("Asocijacije konvertovane.");
  console.log(`Ukupno redova: ${lines.length}`);
  console.log(`Validnih: ${asocijacije.length}`);
  console.log(`Nevalidnih: ${invalid}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log("====================================");
}

main();