// POST /api/libro — copia omaggio di "Intelligenza Fiscale" in PDF.
// 1. salva nome ed email nella tabella "richieste_libro" (una riga per email);
// 2. restituisce un link di download temporaneo (24 ore) al PDF custodito in Supabase Storage,
//    bucket privato "libri", file "intelligenza-fiscale.pdf". Se il file non c'è, usa la copia nel sito.

import { notifica } from "./_notifica.js";
import { body, clip, config, db, emailOk, headers, soloPost } from "./_lib.js";

const LINK_ORE = 24;

export default async function handler(req, res) {
  if (soloPost(req, res)) return;
  const b = body(req);
  if (b.sito) return res.status(200).json({ ok: true, salvato: "filtro_antispam", url: "/download/intelligenza-fiscale.pdf" }); // il libro è gratuito: anche nel dubbio lo diamo

  const nome = clip(b.nome, 120);
  const email = clip(b.email, 160).toLowerCase();
  if (!nome) return res.status(400).json({ error: "Scrivi il tuo nome." });
  if (!emailOk(email)) return res.status(400).json({ error: "Controlla l'indirizzo email." });
  if (b.privacy !== true) return res.status(400).json({ error: "Serve il consenso all'informativa privacy." });

  const { url, key, ok } = config();
  if (!ok) return res.status(500).json({ error: "Configurazione mancante sul server" });

  const r = await db("richieste_libro?on_conflict=email", {
    method: "POST",
    body: { nome, email, consenso_privacy: true },
    prefer: "resolution=ignore-duplicates,return=representation",
  }).catch((e) => ({ ok: false, text: String(e) }));
  if (!r.ok) {
    console.error("Supabase", r.status, r.text);
    return res.status(502).json({ error: "Richiesta non riuscita. Riprova tra poco." });
  }
  const nuovo = Array.isArray(r.data) && r.data.length > 0;
  if (nuovo) {
    await notifica(`Libro scaricato: ${nome}`, { Nome: nome, Email: email, Libro: "Intelligenza Fiscale" }, email);
  }

  let link = null;
  try {
    const path = process.env.LIBRO_PATH || "libri/intelligenza-fiscale.pdf";
    const s = await fetch(`${url}/storage/v1/object/sign/${path}`, {
      method: "POST", headers: headers(key), body: JSON.stringify({ expiresIn: LINK_ORE * 3600 }),
    });
    if (s.ok) {
      const j = await s.json();
      const signed = j.signedURL || j.signedUrl;
      if (signed) link = `${url}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}&download=Intelligenza-Fiscale.pdf`;
    }
  } catch (e) { console.error(e); }
  return res.status(200).json({ ok: true, salvato: nuovo ? "nuovo" : "gia_presente", url: link || "/download/intelligenza-fiscale.pdf" });
}
