# Plan: Gull-egget som læringsspill – versjon 1

Status (28.10.2026): planen er godkjent.
- **Steg 1 (grunnmur) er ferdig:** `public/kjerne/` med oppgaver, læringsmotor, belønninger, lagring og lyd, testet med `npm test` og i nettleser.
- **Steg 2 (rommet) er ferdig:** `public/rom.html`, testet i nettleser som iPhone (høykant) og iPad (liggende).
- **Neste:** steg 3 (Flakse-fuglen).

## 1. Mål og rammer

Et morsomt sted der barn på 1.–2. trinns-nivå lærer å lese, skrive og regne ved å spille, også barn som ikke kan lese
ennå. Laget først for bruk hjemme, på iPhone og iPad.

Bestemt så langt:

- **Læringen er selve spillet.** Han skal ikke løse oppgaver for å få lov til å spille.
- **Én spiller per spill.** Flerspiller og storskjerm fjernes.
- **Gratis å drifte:** statisk nettside på GitHub Pages, uten server og database.
- **Ingen innlogging og ingen foreldreside.** Foreldrene følger med på samme enhet.
- **Ingen navn lagres.** Ingenting om barnet forlater enheten.
- **Kan bygges ut senere** til familier og skoler med server og kontoer, uten å bygge om spillene.

## 2. Hva versjon 1 inneholder

| Med | Ikke med ennå |
|---|---|
| Rommet (startskjerm) med gullegg og diplomer | Slangen, Spiseren, Hopperen, Klossene |
| Flakse-fuglen | Server, kontoer, synkronisering mellom enheter |
| Labyrinten, som enspiller | Foreldreoversikt |
| Felles læringsmotor som tilpasser seg | Redigering av egne oppgaver (finnes i dag, kommer tilbake senere) |
| Profiler (velg figur) på samme enhet | Innspilte bokstavlyder (planlagt rett etter) |
| Lagring på enheten, med sikkerhetskopi | Å forme bokstaver med fingeren |
| Kan legges på hjem-skjermen (fullskjerm) | |
| Publisering på GitHub Pages | |

## 3. Slik opplever han det

1. Han trykker på ikonet på hjem-skjermen, og spillet åpner i fullskjerm.
2. **Er det flere profiler**, ser han figurene og trykker på sin. Med bare én profil går han rett videre.
3. **Rommet:** figuren hans, hylla med gullegg, diplomer på veggen og to store spillknapper: 🐦 Flakse-fuglen og 🥚 Labyrinten.
4. Han spiller en runde på 3–5 minutter.
5. Han kommer tilbake til rommet og ser at det nye egget, stjernene eller diplomet havner på plass, med lyd og en liten feiring.

Alt kan brukes uten å lese. Store bilder, få knapper, og alt som betyr noe, leses opp.

## 4. Rommet

- **Tegnes i 2D** (HTML, SVG og CSS) med varm, kloss-aktig stil. Det skal være inspirert av Minecraft uten å kopiere.
- **Hylla:** ett gullegg per fullført runde, med flere hyller etter hvert.
- **Diplomer på veggen.** Han trykker på et diplom, og det leses opp hva han klarte.
- **Stjerner i rommet:** antall stjerner synes, som en teller eller en krukke som fylles.
- **Spillknappene:** store kort med bilde, ikke tekst. Trykk én gang for å høre navnet og to ganger for å starte. Det hindrer at han starter spill ved et uhell.
- **Senere:** ting han låser opp og kan plassere i rommet, for eksempel en lampe, et kjæledyr eller en rakett.

## 5. Flakse-fuglen (første nye spill)

**Styring:** ett trykk hvor som helst på skjermen, og fuglen flakser opp. Den synker sakte.

**Selve spillet:**
- Øverst står en oppgave som også leses opp, for eksempel «3 + 4» eller 🐟 «Hvilken bokstav starter ordet med?».
- Fuglen flyr mot en vegg med tre åpninger. Hver åpning har et svar, med tall, bokstav eller bilde.
- **Riktig åpning:** pling, en stjerne, og fuglen flyr videre. Neste oppgave kommer.
- **Feil åpning:** fuglen flyr gjennom, men det spilles en «oi»-lyd, riktig svar lyser opp og leses opp, og den samme *typen* oppgave kommer snart igjen.
- **Treffer han veggen:** fuglen spretter litt tilbake og fortsetter. Han dør aldri, og det er aldri «game over».
- **Fart:** rolig fra start, og litt raskere når han får mange riktige på rad.

**Runde og belønning:**
- En runde er 10 oppgaver. Til slutt kommer et gullegg flyvende inn.
- Stjerner etter antall riktige av 10: 1 stjerne for 0–5, 2 stjerner for 6–8 og 3 stjerner for 9–10.

**Skjerm:** fungerer både på høykant og liggende, men er best liggende. Tegnes med Canvas 2D.

