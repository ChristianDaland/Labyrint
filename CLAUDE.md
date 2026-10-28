# Gull-egget

Læringsspill i lesing, skriving og enkel matte for barn på 1.–2. trinns-nivå, også barn som ikke kan lese ennå:
alt leses opp, bilder brukes i stedet for tekst, og oppgavene tilpasser seg barnet. Én spiller, ingen innlogging,
ingen navn. Laget for iPhone og iPad (høykant), virker også på Android og PC. Plan og status står i `PLAN.md`.

Språk i UI: norsk bokmål.

## Personvern i repoet
Repoet og nettsiden er offentlige. Skriv aldri noe om konkrete barn, familier eller testere (hvem spillet er laget for,
hjemmesituasjon, hvordan det går med undervisning e.l.) i filer, kommentarer, commit-meldinger eller noe som publiseres.
Bruk nøytrale ord: «barnet», «spilleren», «foreldrene». Sjekk tekst for slike detaljer før commit.

## Spillveiledning – hold den oppdatert
`public/veiledning.html` er veiledningen for foreldre (kom i gang, rommet, spillene, læringen, belønninger, voksenmenyen,
personvern, feilsøking). Den lenkes fra voksenmenyen.
**Når regler, oppgavetyper, innstillinger, knapper, tekster eller oppførsel endres, skal veiledningen oppdateres i samme endring.**
Tall i veiledningen (stjernegrenser, rundelengde, opp/ned 8/10 og 5/10, ferdighetslisten, voksenmenyens 3 s, revens trygg-tid)
skal stemme med `public/kjerne/` og `public/spill/`.

## Teknologi og publisering
- Statisk nettside i `public/`, ren HTML og JavaScript (ES-moduler) uten byggesteg og uten server. Three.js 0.160 (fra jsDelivr) bare i labyrinten.
- **GitHub Pages:** `.github/workflows/pages.yml` kjører testene og publiserer **bare `public/`** ved push til `main`.
  Adresse: `https://christiandaland.github.io/Labyrint/`. **Startadressen må ikke endres,** ellers slutter installerte ikoner å virke.
  Alle stier er relative (siden ligger under `/Labyrint/`).
- **Tester:** `npm test` (Node, `test/kjerne.test.mjs`): oppgaver, læringsmotor, belønninger, lagring, at all tale finnes som lydfil, labyrintens struktur og revens oppførsel.
  `public/kjerne/package.json` og `public/spill/package.json` gjør filene til moduler i Node.
- Prøv lokalt: `python3 -m http.server -d public 8080`.

## Kjernen (`public/kjerne/`, felles for alle spillene)
- `oppgaver.js` – oppgaver per ferdighet (`SKILLS`, i læringsrekkefølge per fag, hver med diplomtekst). Oppgave: `{skill, q, pic, options[3], answer, speak}`. Staveoppgave (`SPELL_SKILLS`): `{skill, kind: 'stave', word, pic, tiles, ghost, speak}`. `LETTER_ORDER` = rekkefølgen bokstavene innføres i. Oppgaver med bilde sier alltid hva bildet er (f.eks. «Finn ordet tre»).
- `laering.js` – læringsmotoren: nivå per fag (matte, norsk, stave og setning; «begge» = matte og norsk), siste 10 svar per ferdighet, opp ved 8/10 og ned ved under 5/10 (med blanke ark), valg ca. 70 % nå / 20 % repetisjon (vektet mot det spilleren bommer på) / 10 % smakebit. `recordAnswer` fører også statistikk per fag og dag.
- `belonning.js` – stjerner (1–3: av 10 riktige på første forsøk gir 0–5 → 1, 6–8 → 2, 9–10 → 3), ett egg per runde der stjernene avgjør typen (`EGG_KINDS`: 3 gull, 2 sølv, 1 bronse; `eggKind(e)` regner det ut fra `e.stars`), milepæl-diplomer og diplomer for mestrede ferdigheter.
- `lagring.js` – profiler (dyr + farge, aldri navn), alt i `localStorage` under nøkkelen `gullegget` med versjonsnummer; tåler ødelagte data, sikkerhetskopi (eksport/import), `requestPersist()`.
- `lyd.js` – Web Audio-effekter (pling, oops, fanfare, flap, bump, creak, bark, growl med `set/stop`) som også kan tas opp offline. `say(...biter)` spiller ferdiglagde setninger (`lyd/tale/manifest.json` → mp3) etter hverandre via Web Audio; mangler en bit, leses alt av enhetens stemme. `prefetch()` henter på forhånd. Setter `navigator.audioSession.type = 'playback'` (iOS 16.4+), så lyd høres selv om lydløs-bryteren er på. Lyd låses opp på `pointerdown`, `touchend` og `click`. Plass til innspilte bokstavlyder (`LETTER_FILES`).
- `tale.js` – **alt spillet sier**, som funksjoner som gir biter (`T.welcome(p)`, `T.starsHave(n)`, `T.tryAgain()` …). `allPhrases()` lister alle bitene, inkludert alle oppgavesetningene (funnet ved mange trekk) og tall 0–300. **Ny tekst som skal sies, legges inn her**, og så kjøres `verktoy/lag-tale.py`.
- `ui.js` – `holdButton` (hold inne for å utløse) og `keepAwake` (Wake Lock).

