// Disegna la pagina di un articolo lato server (stesso aspetto delle schede del sito).
// Le funzioni sono le stesse usate nel browser in sorgente/sito.html.

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const inl = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
export function testo(t) {
  const out = []; let li = null;
  String(t || "").split(/\r?\n/).forEach((l) => {
    l = l.trim();
    if (/^[-•]\s+/.test(l)) { (li = li || []).push('<li style="margin-bottom: 8px">' + inl(l.replace(/^[-•]\s+/, "")) + "</li>"); return; }
    if (li) { out.push('<ul style="margin: 0 0 22px; padding-left: 22px">' + li.join("") + "</ul>"); li = null; }
    if (!l) return;
    if (/^##\s+/.test(l)) out.push('<h2 class="mont" style="margin: 38px 0 14px; font-size: 24px; font-weight: 800; line-height: 1.25; color: #0F2C5C">' + inl(l.replace(/^##\s+/, "")) + "</h2>");
    else out.push('<p style="margin: 0 0 22px">' + inl(l) + "</p>");
  });
  if (li) out.push('<ul style="margin: 0 0 22px; padding-left: 22px">' + li.join("") + "</ul>");
  return out.join("");
}
export const imgOk = (u) => (/^(img\/[\w.-]+|https:\/\/[^"'\s]+)$/.test(u || "") ? u : "img/colonnato.jpg");
export const data = (d) => { const t = new Date(d); return isNaN(t) ? "" : t.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }); };
export const slug = (a) => String(a.slug).replace(/[^a-z0-9-]/g, "");
function avatar(a, n) {
  if (/^img\/[\w.-]+$/.test(a.autore_foto || "")) return '<img src="' + esc(a.autore_foto) + '" alt="" style="width: ' + n + "px; height: " + n + "px; flex: none; border-radius: 50%; object-fit: cover; object-position: center 22%" + (n > 40 ? "; border: 2px solid #D4A24C" : "") + '">';
  const ini = String(a.autore_nome || "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  return '<span aria-hidden="true" class="mont" style="width: ' + n + "px; height: " + n + "px; flex: none; border-radius: 50%; background: #D4A24C; color: #0A1F44; display: inline-flex; align-items: center; justify-content: center; font-size: " + Math.round(n * 0.36) + 'px; font-weight: 800">' + esc(ini) + "</span>";
}
function scheda(a, k) {
  return '<a href="/approfondimenti/' + slug(a) + '" class="card d' + (k % 3 + 1) + '" style="text-decoration: none; background: #FFFFFF; border-radius: 2px; overflow: hidden; display: flex; flex-direction: column">'
    + '<div class="zoom" style="height: 190px"><img src="' + esc(imgOk(a.immagine)) + '" alt="" loading="lazy" style="display: block; width: 100%; height: 100%; object-fit: cover"></div>'
    + '<div style="padding: 24px; display: flex; flex-direction: column; gap: 10px; flex: 1"><span class="mont up" style="font-size: 11px; font-weight: 800; letter-spacing: .16em; color: #9A6F1E">' + esc(a.categoria) + '</span><span class="mont" style="font-size: 20px; font-weight: 700; line-height: 1.25; color: #0F2C5C">' + esc(a.titolo) + '</span><span style="font-size: 15px; color: #5E6B85">' + esc(a.sommario || "") + "</span>"
    + '<span style="margin-top: auto; padding-top: 8px; display: flex; align-items: center; gap: 10px; font-size: 13px; color: #5E6B85">' + avatar(a, 30) + esc(a.autore_nome) + " · " + data(a.pubblicato_il) + "</span></div></a>";
}
export function articolo(a, altri) {
  const minuti = Math.max(2, Math.round(String(a.corpo || "").split(/\s+/).length / 200));
  return '<article class="view" id="view-articolo-' + slug(a) + '">'
    + '<div style="position: relative; overflow: hidden; background: #0A1F44; color: #FFFFFF"><img src="' + esc(imgOk(a.immagine)) + '" alt="" aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .35"><div aria-hidden="true" style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,31,68,.55), rgba(10,31,68,.95))"></div>'
    + '<div class="wrap" style="position: relative; max-width: 900px; padding-top: 90px; padding-bottom: 70px; display: flex; flex-direction: column; gap: 18px"><a href="/approfondimenti" style="font-size: 14px; color: #E9BE6E; text-decoration: none">← Tutti gli approfondimenti</a>'
    + '<span class="mont up" style="font-size: 12px; font-weight: 800; letter-spacing: .16em; color: #E9BE6E">' + esc(a.categoria) + '</span><h1 class="mont" style="margin: 0; font-size: 48px; font-weight: 800; line-height: 1.08">' + esc(a.titolo) + "</h1>"
    + '<span style="display: flex; align-items: center; gap: 12px; font-size: 15px; color: #D3DDEE">' + avatar(a, 46) + '<span><b style="color: #FFFFFF">' + esc(a.autore_nome) + "</b><br>" + (a.autore_ruolo ? esc(a.autore_ruolo) + " · " : "") + '<time datetime="' + esc(a.pubblicato_il) + '">' + data(a.pubblicato_il) + "</time> · " + minuti + " minuti di lettura</span></span></div></div>"
    + '<div style="background: #FFFFFF; color: #3A4762"><div class="wrap" style="max-width: 900px; padding-top: 64px; padding-bottom: 80px">'
    + (a.sommario ? '<p style="margin: 0 0 28px; font-size: 22px; line-height: 1.5; color: #0F2C5C; font-weight: 500">' + esc(a.sommario) + "</p>" : "")
    + '<div style="font-size: 18px; line-height: 1.8">' + testo(a.corpo) + "</div>"
    + '<div style="margin-top: 20px; padding: 28px; background: #F3F6FB; border-left: 4px solid #D4A24C; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px"><span class="mont" style="font-size: 20px; font-weight: 700; color: #0F2C5C">Vuoi capire cosa significa per la tua impresa?</span><a href="/contatti" class="btn btn-gold">Richiedi un check-up</a></div></div></div>'
    + (altri.length ? '<div style="background: #F3F6FB; color: #3A4762"><div class="wrap" style="padding-top: 70px; padding-bottom: 90px; display: flex; flex-direction: column; gap: 28px"><span class="mont up" style="font-size: 13px; font-weight: 800; letter-spacing: .16em; color: #9A6F1E">Leggi anche</span><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 22px">' + altri.map(scheda).join("") + "</div></div></div>" : "")
    + "</article>";
}
