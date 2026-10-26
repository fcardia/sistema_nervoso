/* =====================================================================
   VALUTAZIONE DELLE RISPOSTE
   valuta(risposta, punto) → { esito: "corretta" | "vicina" | "sbagliata", similarita }
   Le soglie sono in js/config.js.
   ===================================================================== */
(function () {
  const C = window.CONFIG;

  /** Distanza di Levenshtein (numero minimo di inserimenti, cancellazioni, sostituzioni). */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        const costo = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + costo);
      }
      prec = cur;
    }
    return prec[b.length];
  }

  /** Similarità tra 0 e 1 basata su Levenshtein. */
  function similarita(a, b) {
    const max = Math.max(a.length, b.length);
    return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
  }

  /** Minuscole, senza accenti né punteggiatura, spazi singoli, senza articoli/preposizioni
   *  iniziali, con le equivalenze applicate (es. circonvoluzione → giro). */
  function normalizza(testo) {
    let s = (testo || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")    // via gli accenti
      .replace(/[^a-z0-9]+/g, " ")                         // via punteggiatura (anche apostrofi e trattini)
      .replace(/\s+/g, " ").trim();
    let parole = s ? s.split(" ") : [];
    while (parole.length > 1 && C.PAROLE_VUOTE.includes(parole[0])) parole.shift();
    parole = parole.map(p => C.EQUIVALENZE[p] || p);
    return parole.join(" ");
  }

  /** Parole chiave: parole non vuote. */
  const paroleChiave = s => s.split(" ").filter(p => p && !C.PAROLE_VUOTE.includes(p));

  /** Lemma di un gruppo esclusivo corrispondente alla parola (anche con un refuso), o null. */
  function lemmaNelGruppo(parola, gruppo) {
    let migliore = null, best = 0;
    gruppo.forEach((forme, i) => forme.forEach(f => {
      const s = similarita(parola, f);
      if (s > best) { best = s; migliore = i; }
    }));
    return best >= C.SIMILARITA_PAROLA ? migliore : null;
  }

  /** true se risposta e nome usano parole incompatibili dello stesso gruppo (es. superiore/inferiore). */
  function conflitto(risp, nome) {
    const pr = paroleChiave(risp), pn = paroleChiave(nome);
    return C.GRUPPI_ESCLUSIVI.some(gruppo => {
      const lemmiNome = new Set(pn.map(p => lemmaNelGruppo(p, gruppo)).filter(x => x !== null));
      if (!lemmiNome.size) return false;
      return pr.some(p => {
        const l = lemmaNelGruppo(p, gruppo);
        return l !== null && !lemmiNome.has(l);
      });
    });
  }

  /** Risposta incompleta ma con le parole chiave giuste. */
  function contieneParoleChiave(risp, nome) {
    const pr = paroleChiave(risp), pn = paroleChiave(nome);
    if (!pr.length || !pn.length) return false;
    const usate = new Set();
    for (const p of pr) {
      const i = pn.findIndex((q, k) => !usate.has(k) && similarita(p, q) >= C.SIMILARITA_PAROLA);
      if (i < 0) return false;                     // parola estranea al nome
      usate.add(i);
    }
    return usate.size / pn.length >= C.QUOTA_PAROLE_CHIAVE;
  }

  /** Confronta la risposta con il nome e con ciascun sinonimo; vale l'esito migliore. */
  function valuta(risposta, punto) {
    const r = normalizza(risposta);
    if (!r) return { esito: "sbagliata", similarita: 0 };
    const ordine = { sbagliata: 0, vicina: 1, corretta: 2 };
    let migliore = { esito: "sbagliata", similarita: 0 };
    for (const candidato of [punto.nome, ...(punto.sinonimi || [])]) {
      const n = normalizza(candidato);
      const sim = similarita(r, n);
      let esito = "sbagliata";
      if (r === n || sim >= C.SOGLIA_CORRETTA) esito = "corretta";
      else if (sim >= C.SOGLIA_VICINA || contieneParoleChiave(r, n)) esito = "vicina";
      if (esito !== "sbagliata" && conflitto(r, n)) esito = "sbagliata";
      if (ordine[esito] > ordine[migliore.esito] ||
          (esito === migliore.esito && sim > migliore.similarita)) migliore = { esito, similarita: sim };
    }
    return migliore;
  }

  window.Valutazione = { valuta, normalizza, similarita, levenshtein };
})();
