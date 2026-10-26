# Gull-egget

Flerspiller 3D-labyrint i nettleseren. Storskjermen viser QR-kode og kart, deltakerne spiller på mobilen.

## Kjør lokalt
    npm install
    npm start
Åpne http://<PC-ens-IP>:3000 på storskjermen (ikke localhost, ellers peker QR-koden til localhost).
Mobilene må være på samme nett.

## Legg ut på Render
1. Legg mappen i et GitHub-repo.
2. Render → New → Web Service → velg repoet.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
4. Åpne adressen Render gir deg (https://…onrender.com) på PC/pad.

Gratisnivået sovner etter en stund uten trafikk. Åpne storskjermen et minutt før dere skal spille.
Kjør bare én instans: spilltilstanden ligger i minnet på serveren.

Vil du hindre at andre styrer spillet: sett miljøvariabelen `HOST_KEY` (Render → Environment)
og åpne storskjermen med `https://…onrender.com/?key=<nøkkelen>`. Uten `HOST_KEY` er storskjermen åpen.

## Justering
Øverst i `server.js` (CONFIG): antall liv, revenes fart og syn, om revene kan vinne,
hvor lenge før revene begynner å lete etter egget, og om man sendes til start når man blir tatt.
Spillerfarten står både i `server.js` og øverst i scriptet i `public/play.html`.
