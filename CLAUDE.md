# Gull-egget – spesifikasjon

Flerspiller 3D-labyrintspill i nettleseren. En storskjerm (PC/pad) viser QR-kode og kart. Deltakerne blir med fra mobilen og går rundt i labyrinten i førsteperson (retro 3D à la Duke Nukem/Wolfenstein). Et gull-egg er gjemt et tilfeldig sted. Førstemann som finner det vinner. Labyrinten har mange låste dører som åpnes ved å løse en oppgave (matte/norsk for 1.–2. trinn). Man får poeng for å gå nye steder og for å løse oppgaver. Én rev leter også. Tar den deg, står du fast til du har svart riktig på et revespørsmål. Ingen liv eller poeng går tapt. Ikke et skytespill.

Brukes i undervisning på 1.–2. trinn: mange elever kan ikke lese ennå, så oppgavene bruker bilder (emoji) og leses opp.

Språk i UI: norsk bokmål.

## Ombygging pågår (se PLAN.md)
Spillet bygges om fra flerspiller med storskjerm til en samling læringsspill for én spiller, som statisk side på GitHub Pages (ingen server). Plan og status står i `PLAN.md`. Til labyrinten er bygd om (steg 4), beskriver resten av denne fila det gamle flerspillerspillet, som fortsatt ligger i `server.js`, `tasks.js`, `public/index.html` og `public/play.html`.

Ny kjerne i `public/kjerne/` (ES-moduler uten byggesteg, felles for alle spillene; `kjerne/package.json` gjør dem til moduler også i Node):
- `oppgaver.js` – oppgaver per ferdighet (`SKILLS`, i læringsrekkefølge per fag, hver med diplomtekst). Oppgave: `{skill, q, pic, options[3], answer, speak}`. `LETTER_ORDER` = rekkefølgen bokstavene innføres i (bytt hvis en annen ABC-bok følges).
- `laering.js` – læringsmotoren: nivå per fag, siste 10 svar per ferdighet, opp ved 8/10 og ned ved under 5/10 (med blanke ark), valg ca. 70 % nå / 20 % repetisjon (vektet mot det han bommer på) / 10 % smakebit. `recordAnswer` fører også statistikk per fag og dag.
- `belonning.js` – stjerner (1–3), gullegg per runde, milepæl-diplomer og diplomer for mestrede ferdigheter.
- `lagring.js` – profiler (dyr + farge, aldri navn), alt i `localStorage` under nøkkelen `gullegget` med versjonsnummer; tåler ødelagte data, sikkerhetskopi (eksport/import), `requestPersist()`.
- `lyd.js` – Web Audio-effekter (pling, oops, fanfare, flap, bump, creak, bark, growl) som også kan tas opp offline. `say(...biter)` spiller ferdiglagde setninger (`lyd/tale/manifest.json` → mp3) etter hverandre via Web Audio. Mangler en bit, leses alt av enhetens stemme. `prefetch()` henter på forhånd. Plass til innspilte bokstavlyder (`LETTER_FILES`).
- `tale.js` – **alt spillet sier**, som funksjoner som gir biter (`T.welcome(p)`, `T.starsHave(n)`, `T.wrong(task)` …). `allPhrases()` lister alle bitene, inkludert alle oppgavesetningene (funnet ved mange trekk) og tall 0–300. **Ny tekst som skal sies, legges inn her**, og så kjøres `verktoy/lag-tale.py`.
- `ui.js` – `holdButton` (hold inne for å utløse) og `keepAwake` (Wake Lock).
- Alle stier er relative (siden ligger under `/Labyrint/` på GitHub Pages).

