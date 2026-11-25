// POST /api/avviso — email automatiche del blog (chiamata dall'area staff).
//  - articolo inviato in approvazione → avviso a direzione e marketing
//  - articolo pubblicato o rimandato → avviso all'autore
// Richiede l'accesso di un membro dello staff (token nella richiesta).

import { notifica } from "./_notifica.js";
import { body, config, db, headers, soloPost } from "./_lib.js";

export default async function handler(req, res) {
  if (soloPost(req, res)) return;
  const { url, key, ok } = config();
  if (!ok) return res.status(500).json({ error: "Configurazione mancante" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const anon = (process.env.SUPABASE_ANON_KEY || "").trim();
  if (!token || !anon) return res.status(401).json({ error: "Accesso richiesto" });

  const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!u.ok) return res.status(401).json({ error: "Accesso scaduto" });
  const utente = await u.json();
  const st = await db(`staff?user_id=eq.${utente.id}&attivo=is.true&select=nome`);
  if (!st.ok || !st.data || !st.data.length) return res.status(403).json({ error: "Non abilitato" });

  const id = Number(body(req).id);
  const a = await db(`articoli?id=eq.${id}&select=id,titolo,stato,autore_id,autore_nome,ok_direzione,ok_marketing,nota_revisione,slug`);
  if (!a.ok || !a.data || !a.data[0]) return res.status(404).json({ error: "Articolo non trovato" });
  const art = a.data[0];
  const link = `https://www.studiolongobardi.it/approfondimenti/${art.slug}`;

  if (art.stato === "in_revisione") {
    const a1 = (process.env.NOTIFICA_EMAIL || "").trim();
    const a2 = (process.env.MARKETING_EMAIL || "").trim();
    for (const to of [...new Set([a1, a2].filter(Boolean))]) {
      await notifica(`Articolo da approvare: ${art.titolo}`, {
        Autore: art.autore_nome, Titolo: art.titolo,
        Approvazioni: `Direzione ${art.ok_direzione ? "✓" : "in attesa"} · Marketing ${art.ok_marketing ? "✓" : "in attesa"}`,
        Dove: "www.studiolongobardi.it/staff",
      }, null, to);
    }
  } else if ((art.stato === "pubblicato" || art.stato === "respinto") && art.autore_id) {
    const r = await fetch(`${url}/auth/v1/admin/users/${art.autore_id}`, { headers: headers(key) });
    const email = r.ok ? (await r.json()).email : null;
    if (email) {
      await notifica(art.stato === "pubblicato" ? `Il tuo articolo è online: ${art.titolo}` : `Il tuo articolo va rivisto: ${art.titolo}`,
        art.stato === "pubblicato" ? { Titolo: art.titolo, Link: link } : { Titolo: art.titolo, Nota: art.nota_revisione, Dove: "www.studiolongobardi.it/staff" },
        null, email);
    }
  }
  return res.status(200).json({ ok: true });
}
