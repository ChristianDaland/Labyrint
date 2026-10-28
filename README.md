# Gull-egget

Læringsspill i lesing, skriving og enkel matte for 1.–2. trinn, også for barn som ikke kan lese ennå:
alt leses opp, og oppgavene tilpasser seg barnet. Kjører i nettleseren, laget for iPhone og iPad.

**Spill:** https://christiandaland.github.io/Labyrint/
**Veiledning for foreldre:** https://christiandaland.github.io/Labyrint/veiledning.html

Ingen innlogging og ingen navn. All fremgang lagres på enheten.

## Oppbygning
- `public/` er hele nettsiden (statisk, ingen server). `index.html` er rommet. Spillene ligger i `spill/`,
  felles kode (oppgaver, læringsmotor, belønninger, lagring, lyd, tale) i `kjerne/`.
- `public/lyd/tale/` inneholder ferdiglaget norsk tale (Piper, stemmen no_NO-talesyntese).
  Lages på nytt med `uv run --with piper-tts --with lameenc python verktoy/lag-tale.py` når tekst endres.
- `PLAN.md` beskriver planen og status. `CLAUDE.md` har tekniske detaljer.

## Utvikling
    npm test                                  # tester kjernen og at all tale finnes som lydfil
    python3 -m http.server -d public 8080     # prøv lokalt: http://localhost:8080/

Ved push til `main` kjører GitHub Actions testene og publiserer `public/` på GitHub Pages.

## Det gamle flerspillerspillet
`server.js`, `tasks.js`, `public/storskjerm.html` og `public/play.html` er det gamle flerspillerspillet med
storskjerm (Node, Socket.io). Det fjernes når labyrinten er bygd om til enspiller (steg 4 i PLAN.md).