Rommet `public/rom.html` (startskjerm; blir `index.html` i steg 4):
- **Start:** ▶-knapp (låser opp lyd på iOS) → ny figur (velg dyr + farge) / velg figur (hvis flere) / rommet.
- **Lave skjermer:** skjermene kan rulles og har kompakt utgave (`max-height: 520px`), så alt får plass på iPhone på tvers.
- **Rommet:** figur, ⭐ stjerner, gullegg-teller, diplomer på klossvegg (tomme «?»-rammer viser at det finnes flere), gullegg på hyller (antall per hylle etter skjermbredde), krukker for matte/norsk (fremgang i ferdighetene) og spillkort.
- **Opplesning:** alt leses opp ved trykk.
- **Spillkort:** ett trykk sier navnet, to trykk starter.
- **Feiring:** nye egg og diplomer siden sist feires (fanfare, diplom vist stort og lest opp). Rommet teller med `rewards.seenEggs`/`seenDiplomas`.
- **Voksenmeny:** ⚙️, holdes inne i 3 s. Inneholder bytt/ny/slett figur, fag (begge/matte/norsk), lyd av/på, sikkerhetskopi lagre/hent, og hint om Hjem-skjerm.
- **Spillene lastes inn som moduler** (`spill/*.js`) i samme side, ikke egne sider, så lyden forblir låst opp. `GAMES` i rom.html; `ready: false` til spillet finnes.
- Tester: `npm test` (Node, `test/kjerne.test.mjs`). Testene sjekker også at alt `tale.js` kan si, finnes som lydfil.

Stemme og lydfiler:
- **Stemme:** Piper med `no_NO-talesyntese-medium` (CC0, Nasjonalbiblioteket), sakte og tydelig for barn: `length_scale 1.7, noise 0.5, noise_w 0.6`, 0,6 s mellom setninger, MP3 40 kbit/s mono.
- **Lage filene:** `uv run --with piper-tts --with lameenc python verktoy/lag-tale.py`. Henter setningene via `verktoy/fraser.mjs` og lager bare nye filer. Filene heter `sha1(stemme+innstillinger+tekst)`. Ubrukte filer slettes. Stemmen lastes ned til `verktoy/.cache/` (gitignored).
- **Bakgrunn for valget:** nettleserens egen stemme var uforståelig (espeak på Linux).

Spill (`public/spill/*.js`, lastes inn i rommet med `import()`; `export default start({ root, profile, store, onExit })`; `onExit({ game, right, total })` gir egg i rommet, `onExit(null)` = avbrutt):
- **Flakse-fuglen** (`flakse.js`, Canvas 2D):
  - **Styring:** trykk eller mellomrom flakser.
  - **Spillet:** tre åpninger i en klossvegg med svar på skilt.
  - **Ingen kollisjon:** innenfor 1,8 veggbredder før veggen glir fuglen inn i nærmeste åpne åpning (`ASSIST`). Den treffer aldri murstein, så et barn som sikter litt skjevt, tror ikke at svaret var feil. Bakken spretter.
  - **Feil svar:** «Ikke helt. Prøv igjen!», og samme spørsmål kommer på en ny vegg der den feile åpningen er murt igjen, helt til riktig åpning. Etter to feil er bare riktig åpen. Riktig svar avsløres ikke ved feil.
  - **Bare første forsøk teller** i læringsmotoren og for stjernene.
  - **Runde:** 10 spørsmål fra læringsmotoren. Riktig gir pling, ros og stjerner.
  - **Tempo:** veggen bruker 6,5 s til fuglen, ned til 70 % ved mange riktige på rad.
  - **Fuglen** har spillerens farge.
  - **Avslutte:** ✕ holdes inne 1 s.
  - **Test:** `#test=riktig|slurv|feil` i adressen slår på autopilot («slurv» sikter mot kanten av riktig åpning) og eksponerer `window.__flakse` (brukes av automatiske tester).

## Spillveiledning – hold den oppdatert
`public/veiledning.html` (rute `/veiledning`, lenket fra lobbyen og fra «Egne oppgaver») er veiledningen for lærere og foreldre.
**Når regler, poeng, oppgavetyper, innstillinger, knapper, tekster eller oppførsel i spillet endres, skal veiledningen oppdateres i samme endring.**
Tall i veiledningen (poeng, antall dører, ventetider, revens pause, maks oppgaver) skal stemme med `CONFIG` i `server.js` og med `tasks.js`.