## Stemme og lydfiler
- Piper med `no_NO-talesyntese-medium` (CC0, Nasjonalbiblioteket), sakte og tydelig for barn: `length_scale 1.7, noise 0.5, noise_w 0.6`, 0,6 s mellom setninger, MP3 40 kbit/s mono.
- Lage filene: `uv run --with piper-tts --with lameenc python verktoy/lag-tale.py`. Henter setningene via `verktoy/fraser.mjs`, lager bare nye filer (navn = `sha1(stemme+innstillinger+tekst)`), sletter ubrukte. Stemmen lastes ned til `verktoy/.cache/` (gitignored).
- Ikonene tegnes med `uv run --with pillow python verktoy/lag-ikoner.py`.

## Rommet (`public/index.html`, startskjerm)
- **Start:** ▶-knapp (låser opp lyd på iOS) → ny figur (velg dyr + farge) / velg figur (hvis flere) / rommet.
- **Rommet:** figur, ⭐ stjerner, egg-teller (leser opp antall per type), diplomer på klossvegg i fire rammer (`DIPLOMA_GROUPS`: matte, norsk, stave, ekstra; med antall, trykk åpner `#dipList` med alle i gruppa), hylle med 👑/💎 (`treasure(n)`: 10 egg = 1 diamant, 10 diamanter = 1 krone) og en hylle med de løse eggene (0–9) og tomme plasser opp til 10, krukker for matte/norsk (fremgang) og spillkort. Alt leses opp ved trykk. Spillkort (tre kolonner): ett trykk sier navnet, to trykk starter.
- **Feiring:** nye egg og diplomer siden sist feires (fanfare; ny diamant/krone og nye diplomer vist stort og lest opp). Rommet teller med `rewards.seenEggs`/`seenDiplomas`.
- **Voksenmeny:** ⚙️, holdes inne i 3 s: bytt/ny/slett figur, fag (begge/matte/norsk), lyd av/på, sikkerhetskopi lagre/hent, Hjem-skjerm-hint, lenke til veiledningen.
- **Bare høykant på telefon og pad:** Safari kan ikke låse retningen, så `#rotate` («Snu skjermen», leses opp) dekker alt ved `(orientation: landscape) and (pointer: coarse)`, og spillene står stille. PC kan bruke begge retninger.
- **Lave skjermer:** skjermene kan rulles og har kompakt utgave (`max-height: 520px`).
- **Hjem-skjerm-app:** `manifest.webmanifest` (standalone, portrait, `start_url ./`), ikoner i `ikoner/`, iOS-metatagger. En app på Hjem-skjermen har egen lagring, atskilt fra Safari (står i veiledningen).
- **Spillene lastes inn som moduler** i samme side (ikke egne sider), så lyden forblir låst opp. `GAMES` i index.html.

