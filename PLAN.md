# Plan: Spill og lær (først kalt Gull-egget)

Status (30.10.2026): versjon 1 er bygget og publisert på https://christiandaland.github.io/Labyrint/.
Ni spill med felles læringsmotor for 1.–4. trinn. Tekniske detaljer står i `CLAUDE.md`.

**Neste:**
1. Test med barn på ekte iPhone og iPad, og juster etter det.
2. Steg 6: innspilte bokstavlyder (/sss/, ikke «ess»). Da får også brikkene i Ordbyggeren lyder.
3. Mer fra «Senere» (avsnitt 13).

## 1. Mål og rammer

Et morsomt sted der barn på 1.–4. trinns-nivå lærer å lese, skrive og regne ved å spille, også barn som ikke kan lese
ennå. Laget først for bruk hjemme, på iPhone og iPad.

Bestemt:

- **Læringen er selve spillet.** Barnet skal ikke løse oppgaver for å få lov til å spille.
- **Én spiller.** Det gamle flerspillerspillet med storskjerm er fjernet (finnes i git-historikken).
- **Gratis å drifte:** statisk nettside på GitHub Pages, uten server og database.
- **Ingen innlogging og ingen foreldreside.** Foreldrene følger med på samme enhet, og har en voksenmeny.
- **Ingen navn lagres.** Ingenting om barnet forlater enheten.
- **Kan bygges ut senere** til familier og skoler med server og kontoer, uten å bygge om spillene.

## 2. Hva versjon 1 inneholder

| Med | Ikke med ennå |
|---|---|
| Startskjerm og rommet med stjerner, egg, diamanter, kroner og diplomer | Innspilte bokstavlyder (steg 6) |
| Ni spill: Flakse-fuglen, Labyrinten, Slangen, Ordbyggeren, Tallbyggeren, Ordtoget, Bokstavrekka, Prikk til prikk, Bokstavmaling | Spiseren, Hopperen, Klossene |
| Felles læringsmotor med fem fag og startnivå 1.–4. trinn | Å forme bokstaver med fingeren (tegne dem, ikke male) |
| Alfabetplakat i rommet med bokstavene barnet har malt | |
| Profiler (dyr og farge) på samme enhet | Egne oppgaver, med redigering i voksenmenyen |
| Lagring på enheten, med sikkerhetskopi | Server, kontoer, synkronisering mellom enheter |
| Ferdiglaget norsk tale for alt som sies | Foreldreoversikt |
| Hjem-skjerm-app (fullskjerm), publisering på GitHub Pages | |
| Veiledning for foreldre | |

## 3. Slik opplever barnet det

1. Barnet trykker på ikonet på Hjem-skjermen. Startskjermen viser «Spill og lær» og en stor ▶-knapp, som også låser opp lyden.
2. **Er det flere profiler**, trykker barnet på sin figur. Med bare én går det rett videre.
3. **Rommet:** figuren, stjerner, egg, diplomer på veggen, alfabetplakaten og ni spillkort med bilde.
4. Barnet spiller en runde på 3–5 minutter (8–10 oppgaver, eller til egget er funnet i Labyrinten).
5. Tilbake i rommet havner det nye egget på hylla, med lyd og feiring. Nye diamanter, kroner og diplomer vises stort og leses opp.

Alt kan brukes uten å lese. Store bilder, få knapper, og alt som betyr noe, leses opp.

## 4. Rommet

- **Tegnet i 2D** (HTML og CSS) med varm, kloss-aktig stil.
- **Diplomer:** fire rammer på veggen (matte, norsk, staving, stjerne-diplomer) med antall. Trykk åpner alle i gruppa, og de leses opp.
- **Hylla:** ett egg per fullført runde (gull, sølv eller bronse etter stjernene). Ti egg blir til en diamant, og ti diamanter til en krone, så rommet aldri blir fullt.
- **Spillkortene:** store kort med bilde. Trykk én gang for å høre navnet og to ganger for å starte, så ingenting startes ved et uhell.
- **Krukker** for matte og norsk viser fremgangen.
- **Senere:** ting barnet låser opp og kan plassere i rommet.

## 5. Spillene

Felles regler: oppgaven leses alltid opp, feil svar gir «Ikke helt. Prøv igjen!» til riktig er valgt, bare første forsøk
teller, og ingen kan tape.