## Teknologi
- Node.js 18+, Express, Socket.io (sanntid), `qrcode` (QR genereres på serveren).
- Klient: ren HTML/JS, Three.js 0.160 via importmap fra jsDelivr. Ingen byggesteg.
- Hosting: Render Web Service, én instans (tilstanden ligger i minnet). Build `npm install`, start `npm start`. Render gir HTTPS og støtter WebSockets.

## Filer
- `server.js` – all spillogikk, serverautoritativ.
- `tasks.js` – oppgavegenerator: `makeTask(grade, subject)` gir `{q, pic, options[3], answer, speak}`. Matte: telle, pluss/minus, størst, før/etter, tiervenner, dobling, tallrekker. Norsk: forlyd, hva er dette, liten bokstav, alfabetet, manglende bokstav, rim, stavelser. Ordbank med emoji og stavelser.
- `public/index.html` – storskjerm: lobby (QR, deltakere, innstillinger, start), redigering av egne oppgaver, kart ovenfra under spill, vinnerskjerm.
- `public/veiledning.html` – spillveiledning for lærere og foreldre (se over).
- `public/play.html` – mobil: innlogging med navn, venteskjerm, 3D-visning øverst og piltaster nederst, kartknapp.
- Ruter: `/` storskjerm, `/play` mobil, `/veiledning` spillveiledning, `/qr.png` QR-kode som peker til `<proto>://<host>/play`, `/health`.

## Spilleregler
- Faser: `lobby` → `playing` → `ended` → (ny runde eller tilbake til lobby). Er ingen spillere tilkoblet i 60 s under spill, går serveren tilbake til lobbyen.
- Ny labyrint hver runde: perfekt labyrint (recursive backtracker), egget langt unna, dører jevnt fordelt på den eneste veien til egget (`CONFIG.pathDoors`: liten 6, middels 9, stor 12), deretter ca. 8 % ekstra åpninger (sløyfer) som bare godtas hvis hver dør på veien fortsatt er eneste vei fram (`addLoops`). I tillegg får ca. 4 % av de andre gangene en dør (`sideDoorShare`). Man må altså gjennom alle dørene på veien; målt over 75 labyrinter må man gjennom i snitt ca. 7/11/16 dører (liten/middels/stor), ca. 70–85 % av alle dørene.
- Størrelser: liten 8×8, middels 12×12, stor 16×16 celler. Alltid én rev (`CONFIG.foxes`).
- Verten velger trinn (1/2), standardoppgaver (matte, norsk, begge eller ingen) og eventuelt et sett med egne oppgaver.
- Egne oppgaver: lærere/foreldre lager sett på storskjermen (spørsmål, valgfri emoji, riktig svar, 1–2 feil svar; skjema eller «lim inn mange» med `spørsmål | riktig | feil | feil`). Settene lagres i nettleserens localStorage (`gullegg-sets`) og kan lastes ned/hentes som JSON-fil (`{name, tasks: [{q, pic, right, wrong[]}]}`). Ved start sendes valgt sett til serveren. Med standardoppgaver også valgt blandes de 50/50. Hver spiller trekker egne oppgaver fra en stokket bunke, så alle kommer før noen gjentas. Maks 300 per sett.
- Alle starter i (1,1). Egget plasseres langt unna start (≥60 % av maks BFS-avstand). Reven plasseres langt fra både start og egg.
- Poeng: 1 per ny rute man går på (`visited`, ikke for å gå fram og tilbake), 10 per løst dør, 5 for å komme fri fra reven (`foxTaskPoints`), 25 ekstra for å finne egget. Ingen liv, ingen blir ute, poeng trekkes aldri.
- Rev: når den tar deg, holder den deg fast (`p.caughtBy`, `f.holding`) og du får et revespørsmål (samme oppgavepool som dørene). Du kan ikke gå eller gå bort fra spørsmålet. Feil svar: riktig svar vises, og serveren sender selv et nytt revespørsmål etter 3 s. Riktig svar: fri og trygg i 5 s (`invulnMs`), og reven flykter (`f.flee`): den velger et mål ca. 10–14 ruter unna langs gangene (`foxRetreatCells`) der hele veien går bort fra spilleren (reven ligger på korteste vei fra spilleren til målet), og løper dit med fart 2,6 uten å fange noen (maks 6 s). Står reven i en sidegang uten så lang vei bort, løper den så langt det går. Kobler man fra mens man er fanget, slippes man fri.
- Vinner: første spiller innen 0,55 enheter fra egget. Reven vinner hvis den når egget (først etter 60 s). Vinnerskjermen viser poengtavle (poeng og dører).
- Dørene er personlige: en dør er bare åpen for den som har løst oppgaven. Reven går gjennom dører.
- Oppgave: står man vendt mot en lukket dør, får man en flervalgsoppgave. Riktig svar åpner døra. Feil svar viser riktig svar, så får man en ny oppgave etter 3 s. Samme ubesvarte oppgave sendes igjen (man kan ikke bytte til en lettere). Mens man løser en oppgave kan reven ikke ta en.
- Alle verdier ligger i `CONFIG` øverst i `server.js`.

