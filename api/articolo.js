// GET /approfondimenti/<slug>  (riscritto da vercel.json in /api/articolo?slug=<slug>)
// Pagina vera di ogni articolo pubblicato, letta dal database e disegnata dal server:
// Google la legge già completa, con titolo, descrizione e dati strutturati propri.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { config, db } from "./_lib.js";
import { articolo, esc, imgOk, slug as pulito } from "./_articolo.js";

const SITO = "https://www.studiolongobardi.it";
let modello;
const leggiModello = async () => (modello ??= await readFile(path.join(process.cwd(), "api", "_modelli", "articolo.html"), "utf8"));
const CAMPI = "slug,titolo,categoria,sommario,corpo,immagine,autore_nome,autore_ruolo,autore_foto,pubblicato_il,aggiornato_il";

function pagina(m, { titolo, descrizione, url, immagine, dati, corpo }) {
  return m.replaceAll("__TITOLO__", esc(titolo)).replaceAll("__DESCRIZIONE__", esc(descrizione))
    .replaceAll("__URL__", esc(url)).replaceAll("__IMMAGINE__", esc(immagine))
    .replace("<!--DATI_ARTICOLO-->", dati ? `<script type="application/ld+json">${JSON.stringify(dati).replace(/</g, "\\u003c")}</script>` : "")
    .replace("<!--ARTICOLO-->", corpo);
}

export default async function handler(req, res) {
  const s = String(req.query?.slug || "").toLowerCase();
  const m = await leggiModello();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!/^[a-z0-9-]{1,120}$/.test(s) || !config().ok) return nonTrovato(res, m);

  let r = await db(`articoli?stato=eq.pubblicato&slug=eq.${encodeURIComponent(s)}&select=${CAMPI}&limit=1`);
  if (!r.ok && /aggiornato_il/.test(r.text || "")) r = await db(`articoli?stato=eq.pubblicato&slug=eq.${encodeURIComponent(s)}&select=${CAMPI.replace(",aggiornato_il", "")}&limit=1`);
  const a = r.ok && r.data && r.data[0];
  if (!a) return nonTrovato(res, m);

  const altri = await db(`articoli?stato=eq.pubblicato&slug=neq.${encodeURIComponent(s)}&select=slug,titolo,categoria,sommario,immagine,autore_nome,autore_foto,pubblicato_il&order=pubblicato_il.desc&limit=2`);
  const url = `${SITO}/approfondimenti/${pulito(a)}`;
  const img = imgOk(a.immagine);
  const immagine = img.startsWith("http") ? img : `${SITO}/${img}`;
  const descrizione = (a.sommario || String(a.corpo || "").replace(/[#*\-•]/g, " ").replace(/\s+/g, " ").trim()).slice(0, 160);
  const dati = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: a.titolo, description: descrizione, image: immagine, url, mainEntityOfPage: url,
    datePublished: a.pubblicato_il, dateModified: a.aggiornato_il || a.pubblicato_il,
    articleSection: a.categoria || undefined,
    author: { "@type": "Person", name: a.autore_nome || "Studio Longobardi" },
    publisher: { "@id": `${SITO}/#studio` },
  };
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).send(pagina(m, {
    titolo: `${a.titolo} · Studio Longobardi`, descrizione, url, immagine, dati,
    corpo: articolo(a, (altri.ok && altri.data) || []),
  }));
}

function nonTrovato(res, m) {
  res.setHeader("Cache-Control", "public, s-maxage=60");
  return res.status(404).send(pagina(m, {
    titolo: "Articolo non trovato · Studio Longobardi", descrizione: "", url: `${SITO}/approfondimenti`, immagine: `${SITO}/img/condivisione.jpg`, dati: null,
    corpo: '<div style="background: #FFFFFF"><div class="wrap" style="max-width: 900px; padding-top: 110px; padding-bottom: 110px; display: flex; flex-direction: column; gap: 18px"><h1 class="mont" style="margin: 0; font-size: 40px; font-weight: 800; color: #0F2C5C">Articolo non trovato</h1><p style="margin: 0; font-size: 18px; color: #3A4762">L\'articolo che cerchi non c\'è più o ha cambiato indirizzo.</p><a href="/approfondimenti" class="btn btn-gold" style="align-self: flex-start">Tutti gli approfondimenti</a></div></div>',
  }).replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">'));
}
