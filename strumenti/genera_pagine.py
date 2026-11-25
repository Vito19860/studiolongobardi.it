#!/usr/bin/env python3
"""Genera le pagine del sito dello studio da un unico sorgente: sorgente/sito.html.

    python3 strumenti/genera_pagine.py

Scrive:
  index.html                          la home (solo la home, senza le altre sezioni)
  lo-studio.html, contatti.html, ...  una pagina vera per ogni sezione, con titolo e descrizione propri
  servizi/*.html                      una pagina per ogni servizio
  api/_modelli/articolo.html          il modello che /api/articolo riempie con l'articolo letto dal database

Si modifica SEMPRE sorgente/sito.html (o questo file), poi si rilancia lo script.
I vecchi indirizzi con # (es. /#holding, /#articolo-holding) portano alla pagina nuova.
"""
import json
import os
import re
import sys

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITO = "https://www.studiolongobardi.it"

# id della sezione nel sorgente -> (indirizzo, titolo per Google, descrizione per Google)
PAGINE = {
    "lo-studio": ("/lo-studio", "Lo studio · Studio Longobardi, commercialisti e consulenti del lavoro a Gragnano",
                  "Sedici professionisti e oltre 500 clienti: fisco, lavoro, controllo di gestione e holding seguiti da un'unica squadra. Conosci lo Studio Longobardi di Gragnano (NA)."),
    "fiscale": ("/servizi/fiscale-contabilita", "Consulenza fiscale e contabilità a Gragnano (NA) · Studio Longobardi",
                "Contabilità, dichiarazioni e pianificazione fiscale per imprese, SRL e professionisti: analizziamo numeri e struttura per farti pagare il giusto, nel rispetto delle regole."),
    "lavoro": ("/servizi/lavoro-paghe", "Consulenza del lavoro e paghe a Gragnano (NA) · Studio Longobardi",
               "Buste paga, contratti, assunzioni, welfare aziendale e incentivi: lo Studio Longobardi segue la gestione del personale della tua impresa."),
    "controllo": ("/servizi/controllo-di-gestione", "Controllo di gestione e piano finanziario per PMI · Studio Longobardi",
                  "Budget, margini, flussi di cassa e indicatori: il controllo di gestione per conoscere i tuoi numeri e guidare l'impresa con decisioni migliori."),
    "holding": ("/servizi/consulenza-holding", "Consulenza holding e protezione del patrimonio · Studio Longobardi",
                "Costituzione e gestione della holding, governance, controllo e protezione del patrimonio dell'imprenditore e della famiglia."),
    "formazione": ("/servizi/formazione", "Corsi di formazione per imprenditori: fisco, lavoro, piani finanziari · Studio Longobardi",
                   "Corsi pratici su fisco, lavoro e piani finanziari, con casi reali e strumenti da usare il giorno dopo. La formazione dello Studio Longobardi."),
    "elevate": ("/elevate", "Elevate · L'evento dello Studio Longobardi per imprenditori",
                "Elevate: la serata su fisco, numeri, holding, protezione del patrimonio e persone, con Vito Longobardi. Rivivi l'edizione 2026 e scopri Elevate 2027."),
    "contatti": ("/contatti", "Contatti · Studio Longobardi, Via Castellammare 71, Gragnano (NA)",
                 "Richiedi una consulenza allo Studio Longobardi: Via Castellammare 71, Gragnano (NA). Tel. 081 801 1388, dal lunedì al venerdì dalle 9 alle 19:30."),
    "blog": ("/approfondimenti", "Approfondimenti fiscali e del lavoro · Il blog dello Studio Longobardi",
             "Articoli, novità e scadenze su fisco, lavoro, holding e incentivi, scritti dai professionisti dello Studio Longobardi."),
    "privacy": ("/privacy", "Privacy policy · Studio Longobardi", "Informativa sul trattamento dei dati personali di www.studiolongobardi.it."),
    "cookie": ("/cookie", "Cookie policy · Studio Longobardi", "Quali cookie e strumenti usa www.studiolongobardi.it e come gestire le tue preferenze."),
    "note-legali": ("/note-legali", "Note legali · Studio Longobardi", "Informazioni societarie di ADVANCE STP S.r.l., che opera con il marchio Studio Longobardi."),
}
NON_INDICIZZARE = {"privacy", "cookie", "note-legali"}
# vecchi # che non sono più sezioni: dove portano
ALTRI = {"accedi": "/staff"}

