// Strumenti comuni alle funzioni del sito (i file che iniziano con "_" non sono pubblici).

export const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
export const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export function body(req) {
  let b = req.body || {};
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === "object" ? b : {};
}

export function config() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, key, ok: Boolean(url && key) };
}

export function headers(key, extra = {}) {
  return {
    apikey: key,
    // le chiavi "legacy" (JWT, iniziano con eyJ) vanno anche in Authorization; le nuove sb_secret_ solo in apikey
    ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
    "Content-Type": "application/json",
    ...extra,
  };
}

// chiamata al database con la chiave del server
export async function db(path, { method = "GET", body: b, prefer } = {}) {
  const { url, key } = config();
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: headers(key, prefer ? { Prefer: prefer } : {}),
    ...(b !== undefined ? { body: JSON.stringify(b) } : {}),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data, text };
}

export function soloPost(req, res) {
  if (req.method === "POST") return false;
  res.setHeader("Allow", "POST");
  res.status(405).json({ error: "Metodo non consentito" });
  return true;
}