## Spillene (`public/spill/`)
Felles grensesnitt: `export default start({ root, profile, store, onExit })`. `onExit({ game, right, total, foxEscapes? })` gir egg og stjerner i rommet; `onExit(null)` = avbrutt (svarene teller likevel i læringen). Felles regler: spørsmålet leses alltid opp (🔊 igjen), **feil svar gir «Ikke helt. Prøv igjen!»** til riktig er valgt, og **bare første forsøk teller** i læringsmotoren og for stjernene. Ingen kan tape. ✕ holdes inne 1 s for å avslutte.

- **Flakse-fuglen** (`flakse.js`, Canvas 2D): trykk eller mellomrom flakser. Tre åpninger i en klossvegg med svar på skilt. Innenfor 1,8 veggbredder før veggen glir fuglen inn i nærmeste åpne åpning (`ASSIST`), så den aldri treffer murstein. Feil åpning: samme spørsmål på en ny vegg der den feile åpningen er murt igjen (riktig svar avsløres ikke). 10 spørsmål per runde. Veggen bruker 10 s til fuglen, ned til 75 % ved mange riktige på rad. Fuglen har spillerens farge. Test: `#test=riktig|slurv|feil` (autopilot, `window.__flakse`).
- **Labyrinten** (`labyrint.js` + `labyrint-kart.js`, Three.js): førsteperson i en 7×7-labyrint, ◀ ▶ snur, ▲ ▼ går (piltaster/WASD på PC), 🗺️ Kart (eller M) viser kart ovenfra med egget, reven og lukkede dører.
  - `labyrint-kart.js` (uten grafikk, testes i Node): perfekt labyrint, egget langt unna, `pathDoors` (6) dører jevnt fordelt på den eneste veien til egget, sløyfer bare der de ikke går rundt en dør, noen få sidedører (ikke rett ved start). Reven: vandrer, jager når den ser spilleren langs en rett gang (opptil 7 ruter), og `releaseFox` sender den til et mål ca. 10 ruter unna der hele veien går bort fra spilleren.
  - Dør: står man vendt mot en lukket dør (< 0,95), åpnes en oppgave. Riktig: oppgaven lukkes etter 0,7 s, og døra svinger opp på hengsler bort fra spilleren i takt med knirken (1,9 s). «Gå bort fra døra» er mulig; samme ubesvarte oppgave kommer igjen.
  - Rev: fanger når den er nær (0,5) og spilleren ikke er trygg → revespørsmål (oransje/rødt, «Reven har fanget deg!», kan ikke gå bort). Riktig: «Du er fri. Løp!», reven løper unna, trygg i 5 s. Spilleren er også trygg mens en oppgave er åpen. Reven kan ikke vinne.
  - Lyd: knurring fra reven (sterkere jo nærmere, panorert mot revens side, stille mens oppgave er åpen), bjeff når den jager og fanger, knirk når døra åpnes. Oransje kant når en jagende rev er nær.
  - Egget starter som gull og skifter farge (3D, kart og merke øverst) etter stjernene for svarene så langt. Egget (< 0,55) avslutter runden: «Du fant gull-egget!» / sølvegget / bronse-egget, stjerner, tilbake til rommet. Stjerner etter riktige på første forsøk av alle oppgaver (dører og rev).
  - Test: `#test=riktig|feil` (autopilot som går korteste vei til egget og svarer, `window.__labyrint`).