## Koordinater og labyrint
- `grid[z][x]`, 1 = vegg, 0 = gulv. Størrelse (2n+1)×(2n+1). Celle-sentre på oddetallskoordinater.
- Verdensenhet: 1 rute = 1 enhet. Vegghøyde 1,4, øyehøyde 0,62.
- Retning `a` i radianer: fremover = (cos a, sin a) i (x, z). Økende `a` = snu til høyre.
- Three.js: `camera.rotation.y = -a - π/2`. Modeller bygges med front mot +x og roteres `rotation.y = -a`.

## Rever (server)
- Beveger seg rute for rute og velger ny retning i hvert rutesenter.
- Ser langs rette korridorer opptil 7 ruter. Ser den en spiller (ikke usårbar): jager med fart 2,0.
- Ellers etter 60 s: går mot egget hvis det er i synsfeltet. Ellers vandrer den tilfeldig (fart 1,3) og unngår å snu.
- Spillerfart er 2,4, så man kan løpe fra en rev.

## Nettverksprotokoll (Socket.io)
Klient → server:
- `host {key?}` – storskjermen melder seg (rom `hosts`). Er miljøvariabelen `HOST_KEY` satt, må `key` stemme (storskjermen leser den fra `/?key=…`), ellers svarer serveren `hostDenied`.
- `join {key, name}` – `key` lagres i localStorage for gjenoppkobling.
- `pos {x, z, a, s}` – ~15 Hz. `s` = spawnId; serveren ignorerer gamle spawnId, posisjoner i vegg og urimelig raske hopp.
- `door id` – be om oppgave for en dør (serveren sjekker avstand og ventetid).
- `answer i` – svar på oppgaven (indeks). `cancelTask` – gå bort fra døra (ignoreres når reven har fanget deg).
- `settings {size, grade, subject}` (`subject`: `begge`|`matte`|`norsk`|`ingen`), `customTasks {name, tasks[]}`, `start`, `toLobby` – kun fra host. `customTasks` valideres på serveren og ignoreres under spill. Svarene sendes aldri ut; lobbyen får bare `customName` og `customCount`.

Server → klient:
- `lobby {phase, settings, players[]}`
- `joined {id, key, name, color}`
- `game {phase, grid, start, egg, doors[], result, round, elapsed, you?}` – `doors` = `[{id, x, z}]`. `you` = egen posisjon/spawnId/`score`/`opened[]` (kun til spillere). `round` teller runder, `elapsed` = ms siden start (frosset ved slutt). Egget sendes til alle fra start (det vises på kartet).
- `task {kind, door?, q, pic, options[], speak}` – oppgaven, uten fasit. `kind` = `door` eller `fox` (revespørsmål).
- `answerResult {ok, kind, correct, door?, points?, wait?}` – `correct` = indeksen til riktig svar.
- `state {players[], foxes[]}` – 20 Hz. Spiller har også `score`, `doors` (antall åpnet), `task` (løser nå) og `caught` (fanget av reven). Rev: `{x, z, a, c}` der `c=1` betyr jager.
- `end {type: 'player'|'fox', id?, name?, color?, scores[]}` – `scores` = `[{id, name, color, score, doors}]` sortert.
- `event {text}` – hendelseslogg til storskjermen.

