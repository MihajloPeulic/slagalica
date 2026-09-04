"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";


async function generateLetters() {
    const supabase = await createServerSupabaseClient();

    // Težine približno prate učestalost slova.
    const vowels = [
        ..."AAAAAAAAAAAA",
        ..."EEEEEEEEEEE",
        ..."IIIIIIIIII",
        ..."OOOOOOOOO",
        ..."UUUUU",
    ];

    const consonants = [
        ..."NNNNNNNN",
        ..."RRRRRRRR",
        ..."SSSSSSS",
        ..."TTTTTTT",
        ..."KKKKKK",
        ..."LLLLLL",
        ..."JJJJJ",
        ..."VVVVV",
        ..."DDDDD",
        ..."PPPP",
        ..."CCCC",
        ..."MMMM",
        ..."BBBB",
        ..."GGGG",
        ..."ZZZ",
        ..."ŠŠŠ",
        ..."ČČ",
        ..."ĆĆ",
        ..."ŽŽ",
        ..."ĐĐ",
        "LJ",
        "LJ",
        "NJ",
        "NJ",
        "DŽ",
        "DŽ",
    ];

    const randomFrom = (pool: string[]) =>
        pool[Math.floor(Math.random() * pool.length)];

    function shuffle<T>(array: T[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            [array[i], array[j]] = [
                array[j],
                array[i],
            ];
        }

        return array;
    }

    function createLetterSet() {
        // 65% vremena 4 samoglasnika,
        // 35% vremena 5 samoglasnika.
        const vowelCount = Math.random() < 0.65 ? 4 : 5;
        const consonantCount = 12 - vowelCount;

        const letters = [
            ...Array.from(
                { length: vowelCount },
                () => randomFrom(vowels)
            ),
            ...Array.from(
                { length: consonantCount },
                () => randomFrom(consonants)
            ),
        ];

        shuffle(letters);

        const uniqueId = `${Date.now()}-${crypto.randomUUID()}`;

        return letters.map((value, index) => ({
            id: `let-${uniqueId}-${index}`,
            value,
            used: false,
        }));
    }

    /*
        Ne želimo 10-20 RPC poziva.

        3 pokušaja je dovoljno:
        - ako odmah dobijemo riječ >= 8 slova -> gotovo
        - inače pokušamo još maksimalno 2 puta
        - vratimo najbolju kombinaciju
    */
    const MAX_ATTEMPTS = 3;
    const TARGET_WORD_LENGTH = 8;

    let bestResult: {
        slova: {
            id: string;
            value: string;
            used: boolean;
        }[];
        najduza_rec: string | null;
    } | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const arr = createLetterSet();

        const { data: longestWord, error } =
            await supabase.rpc(
                "najduza_rijec_od_slova",
                {
                    p_slova: arr.map(
                        item => item.value
                    ),
                }
            );

        if (error) {
            console.error(
                "Greška pri traženju najduže riječi:",
                error
            );

            continue;
        }

        const result = {
            slova: arr,
            najduza_rec: longestWord ?? null,
        };

        const currentLength =
            longestWord?.length ?? 0;

        const bestLength =
            bestResult?.najduza_rec?.length ?? 0;

        if (
            !bestResult ||
            currentLength > bestLength
        ) {
            bestResult = result;
        }

        // Dovoljno dobra kombinacija.
        // Nema potrebe za dodatnim DB pozivima.
        if (currentLength >= TARGET_WORD_LENGTH) {
            return result;
        }
    }

    /*
        Ako nijedan od 3 pokušaja nije imao 8+,
        uzimamo najbolji koji smo pronašli.
    */
    if (bestResult) {
        return bestResult;
    }

    /*
        RPC je potpuno zakazao.
        Igra i dalje može početi umjesto da pukne.
    */
    return {
        slova: createLetterSet(),
        najduza_rec: null,
    };
}

function generateNumbersRound() {
    const mali = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const srednji = [10, 15, 20];
    const veliki = [25, 50, 75, 100];
    const getRandom = (arr: number[]) => arr[Math.floor(Math.random() * arr.length)];
    const getRandomMali = () => Math.floor(Math.random() * 9) + 1;
    const numbers = [
        getRandomMali(), getRandomMali(), getRandomMali(), getRandomMali(),
        getRandom(srednji), getRandom(veliki)
    ];
    const target = Math.floor(Math.random() * 949) + 50; 
    return { target, numbers };
}

function generateSkockoRound() {
    const symbols = ["skocko", "tref", "pik", "srce", "karo", "zvezda"];
    return {
        secretCode: Array.from({ length: 4 }, () => symbols[Math.floor(Math.random() * symbols.length)])
    };
}

// --- NOVA funkcija za generisanje Spojnica ---
// (Ako imaš bazu tema, možeš je zameniti ovim ili pozivati iz svog fajla)
const SPOJNICE_TEME_FALLBACK = [
    {
        tema: "Glavni gradovi (Fallback)",
        pairs: [
            { id: 1, left: "Pariz", right: "Francuska" },
            { id: 2, left: "Tokio", right: "Japan" },
            { id: 3, left: "Kanbera", right: "Australija" },
            { id: 4, left: "Otava", right: "Kanada" },
        ]
    }
];

function generateSpojniceFallback() {
    const randomTheme = SPOJNICE_TEME_FALLBACK[0];
    return {
        tema: randomTheme.tema,
        verzija: 1,
        pairs: randomTheme.pairs,
        // Odmah ovde mešamo za fallback!
        rightItems: [...randomTheme.pairs].sort(() => Math.random() - 0.5) 
    };
}

