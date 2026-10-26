/* =====================================================================
   CONFIGURAZIONE DELLA VALUTAZIONE
   Tutte le soglie e le regole di confronto stanno qui: modificale liberamente.
   ===================================================================== */
window.CONFIG = {
  // Similarità (1 - distanza di Levenshtein / lunghezza della stringa più lunga)
  SOGLIA_CORRETTA: 0.90,   // >= 90%  → corretta (refusi minimi)
  SOGLIA_VICINA: 0.70,     // 70–90%  → vicina

  // Risposta incompleta: è "vicina" se tutte le parole scritte sono parole chiave del nome
  // e coprono almeno questa quota delle parole chiave (es. 2 parole su 3 = 0.67 ≥ 0.5)
  QUOTA_PAROLE_CHIAVE: 0.5,
  // Due singole parole si considerano uguali (refuso) sopra questa similarità
  SIMILARITA_PAROLA: 0.8,

  // Valore di una risposta "vicina" nel punteggio (corretta = 1, sbagliata = 0)
  PUNTEGGIO_VICINA: 0.5,

  // Aiuti nel campo di risposta:
  // - con il suggerimento una risposta corretta conta come "vicina" (false = nessuna penalità)
  // - mostrare la soluzione registra il punto come "vista" (viola): 0 punti, ma non conta come errore
  SUGGERIMENTO_PENALIZZA: true,
  // Nome di una sola parola: quota di lettere mostrate nel suggerimento (es. "encef…")
  QUOTA_LETTERE_SUGGERIMENTO: 0.4,
  // Parole troppo generiche per fare da suggerimento (si mostra la prima parola non in elenco)
  PAROLE_GENERICHE: ["circonvoluzione", "circonvoluzioni", "giro", "giri", "solco", "solchi", "scissura",
    "fessura", "nucleo", "nuclei", "lobulo", "lobo", "nervo", "nervi", "corpo", "parte", "ramo"],

  // Articoli e preposizioni ignorati all'inizio della risposta (e come parole non-chiave)
  PAROLE_VUOTE: ["il", "lo", "la", "i", "gli", "le", "l", "un", "uno", "una", "di", "del", "dello",
    "della", "dei", "degli", "delle", "da", "dal", "dallo", "dalla", "a", "al", "allo", "alla",
    "in", "nel", "nello", "nella", "e", "ed"],

  // Parole considerate equivalenti (si sostituisce la chiave col valore prima del confronto)
  EQUIVALENZE: {
    "circonvoluzione": "giro", "circonvoluzioni": "giri",
    "scissura": "solco", "scissure": "solchi", "fessura": "solco", "fessure": "solchi",
    "solci": "solchi",
    // "3° ventricolo" diventa "3 ventricolo": così "terzo ventricolo" è equivalente
    "terzo": "3", "quarto": "4", "iii": "3", "iv": "4", "3o": "3", "4o": "4",
    "coroideo": "corioideo", "coroidei": "corioidei"
  },

  // Gruppi di parole che si escludono a vicenda: se la risposta usa una parola diversa
  // dello stesso gruppo rispetto al nome corretto (es. "superiore" invece di "inferiore",
  // "solco" invece di "giro") la risposta è sbagliata, anche se le stringhe sono simili.
  // Ogni gruppo è un elenco di "lemmi"; ogni lemma è un elenco di forme equivalenti.
  GRUPPI_ESCLUSIVI: [
    [["superiore", "superiori"], ["inferiore", "inferiori"], ["medio", "media", "medi", "medie"]],
    [["anteriore", "anteriori"], ["posteriore", "posteriori"]],
    [["mediale", "mediali"], ["laterale", "laterali"]],
    [["destro", "destra", "destri", "destre"], ["sinistro", "sinistra", "sinistri", "sinistre"]],
    [["precentrale"], ["postcentrale"], ["centrale"], ["paracentrale"]],
    [["solco", "solchi"], ["giro", "giri"], ["lobulo", "lobuli"], ["lobo", "lobi"]],
    [["frontale", "frontali"], ["parietale", "parietali"], ["temporale", "temporali"],
     ["occipitale", "occipitali"], ["limbico", "limbica"], ["insulare"]]
  ]
};
