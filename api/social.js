// GET /api/social — ultimi post di Instagram e Facebook dello studio.
// I post sono copiati nella tabella "post_social" e le immagini nel bucket pubblico "social",
// così il sito non carica script né cookie di Meta.
// La copia si aggiorna da sola: al massimo ogni 30 minuti quando qualcuno visita il sito,
// e comunque ogni mattina (cron in vercel.json).
//
// Variabili d'ambiente su Vercel:
//   META_PAGE_ID     id della pagina Facebook dello studio
//   META_PAGE_TOKEN  token di accesso della pagina (permanente, vedi README)
//   META_IG_ID       facoltativo: id dell'account Instagram professionale (se manca lo ricava dalla pagina)
//   CRON_SECRET      facoltativo: protegge l'aggiornamento forzato (?sync=1)

import { config, db, headers } from "./_lib.js";

const VER = process.env.META_API_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${VER}`;
const OGNI_MIN = 30;
const QUANTI = 12;

export default async function handler(req, res) {
  if (!config().ok) return res.status(500).json({ error: "Configurazione mancante sul server" });
  const meta = Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_TOKEN);
  const forza = req.query && req.query.sync === "1";
  if (forza && process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Non autorizzato" });
  }

  let esito = null;
  if (meta) {
    const ultima = await db("impostazioni?chiave=eq.social_sync&select=valore").catch(() => null);
    const quando = ultima && ultima.ok && ultima.data && ultima.data[0] ? Date.parse(ultima.data[0].valore) : 0;
    if (forza || !quando || Date.now() - quando > OGNI_MIN * 60000) {
      esito = await sincronizza().catch((e) => ({ errore: String(e.message || e).slice(0, 300) }));
      // se il collegamento con Meta non riesce, riproviamo alla visita successiva invece di aspettare 30 minuti
      const riuscito = esito && !esito.errore;
      await db("impostazioni?on_conflict=chiave", {
        method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
        body: [...(riuscito ? [{ chiave: "social_sync", valore: new Date().toISOString() }] : []), { chiave: "social_esito", valore: JSON.stringify({ ...esito, quando: new Date().toISOString() }).slice(0, 1000) }],
      }).catch(() => {});
    }
  }

  const r = await db(`post_social?visibile=is.true&immagine=not.is.null&select=id,rete,tipo,testo,immagine,link,pubblicato_il&order=pubblicato_il.desc&limit=${QUANTI}`);
  if (!r.ok) return res.status(502).json({ error: "Lettura non riuscita" });
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).json({ ok: true, post: r.data || [], ...(forza ? { esito } : {}) });
}

async function graph(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(process.env.META_PAGE_TOKEN)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Meta ${r.status}: ${(j.error && j.error.message) || "errore"}`);
  return j;
}

const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, " ").trim().slice(0, 80);

async function sincronizza() {
  const page = process.env.META_PAGE_ID;
  let ig = process.env.META_IG_ID;
  if (!ig) {
    const p = await graph(`${page}?fields=instagram_business_account`);
    ig = p.instagram_business_account && p.instagram_business_account.id;
  }
  const post = [];
  const errori = [];

  if (ig) {
    try {
      const m = await graph(`${ig}/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp&limit=${QUANTI}`);
      for (const x of m.data || []) {
        const video = x.media_type === "VIDEO";
        post.push({
          id: `ig_${x.id}`, rete: "ig",
          tipo: video ? (x.media_product_type === "REELS" ? "reel" : "video") : (x.media_type === "CAROUSEL_ALBUM" ? "carosello" : "foto"),
          testo: x.caption || null, sorgente: video ? x.thumbnail_url : x.media_url,
          link: x.permalink, pubblicato_il: x.timestamp,
        });
      }
    } catch (e) { errori.push("Instagram: " + e.message); }
  }

  try {
    const f = await graph(`${page}/posts?fields=id,message,full_picture,permalink_url,created_time,attachments{media_type}&limit=${QUANTI}`);
    const testiIg = post.map((p) => ({ t: norm(p.testo), d: Date.parse(p.pubblicato_il) }));
    for (const x of f.data || []) {
      if (!x.full_picture) continue; // post senza immagine: non adatti alla griglia
      const t = norm(x.message), d = Date.parse(x.created_time);
      // lo stesso contenuto pubblicato su Instagram e Facebook compare una volta sola
      if (t && testiIg.some((o) => o.t && (o.t.startsWith(t.slice(0, 40)) || t.startsWith(o.t.slice(0, 40))) && Math.abs(o.d - d) < 2 * 86400000)) continue;
      const mt = x.attachments && x.attachments.data && x.attachments.data[0] && x.attachments.data[0].media_type;
      post.push({
        id: `fb_${x.id}`, rete: "fb", tipo: mt === "video" ? "video" : (mt === "album" ? "carosello" : "foto"),
        testo: x.message || null, sorgente: x.full_picture, link: x.permalink_url, pubblicato_il: x.created_time,
      });
    }
  } catch (e) { errori.push("Facebook: " + e.message); }

  // immagini: copiate una volta sola nel bucket "social"
  const gia = await db(`post_social?select=id,immagine&id=in.(${post.map((p) => `"${p.id}"`).join(",") || '""'})`);
  const salvate = new Map((gia.ok && Array.isArray(gia.data) ? gia.data : []).map((r) => [r.id, r.immagine]));
  const { url, key } = config();
  const righe = [];
  for (const p of post) {
    let immagine = salvate.get(p.id) || null;
    if (!immagine && p.sorgente) {
      try {
        const img = await fetch(p.sorgente);
        if (img.ok) {
          const tipo = img.headers.get("content-type") || "image/jpeg";
          const nome = `${p.id.replace(/[^a-z0-9_]/gi, "")}.${tipo.includes("png") ? "png" : "jpg"}`;
          const up = await fetch(`${url}/storage/v1/object/social/${nome}`, {
            method: "POST",
            headers: { ...headers(key, { "Content-Type": tipo, "x-upsert": "true", "Cache-Control": "max-age=31536000" }) },
            body: Buffer.from(await img.arrayBuffer()),
          });
          if (up.ok) immagine = `${url}/storage/v1/object/public/social/${nome}`;
          else errori.push(`Immagine ${p.id}: ${up.status}`);
        }
      } catch (e) { errori.push(`Immagine ${p.id}: ${e.message}`); }
    }
    righe.push({ id: p.id, rete: p.rete, tipo: p.tipo, testo: p.testo, immagine, link: p.link, pubblicato_il: p.pubblicato_il });
  }
  if (righe.length) {
    const w = await db("post_social?on_conflict=id", { method: "POST", body: righe, prefer: "resolution=merge-duplicates,return=minimal" });
    if (!w.ok) errori.push("Salvataggio: " + w.text.slice(0, 200));
  }
  return { post: righe.length, instagram: Boolean(ig), errori };
}
