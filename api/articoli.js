// GET /api/articoli — articoli del blog pubblicati (approvati da direzione e marketing).

import { config, db } from "./_lib.js";

export default async function handler(req, res) {
  if (!config().ok) return res.status(500).json({ error: "Configurazione mancante sul server" });
  const r = await db("articoli?stato=eq.pubblicato&select=slug,titolo,categoria,sommario,corpo,immagine,autore_nome,autore_ruolo,autore_foto,pubblicato_il&order=pubblicato_il.desc&limit=60");
  if (!r.ok) return res.status(502).json({ error: "Lettura non riuscita" });
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
  return res.status(200).json({ ok: true, articoli: r.data || [] });
}
