# Gull-egget – spesifikasjon

Flerspiller 3D-labyrintspill i nettleseren. En storskjerm (PC/pad) viser QR-kode og kart. Deltakerne blir med fra mobilen og går rundt i labyrinten i førsteperson (retro 3D à la Duke Nukem/Wolfenstein). Et gull-egg er gjemt et tilfeldig sted. Førstemann som finner det vinner. Rever leter også, og krasjer man med en rev mister man et liv. Ikke et skytespill.

Språk i UI: norsk bokmål.

## Teknologi
- Node.js 18+, Express, Socket.io (sanntid), `qrcode` (QR genereres på serveren).
- Klient: ren HTML/JS, Three.js 0.160 via importmap fra jsDelivr. Ingen byggesteg.
- Hosting: Render Web Service, én instans (tilstanden ligger i minnet). Build `npm install`, start `npm start`. Render gir HTTPS og støtter WebSockets.

## Filer
- `server.js` – all spillogikk, serverautoritativ.
- `public/index.html` – storskjerm: lobby (QR, deltakere, innstillinger, start), kart ovenfra under spill, vinnerskjerm.
- `public/play.html` – mobil: innlogging med navn, venteskjerm, 3D-visning øverst og piltaster nederst.
- Ruter: `/` storskjerm, `/play` mobil, `/qr.png` QR-kode som peker til `<proto>://<host>/play`, `/health`.

## Spilleregler
- Faser: `lobby` → `playing` → `ended` → (ny runde eller tilbake til lobby). Er ingen spillere tilkoblet i 60 s under spill, går serveren tilbake til lobbyen.
- Ny labyrint hver runde (recursive backtracker) + ca. 8 % ekstra åpninger, så det finnes sløyfer å rømme rundt.
- Størrelser: liten 8×8, middels 12×12, stor 16×16 celler. Antall rever 0–6 (standard 2).
- Alle starter i (1,1). Egget plasseres langt unna start (≥60 % av maks BFS-avstand). Rever plasseres langt fra både start og egg.
- 3 liv. Treff av rev: mister et liv, sendes til start, usårbar 2,5 s. 0 liv = ute (tilskuer).
- Vinner: første spiller innen 0,55 enheter fra egget. Revene vinner hvis en rev når egget (først etter 60 s), eller hvis alle spillere er ute.
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
- `settings {size, foxes}`, `start`, `toLobby` – kun fra host.

Server → klient:
- `lobby {phase, settings, players[]}`
- `joined {id, key, name, color}`
- `game {phase, grid, start, egg, result, lives, round, elapsed, you?}` – `you` = egen posisjon/spawnId/liv (kun til spillere). `round` teller runder, `elapsed` = ms siden start (frosset ved slutt). Til spillere er `egg` `null` til de har sett det.
- `egg {x, z}` – sendes til en spiller første gang hen ser egget (innen 3 enheter, eller fri sikt innen 9).
- `state {players[], foxes[]}` – 20 Hz. Rev: `{x, z, a, c}` der `c=1` betyr jager.
- `hit {lives, respawn?, out?}`, `end {type: 'player'|'fox'|'allOut', id?, name?, color?}`
- `event {text}` – hendelseslogg til storskjermen.

## Klient (mobil)
- Styring: ◀ ▶ (snu) til venstre, ▲ ▼ (gå) til høyre, med pointer events slik at to tomler kan brukes samtidig. Piltaster/WASD fungerer på PC for testing.
- Kollisjon mot vegger lokalt (radius 0,22, x og z hver for seg).
- Andre spillere og rever interpoleres jevnt mot siste mottatte posisjon.
- Grafikk: InstancedMesh-vegger med prosedyrisk murstein (NearestFilter), tåke, lykt som følger kameraet, glødende gull-egg, lavpolygon-rev med lysende øyne, avatarer i spillerens farge med navneskilt.
- Effekter: rød blink og vibrasjon ved treff, oransje kant når en jagende rev er nær, Wake Lock for å holde skjermen på.

## Status
Ferdig og testet med simulerte socket-klienter: lobby, start, vinn ved egg, treff og liv, ute, revene vinner.
Også testet: vertsnøkkel, egget skjult til det er sett, tidtaker ved gjenoppkobling, retur til lobby når alle har koblet fra.
Ikke testet visuelt på ekte mobil ennå.

## Forslag til neste steg
1. Test på iPhone og Android; juster lys, tåke, fart og knappestørrelser.
2. Romkoder, så flere spill kan kjøre samtidig (i dag finnes ett globalt spill).
3. Minikart eller kompass på mobilen (valgfritt, kan gjøre det for lett).
4. Lyd: fottrinn, rev som knurrer når den jager, fanfare ved seier.
5. Enkel animasjon av spilleravatarene (gange).
