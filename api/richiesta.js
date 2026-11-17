// POST /api/richiesta — form contatti e richiesta di check-up dal test.
// Salva nella tabella "richieste" e manda l'avviso email allo studio.

import { notifica } from "./_notifica.js";
import { body, clip, config, db, emailOk, soloPost } from "./_lib.js";

const AREE = ["Fiscale e contabilità", "Check-up fiscale", "Lavoro e paghe", "Controllo di gestione", "Consulenza holding", "Formazione", "Elevate", "Lavora con noi", "Altro"];

export default async function handler(req, res) {
  if (soloPost(req, res)) return;
  const b = body(req);
  if (b.sito) return res.status(200).json({ ok: true }); // campo trappola anti-spam

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

  let dati = null;
  if (tipo === "test" && b.test && typeof b.test === "object") {
    const pil = b.test.pilastri && typeof b.test.pilastri === "object" ? b.test.pilastri : {};
    dati = {
      punteggio: Number(b.test.punteggio) || 0,
      pilastro_debole: clip(b.test.debole, 40),
      pilastri: Object.fromEntries(Object.entries(pil).slice(0, 8).map(([k, v]) => [clip(k, 30), Number(v) || 0])),
    };
  }

  const row = {
    tipo,
    nome,
    email: email || null,
    telefono: telefono || null,
    azienda: clip(b.azienda, 160) || null,
    area: tipo === "test" ? "Check-up fiscale" : (AREE.includes(b.area) ? b.area : "Altro"),
    messaggio: clip(b.messaggio, 4000) || null,
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
    : `Nuova richiesta: ${row.area} · ${nome}`;
  await notifica(titolo, {
    Nome: nome, Email: row.email, Telefono: row.telefono, Azienda: row.azienda, Area: row.area,
    Messaggio: row.messaggio,
    Test: dati ? Object.entries(dati.pilastri).map(([k, v]) => `${k} ${v}/2`).join(" · ") : null,
    "Consenso aggiornamenti": row.consenso_marketing ? "sì" : null,
  }, row.email);
  return res.status(200).json({ ok: true });
}
