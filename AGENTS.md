<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Slagalica UI design pravila

Ova aplikacija je društveni kviz. Vizuelni ton je razigran, topao, opušten i savremen. Izbegavaj tamni tech ili gaming izgled, neon, agresivne glow efekte, staklene panele i animacije koje stalno odvlače pažnju. Dizajn treba da deluje kao prijateljska igra znanja i da tekst bude lako čitljiv u svakom stanju.

### Granice pri UI radu

- Ne menjaj logiku igara, obračun poena, tajmere, uslove, state, server actions, podatke, navigaciju ili API-je tokom vizuelnih izmena.
- Sačuvaj `phone-frame` u `app/globals.css` i njegovo korišćenje u auth i game layoutima. Aplikacija ostaje širine telefona i na desktopu. Javna landing stranica ima svoj postojeći široki raspored.
- Za proveru UI promena prati putanju `/`, `/login`, `/register`, `/home`, profil, podešavanja, rang listu, modale, čekanje partije i svih šest igara. Ako ekran traži prijavu, proveri kod i ne zaobilazi autentifikaciju.
- Pre izmena Next.js koda pročitaj odgovarajući vodič u `node_modules/next/dist/docs/` kao što nalaže blok iznad.

### Boje i površine

Centralni tokeni su u `app/globals.css` i izloženi kroz Tailwind `@theme inline`. Koristi semantičke klase i tokene, umesto novih nasumičnih heks vrednosti po komponentama.

| Namena | Token | Boja |
| --- | --- | --- |
| Pozadina aplikacije | `--background` | `#fff8ef` |
| Kartica i polje | `--surface` | `#ffffff` |
| Topla istaknuta površina | `--surface-light` | `#fff0db` |
| Ivica | `--border` | `#e6d8c9` |
| Glavni tekst | `--text` | `#30293a` |
| Sekundarni tekst | `--text-secondary` | `#5c5366` |
| Manje važan tekst | `--text-muted` | `#746b78` |
| Glavna akcija i akcenat | `--primary` | `#a53e61` |
| Hover glavne akcije | `--primary-hover` | `#882f50` |
| Pozitivno stanje | `--success` | `#21775f` |
| Greška | `--danger` | `#b63f56` |
| Upozorenje | `--warning` | `#9b620d` |
| Plavi igrač | `--blue-player` | `#236e91` |
| Crveni igrač | `--red-player` | `#b43f57` |

Kategorijski akcenti `--purple`, `--orange`, `--yellow` i `--mint` služe za vedru razliku među igrama i sadržajem. Koristi ih u malim površinama, ikonama i detaljima. Glavne akcije su malinaste sa belim tekstom. Tekst u običnom sadržaju treba da ostane tamne boje. Ne koristi svetle nijanse kao jedinu boju sitnog teksta na beloj površini. Stanja igrača moraju imati i tekstualnu oznaku, ne samo boju.

### Tipografija, raspored i komponente

- Osnovni font je postojeći lokalno optimizovani Geist preko `next/font`. Naslovi mogu biti krupni, teški i malo zbijeni; tekst za čitanje treba da ima mirniji ritam i dovoljan prored. Izbegavaj tekst ispod 12 px u običnom UI-ju; na gusto složenim tablama igara kraće oznake mogu biti 10–11 px samo kada nema više prostora.
- Očuvaj jasnu hijerarhiju: jedan glavni naslov ekrana, zatim naslovi sekcija, nazivi kartica i pomoćni tekst. Sitne uppercase oznake koristi samo za kratke etikete, nikada za duga objašnjenja.
- Koristi `page-container`, `card-base`, `input-base`, `btn-primary` i postojeće `components/ui` komponente. Površine su uglavnom ravne, sa nežnim ivicama i blagom senkom. Izbegavaj uniformne kartice sa prevelikim razmacima.
- Na `/home` čuvaj centralni kružni motiv i veseli lav kao vizuelni fokus. Na drugim ekranima ostavi dovoljno prostora za interaktivnu tablu, naročito na 320–390 px širine.
- Sačuvaj vidljiv `:focus-visible`, dovoljno velike dodirne mete i kontrast teksta najmanje WCAG AA nivoa. Proveri duga imena igrača, poruke o greškama i disabled stanja.

### Animacije

Koristi kratke animacije za ulazak panela, hover i pritisak dugmeta, promenu stanja i slavlje na kraju igre. Animacije treba da pomognu razumevanju akcije. Preferiraj `transform` i `opacity`, trajanje približno 150–500 ms i bez stalnog pulsiranja velikih površina. Jedini stalni dekorativni pokret može biti suptilno lebdenje ilustracije na početnoj. Poštuj `prefers-reduced-motion` pravilo u `app/globals.css`.

### Provera posle izmena

Pokreni `npm run build` i `npx tsc --noEmit`. Vizuelno proveri najmanje uzak mobilni ekran i desktop ekran sa očuvanim telefonskim okvirom. Pri pregledu diffa proveri da su menjane samo klase, CSS, ilustracije i tekst koji pripada UI-ju, bez promena logike.