## Klient (mobil)
- Styring: ◀ ▶ (snu) til venstre, ▲ ▼ (gå) til høyre, med pointer events slik at to tomler kan brukes samtidig. Piltaster/WASD fungerer på PC for testing.
- Kollisjon mot vegger og lukkede dører lokalt (radius 0,22, x og z hver for seg).
- Kartknapp midt i statuslinja (også tasten M): bytter mellom 3D og kart ovenfra med vegger, egne lukkede dører, egen posisjon og retning, andre spillere, egget og reven (🦊, rød ring når den jager). 3D tegnes ikke mens kartet vises.
- Statuslinja viser poeng (⭐), med sprett når de endres. Vinnerskjermen viser poengtavle.
- Dørspørsmål og revespørsmål ser tydelig forskjellige ut: dør = mørkegrønt med «🚪 Løs oppgaven for å åpne døra» og «Gå bort fra døra»; rev (`#task.fox`) = glødende oransje/rød bakgrunn, pulserende «🦊 Reven har fanget deg! Svar riktig for å komme fri», oransje knapper, rød blink og vibrasjon, «Reven har fanget deg!» leses opp først, og ingen «gå bort».
- Oppgavevindu med bilde, stor tekst, 🔊-knapp (Web Speech, nb-NO, leses også opp automatisk) og tre store svarknapper. Dører er treplanker med «?» og glir opp i taket når de åpnes.
- Andre spillere og rever interpoleres jevnt mot siste mottatte posisjon.
- Grafikk: InstancedMesh-vegger med prosedyrisk murstein (NearestFilter), tåke, lykt som følger kameraet, glødende gull-egg, lavpolygon-rev med lysende øyne, avatarer i spillerens farge med navneskilt.
- Lyd (Web Audio, lages i koden, ingen lydfiler; startes/gjenopptas ved hvert trykk, pauses når fanen skjules): knirk når en dør åpnes (sagtann med glidende tonehøyde, hakket opp 26–58 ganger/s, gjennom båndpass), knurring fra nærmeste rev innen 7 ruter (sterkere jo nærmere, ×0,4 når den ikke jager, panorert mot revens side), bjeff av og til når den jager og når den fanger deg. Revelyden er stille mens et oppgavevindu er oppe, så opplesningen høres.
- Effekter: rød blink og vibrasjon når reven fanger deg, oransje kant når en jagende rev er nær, Wake Lock for å holde skjermen på.

## Status
Ferdig og testet med simulerte socket-klienter: lobby, start, vinn ved egg, poeng (nye ruter, oppgaver, egg), revespørsmål (fanget står stille, kan ikke gå bort, nytt spørsmål etter feil svar, fri etter riktig, ingen poeng trekkes, trygg-tid, reven flykter minst 10 ruter eller til enden av en sidegang, 25 runder), labyrintstruktur (egget kan aldri nås uten dører, over 75 labyrinter).
Også testet: egne oppgaver (validering, ingen fasit ut, bunke uten gjentakelse), skjermbilder i Chromium av redigering, lobby, mobil 3D og kart (med rev og egg), vinnerskjermer med poengtavle, dørspørsmål og revespørsmål, dører og oppgaver (ingen fasit til klienten, kan ikke gå gjennom lukket dør, ventetid etter feil), vertsnøkkel, tidtaker ved gjenoppkobling, retur til lobby når alle har koblet fra.
Ikke testet visuelt på ekte mobil ennå.

## Forslag til neste steg
1. Test på iPhone og Android; juster lys, tåke, fart og knappestørrelser.
2. Lagre egne oppgavesett på serveren (krever database og innlogging) når hjemmesiden får brukerkontoer.
3. Romkoder, så flere spill kan kjøre samtidig (i dag finnes ett globalt spill).
4. Mer lyd: fottrinn, fanfare ved seier, eventuelt en av/på-knapp for lydeffekter.
5. Enkel animasjon av spilleravatarene (gange).