// NOVA ASYNC FUNKCIJA KOJA GENERIŠE CEO GAME STATE
// --- NOVA funkcija za generisanje Ko Zna Zna ---
const KO_ZNA_ZNA_FALLBACK = [
    { id: 1, question: "Koji je glavni grad Francuske?", options: ["Lion", "Pariz", "Nica", "Bordo"], correctIndex: 1 },
    { id: 2, question: "Koliko padeža ima u srpskom jeziku?", options: ["5", "6", "7", "8"], correctIndex: 2 },
    { id: 3, question: "Ko je napisao 'Gorski vijenac'?", options: ["Ivo Andrić", "Meša Selimović", "Petar II Petrović Njegoš", "Miloš Crnjanski"], correctIndex: 2 },
    { id: 4, question: "Koji je najviši vrh na svetu?", options: ["K2", "Mont Everest", "Kilimandžaro", "Mon Blan"], correctIndex: 1 },
    { id: 5, question: "Koliko minuta traje fudbalska utakmica (bez nadoknade)?", options: ["80", "90", "100", "120"], correctIndex: 1 },
    { id: 6, question: "Koja planeta je najbliža Suncu?", options: ["Venera", "Zemlja", "Merkur", "Mars"], correctIndex: 2 },
    { id: 7, question: "Koje godine je počeo Prvi svetski rat?", options: ["1912", "1914", "1918", "1939"], correctIndex: 1 },
    { id: 8, question: "Koji hemijski element ima oznaku 'O'?", options: ["Osmijum", "Olovo", "Kiseonik", "Ugljenik"], correctIndex: 2 },
    { id: 9, question: "Koji kontinent je najveći?", options: ["Afrika", "Azija", "Severna Amerika", "Evropa"], correctIndex: 1 },
    { id: 10, question: "Koja životinja je poznata kao 'kralj životinja'?", options: ["Tigar", "Slon", "Lav", "Gepard"], correctIndex: 2 }
];

// --- NOVA funkcija za generisanje Asocijacija ---
const ASOCIJACIJE_FALLBACK = {
    kolone: {
        A: { fields: ["SNEG", "MLEKO", "ZUB", "MEDVED"], sol: ["BELI", "BELA", "BELO"] },
        B: { fields: ["MORE", "NEBO", "DUBINA", "ŠTRUMF"], sol: ["PLAVI", "PLAVA", "PLAVO"] },
        C: { fields: ["TRAVA", "ŽABA", "ŠUMA", "LIST"], sol: ["ZELENI", "ZELENA", "ZELENO"] },
        D: { fields: ["SUNCE", "ZLATO", "LIMUN", "KUKURUZ"], sol: ["ŽUTI", "ŽUTA", "ŽUTO"] }
    },
    konacno: ["BOJE", "BOJA"]
};

// NOVA ASYNC FUNKCIJA KOJA GENERIŠE CEO GAME STATE
export async function generateFullGameState() {
    const supabase = await createServerSupabaseClient()
    
    // 1. Spojnice
    const { data: dbDataSpojnice, error: errSpojnice } = await supabase.rpc("get_random_spojnice");
    let spojniceData;
    if (!errSpojnice && dbDataSpojnice && dbDataSpojnice.length >= 2) {
        spojniceData = {
            runda_1: { tema: dbDataSpojnice[0].tema, verzija: dbDataSpojnice[0].verzija, pairs: dbDataSpojnice[0].parovi, rightItems: [...dbDataSpojnice[0].parovi].sort(() => Math.random() - 0.5) },
            runda_2: { tema: dbDataSpojnice[1].tema, verzija: dbDataSpojnice[1].verzija, pairs: dbDataSpojnice[1].parovi, rightItems: [...dbDataSpojnice[1].parovi].sort(() => Math.random() - 0.5) }
        };
    } else {
        spojniceData = { runda_1: generateSpojniceFallback(), runda_2: generateSpojniceFallback() };
    }

    // 2. Ko Zna Zna
    const { data: dbDataKzk, error: errKzk } = await supabase.rpc("get_random_ko_zna_zna_questions"); 
    let kzkData = [];
    if (!errKzk && dbDataKzk && dbDataKzk.length >= 10) {
        kzkData = dbDataKzk.slice(0, 10).map((row: any) => ({
            id: row.id,
            question: row.pitanje,       
            options: row.opcije,         
            correctIndex: row.tacna_opcija 
        }));
    } else {
        kzkData = [...KO_ZNA_ZNA_FALLBACK].sort(() => Math.random() - 0.5).slice(0, 10);
    }

    // 3. Asocijacije
    const { data: dbDataAsoc, error: errAsoc } = await supabase.rpc("get_random_asocijacije"); // Ako nemaš proceduru, možeš koristiti select sa .order('random()').limit(2)
    let asocData = [];
    if (!errAsoc && dbDataAsoc && dbDataAsoc.length >= 2) {
        asocData = dbDataAsoc.slice(0, 2).map((row: any) => ({
            kolone: row.kolone,
            konacno: row.konacno
        }));
    } else {
        asocData = [ASOCIJACIJE_FALLBACK, ASOCIJACIJE_FALLBACK];
    }

    return {
        rec: { runda_1: await generateLetters(), runda_2: await generateLetters() },
        broj: { runda_1: generateNumbersRound(), runda_2: generateNumbersRound() },
        skocko: { runda_1: generateSkockoRound(), runda_2: generateSkockoRound() },
        spojnice: spojniceData,
        ko_zna_zna: { pitanja: kzkData },
        asocijacije: { runda_1: asocData[0], runda_2: asocData[1] } // Dodate Asocijacije!
    };
}