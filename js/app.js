/* =====================================================================
   QUIZ SULLE TAVOLE DELL'ATLANTE
   Dati: window.DATI_TAVOLE (data/tavole.js) · Soglie: js/config.js
   Valutazione: js/valutazione.js · Salvataggi: localStorage del browser
   ===================================================================== */
(function () {
  "use strict";

  // ---------------------------------------------------------------- salvataggi
  const CHIAVI = { progressi: "snc.progressi", modifiche: "snc.modifiche", preferenze: "snc.preferenze" };
  const leggi = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) || def; } catch { return def; } };
  const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* spazio pieno o privato */ } };

  let progressi = leggi(CHIAVI.progressi, {});      // {tavola: {punto: {esito, risposta}}}
  let modifiche = leggi(CHIAVI.modifiche, {});      // {tavola: {punto: {punto_xy, nome, sinonimi, incerto}}}
  const pref = Object.assign({ tavola: 0, casuale: false, etichette: true }, leggi(CHIAVI.preferenze, {}));

  // ---------------------------------------------------------------- stato
  let tavole = [];            // dati con le modifiche locali applicate
  let tav = null;             // tavola corrente
  let ordine = [];            // ordine dei punti per "Prossimo punto"
  let filtro = null;          // Set di id quando si ripetono solo sbagliati/vicini
  let attivo = null;          // id del punto con il campo di risposta aperto
  let guidato = false;        // true se il campo è stato aperto con "Prossimo punto"
  let inModifica = false;
  const vista = { s: 1, tx: 0, ty: 0, adatta: 1 };   // zoom e spostamento

  // ---------------------------------------------------------------- elementi
  const $ = id => document.getElementById(id);
  const el = {
    viewport: $("viewport"), scena: $("scena"), img: $("immagine"), punti: $("strato-punti"),
    linee: $("linee-modifica"), sel: $("sel-tavola"), ptTav: $("punteggio-tavola"), ptTot: $("punteggio-totale"),
    box: $("box-risposta"), input: $("input-risposta"), indice: $("risposta-indice"),
    boxMod: $("box-modifica"), modTitolo: $("modifica-titolo"), modNome: $("mod-nome"),
    modSin: $("mod-sinonimi"), modInc: $("mod-incerto"),
    btnEtichette: $("btn-etichette"), chkCasuale: $("chk-casuale"), btnRipeti: $("btn-ripeti"),
    btnTutti: $("btn-tutti"), btnModifica: $("btn-modifica"), cmdMod: $("comandi-modifica"),
    avvisoMod: $("avviso-modifica")
  };

  // ---------------------------------------------------------------- dati
  /** Copia dei dati originali con sopra le modifiche fatte in modalità Modifica. */
  function caricaDati() {
    const base = JSON.parse(JSON.stringify(window.DATI_TAVOLE || { tavole: [] }));
    for (const t of base.tavole) {
      const m = modifiche[t.id] || {};
      for (const p of t.punti) if (m[p.id]) Object.assign(p, m[p.id]);
    }
    tavole = base.tavole;
  }

  const prog = () => (progressi[tav.id] = progressi[tav.id] || {});
  const puntoDaId = id => tav.punti.find(p => p.id === id);
  const visibile = p => !filtro || filtro.has(p.id);

  // ---------------------------------------------------------------- tavole
  function popolaSelect() {
    el.sel.innerHTML = "";
    tavole.forEach((t, i) => {
      const o = document.createElement("option");
      o.value = i; o.textContent = `${t.titolo} (pag. ${t.pagina_pdf})`;
      el.sel.appendChild(o);
    });
  }

  function apriTavola(i) {
    if (!tavole.length) return;
    i = Math.max(0, Math.min(tavole.length - 1, i));
    pref.tavola = i; scrivi(CHIAVI.preferenze, pref);
    tav = tavole[i];
    el.sel.value = i;
    filtro = null;
    chiudiBox();
    el.scena.style.width = tav.larghezza + "px";
    el.scena.style.height = tav.altezza + "px";
    el.img.src = tav.immagine;
    el.img.alt = tav.titolo;
    preparaOrdine();
    disegnaPunti();
    adattaVista();
  }

  function preparaOrdine() {
    ordine = tav.punti.map(p => p.id);
    if (pref.casuale) {
      for (let i = ordine.length - 1; i > 0; i--) {          // Fisher–Yates
        const j = Math.floor(Math.random() * (i + 1));
        [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
      }
    }
  }

  // ---------------------------------------------------------------- disegno
  function disegnaPunti() {
    el.punti.innerHTML = "";
    const pr = prog();
    for (const p of tav.punti) {
      const [x, y] = p.punto_xy;
      const r = pr[p.id];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "punto" + (r ? " " + r.esito : "") + (p.incerto ? " incerto" : "") +
        (visibile(p) ? "" : " nascosto") + (attivo === p.id ? " attivo" : "");
      b.style.left = x + "%"; b.style.top = y + "%";
      b.dataset.id = p.id;
      b.setAttribute("aria-label", r ? `Punto ${p.id}: ${p.nome}` : "Punto da indovinare");
      if (inModifica) b.innerHTML = `<span class="num">${p.numero}</span>`;
      if (p.incerto && inModifica) b.title = "Incerto: " + (p.nota || "");
      el.punti.appendChild(b);

      // etichetta: nome corretto + risposta data (sempre, anche se corretta)
      if (r && visibile(p)) {
        const e = document.createElement("div");
        e.className = "etichetta " + r.esito + (x > 62 ? " sinistra" : "");
        e.style.left = x + "%"; e.style.top = y + "%";
        const tua = r.esito === "corretta" ? escape(r.risposta) : `<s>${escape(r.risposta) || "—"}</s>`;
        e.innerHTML = `<b>${escape(p.nome)}</b>${p.incerto ? " <span title='posizione incerta'>(?)</span>" : ""}` +
          `<br><span class="tua">tu: ${tua}</span>`;
        el.punti.appendChild(e);
      }
    }
    disegnaLineeModifica();
    aggiornaPunteggi();
  }

  /** In modalità modifica: segmento dal numero originale al punto, per i punti con linea. */
  function disegnaLineeModifica() {
    el.linee.innerHTML = "";
    if (!inModifica) return;
    el.linee.setAttribute("viewBox", "0 0 100 100");
    for (const p of tav.punti) {
      if (!p.numero_xy) continue;
      const [nx, ny] = p.numero_xy, [x, y] = p.punto_xy;
      el.linee.insertAdjacentHTML("beforeend",
        `<line x1="${nx}" y1="${ny}" x2="${x}" y2="${y}" stroke="#7c3aed" stroke-width="2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>` +
        `<circle cx="${nx}" cy="${ny}" r="0.35" fill="#7c3aed"/>`);
    }
  }

  const escape = s => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------------------------------------------------------------- punteggi
  function conteggio(t) {
    const pr = progressi[t.id] || {};
    const c = { corretta: 0, vicina: 0, sbagliata: 0, totale: t.punti.length };
    for (const p of t.punti) if (pr[p.id]) c[pr[p.id].esito]++;
    c.risposte = c.corretta + c.vicina + c.sbagliata;
    c.punti = c.corretta + c.vicina * CONFIG.PUNTEGGIO_VICINA;
    return c;
  }

  function aggiornaPunteggi() {
    const c = conteggio(tav);
    const pct = c.totale ? Math.round(c.punti / c.totale * 100) : 0;
    el.ptTav.innerHTML = `Tavola: <b>${c.risposte}/${c.totale}</b> · ` +
      `<span style="color:var(--corretta)">✔ ${c.corretta}</span> ` +
      `<span style="color:var(--vicina)">≈ ${c.vicina}</span> ` +
      `<span style="color:var(--sbagliata)">✘ ${c.sbagliata}</span> · ${pct}%`;
    const tot = tavole.map(conteggio).reduce((a, b) => ({
      punti: a.punti + b.punti, totale: a.totale + b.totale, risposte: a.risposte + b.risposte
    }), { punti: 0, totale: 0, risposte: 0 });
    el.ptTot.textContent = `Totale: ${tot.risposte}/${tot.totale} · ${tot.totale ? Math.round(tot.punti / tot.totale * 100) : 0}%`;
  }

  // ---------------------------------------------------------------- campo di risposta
  function apriRisposta(id, daGuida = false) {
    const p = puntoDaId(id);
    if (!p) return;
    attivo = id; guidato = daGuida;
    el.boxMod.hidden = true;
    disegnaPunti();
    const r = prog()[id];
    const fatti = conteggio(tav).risposte;
    el.indice.textContent = r ? "Riprova questo punto" : `Punto ${fatti + 1} di ${tav.punti.length}`;
    el.input.value = "";
    el.box.hidden = false;
    posizionaBox(el.box, id);
    el.input.focus({ preventScroll: true });
  }

  function chiudiBox() {
    el.box.hidden = true; el.boxMod.hidden = true;
    if (attivo) { attivo = null; if (tav) disegnaPunti(); }
  }

  /** Mette il box accanto al pallino (su telefono il CSS lo ancora in basso). */
  function posizionaBox(box, id) {
    const b = el.punti.querySelector(`.punto[data-id="${CSS.escape(id)}"]`);
    if (!b) return;
    const r = b.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    let x = r.right + 14, y = r.top + r.height / 2 - h / 2;
    if (x + w > innerWidth - 8) x = r.left - w - 14;
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    y = Math.max(8, Math.min(innerHeight - h - 8, y));
    box.style.left = x + "px"; box.style.top = y + "px";
  }

  function inviaRisposta(ev) {
    ev.preventDefault();
    if (!attivo) return;
    const p = puntoDaId(attivo);
    const testo = el.input.value.trim();
    const { esito } = Valutazione.valuta(testo, p);
    prog()[p.id] = { esito, risposta: testo };
    scrivi(CHIAVI.progressi, progressi);
    const eraGuidato = guidato;
    chiudiBox();
    if (eraGuidato) prossimoPunto();
  }

  /** Apre il primo punto ancora senza risposta nell'ordine scelto (normale o casuale). */
  function prossimoPunto() {
    const pr = prog();
    const id = ordine.find(i => !pr[i] && visibile(puntoDaId(i)));
    if (!id) { avviso("Tavola completata! Usa “Ripeti sbagliati/vicini” o passa alla prossima."); return; }
    mostraPunto(id);
    apriRisposta(id, true);
  }

  // ---------------------------------------------------------------- comandi
  function ripetiSbagliati() {
    const pr = prog();
    const ids = tav.punti.filter(p => pr[p.id] && pr[p.id].esito !== "corretta").map(p => p.id);
    if (!ids.length) { avviso("Nessun punto sbagliato o vicino in questa tavola."); return; }
    ids.forEach(id => delete pr[id]);
    scrivi(CHIAVI.progressi, progressi);
    filtro = new Set(ids);
    el.btnTutti.hidden = false;
    preparaOrdine();
    disegnaPunti();
    prossimoPunto();
  }

  function mostraTutti() {
    filtro = null; el.btnTutti.hidden = true; disegnaPunti();
  }

  function azzeraTavola() {
    if (!confirm("Cancellare tutte le risposte di questa tavola?")) return;
    delete progressi[tav.id];
    scrivi(CHIAVI.progressi, progressi);
    filtro = null; el.btnTutti.hidden = true;
    preparaOrdine();
    disegnaPunti();
  }

  function impostaEtichette(on) {
    pref.etichette = on; scrivi(CHIAVI.preferenze, pref);
    document.body.classList.toggle("nascondi-etichette", !on);
    el.btnEtichette.textContent = on ? "Nascondi etichette" : "Mostra etichette";
  }

  let timerAvviso;
  function avviso(testo) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div"); t.id = "toast";
      t.style.cssText = "position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:#1f2328;color:#fff;" +
        "padding:8px 14px;border-radius:8px;font-size:14px;z-index:20;max-width:90vw;text-align:center";
      document.body.appendChild(t);
    }
    t.textContent = testo; t.hidden = false;
    clearTimeout(timerAvviso); timerAvviso = setTimeout(() => (t.hidden = true), 3500);
  }

  // ---------------------------------------------------------------- modalità modifica
  function attivaModifica(on) {
    inModifica = on;
    chiudiBox();
    el.scena.classList.toggle("modifica", on);
    el.btnModifica.classList.toggle("attivo", on);
    el.btnModifica.textContent = on ? "Fine modifica" : "Modifica";
    el.cmdMod.hidden = !on;
    el.avvisoMod.hidden = !on;
    disegnaPunti();
  }

  function salvaModifica(id, campi) {
    const m = (modifiche[tav.id] = modifiche[tav.id] || {});
    m[id] = Object.assign(m[id] || {}, campi);
    Object.assign(puntoDaId(id), campi);
    scrivi(CHIAVI.modifiche, modifiche);
  }

  function apriModificaPunto(id) {
    const p = puntoDaId(id);
    attivo = id;
    disegnaPunti();
    el.modTitolo.textContent = `Punto ${p.id} · ${p.tipo}`;
    el.modNome.value = p.nome;
    el.modSin.value = (p.sinonimi || []).join("; ");
    el.modInc.checked = !!p.incerto;
    el.box.hidden = true;
    el.boxMod.hidden = false;
    posizionaBox(el.boxMod, id);
  }

  function inviaModifica(ev) {
    ev.preventDefault();
    if (!attivo) return;
    salvaModifica(attivo, {
      nome: el.modNome.value.trim(),
      sinonimi: el.modSin.value.split(";").map(s => s.trim()).filter(Boolean),
      incerto: el.modInc.checked
    });
    chiudiBox();
  }

  function scarica(nome, testo, tipo) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([testo], { type: tipo }));
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function datiEsportati() {
    return JSON.stringify({ versione: (window.DATI_TAVOLE || {}).versione || 1, tavole }, null, 1);
  }

  // ---------------------------------------------------------------- zoom e trascinamento
  function applicaVista() {
    el.scena.style.transform = `translate(${vista.tx}px, ${vista.ty}px) scale(${vista.s})`;
    el.scena.style.setProperty("--inv", 1 / vista.s);
  }

  function adattaVista() {
    const vw = el.viewport.clientWidth, vh = el.viewport.clientHeight;
    vista.adatta = Math.min(vw / tav.larghezza, vh / tav.altezza) * 0.96;
    vista.s = vista.adatta;
    vista.tx = (vw - tav.larghezza * vista.s) / 2;
    vista.ty = (vh - tav.altezza * vista.s) / 2;
    applicaVista();
  }

  /** Zoom di un fattore mantenendo fermo il punto (cx, cy) del viewport. */
  function zoom(fattore, cx, cy) {
    const s = Math.max(vista.adatta * 0.7, Math.min(vista.adatta * 12, vista.s * fattore));
    const k = s / vista.s;
    vista.tx = cx - (cx - vista.tx) * k;
    vista.ty = cy - (cy - vista.ty) * k;
    vista.s = s;
    applicaVista();
    riposizionaBoxAperti();
  }

  /** Se il pallino è fuori dallo schermo, sposta la vista per centrarlo. */
  function mostraPunto(id) {
    const p = puntoDaId(id);
    const vw = el.viewport.clientWidth, vh = el.viewport.clientHeight;
    const x = p.punto_xy[0] / 100 * tav.larghezza * vista.s + vista.tx;
    const y = p.punto_xy[1] / 100 * tav.altezza * vista.s + vista.ty;
    if (x < 40 || x > vw - 40 || y < 40 || y > vh - 40) {
      vista.tx += vw / 2 - x; vista.ty += vh / 2 - y; applicaVista();
    }
  }

  function riposizionaBoxAperti() {
    if (!attivo) return;
    if (!el.box.hidden) posizionaBox(el.box, attivo);
    if (!el.boxMod.hidden) posizionaBox(el.boxMod, attivo);
  }

  // Gestione unificata di mouse e tocco: 1 dito = sposta (o trascina un pallino in modifica),
  // 2 dita = pinch zoom, tocco senza movimento su un pallino = apri il campo.
  const puntatori = new Map();
  let gesto = null;

  function posRel(e) {
    const r = el.viewport.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  el.viewport.addEventListener("pointerdown", e => {
    if (e.target.closest(".zoom-ctrl")) return;
    try { el.viewport.setPointerCapture(e.pointerId); } catch { /* puntatore non catturabile */ }
    puntatori.set(e.pointerId, posRel(e));
    const puntoEl = e.target.closest(".punto");
    if (puntatori.size === 1) {
      gesto = { tipo: inModifica && puntoEl ? "punto" : "sposta", inizio: posRel(e), mosso: false,
        id: puntoEl && puntoEl.dataset.id, tx: vista.tx, ty: vista.ty };
    } else if (puntatori.size === 2) {
      const [a, b] = [...puntatori.values()];
      gesto = { tipo: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), s: vista.s, mosso: true };
    }
  });

  el.viewport.addEventListener("pointermove", e => {
    if (!puntatori.has(e.pointerId) || !gesto) return;
    const pos = posRel(e);
    puntatori.set(e.pointerId, pos);
    if (gesto.tipo === "pinch" && puntatori.size === 2) {
      const [a, b] = [...puntatori.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoom((gesto.s * d / gesto.dist) / vista.s, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    const dx = pos.x - gesto.inizio.x, dy = pos.y - gesto.inizio.y;
    if (!gesto.mosso && Math.hypot(dx, dy) < 6) return;
    gesto.mosso = true;
    if (gesto.tipo === "sposta") {
      el.viewport.classList.add("trascina");
      vista.tx = gesto.tx + dx; vista.ty = gesto.ty + dy;
      applicaVista();
      riposizionaBoxAperti();
    } else if (gesto.tipo === "punto") {
      // nuova posizione in percentuale dell'immagine
      const x = ((pos.x - vista.tx) / vista.s) / tav.larghezza * 100;
      const y = ((pos.y - vista.ty) / vista.s) / tav.altezza * 100;
      const p = puntoDaId(gesto.id);
      p.punto_xy = [Math.round(Math.max(0, Math.min(100, x)) * 100) / 100, Math.round(Math.max(0, Math.min(100, y)) * 100) / 100];
      const b = el.punti.querySelector(`.punto[data-id="${CSS.escape(gesto.id)}"]`);
      b.style.left = p.punto_xy[0] + "%"; b.style.top = p.punto_xy[1] + "%";
      disegnaLineeModifica();
    }
  });

  function fineGesto(e) {
    if (!puntatori.has(e.pointerId)) return;
    puntatori.delete(e.pointerId);
    el.viewport.classList.remove("trascina");
    if (!gesto) return;
    const g = gesto;
    if (puntatori.size === 0) gesto = null;
    else if (g.tipo === "pinch") {                // resta un dito: riparte lo spostamento
      const [p] = [...puntatori.values()];
      gesto = { tipo: "sposta", inizio: p, mosso: true, tx: vista.tx, ty: vista.ty };
      return;
    }
    if (e.type === "pointercancel") return;
    if (g.tipo === "punto") {
      if (g.mosso) { salvaModifica(g.id, { punto_xy: puntoDaId(g.id).punto_xy }); disegnaPunti(); }
      else apriModificaPunto(g.id);
    } else if (g.tipo === "sposta" && !g.mosso) {
      const puntoEl = document.elementFromPoint(e.clientX, e.clientY);
      const b = puntoEl && puntoEl.closest(".punto");
      if (b) apriRisposta(b.dataset.id);
      else chiudiBox();
    }
  }
  el.viewport.addEventListener("pointerup", fineGesto);
  el.viewport.addEventListener("pointercancel", fineGesto);

  el.viewport.addEventListener("wheel", e => {
    e.preventDefault();
    const p = posRel(e);
    zoom(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });

  const centro = () => ({ x: el.viewport.clientWidth / 2, y: el.viewport.clientHeight / 2 });
  $("btn-zoom-piu").onclick = () => { const c = centro(); zoom(1.4, c.x, c.y); };
  $("btn-zoom-meno").onclick = () => { const c = centro(); zoom(1 / 1.4, c.x, c.y); };
  $("btn-zoom-adatta").onclick = () => { adattaVista(); riposizionaBoxAperti(); };
  addEventListener("resize", () => { if (tav) { adattaVista(); riposizionaBoxAperti(); } });

  // ---------------------------------------------------------------- collegamenti
  el.sel.onchange = () => apriTavola(+el.sel.value);
  $("btn-prec").onclick = () => apriTavola(pref.tavola - 1);
  $("btn-succ").onclick = () => apriTavola(pref.tavola + 1);
  el.box.addEventListener("submit", inviaRisposta);
  el.boxMod.addEventListener("submit", inviaModifica);
  $("btn-chiudi-risposta").onclick = chiudiBox;
  $("btn-chiudi-modifica").onclick = chiudiBox;
  $("btn-prossimo").onclick = prossimoPunto;
  el.btnEtichette.onclick = () => impostaEtichette(!pref.etichette);
  el.chkCasuale.onchange = () => { pref.casuale = el.chkCasuale.checked; scrivi(CHIAVI.preferenze, pref); preparaOrdine(); };
  el.btnRipeti.onclick = ripetiSbagliati;
  el.btnTutti.onclick = mostraTutti;
  $("btn-azzera").onclick = azzeraTavola;
  el.btnModifica.onclick = () => attivaModifica(!inModifica);
  $("btn-scarica").onclick = () => scarica("tavole.json", datiEsportati(), "application/json");
  $("btn-scarica-js").onclick = () => scarica("tavole.js",
    "// Esportato dalla modalità Modifica. Sostituisci data/tavole.js con questo file.\nwindow.DATI_TAVOLE = " + datiEsportati() + ";\n",
    "text/javascript");
  $("btn-annulla-mod").onclick = () => {
    if (!confirm("Annullare tutte le modifiche locali a posizioni e nomi?")) return;
    modifiche = {}; scrivi(CHIAVI.modifiche, modifiche);
    caricaDati(); tav = tavole[pref.tavola]; disegnaPunti();
  };
  document.addEventListener("keydown", e => { if (e.key === "Escape") chiudiBox(); });

  // ---------------------------------------------------------------- avvio
  caricaDati();
  if (!tavole.length) { document.body.insertAdjacentHTML("beforeend", "<p style='padding:20px'>Nessuna tavola in data/tavole.js</p>"); return; }
  popolaSelect();
  el.chkCasuale.checked = pref.casuale;
  impostaEtichette(pref.etichette);
  apriTavola(pref.tavola);

  window.App = { Valutazione: window.Valutazione };   // comodo per prove dalla console
})();
