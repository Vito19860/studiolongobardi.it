// /api/strumenti — modelli Excel gratuiti dello studio, in cambio dei dati.
// POST: salva nome, email e telefono nella tabella "richieste" (area "Strumenti Excel"),
//       avvisa lo studio e restituisce i link di download validi 24 ore.
// GET ?f=<file>&e=<scadenza>&k=<firma>: consegna il file se la firma è valida.
// I file stanno in api/_strumenti/ (non pubblici: si scaricano solo da qui).

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { notifica } from "./_notifica.js";
import { body, clip, config, db, emailOk } from "./_lib.js";

export const FILE = {
  piano: { file: "piano-finanziario.xlsx", nome: "Modello Piano Finanziario e Controllo di Gestione", scarica: "Piano-Finanziario-Studio-Longobardi.xlsx" },
  cruscotto: { file: "cruscotto-patrimonio.xlsx", nome: "Cruscotto del Patrimonio Doppio Motore", scarica: "Cruscotto-Patrimonio-Doppio-Motore.xlsx" },
  esempio: { file: "cruscotto-patrimonio-esempio.xlsx", nome: "Cruscotto del Patrimonio — esempio compilato", scarica: "Cruscotto-Patrimonio-Doppio-Motore-ESEMPIO.xlsx" },
};
const ORE = 24;

const firma = (f, e) => createHmac("sha256", "strumenti:" + (process.env.SUPABASE_SERVICE_ROLE_KEY || "")).update(`${f}:${e}`).digest("base64url");
const valida = (f, e, k) => {
  if (!FILE[f] || !/^\d{10}$/.test(e || "") || +e < Date.now() / 1000 || typeof k !== "string") return false;
  const a = Buffer.from(firma(f, e)), b = Buffer.from(k);
  return a.length === b.length && timingSafeEqual(a, b);
};

async function consegna(req, res) {
  const { f, e, k } = req.query || {};
  if (!valida(f, e, k)) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(403).send('<meta charset="utf-8"><p style="font:16px sans-serif;padding:40px">Il link è scaduto. <a href="/#strumenti">Richiedi di nuovo i modelli</a>.</p>');
  }
  const dati = await readFile(path.join(process.cwd(), "api", "_strumenti", FILE[f].file));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${FILE[f].scarica}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return res.status(200).send(dati);
}

function link() {
  const e = String(Math.floor(Date.now() / 1000) + ORE * 3600);
  return Object.keys(FILE).map((f) => ({ id: f, nome: FILE[f].nome, url: `/api/strumenti?f=${f}&e=${e}&k=${firma(f, e)}` }));
}

export default async function handler(req, res) {
  if (req.method === "GET") return consegna(req, res);
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Metodo non consentito" }); }

  const b = body(req);
  if (!config().ok) return res.status(500).json({ error: "Configurazione mancante sul server" });
  if (typeof b.t === "number" && b.t < 1500) return res.status(200).json({ ok: true, file: link() }); // anti-spam: non salva nulla

  const nome = clip(b.nome, 120);
  const email = clip(b.email, 160).toLowerCase();
  const telefono = clip(b.telefono, 40);
  if (!nome) return res.status(400).json({ error: "Scrivi nome e cognome." });
  if (!emailOk(email)) return res.status(400).json({ error: "Controlla l'indirizzo email." });
  if (telefono.replace(/\D/g, "").length < 6) return res.status(400).json({ error: "Inserisci un numero di telefono valido." });
  if (b.privacy !== true) return res.status(400).json({ error: "Serve il consenso all'informativa privacy." });

  const elenco = Object.values(FILE).map((x) => x.nome);
  const row = {
    tipo: "contatto", nome, email, telefono,
    azienda: clip(b.azienda, 160) || null,
    area: "Strumenti Excel",
    messaggio: `Ha richiesto i modelli Excel: ${elenco.join("; ")}.`,
    dati: { strumenti: Object.keys(FILE) },
    consenso_privacy: true,
    consenso_marketing: b.marketing === true,
    origine: clip(req.headers["referer"], 300) || null,
  };
  const r = await db("richieste", { method: "POST", body: row, prefer: "return=minimal" }).catch((e) => ({ ok: false, text: String(e) }));
  if (!r.ok) {
    console.error("Supabase", r.status, r.text);
    return res.status(502).json({ error: "Richiesta non riuscita. Riprova o chiamaci allo 081 801 1388." });
  }
  await notifica(`Strumenti Excel scaricati: ${nome}`, {
    Nome: nome, Email: email, Telefono: telefono, Azienda: row.azienda, Modelli: elenco.join(" · "),
    "Consenso aggiornamenti": row.consenso_marketing ? "sì" : "no",
  }, email);
  return res.status(200).json({ ok: true, file: link() });
}
