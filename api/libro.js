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
  if (typeof b.t === "number" && b.t < 1500) return res.status(200).json({ ok: true, salvato: "filtro_antispam", url: "/download/intelligenza-fiscale.pdf" });

  const nome = clip(b.nome, 120);
  const email = clip(b.email, 160).toLowerCase();
  const telefono = clip(b.telefono, 40);
  if (!nome) return res.status(400).json({ error: "Scrivi il tuo nome." });
  if (!emailOk(email)) return res.status(400).json({ error: "Controlla l'indirizzo email." });
  if (telefono.replace(/\D/g, "").length < 6) return res.status(400).json({ error: "Inserisci un numero di telefono valido." });
  if (b.privacy !== true) return res.status(400).json({ error: "Serve il consenso all'informativa privacy." });

  const { url, key, ok } = config();
  if (!ok) return res.status(500).json({ error: "Configurazione mancante sul server" });

  const salva = (riga) => db("richieste_libro?on_conflict=email", {
    method: "POST", body: riga, prefer: "resolution=ignore-duplicates,return=representation",
  }).catch((e) => ({ ok: false, text: String(e) }));
  const marketing = b.marketing === true;
  let r = await salva({ nome, email, telefono, consenso_privacy: true, consenso_marketing: marketing });
  // se la colonna "telefono" non è ancora stata creata nel database, salva comunque nome ed email
  if (!r.ok && /consenso_marketing/.test(r.text || "")) r = await salva({ nome, email, telefono, consenso_privacy: true });
  if (!r.ok && /telefono/.test(r.text || "")) r = await salva({ nome, email, consenso_privacy: true });
  if (!r.ok) {
    console.error("Supabase", r.status, r.text);
    return res.status(502).json({ error: "Richiesta non riuscita. Riprova tra poco." });
  }
  const nuovo = Array.isArray(r.data) && r.data.length > 0;
  // chi riscarica con la stessa email: aggiorniamo il telefono se prima mancava o è cambiato
  if (!nuovo) await db(`richieste_libro?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: marketing ? { telefono, consenso_marketing: true } : { telefono }, prefer: "return=minimal" }).catch(() => {});
  if (nuovo) {
    await notifica(`Libro scaricato: ${nome}`, { Nome: nome, Email: email, Telefono: telefono, Libro: "Intelligenza Fiscale", "Consenso comunicazioni": marketing ? "sì" : "no" }, email);
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