| Spill | Kort fortalt |
|---|---|
| 🐦 Flakse-fuglen | Fly gjennom åpningen med riktig svar. Fuglen glir selv inn i nærmeste åpning, så den aldri krasjer. Feil åpning blir murt igjen på neste vegg. |
| 🧱 Labyrinten | 3D-labyrint med dører som åpnes med oppgaver, en rev som fanger barnet med et revespørsmål, kart og et egg som skifter farge etter hvordan det går. |
| 🐍 Slangen | Trykk der slangen skal gå, og spis skiltet med riktig svar. Slangen kan ikke krasje. |
| 🧩 Ordbyggeren | Stav ordet med bokstavbrikker (dra eller trykk). |
| 🧮 Tallbyggeren | Dra tall på plass i regnestykker og tallrekker (3 + ☐ = 7). |
| 🚂 Ordtoget | Hør setningen og legg ordbrikkene i riktig rekkefølge. |
| 🔡 Bokstavrekka | Dra inn bokstavene som mangler i en rekke (F G ☐ I ☐). |
| ✏️ Prikk til prikk | Trykk bokstavene i alfabetisk rekkefølge, så kommer et bilde fram. |
| 🎨 Bokstavmaling | Mal en stor bokstav med fingeren; den havner på alfabetplakaten i rommet. Gir ikke egg. |

Flakse-fuglen, Labyrinten og Slangen bruker flervalgsoppgaver (matte og norsk). De fire byggespillene deler motor
(`brikker.js`). Ordbyggeren, Ordtoget og alfabetspillene har egne fag (staving, setninger og alfabetet).

## 6. Læringsmotoren (felles for alle spill)

**Fem fag**, hvert med ferdigheter i læringsrekkefølge (full liste i veiledningen):
- **Matte:** telling, før og etter, størst, pluss og minus til 5, 10 og 20, tiervenner, dobling, tallrekker, store tall.
  3.–4. trinn: veksling, gange og dele, hundrere/tiere/enere, tall og pluss/minus opp til 1000, gangetabellen.
- **Norsk:** store og små bokstaver, første lyd, lese korte og lange ord, alfabetet, bokstaven som mangler, rim, stavelser.
  3.–4. trinn: leseforståelse (setning til bilde, kort tekst med spørsmål; teksten leses ikke opp).
- **Staving** (Ordbyggeren): lydrette ord fra korte til lange, så rettskriving (ng, kj/sj, stumme bokstaver, sammensatte ord).
- **Setninger** (Ordtoget): tre til fem ord, etter hvert med et ekstra ord å velge bort.
- **Alfabetet** (Bokstavrekka og Prikk til prikk): A–J, A–T, hele A–Å, små bokstaver, baklengs.

**Tilpasning:**
- For hver ferdighet huskes de siste 10 svarene.
- Et hakk opp ved 8 av 10 riktige, og et hakk ned ved under 5 av 10.
- Oppgavene velges omtrent 70 % på nivået, 20 % repetisjon av de nærmeste ferdighetene under (oftest det barnet bommer på) og 10 % smakebit på det neste.
- **Startnivå** (1.–4. trinn) velges i voksenmenyen.
- Foreldrene kan velge matte og norsk, bare matte eller bare norsk.

**Tale** (besluttet 28.10.2026 etter lydprøver):
- Ferdiglagde lydfiler med Piper, stemmen `no_NO-talesyntese-medium` (CC0, Nasjonalbiblioteket), sakte og tydelig for barn.
- Alt som sies, lages på forhånd av et skript. Store regnestykker settes sammen av biter («Hva er» + «347» + «pluss» + «200»), og tallene 0–1000 finnes som egne filer.
- Enhetens stemme brukes bare som reserve hvis en fil mangler.
- Bokstavlyder (/sss/) tas opp senere (steg 6). Til da sies bokstavnavnet.

## 7. Belønninger

| Belønning | Hvordan |
|---|---|
| Stjerner | 1–3 per runde etter riktige på første forsøk: 0–5 av 10 gir 1, 6–8 gir 2, 9–10 gir 3 |
| Egg | Ett per fullført runde: gull (3 stjerner), sølv (2) eller bronse (1). Ti egg blir en diamant, ti diamanter en krone |
| Diplomer | For hver ferdighet barnet mestrer («Du kan pluss opp til 10!»), og milepæler: første egg, 5, 10 og 25 egg, første gullegg, fem gullegg, 50 og 200 riktige i matte og norsk, rømt fra reven fem ganger |

Diplomene viser *hva barnet har lært*, ikke bare at det har spilt mye.

## 8. Profiler

- Flere profiler på samme enhet. Hver har et dyr og en farge, som 🦉 lilla ugle, og ikke noe navn.
- Med én profil vises aldri valget.
- Nye profiler lages fra voksenmenyen eller profilvalget (et «+» som holdes inne).

## 9. Lagring og sikkerhetskopi

- Alt lagres i nettleserens `localStorage` (nøkkelen `gullegget`, fra det første navnet), med versjonsnummer.
- **Per profil:** figur, nivå per fag, siste svar per ferdighet, egg, stjerner, diplomer og en logg per dag.
- Spillet ber om varig lagring (`navigator.storage.persist`).
- **Hjem-skjermen er viktig:** Safari kan slette data for nettsider som ikke er brukt på 7 dager. Det gjelder ikke apper på Hjem-skjermen. Appen har egen lagring, atskilt fra Safari.
- **Voksenmeny** (⚙️ holdes inne i 3 sekunder): bytt, ny og slett figur, fag, startnivå, lyd, sikkerhetskopi (lagre og hent), Hjem-skjerm-hint, veiledning og «Om spillet».
- **Utbygging senere:** formatet gjør det mulig å laste opp fremgangen til en server når familiekontoer kommer.

