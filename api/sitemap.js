// GET /sitemap.xml (riscritto da vercel.json): pagine del sito + tutti gli articoli pubblicati.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config, db } from "./_lib.js";

const SITO = "https://www.studiolongobardi.it";
const PRIORITA = { "/": "1.0", "/pianificazione-fiscale-srl": "0.9", "/contatti": "0.8" };

export default async function handler(req, res) {
  const pagine = JSON.parse(await readFile(path.join(process.cwd(), "api", "_modelli", "pagine.json"), "utf8"));
  pagine.splice(1, 0, "/pianificazione-fiscale-srl");
  const righe = pagine.map((u) => `<url><loc>${SITO}${u}</loc><changefreq>monthly</changefreq><priority>${PRIORITA[u] || (u.startsWith("/servizi/") ? "0.8" : "0.6")}</priority></url>`);
  if (config().ok) {
    const r = await db("articoli?stato=eq.pubblicato&select=slug,pubblicato_il&order=pubblicato_il.desc&limit=500").catch(() => null);
    for (const a of (r && r.ok && r.data) || []) {
      const s = String(a.slug).replace(/[^a-z0-9-]/g, "");
      if (s) righe.push(`<url><loc>${SITO}/approfondimenti/${s}</loc>${a.pubblicato_il ? `<lastmod>${String(a.pubblicato_il).slice(0, 10)}</lastmod>` : ""}<changefreq>yearly</changefreq><priority>0.6</priority></url>`);
    }
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${righe.join("\n")}\n</urlset>\n`);
}