- **Brikkespill** (`brikker.js`, DOM): felles motor for Ordbyggeren og Tallbyggeren. Puslespill `{skill, key, pic, q, parts: [{text}|{slot, ghost}], tiles, speak, done}`. Unngår samme `key` i en runde og helst fra forrige runde.
- **Tallbyggeren** (`tallbygger.js`): `makeMathPuzzle` i oppgaver.js lager regnestykker/tallrekker med tomme ruter for hver matte-ferdighet (samme matte-nivå som de andre spillene): telling med bilde, rekke med neste tall, «☐ > a» (bare én brikke større), pluss/minus (fra nivå 10 også ukjent i midten: 30–40 %), tiervenner, rekke med to tomme (opp til 20), dobbel, tallrekker (2/5/10). Svarene + 2 ekstra tall. 10 oppgaver. Test: `#test=riktig|feil` (`window.__tallbygger`).
- **Ordtoget** (`ordtog.js`, bruker brikker.js med tema `ord`: brede ordbrikker): «Lag setningen: Katten drikker melk.» og ordbrikker i riktig rekkefølge. Ordbrikkene med store bokstaver og uten punktum (`sentenceWords`), så rekkefølgen ikke avsløres. Stemmen sier ordet ved plassering og setningen til slutt. 8 setninger. Eget fag `setning` (`SENTENCE_SKILLS`, `SENTENCES` i oppgaver.js), alltid tomme ruter (ingen hjelpetekst): setntre → setnfire → setnvelg (+1 ekstra ord, `EXTRA_WORDS`) → setnlang (5 ord +1). Diplomene i norsk-rammen. Test: `#test=riktig|feil` (`window.__ordtog`).
- **Ordbyggeren** (`ordbygger.js`, bruker brikker.js): bilde + «Stav ordet sol», ruter og bokstavbrikker. Dra en brikke til en rute, eller trykk (< 10 px bevegelse) så havner den i første ledige rute. Feil bokstav rister og blir liggende («Prøv igjen»); etter 2 feil på samme rute vinker riktig brikke. Stemmen sier bokstaven (bokstavnavn til bokstavlydene er spilt inn) og ordet til slutt. Ordet er riktig bare uten feil. 8 ord per runde. Staving er eget fag `stave` (`SPELL_SKILLS` i oppgaver.js, utenfor `SKILLS` fordi de ikke er flervalg): stavkopi (korte ord, bokstavene svakt i rutene) → stavkort → stavvelg (+2 ekstra bokstaver) → stavfire → stavdobbel → stavlang. Bare lydrette ord (`SPELL_WORDS`). Test: `#test=riktig|feil` (`window.__ordbygger`).
- **Slangen** (`slange.js`, Canvas 2D): rutebrett (ca. 8 ruter bredt, ruter 30–64 px, bestemt ved start; plass til spørsmålet er satt av øverst). Trykk på brettet svinger slangen mot trykket (aksen med størst avstand fra hodet; trykk rett foran/bak svinger mot siden), piltaster/WASD på PC. Kan ikke krasje: `steer` svinger selv ved kanten (mot midten), og slangen kan krysse seg selv. Tre skilt med svar (`placeItems`: ikke under slangen, minst 4 ruter fra hodet, luft mellom skiltene; lange ord dekker flere ruter), spiselige etter 1,2 s. Riktig: vokser 2 ledd, neste spørsmål. Feil: skiltet blir stein og forsvinner, prøv igjen. 10 spørsmål, 2,4 ruter/s opp til 3,4 ved mange riktige på rad. `placeItems` og `steer` testes i Node. Test: `#test=riktig|feil` (`window.__slange`).

## Koordinater (labyrinten)
- `grid[z][x]`, 1 = vegg, 0 = gulv. Størrelse (2n+1)×(2n+1). Ruter på oddetallskoordinater, ganger mellom dem. Dører står i ganger (x og z har ulik paritet); gangen går langs x når x er partall.
- 1 rute = 1 enhet. Vegghøyde 1,4, øyehøyde 0,62, kollisjonsradius 0,22 (x og z hver for seg).
- Retning `a` i radianer: fremover = (cos a, sin a) i (x, z). Økende `a` = snu til høyre. Three.js: `camera.rotation.y = -a - π/2`; modeller bygges med front mot +x og roteres `rotation.y = -a`.

## Status
Steg 1–5 i PLAN.md er gjort: kjerne, rommet, Flakse-fuglen, Labyrinten, hjem-skjerm-app, publisering og veiledning. Slangen, Ordbyggeren (staving), Tallbyggeren og Ordtoget (setninger) er lagt til.
Testet med `npm test` og hele runder med autopilot i Chromium (iPhone og iPad, høykant). Ikke testet på ekte enheter av utvikleren ut over korte prøver.
Neste: innspilte bokstavlyder (steg 6) og flere spill (se PLAN.md, «Senere»).
