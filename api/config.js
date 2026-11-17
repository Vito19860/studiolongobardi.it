// GET /api/config — dati pubblici per l'area staff: indirizzo di Supabase e chiave "publishable"/anon.
// Questa chiave è pensata per stare nel browser: i permessi li decidono le regole (RLS) del database.

export default function handler(req, res) {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anon = (process.env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !anon) return res.status(500).json({ error: "Configurazione mancante sul server" });
  res.setHeader("Cache-Control", "public, s-maxage=3600");
  return res.status(200).json({ url, anon });
}
