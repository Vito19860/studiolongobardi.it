// POST /api/richiesta — form contatti e richiesta di check-up dal test.
// Salva nella tabella "richieste" e manda l'avviso email allo studio.

import { notifica } from "./_notifica.js";
import { body, clip, config, db, emailOk, soloPost } from "./_lib.js";

const AREE = ["Simulatore di detassazione", "Pianificazione fiscale avanzata SRL", "Fiscale e contabilità", "Check-up fiscale", "Lavoro e paghe", "Controllo di gestione", "Consulenza holding", "Formazione", "Elevate", "Lavora con noi", "Altro"];

const SCELTE = {"forma": ["Ditta individuale", "Libero professionista", "Società di persone (snc, sas)", "SRL", "SpA o altra società", "Non ho ancora un'attività"], "fatturato": ["Fino a 250.000 €", "250.000 – 1 milione €", "1 – 5 milioni €", "Oltre 5 milioni €", "Preferisco non dirlo"], "dipendenti": ["Nessuno", "1 – 9", "10 – 49", "50 o più"], "urgenza": ["Entro un mese", "Entro 3 mesi", "Sto solo valutando"]};

const NOMI_LEVE = { comp: "compenso amministratore", tfm: "TFM", km: "rimborsi chilometrici", tras: "trasferte", roy: "royalties", buoni: "buoni pasto", fringe: "fringe benefit", prev: "previdenza complementare", iper: "iperammortamento", maxi: "maxi deduzione assunti", gar: "garanzie del socio" };
const intero = (v) => (Number.isFinite(+v) ? Math.max(-1e9, Math.min(1e9, Math.round(+v))) : 0);
const euro = (v) => intero(v).toLocaleString("it-IT") + " €";

function simulazione(x) {
  if (!x || typeof x !== "object") return null;
  return {
    fatturato: intero(x.fatturato), costi: intero(x.costi), collaboratori: intero(x.collaboratori),
    forma: clip(x.forma, 60) || "–", risparmio: Math.max(0, intero(x.risparmio)),
    leve: Array.isArray(x.leve) ? x.leve.filter((k) => NOMI_LEVE[k]).slice(0, 11) : [],
  };
}

function qualifica(q) {
  if (!q || typeof q !== "object") return null;
  const out = {};
  for (const k of Object.keys(SCELTE)) if (SCELTE[k].includes(q[k])) out[k] = q[k];
  return Object.keys(out).length ? out : null;
}

export default async function handler(req, res) {
  if (soloPost(req, res)) return;
  const b = body(req);
  if (typeof b.t === "number" && b.t < 1500) return res.status(200).json({ ok: true }); // anti-spam: invio troppo veloce per una persona

  const tipo = b.tipo === "test" ? "test" : "contatto";
  const nome = clip(b.nome, 120);
  let email = clip(b.email, 160).toLowerCase();
  let telefono = clip(b.telefono, 40);
  // nel test c'è un solo campo "telefono o email"
  if (tipo === "test" && b.recapito) {
    const r = clip(b.recapito, 160);
    if (emailOk(r)) email = r.toLowerCase(); else telefono = r.slice(0, 40);
  }
  if (!nome) return res.status(400).json({ error: "Scrivi nome e cognome." });
  if (tipo === "contatto" && !emailOk(email)) return res.status(400).json({ error: "Controlla l'indirizzo email." });
  if (tipo === "test" && !emailOk(email) && !/[0-9]{6,}/.test(telefono.replace(/\D/g, ""))) return res.status(400).json({ error: "Lascia un telefono o un'email per essere ricontattato." });
  if (b.privacy !== true) return res.status(400).json({ error: "Serve il consenso all'informativa privacy." });
  const sim = b.area === "Simulatore di detassazione" ? simulazione(b.simulazione) : null;
  if (sim && telefono.replace(/\D/g, "").length < 6) return res.status(400).json({ error: "Inserisci un numero di telefono valido." });

  let dati = null;
  if (tipo === "test" && b.test && typeof b.test === "object") {
    const pil = b.test.pilastri && typeof b.test.pilastri === "object" ? b.test.pilastri : {};
    dati = {
      punteggio: Number(b.test.punteggio) || 0,
      pilastro_debole: clip(b.test.debole, 40),
      pilastri: Object.fromEntries(Object.entries(pil).slice(0, 8).map(([k, v]) => [clip(k, 30), Number(v) || 0])),
    };
  }

  if (sim) dati = { simulazione: sim };
  const qual = qualifica(b.qualifica);
  if (qual) dati = { ...(dati || {}), ...qual };

  const row = {
    tipo,
    nome,
    email: email || null,
    telefono: telefono || null,
    azienda: clip(b.azienda, 160) || null,
    area: tipo === "test" ? "Check-up fiscale" : (AREE.includes(b.area) ? b.area : "Altro"),
    messaggio: sim
      ? `Simulazione: fatturato ${euro(sim.fatturato)}, costi ${euro(sim.costi)}, collaboratori ${euro(sim.collaboratori)}. Forma più leggera: ${sim.forma}. Risparmio stimato: ${euro(sim.risparmio)} l'anno.` + (sim.leve.length ? ` Leve attive: ${sim.leve.map((k) => NOMI_LEVE[k]).join(", ")}.` : "")
      : (clip(b.messaggio, 4000) || null),
    dati,
    consenso_privacy: true,
    consenso_marketing: b.marketing === true,
    origine: clip(req.headers["referer"], 300) || null,
  };

  if (!config().ok) return res.status(500).json({ error: "Configurazione mancante sul server" });
  const r = await db("richieste", { method: "POST", body: row, prefer: "return=minimal" }).catch((e) => ({ ok: false, text: String(e) }));
  if (!r.ok) {
    console.error("Supabase", r.status, r.text);
    return res.status(502).json({ error: "Invio non riuscito. Riprova o chiamaci allo 081 801 1388." });
  }

  const titolo = tipo === "test"
    ? `Test d'impresa: ${nome} · ${dati ? dati.punteggio + "/12" : ""}${dati && dati.pilastro_debole ? " · da rafforzare: " + dati.pilastro_debole : ""}`
    : sim ? `Simulatore: ${nome} · risparmio stimato ${euro(sim.risparmio)} l'anno` : `Nuova richiesta: ${row.area} · ${nome}`;
  await notifica(titolo, {
    Nome: nome, Email: row.email, Telefono: row.telefono, Azienda: row.azienda, Area: row.area,
    Messaggio: row.messaggio,
    Forma: dati && dati.forma, Fatturato: dati && dati.fatturato, Dipendenti: dati && dati.dipendenti, Urgenza: dati && dati.urgenza,
    Test: dati && dati.pilastri ? Object.entries(dati.pilastri).map(([k, v]) => `${k} ${v}/2`).join(" · ") : null,
    "Consenso aggiornamenti": row.consenso_marketing ? "sì" : null,
  }, row.email);
  return res.status(200).json({ ok: true });
}