DATI_STUDIO = {
    "@context": "https://schema.org",
    "@type": "AccountingService",
    "@id": SITO + "/#studio",
    "name": "Studio Longobardi",
    "legalName": "ADVANCE STP S.r.l.",
    "description": "Studio di consulenza fiscale, del lavoro e d'impresa a Gragnano (NA): fiscale e contabilità, lavoro e paghe, controllo di gestione, consulenza holding e formazione.",
    "url": SITO + "/",
    "logo": SITO + "/img/logo-chiaro.png",
    "image": SITO + "/img/condivisione.jpg",
    "telephone": "+39 081 801 1388",
    "email": "info@studiolongobardi.it",
    "vatID": "IT08187871218",
    "address": {"@type": "PostalAddress", "streetAddress": "Via Castellammare 71", "addressLocality": "Gragnano",
                "postalCode": "80054", "addressRegion": "NA", "addressCountry": "IT"},
    "areaServed": ["Gragnano", "Castellammare di Stabia", "Provincia di Napoli", "Campania"],
    "openingHoursSpecification": [{"@type": "OpeningHoursSpecification",
                                   "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                                   "opens": "09:00", "closes": "19:30"}],
    "sameAs": ["https://www.instagram.com/studiolongobardi/", "https://www.facebook.com/studiolongobardi1/"],
    "founder": {"@type": "Person", "name": "Vito Longobardi"},
}


def leggi(p):
    with open(os.path.join(RADICE, p), encoding="utf-8") as f:
        return f.read()


def scrivi(p, testo):
    p = os.path.join(RADICE, p)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(testo)


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def sostituisci_una(s, vecchio, nuovo):
    if s.count(vecchio) != 1:
        sys.exit(f"Non trovo (una sola volta) nel sorgente: {vecchio[:80]!r}")
    return s.replace(vecchio, nuovo)


def meta(s, titolo, descrizione, url, indicizza=True):
    s = re.sub(r"<title>[^<]*</title>", f"<title>{esc(titolo)}</title>", s, count=1)
    s = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(descrizione)}">', s, count=1)
    s = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{esc(titolo)}">', s, count=1)
    s = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{esc(descrizione)}">', s, count=1)
    s = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{SITO}{url}">', s, count=1)
    s = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{SITO}{url}">', s, count=1)
    if not indicizza:
        s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, follow">', 1)
    return s


def main():
    src = leggi("sorgente/sito.html")

    # 1. Tutti i percorsi relativi (img/, fonts/) partono dalla radice, anche dalle pagine in /servizi/.
    #    Un link "#test" da una pagina interna porta a "/#test", cioè alla sezione della home.
    src = sostituisci_una(src, '<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="/">')
    # 2. Dati dello studio leggibili da Google (indirizzo, orari, telefono).
    ld = json.dumps(DATI_STUDIO, ensure_ascii=False, separators=(",", ":"))
    src = sostituisci_una(src, "</head>", f'<script type="application/ld+json">{ld}</script>\n</head>')

    # 3. Link interni: dal vecchio # all'indirizzo vero.
    for vid, (url, _, _) in PAGINE.items():
        src = src.replace(f'href="#{vid}"', f'href="{url}"')
    for vid, url in ALTRI.items():
        src = src.replace(f'href="#{vid}"', f'href="{url}"')
    src = re.sub(r'href="#articolo-([a-z0-9-]+)"', r'href="/approfondimenti/\1"', src)
    src = src.replace("'<a href=\"#articolo-'+slug(a)+'\"", "'<a href=\"/approfondimenti/'+slug(a)+'\"")  # schede create dal JS
    if 'href="#articolo-' in src or "href=\"#articolo-'" in src:
        sys.exit("Sono rimasti link #articolo- da convertire")

    # 4. Separa le sezioni.
    sezioni = {m.group(1): m for m in re.finditer(r'<section class="view" id="view-([a-z0-9-]+)" hidden>.*?</section>\n?', src, re.S)}
    home = re.search(r'<main id="view-home">.*?</main>\n?', src, re.S)
    if not home or not all(k in sezioni for k in PAGINE):
        sys.exit("Struttura del sorgente cambiata: mancano la home o alcune sezioni")

    def senza(testo, tenere=None):
        """Toglie dalla pagina tutte le sezioni (e la home) tranne quella da tenere."""
        out, pos = [], 0
        blocchi = sorted([home] + list(sezioni.values()), key=lambda m: m.start())
        for m in blocchi:
            out.append(testo[pos:m.start()])
            if tenere is not None and m is tenere:
                blocco = m.group(0)
                if m is not home:
                    blocco = blocco.replace(" hidden>", ">", 1)
                out.append(blocco)
            pos = m.end()
        out.append(testo[pos:])
        return "".join(out)

    # 5. Home.
    scrivi("index.html", senza(src, home))
    pagine = ["/"]

    # 6. Una pagina per sezione.
    for vid, (url, titolo, descr) in PAGINE.items():
        pagina = meta(senza(src, sezioni[vid]), titolo, descr, url, vid not in NON_INDICIZZARE)
        pagina = pagina.replace("<body", f'<body data-pagina="{vid}"', 1)
        scrivi(url.lstrip("/") + ".html", pagina)
        if vid not in NON_INDICIZZARE:
            pagine.append(url)

    # 7. Modello per le pagine degli articoli (riempito da /api/articolo).
    modello = senza(src, None)
    modello = modello.replace("<body", '<body data-pagina="articolo"', 1)
    modello = re.sub(r"<title>[^<]*</title>", "<title>__TITOLO__</title>", modello, count=1)
    modello = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="__DESCRIZIONE__">', modello, count=1)
    modello = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="__TITOLO__">', modello, count=1)
    modello = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="__DESCRIZIONE__">', modello, count=1)
    modello = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="__URL__">', modello, count=1)
    modello = re.sub(r'<meta property="og:image" content="[^"]*">', '<meta property="og:image" content="__IMMAGINE__">', modello, count=1)
    modello = re.sub(r'<meta property="og:type" content="[^"]*">', '<meta property="og:type" content="article">', modello, count=1)
    modello = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="__URL__">', modello, count=1)
    modello = sostituisci_una(modello, "</head>", "<!--DATI_ARTICOLO-->\n</head>")
    # l'articolo va dove stavano le sezioni, cioè subito dopo la chiusura dell'intestazione
    i = modello.index("<!-- FOOTER -->")
    modello = modello[:i] + "<!--ARTICOLO-->\n" + modello[i:]
    scrivi("api/_modelli/articolo.html", modello)

    scrivi("api/_modelli/pagine.json", json.dumps(pagine, indent=1) + "\n")
    print("Pagine generate:", ", ".join(pagine), "+ modello articoli")


if __name__ == "__main__":
    main()
