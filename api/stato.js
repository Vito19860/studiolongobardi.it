// Diagnostica: www.studiolongobardi.it/diagnostica
// Dice se le impostazioni funzionano. Non mostra mai chiavi o dati personali.

import { config, headers } from "./_lib.js";

const em = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || "").trim());

export default async function handler(req, res) {
  const { url, key } = config();
  const anon = (process.env.SUPABASE_ANON_KEY || "").trim();
  const out = {
    supabase: {
      SUPABASE_URL: url ? (/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) ? "presente, formato corretto" : "presente, ma non è un indirizzo https://….supabase.co") : "MANCANTE",
      SUPABASE_SERVICE_ROLE_KEY: !key ? "MANCANTE" : key.startsWith("eyJ") ? "presente (chiave legacy service_role)" : key.startsWith("sb_secret_") ? "presente (chiave secret)" : key.startsWith("sb_publishable_") ? "SBAGLIATA: è la chiave publishable, qui serve la secret" : "presente, tipo non riconosciuto",
      SUPABASE_ANON_KEY: !anon ? "MANCANTE (l'area staff non funziona)" : anon.startsWith("sb_secret_") ? "SBAGLIATA: è la chiave segreta, qui serve la publishable/anon" : "presente",
    },
    avvisi_email: {
      SMTP_USER: !process.env.SMTP_USER ? "MANCANTE (avvisi disattivati)" : em(process.env.SMTP_USER) ? "presente" : "presente, ma non è un indirizzo email completo",
      SMTP_PASS: process.env.SMTP_PASS ? "presente" : "MANCANTE (avvisi disattivati)",
      NOTIFICA_EMAIL: !process.env.NOTIFICA_EMAIL ? "MANCANTE (avvisi disattivati)" : "presente",
    },
    social: {
      META_PAGE_ID: process.env.META_PAGE_ID ? "presente" : "MANCANTE (i post non si aggiornano)",
      META_PAGE_TOKEN: process.env.META_PAGE_TOKEN ? "presente" : "MANCANTE (i post non si aggiornano)",
    },
  };
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT || 465);
    try {
      const { default: nodemailer } = await import("nodemailer");
      await nodemailer.createTransport({ host: (process.env.SMTP_HOST || "smtps.aruba.it").trim(), port, secure: port === 465,
        auth: { user: String(process.env.SMTP_USER).trim(), pass: process.env.SMTP_PASS }, connectionTimeout: 7000, greetingTimeout: 7000, socketTimeout: 9000 }).verify();
      out.avvisi_email.accesso_aruba = "ok, la casella accetta l'invio";
    } catch (e) {
      out.avvisi_email.accesso_aruba = e.code === "EAUTH" ? "ERRORE: utente o password della casella non corretti" : "ERRORE: " + String(e.code || e.message || e).slice(0, 120);
    }
  }
  if (url && key) {
    const h = headers(key);
    const check = async (path) => {
      try { const r = await fetch(url + path, { headers: h }); const t = await r.text(); return r.ok ? "ok" : `errore ${r.status}: ${t.slice(0, 140)}`; }
      catch (e) { return "errore: " + String(e.message || e).slice(0, 140); }
    };
    out.tabelle = {};
    for (const t of ["richieste", "richieste_libro", "iscritti", "post_social", "staff", "articoli"]) out.tabelle[t] = await check(`/rest/v1/${t}?select=*&limit=1`);
    out.righe = {};
    for (const t of ["richieste", "richieste_libro", "iscritti", "articoli"]) {
      try {
        const r = await fetch(`${url}/rest/v1/${t}?select=id`, { headers: { ...h, Prefer: "count=exact", Range: "0-0" } });
        out.righe[t] = r.ok ? Number((r.headers.get("content-range") || "").split("/")[1] || 0) : "errore " + r.status;
      } catch (e) { out.righe[t] = "errore"; }
    }
    out.libro_pdf_su_storage = (await check("/storage/v1/object/info/libri/intelligenza-fiscale.pdf")) === "ok" ? "sì" : "no (si usa la copia nel sito)";
    try {
      const r = await fetch(`${url}/rest/v1/impostazioni?chiave=in.(social_sync,social_esito)&select=chiave,valore`, { headers: h });
      if (r.ok) for (const x of await r.json()) out.social[x.chiave === "social_sync" ? "ultimo_aggiornamento" : "esito"] = x.valore;
    } catch {}
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(out);
}
