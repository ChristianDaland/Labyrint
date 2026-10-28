# Gull-egget – spesifikasjon

Flerspiller 3D-labyrintspill i nettleseren. En storskjerm (PC/pad) viser QR-kode og kart. Deltakerne blir med fra mobilen og går rundt i labyrinten i førsteperson (retro 3D à la Duke Nukem/Wolfenstein). Et gull-egg er gjemt et tilfeldig sted. Førstemann som finner det vinner. Labyrinten har mange låste dører som åpnes ved å løse en oppgave (matte/norsk for 1.–2. trinn). Én rev leter også, og krasjer man med den mister man et liv. Ikke et skytespill.

Brukes i undervisning på 1.–2. trinn: mange elever kan ikke lese ennå, så oppgavene bruker bilder (emoji) og leses opp.

Språk i UI: norsk bokmål.

## Teknologi
- Node.js 18+, Express, Socket.io (sanntid), `qrcode` (QR genereres på serveren).
- Klient: ren HTML/JS, Three.js 0.160 via importmap fra jsDelivr. Ingen byggesteg.
- Hosting: Render Web Service, én instans (tilstanden ligger i minnet). Build `npm install`, start `npm start`. Render gir HTTPS og støtter WebSockets.

## Filer
- `server.js` – all spillogikk, serverautoritativ.
- `tasks.js` – oppgavegenerator: `makeTask(grade, subject)` gir `{q, pic, options[3], answer, speak}`. Matte: telle, pluss/minus, størst, før/etter, tiervenner, dobling, tallrekker. Norsk: forlyd, hva er dette, liten bokstav, alfabetet, manglende bokstav, rim, stavelser. Ordbank med emoji og stavelser.
- `public/index.html` – storskjerm: lobby (QR, deltakere, innstillinger, start), redigering av egne oppgaver, kart ovenfra under spill, vinnerskjerm.
- `public/play.html` – mobil: innlogging med navn, venteskjerm, 3D-visning øverst og piltaster nederst, kartknapp.
- Ruter: `/` storskjerm, `/play` mobil, `/qr.png` QR-kode som peker til `<proto>://<host>/play`, `/health`.

## Spilleregler
- Faser: `lobby` → `playing` → `ended` → (ny runde eller tilbake til lobby). Er ingen spillere tilkoblet i 60 s under spill, går serveren tilbake til lobbyen.
- Ny labyrint hver runde (recursive backtracker) + ca. 8 % ekstra åpninger, så det finnes sløyfer å rømme rundt.
- Størrelser: liten 8×8, middels 12×12, stor 16×16 celler. Alltid én rev (`CONFIG.foxes`).
- Verten velger trinn (1/2), standardoppgaver (matte, norsk, begge eller ingen) og eventuelt et sett med egne oppgaver.
- Egne oppgaver: lærere/foreldre lager sett på storskjermen (spørsmål, valgfri emoji, riktig svar, 1–2 feil svar; skjema eller «lim inn mange» med `spørsmål | riktig | feil | feil`). Settene lagres i nettleserens localStorage (`gullegg-sets`) og kan lastes ned/hentes som JSON-fil (`{name, tasks: [{q, pic, right, wrong[]}]}`). Ved start sendes valgt sett til serveren. Med standardoppgaver også valgt blandes de 50/50. Hver spiller trekker egne oppgaver fra en stokket bunke, så alle kommer før noen gjentas. Maks 300 per sett.
- Alle starter i (1,1). Egget plasseres langt unna start (≥60 % av maks BFS-avstand). Rever plasseres langt fra både start og egg.
- 3 liv. Treff av rev: mister et liv, sendes til start, usårbar 2,5 s. 0 liv = ute (tilskuer).
- Vinner: første spiller innen 0,55 enheter fra egget. Revene vinner hvis en rev når egget (først etter 60 s), eller hvis alle spillere er ute.
- Dører: ca. 15 % av gangene mellom to ruter får en dør. Dørene er personlige: en dør er bare åpen for den som har løst oppgaven. Reven går gjennom dører.
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
- `answer i` – svar på oppgaven (indeks). `cancelTask` – gå bort fra døra.
- `settings {size, grade, subject}` (`subject`: `begge`|`matte`|`norsk`|`ingen`), `customTasks {name, tasks[]}`, `start`, `toLobby` – kun fra host. `customTasks` valideres på serveren og ignoreres under spill. Svarene sendes aldri ut; lobbyen får bare `customName` og `customCount`.