## 10. Teknisk oppbygning

- **Statisk nettside,** ren HTML og JavaScript (ES-moduler) uten byggesteg. Three.js brukes bare i labyrinten.
- **Spillene er moduler som lastes inn i rommet,** ikke egne sider. På iPhone og iPad må lyd låses opp med et trykk etter hver sidelasting, så egne sider ville gitt stum feiring i rommet.

```
public/
  index.html            startskjerm, rommet, profilvalg og voksenmeny
  veiledning.html       veiledning for foreldre
  manifest.webmanifest  hjem-skjerm-app (navn, ikon, fullskjerm, høykant)
  ikoner/               app-ikoner
  lyd/tale/             ferdiglaget tale (mp3 og manifest.json)
  kjerne/               oppgaver, læringsmotor, belønninger, lagring, lyd, tale, ui
  spill/                flakse, labyrint (+ labyrint-kart), slange, brikker, ordbygger, tallbygger, ordtog,
                        bokstavrekka, prikk, maling
test/                   Node-tester (npm test)
verktoy/                lag-tale.py, fraser.mjs, lag-ikoner.py
```

- **GitHub Pages** (valgt 28.10.2026):
  - En GitHub Actions-arbeidsflyt kjører testene og publiserer bare `public/` ved hver push til `main`.
  - **Adresse:** `https://christiandaland.github.io/Labyrint/`. Den må ikke endres, ellers slutter installerte ikoner å virke. Alle stier er relative.
  - **Server senere:** når den kommer, kan den ligge et annet sted og kalles fra siden.

## 11. iPhone og iPad

- **Hjem-skjerm-app:** fullskjerm uten Safari-menyer, og varig lagring.
- **Store berøringsflater** og ingen dobbelttrykk-zoom eller markering av tekst.
- **Bare høykant på telefon og nettbrett.** Safari kan ikke låse retningen, så «Snu skjermen» dekker alt (og leses opp) når enheten holdes på tvers, og spillene står stille. PC kan bruke begge retninger.
- **Lyd:** låses opp med ▶ på startskjermen. På iOS 16.4 og nyere spilles lyden selv om lydløs-bryteren er på.

## 12. Personvern

- Ingen navn, ingen innlogging, ingen sporing og ingen analyseverktøy.
- Alle data ligger på enheten. GitHub Pages leverer bare filer. GitHub logger besøk etter sin personvernerklæring, men spillet setter ingen informasjonskapsler og sender ingenting.
- Repoet og nettsiden er offentlige: ingenting om konkrete barn, familier eller testere skal stå der.
- Når vi senere legger til server og kontoer, må dette vurderes på nytt.

## 13. Senere

- Innspilte bokstavlyder (steg 6), og oppgaver som bruker dem.
- Slangen med staving: spise bokstavene i riktig rekkefølge.
- Spiseren, Hopperen og Klossene.
- Ting å bygge og plassere i rommet.
- Forme bokstaver med fingeren.
- Egne oppgaver, med enkel redigering i voksenmenyen.
- En innstilling for barn som leser selv («les opp alt» eller «bare ved trykk»).
- Engelsk som eget fag.
- Server med familiekontoer og godkjente enheter. Fremgangen følger barnet mellom enheter, og det kommer en foreldreoversikt.
- Skoler: grupper, bildekode og «åpne klassen».

## 14. Åpne spørsmål

1. Følges en bestemt ABC-bok eller rekkefølge for bokstavene? Det påvirker rekkefølgen i norsk-ferdighetene (`LETTER_ORDER`).
2. Passer rundelengden (8–10 oppgaver, 3–5 minutter) for hvor lenge barn holder fokus?
3. Er en figur med farge, uten navn, nok for profilene, eller vil barn gjerne kalle figuren noe? Da lagres det bare på enheten.
4. Er den sammensatte talen i store regnestykker («Hva er … 347 … pluss … 200») grei å forstå, eller bør stykkene leses som hele setninger?

## Historikk

- 28.10.2026: planen godkjent. Bygget i rekkefølgen grunnmur (steg 1), rommet (2), Flakse-fuglen og tale (3),
  hjem-skjerm-app, publisering og veiledning (5), Labyrinten som enspiller (4). Det gamle flerspillerspillet ble fjernet.
- Samme kveld: Slangen, Ordbyggeren, Tallbyggeren og Ordtoget, eggtyper og diamanter, 1.–4. trinn med startnivå,
  og nytt navn: Spill og lær (© 2026 Løland Gård Gaming).
- 30.10.2026: alfabetet som eget fag med Bokstavrekka, Prikk til prikk og Bokstavmaling, og alfabetplakat i rommet.
