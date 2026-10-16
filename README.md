# Empiric.fr

**De la text la folosire activă a limbii franceze.** Aplicație personală, offline-first, cu exerciții generate din orice text francez introdus de utilizator, fără lecții obligatorii A1–C1.

## Principiul de lucru

1. Introduci un text în franceză.
2. Aplicația identifică toate cuvintele grafice și le face interactive.
3. Fiecare cuvânt trebuie reconstituit în context, folosit într-o propoziție nouă și utilizat oral; structura propoziției este exersată separat.
4. Progresul se păstrează numai pe dispozitiv.

## Confidențialitate și offline

Nu există backend, cont, telemetrie, API de traducere sau conexiuni la modele cloud. După prima încărcare și instalarea cache-ului de către service worker, interfața funcționează fără internet. Vocea este permisă numai dacă browserul expune o voce **fr-FR locală**; înregistrarea audio rămâne locală.

**Limitări ale primei versiuni:** verificarea ortografiei și ordinii cuvintelor este automată; evaluarea sensului, a corectitudinii propozițiilor noi și a pronunției cere autoevaluare. Dicționarul local inițial este demonstrativ, nu reprezintă limba franceză în întregime. OCR local complet și recunoașterea vorbirii cu modele locale sunt obiective următoare, nu funcții livrate în prima versiune.

## Pornire

Deschide proiectul cu un server static (de exemplu `python3 -m http.server 4173`) și vizitează `http://localhost:4173`. Pentru instalare pe telefon publică proiectul pe GitHub Pages (HTTPS); aplicația nu folosește servicii online la utilizare. Deschiderea directă a `index.html` ca fișier poate dezactiva service worker.

## Teste

`node --test tests/*.test.mjs`

## Tehnologie

JavaScript ES Modules, CSS, HTML, service worker, localStorage, Web Speech Synthesis doar cu voci locale fr-FR, MediaRecorder. Fără biblioteci externe la rulare.

## Plan

- Integrare OCR local (Tesseract.js + date fr, găzduite în aceeași aplicație).
- Analiză morfosintactică cu pachete franceze licențiate, instalate local.
- Modele locale pentru recunoașterea vorbirii și verificări lingvistice.
- Exerciții verificabile de conjugare, restructurare, sens și dialog, cu acoperire exhaustivă transparentă.

Resursele lingvistice viitoare vor fi evaluate separat pentru acuratețe, proveniență și licență.