## 6. Labyrinten som enspiller

Labyrinten slik den er i dag, men alt kjører i nettleseren:
- labyrinten lages på enheten,
- dører med oppgaver,
- rev med revespørsmål,
- knirk og knurrelyder,
- kart,
- egget.

Oppgavene ved dørene og fra reven hentes fra læringsmotoren. Å finne egget gir et gullegg i rommet. Stjerner gis for få feil svar og for å ikke bli tatt av reven.

## 7. Læringsmotoren (felles for alle spill)

**Ferdigheter.** Hver har en ID, et nivå og en oppgavegenerator:

| Matte | Norsk (lese og skrive) |
|---|---|
| Telle bilder til 5, så til 10 | Bokstavnavn: stor og liten bokstav |
| Tallrekkefølge: før og etter | Første lyd i ord (med bilde) |
| Størst og minst | Ord til bilde: korte ord som SOL, BIL og IS |
| Pluss innenfor 5, så 10 | Manglende bokstav (S _ L) |
| Minus innenfor 5, så 10 | Rim |
| Tiervenner | Stavelser |
| Pluss og minus innenfor 20 | Bygge ord med bokstavbrikker (fra Slangen) |

**Tilpasning:**
- For hver ferdighet huskes de siste 10 svarene.
- Han flyttes et hakk opp når han har 8 av 10 riktige, og et hakk ned når han har under 5 av 10.
- Oppgavene velges omtrent slik:
  - 70 % på nivået han er på,
  - 20 % repetisjon av noe han kan,
  - 10 % smakebit på det neste.
- Ferdigheter han ofte bommer på, kommer oftere.
- Det blandes matte og norsk. Senere kan foreldrene få velge fag.

**Oppgaveformat** (felles for alle spill): `{ ferdighet, spørsmål, bilde, alternativer[], riktig, opplesning }`. Dagens oppgavegenerator i `tasks.js` brukes som utgangspunkt og merkes med ferdighet og nivå.

**Lyd:**
- Hele spørsmål leses av telefonens norske stemme.
- Bokstavlyder, som /sss/ og ikke «ess», tas opp av deg senere som lydfiler.
- Til opptakene er klare, lager vi oppgaver som ikke trenger enkeltlyder.

## 8. Belønninger

| Belønning | Hvordan |
|---|---|
| Stjerner | 1–3 per runde (se over) |
| Gullegg | Ett per fullført runde i hvilket som helst spill |
| Diplomer | Milepæler, for eksempel: første egg · 5 egg · 10 egg · 3 stjerner i en runde · 50 riktige i matte · 50 riktige i norsk · ny ferdighet låst opp · rømte fra reven 5 ganger |

Diplomene viser *hva han har lært*, for eksempel «Du kan pluss innenfor 10!», ikke bare at han har spilt mye. Diplomer for nye ferdigheter er de viktigste.

## 9. Profiler

- Flere profiler på samme enhet. Hver har en figur og en farge, som 🦉 Lilla ugle, og ikke noe navn.
- Med én profil ser han aldri valget.
- En ny profil lages fra profilvalget. Det åpnes med et lite «+» som må holdes inne i 3 sekunder, slik at det er tungt å gjøre ved et uhell.

## 10. Lagring og sikkerhetskopi

- Alt lagres i nettleserens `localStorage`, med versjonsnummer slik at det tåler senere endringer.
- **Per profil:** figur, ferdighetsnivåer, siste svar per ferdighet, egg, stjerner, diplomer, og en enkel logg per dag over hvor mye han har spilt og hvor mye som var riktig.
- Spillet ber nettleseren om varig lagring (`navigator.storage.persist`).
- **Hjem-skjermen er viktig:** Safari på iPhone og iPad kan slette lagrede data for nettsider som ikke er brukt på 7 dager. Når spillet er lagt på hjem-skjermen, gjelder ikke det.
- **Voksenmeny:** en liten ⚙️-knapp i rommet som må holdes inne i 3 sekunder. Den har:
  - «Lagre sikkerhetskopi» (fil),
  - «Hent sikkerhetskopi»,
  - lyd av og på,
  - slette en profil.

  Den er ingen foreldreside, bare det minste som trengs for å ikke miste fremgangen.
- **Utbygging senere:** formatet gjør det mulig å laste opp fremgangen til en server når familiekontoer kommer.

## 11. Teknisk oppbygning

- **Statisk nettside,** ren HTML og JavaScript uten byggesteg, som i dag. Three.js brukes bare i labyrinten.
- **Foreslått struktur:**

Endret i steg 2: spillene er **moduler som lastes inn i rommet**, ikke egne sider. På iPhone og iPad må lyd låses opp med et trykk etter hver sidelasting. Med egne sider ville feiringen være stum når han kommer tilbake til rommet. Nå er lyden låst opp hele tiden, og rommet deler ut belønningene på ett sted.