Server → klient:
- `lobby {phase, settings, players[]}`
- `joined {id, key, name, color}`
- `game {phase, grid, start, egg, doors[], result, lives, round, elapsed, you?}` – `doors` = `[{id, x, z}]`. `you` = egen posisjon/spawnId/liv/`opened[]` (kun til spillere). `round` teller runder, `elapsed` = ms siden start (frosset ved slutt). Til spillere er `egg` `null` til de har sett det.
- `egg {x, z}` – sendes til en spiller første gang hen ser egget (innen 3 enheter, eller fri sikt innen 9).
- `task {door, q, pic, options[], speak}` – oppgaven, uten fasit.
- `answerResult {ok, correct, door, wait?}` – `correct` = indeksen til riktig svar.
- `state {players[], foxes[]}` – 20 Hz. Spiller har også `doors` (antall åpnet) og `task` (løser nå). Rev: `{x, z, a, c}` der `c=1` betyr jager.
- `hit {lives, respawn?, out?}`, `end {type: 'player'|'fox'|'allOut', id?, name?, color?}`
- `event {text}` – hendelseslogg til storskjermen.

## Klient (mobil)
- Styring: ◀ ▶ (snu) til venstre, ▲ ▼ (gå) til høyre, med pointer events slik at to tomler kan brukes samtidig. Piltaster/WASD fungerer på PC for testing.
- Kollisjon mot vegger og lukkede dører lokalt (radius 0,22, x og z hver for seg).
- Kartknapp midt i statuslinja (også tasten M): bytter mellom 3D og kart ovenfra med vegger, egne lukkede dører, egen posisjon og retning, andre spillere og egget (bare hvis man har sett det). Reven vises ikke på kartet. 3D tegnes ikke mens kartet vises.
- Oppgavevindu med bilde, stor tekst, 🔊-knapp (Web Speech, nb-NO, leses også opp automatisk) og tre store svarknapper. Dører er treplanker med «?» og glir opp i taket når de åpnes.
- Andre spillere og rever interpoleres jevnt mot siste mottatte posisjon.
- Grafikk: InstancedMesh-vegger med prosedyrisk murstein (NearestFilter), tåke, lykt som følger kameraet, glødende gull-egg, lavpolygon-rev med lysende øyne, avatarer i spillerens farge med navneskilt.
- Effekter: rød blink og vibrasjon ved treff, oransje kant når en jagende rev er nær, Wake Lock for å holde skjermen på.

## Status
Ferdig og testet med simulerte socket-klienter: lobby, start, vinn ved egg, treff og liv, ute, revene vinner.
Også testet: egne oppgaver (validering, ingen fasit ut, bunke uten gjentakelse), skjermbilder i Chromium av redigering, lobby, mobil 3D og kart, dører og oppgaver (ingen fasit til klienten, kan ikke gå gjennom lukket dør, ventetid etter feil), vertsnøkkel, egget skjult til det er sett, tidtaker ved gjenoppkobling, retur til lobby når alle har koblet fra.
Ikke testet visuelt på ekte mobil ennå.

## Forslag til neste steg
1. Test på iPhone og Android; juster lys, tåke, fart og knappestørrelser.
2. Lagre egne oppgavesett på serveren (krever database og innlogging) når hjemmesiden får brukerkontoer.
3. Romkoder, så flere spill kan kjøre samtidig (i dag finnes ett globalt spill).
4. Lyd: fottrinn, rev som knurrer når den jager, fanfare ved seier.
5. Enkel animasjon av spilleravatarene (gange).
