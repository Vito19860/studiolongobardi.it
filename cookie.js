/* Studio Longobardi — banner e preferenze cookie.
   Regole (Linee guida cookie del Garante, 10/6/2021):
   - nessuno strumento non tecnico parte prima del consenso;
   - "Accetta tutti" e "Rifiuta" hanno lo stesso peso; la X chiude e vale come rifiuto;
   - la scelta si conserva 6 mesi, poi il banner ricompare; si cambia quando si vuole
     dal link "Preferenze cookie" (in fondo alle pagine) o da qualunque elemento con data-cookie-preferenze.
   Categorie: necessari (sempre attivi), statistiche (Vercel Web Analytics), marketing (Pixel di Meta).
   Per attivare il Pixel di Meta basta scrivere il suo ID in PIXEL qui sotto. */
(function () {
  "use strict";
  var PIXEL = "";                 // ID del Pixel di Meta (vuoto = non usato)
  var KEY = "sl-consenso";
  var VERSIONE = 1;               // aumentare se cambiano le categorie: il banner ricompare a tutti
  var DURATA = 182 * 864e5;       // 6 mesi
  var POLICY = "/cookie";

  function leggi() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || "null");
      if (c && c.v === VERSIONE && Date.now() - c.data < DURATA) return c;
    } catch (e) {}
    return null;
  }
  function salva(stat, mkt) {
    var c = { v: VERSIONE, stat: !!stat, mkt: !!mkt, data: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    applica(c);
    chiudi();
    return c;
  }

  /* ---------- strumenti attivati solo con il consenso ---------- */
  var caricati = {};
  function script(src) {
    if (caricati[src]) return;
    caricati[src] = 1;
    var s = document.createElement("script");
    s.defer = true; s.src = src;
    document.head.appendChild(s);
  }
  function applica(c) {
    if (!c) return;
    if (c.stat) script("/_vercel/insights/script.js");
    if (c.mkt && PIXEL && !window.fbq) {
      var f = (window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); });
      if (!window._fbq) window._fbq = f;
      f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
      script("https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", PIXEL);
      window.fbq("track", "PageView");
    }
    // Se l'utente revoca il consenso, gli strumenti già caricati in questa pagina restano fino al prossimo caricamento:
    if (caricati.ricarica) location.reload();
  }

  /* ---------- interfaccia ---------- */
  var css =
    "#slc,#slc *{box-sizing:border-box}" +
    "#slc{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:980px;margin:0 auto;background:#0F2C5C;color:#E6ECF5;" +
    "font:15px/1.55 Inter,system-ui,-apple-system,Segoe UI,sans-serif;border-top:3px solid #D4A24C;box-shadow:0 18px 50px rgba(8,22,48,.35);padding:22px 24px}" +
    "#slc h2{margin:0 36px 6px 0;font:800 17px/1.3 Montserrat,Inter,sans-serif;color:#FFFFFF;text-transform:none;letter-spacing:0}" +
    "#slc p{margin:0}#slc a{color:#E9BE6E}" +
    "#slc .slc-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;background:none;color:#C9D3E3;font-size:24px;line-height:1;cursor:pointer}" +
    "#slc .slc-b{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}" +
    "#slc button.slc-btn{flex:1 1 160px;min-height:46px;padding:12px 18px;border:1.5px solid #D4A24C;font:800 12px/1 Montserrat,Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}" +
    "#slc button.slc-si,#slc button.slc-no{background:#D4A24C;color:#0F2C5C}#slc button.slc-pers,#slc button.slc-salva{background:transparent;color:#FFFFFF;border-color:#8FA3C4}" +
    "#slc .slc-cat{display:none;margin-top:14px;border-top:1px solid rgba(255,255,255,.15)}#slc.pers .slc-cat{display:block}" +
    "#slc .slc-riga{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.1)}" +
    "#slc .slc-riga b{display:block;color:#FFFFFF;font-size:14px}#slc .slc-riga small{display:block;color:#AFC0DA;font-size:13px}" +
    "#slc .slc-sw{position:relative;flex:0 0 46px;width:46px;height:26px;margin-top:2px}" +
    "#slc .slc-sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;z-index:1}" +
    "#slc .slc-sw span{position:absolute;inset:0;border-radius:13px;background:#5B6F92;transition:.2s}" +
    "#slc .slc-sw span:after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#FFFFFF;transition:.2s}" +
    "#slc .slc-sw input:checked+span{background:#D4A24C}#slc .slc-sw input:checked+span:after{left:23px}" +
    "#slc .slc-sw input:disabled+span{opacity:.6}#slc .slc-sw input:focus-visible+span{outline:2px solid #FFFFFF;outline-offset:2px}" +
    "#slc button.slc-salva,#slc.pers button.slc-pers{display:none}#slc.pers button.slc-salva{display:block}" +
    "@media(max-width:600px){#slc{left:0;right:0;bottom:0;padding:16px 16px 14px;max-height:88vh;overflow:auto;font-size:14px}#slc .slc-b{margin-top:12px;gap:8px}#slc button.slc-btn{flex:1 1 40%;min-height:44px;padding:10px 8px}#slc button.slc-pers,#slc button.slc-salva{order:3;flex:1 1 100%;min-height:40px}}";

  var box;
  function riga(id, titolo, testo, fisso, acceso) {
    return '<div class="slc-riga"><div><b>' + titolo + "</b><small>" + testo + '</small></div><label class="slc-sw"><input type="checkbox" id="' + id + '"' +
      (fisso ? " checked disabled" : acceso ? " checked" : "") + ' aria-label="' + titolo + '"><span></span></label></div>';
  }
  function apri(personalizza) {
    chiudi();
    var c = leggi() || {};
    if (!document.getElementById("slc-css")) {
      var st = document.createElement("style"); st.id = "slc-css"; st.textContent = css; document.head.appendChild(st);
    }
    box = document.createElement("div");
    box.id = "slc";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "false");
    box.setAttribute("aria-labelledby", "slc-t");
    if (personalizza) box.className = "pers";
    box.innerHTML =
      '<button type="button" class="slc-x" aria-label="Chiudi: continua senza accettare">×</button>' +
      '<h2 id="slc-t">Rispettiamo la tua privacy</h2>' +
      "<p>Usiamo strumenti tecnici necessari al funzionamento del sito e, solo con il tuo consenso, strumenti di statistica e di marketing. " +
      "Puoi cambiare scelta quando vuoi da «Preferenze cookie», in fondo alla pagina. La X chiude senza accettare. " +
      '<a href="' + POLICY + '">Cookie policy</a></p>' +
      '<div class="slc-cat">' +
      riga("slc-nec", "Necessari", "Fanno funzionare il sito: le tue preferenze sui cookie, i moduli e l'area riservata. Sempre attivi.", true) +
      riga("slc-stat", "Statistiche", "Vercel Web Analytics: conta visite e richieste in forma anonima e aggregata.", false, c.stat) +
      riga("slc-mkt", "Marketing", "Pixel di Meta (Facebook e Instagram): misura i risultati delle nostre campagne pubblicitarie.", false, c.mkt) +
      "</div>" +
      '<div class="slc-b">' +
      '<button type="button" class="slc-btn slc-no">Rifiuta</button>' +
      '<button type="button" class="slc-btn slc-pers">Personalizza</button>' +
      '<button type="button" class="slc-btn slc-salva">Salva le mie scelte</button>' +
      '<button type="button" class="slc-btn slc-si">Accetta tutti</button>' +
      "</div>";
    var salvaBtn = box.querySelector(".slc-salva");
    document.body.appendChild(box);

    var gia = !!leggi();
    box.querySelector(".slc-x").onclick = function () { segnaRicarica(c, false, false); salva(false, false); };
    box.querySelector(".slc-no").onclick = function () { segnaRicarica(c, false, false); salva(false, false); };
    box.querySelector(".slc-si").onclick = function () { salva(true, true); };
    box.querySelector(".slc-pers").onclick = function () { box.classList.add("pers"); box.querySelector("#slc-stat").focus(); };
    salvaBtn.onclick = function () {
      var s = box.querySelector("#slc-stat").checked, m = box.querySelector("#slc-mkt").checked;
      segnaRicarica(c, s, m); salva(s, m);
    };
    box.addEventListener("keydown", function (e) { if (e.key === "Escape" && gia) chiudi(); });
    if (personalizza) box.querySelector("#slc-stat").focus();
  }
  // Se tolgo un consenso già dato e lo strumento è già partito, ricarico la pagina per fermarlo.
  function segnaRicarica(prima, stat, mkt) {
    if ((prima.stat && !stat && caricati["/_vercel/insights/script.js"]) || (prima.mkt && !mkt && window.fbq)) caricati.ricarica = 1;
  }
  function chiudi() { if (box && box.parentNode) box.parentNode.removeChild(box); box = null; }

  window.SLConsenso = {
    stato: leggi,
    apri: function () { apri(true); },
    // eventi di conversione per il Pixel (non fa nulla se manca il consenso o il Pixel)
    evento: function (nome, dati) { var c = leggi(); if (c && c.mkt && window.fbq) window.fbq("track", nome, dati || {}); }
  };

  function avvia() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-cookie-preferenze]");
      if (a) { e.preventDefault(); apri(true); }
    });
    var c = leggi();
    if (c) applica(c); else apri(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia); else avvia();
})();