```
public/
  rom.html            rommet + profilvalg + voksenmeny (blir index.html når det gamle spillet fjernes i steg 4)
  spill/flakse.js     Flakse-fuglen (lastes inn i rommet)
  spill/labyrint.js   labyrinten, enspiller (lastes inn i rommet)
  veiledning.html     skrives om for den nye løsningen
  manifest.json       hjem-skjerm-app (navn, ikon, fullskjerm)
  ikoner/             app-ikoner
  lyd/                innspilte bokstavlyder (senere)
  kjerne/
    laering.js        ferdigheter, tilpasning, oppgavevalg
    oppgaver.js       oppgavegeneratorer (fra tasks.js)
    lagring.js        profiler, fremgang, sikkerhetskopi
    lyd.js            lydeffekter (Web Audio) og opplesning
    belonning.js      stjerner, egg, diplomer
```

- **Det som fjernes:** `server.js` og socket.io (finnes i git-historikken), flerspiller, storskjerm og QR.
- **GitHub Pages** (valgt 28.10.2026; brukeren bruker det fra før):
  - **Publisering:** en GitHub Actions-arbeidsflyt publiserer bare `public/` ved hver push til `main`. Resten av repoet, som `PLAN.md` og gamle serverfiler, kommer ikke med.
  - **Adresse:** `https://christiandaland.github.io/Labyrint/`. Siden ligger i en undermappe, så **alle stier må være relative** (`kjerne/lyd.js`, ikke `/kjerne/lyd.js`).
  - **`.nojekyll`** legges i `public/`, så GitHub ikke behandler filene som Jekyll og hopper over noen av dem.
  - **Alle filtyper er tillatt** (lyd, `.webmanifest`), og trafikken er omtrent 100 GB i måneden.
  - **Server senere:** når den kommer, kan den ligge et annet sted (for eksempel Render) og kalles fra siden.
  - **Render-tjenesten** for det gamle flerspillerspillet kan slettes når den nye versjonen er ute.

## 12. iPhone og iPad

- **Hjem-skjerm-app:** fullskjerm uten Safari-menyer, og lagringen blir varig.
- **Store berøringsflater:** minst 64 px. Ingen dobbelttrykk-zoom eller markering av tekst.
- **Skjermretning:** hvert spill fungerer både på høykant og liggende, og velger den beste visningen selv.
- **Lyd:** starter ved første trykk. Bryteren for lydløs på iPhone demper lydeffektene, men det står i veiledningen.
- **Ytelse:** labyrinten er testet i 3D. Flakse-fuglen i 2D er lett.

## 13. Personvern

- Ingen navn, ingen innlogging, ingen sporing og ingen analyseverktøy.
- Alle data ligger på enheten. GitHub Pages leverer bare filer. GitHub logger besøk etter sin personvernerklæring, men spillet setter ingen informasjonskapsler og sender ingenting.
- Når vi senere legger til server og kontoer, må dette vurderes på nytt (se tidligere diskusjon om familiekode og godkjente enheter).

## 14. Rekkefølge

| Steg | Innhold | Kan testes med ham? |
|---|---|---|
| 1 | Grunnmur: struktur, lagring, profiler, lyd, læringsmotor (uten grafikk) | Nei (testes av oss) |
| 2 | Rommet med egg, stjerner og diplomer | Ja, han ser rommet |
| 3 | Flakse-fuglen | **Ja: første ekte test** |
| 4 | Labyrinten som enspiller | Ja |
| 5 | Hjem-skjerm-app, publisering på GitHub Pages, ny veiledning | Ja, på hans egen iPad |
| 6 | Innspilte bokstavlyder og oppgaver som bruker dem | Ja |

Etter steg 3 og 5 tester vi med ham og justerer før vi går videre.

## 15. Senere

- Slangen: stave ord og telle i rekker.
- Spiseren, Hopperen og Klossene.
- Ting å bygge og plassere i rommet.
- Forme bokstaver med fingeren.
- Egne oppgaver tilbake, med enkel redigering i voksenmenyen.
- Server med familiekontoer og godkjente enheter. Fremgangen følger barnet mellom enheter, og det kommer en foreldreoversikt.
- Skoler: grupper, bildekode og «åpne klassen».

## 16. Åpne spørsmål

1. Følges en bestemt ABC-bok eller rekkefølge for bokstavene? Det påvirker rekkefølgen i norsk-ferdighetene.
2. Passer 10 oppgaver per runde i Flakse-fuglen, omtrent 3–5 minutter, for hvor lenge han holder fokus?
3. Skal labyrinten med i første test, eller vente til Flakse-fuglen er prøvd?
4. Er en figur med farge, uten navn, nok for profilene, eller vil han gjerne kalle figuren noe? Da lagres det bare på enheten.
