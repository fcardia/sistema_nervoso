# Atlante SNC – Quiz

Apri `index.html` con doppio clic (funziona anche senza server).
In alternativa: `python -m http.server` nella cartella e vai su http://localhost:8000

## Struttura
- `index.html`, `css/stile.css`, `js/app.js` – interfaccia e logica del quiz
- `js/config.js` – **soglie della valutazione** (90% / 70%), equivalenze (circonvoluzione = giro,
  scissura = solco, terzo = 3°…), gruppi di parole incompatibili (superiore/inferiore, solco/giro…)
- `js/valutazione.js` – normalizzazione, Levenshtein, confronto con nome e sinonimi
- `data/tavole.json` – dati delle tavole; `data/tavole.js` – stessi dati caricati dall'app
- `img/` – tavole senza numeri
- `tools/` – script di estrazione (Python: PyMuPDF, Pillow, numpy, OpenCV, RapidOCR)

## Tipi di punto
- **con linea / senza linea** (solo Fig. 6 e Fig. 8, la demo): linee di richiamo cancellate,
  pallino sull'estremità della linea (con linea) o al centro del numero (senza linea).
- **al posto del numero** (tutte le altre): il numero è cancellato, la linea di richiamo resta
  visibile e il pallino è dove stava il numero; la linea indica la struttura.

## Pipeline di estrazione
1. `python tools/ocr_pagine.py` – OCR di tutte le pagine (cache in `tools/cache/`, lento: ~5 min/pagina)
2. `python tools/bozza.py <pagina0> <cartella>` – bozza `tools/tavole/pNN.py` + immagini di controllo
3. `python tools/correggi.py pNN ...` – correzioni decise a vista (numeri, voci di legenda, sinonimi, ritaglio)
4. `python tools/genera_tutto.py [pNN ...]` – genera `img/` e `data/` dai file in `tools/tavole/`
5. `python tools/riepilogo.py` – conteggi, punti incerti, numeri esclusi

Le pagine 38-40 (Fig. 48-50) sono stampate ruotate e vengono raddrizzate da `tools/pagine.py`.

## Correggere i dati
- Dall'app: **Modifica** → trascina i pallini, tocca un pallino per cambiare nome/sinonimi/incerto →
  **Scarica tavole.js** e sostituisci `data/tavole.js` (le modifiche restano comunque salvate nel browser).
- Oppure modifica il file della tavola in `tools/tavole/` e rilancia `python tools/genera_tutto.py pNN`
  (attenzione: questo sovrascrive `data/tavole.js`, incluse eventuali modifiche fatte dall'app e già copiate lì).
