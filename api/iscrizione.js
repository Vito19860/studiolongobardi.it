// POST /api/iscrizione — "Avvisami" per Elevate e aggiornamenti del blog.
// Salva nella tabella "iscritti" (una riga per email e lista).

import { notifica } from "./_notifica.js";
import { body, clip, config, db, emailOk, soloPost } from "./_lib.js";

export default async function handler(req, res) {
  if (soloPost(req, res)) return;
  const b = body(req);
  if (b.sito) return res.status(200).json({ ok: true });

  const email = clip(b.email, 160).toLowerCase();
  const lista = b.lista === "elevate" ? "elevate" : "blog";
  if (!emailOk(email)) return res.status(400).json({ error: "Controlla l'indirizzo email." });
  if (b.consenso !== true) return res.status(400).json({ error: "Serve il consenso per ricevere le comunicazioni." });
  if (!config().ok) return res.status(500).json({ error: "Configurazione mancante sul server" });

  const r = await db("iscritti?on_conflict=email,lista", {
    method: "POST",
    body: { email, lista, consenso: true },
    prefer: "resolution=ignore-duplicates,return=representation",
  }).catch((e) => ({ ok: false, text: String(e) }));
  if (!r.ok) {
    console.error("Supabase", r.status, r.text);
    return res.status(502).json({ error: "Iscrizione non riuscita. Riprova tra poco." });
  }
  if (Array.isArray(r.data) && r.data.length) {
    await notifica(`Nuovo iscritto ${lista === "elevate" ? "a Elevate 2027" : "agli aggiornamenti del blog"}`, { Email: email, Lista: lista }, email);
  }
  return res.status(200).json({ ok: true });
}
