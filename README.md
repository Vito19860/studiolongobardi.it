# Studio Longobardi · www.studiolongobardi.it

Sito dello studio (ADVANCE STP S.r.l.). È **separato** dal sito personale www.vitolongobardi.it.

- **GitHub**: il codice. Ogni modifica su `main` va online da sola.
- **Vercel**: pubblica il sito ed esegue le funzioni in `api/`.
- **Supabase** (progetto `studiolongobardi`): richieste, iscritti, post social, blog e accessi dello staff.

## Cosa c'è

```
index.html                  il sito (home + pagine interne, raggiunte con #lo-studio, #fiscale, #blog, …)
staff.html                  area staff (www.studiolongobardi.it/staff): login, editor articoli, approvazioni
img/  fonts/                foto e caratteri (ospitati qui: nessuna richiesta a Google)
download/                   copia di riserva del PDF di Intelligenza Fiscale
api/richiesta.js            form contatti e check-up dal test → tabella "richieste" + email allo studio
api/iscrizione.js           "Avvisami" Elevate e aggiornamenti blog → tabella "iscritti"
api/libro.js                download del libro → tabella "richieste_libro" + link temporaneo 24 h
api/social.js               post di Instagram e Facebook → tabella "post_social" (immagini copiate su Storage)
api/articoli.js             articoli pubblicati del blog
api/avviso.js               email del blog: "da approvare" a direzione e marketing, "online"/"da rivedere" all'autore
api/config.js               dati pubblici per l'area staff
api/stato.js                diagnostica: www.studiolongobardi.it/diagnostica
supabase/schema.sql         database (tabelle, regole di sicurezza, doppia approvazione)
supabase/articoli-iniziali.sql  i 7 articoli dal giornale dello studio
supabase/staff.sql          chi entra nell'area staff (direzione, marketing)
supabase/richieste-staff.sql  archivio richieste dentro /staff (ruoli direzione, marketing, segreteria)
```

## Messa online (una volta sola)

### 1. Supabase
1. Progetto `studiolongobardi`, regione Europe.
2. **SQL Editor → New query**: incolla `supabase/schema.sql` → **Run**. Poi, in una nuova query, `supabase/articoli-iniziali.sql` → **Run**.
3. **Storage → libri**: carica `intelligenza-fiscale.pdf` (facoltativo: se manca si usa la copia nel sito).
4. **Authentication → Sign In / Providers**: disattiva **Allow new users to sign up** (gli account dello staff si creano solo su invito).
5. **Authentication → URL Configuration**: Site URL `https://www.studiolongobardi.it`, e tra i Redirect URLs aggiungi `https://www.studiolongobardi.it/staff` e l'indirizzo provvisorio di Vercel seguito da `/staff`.
6. **Project Settings → API Keys**: copia il Project URL, la chiave **publishable** (o *anon*) e la chiave **secret** (o *service_role*).

### 2. Vercel
1. **Add New → Project** → importa `studiolongobardi.it`. Framework **Other**, nessun comando di build.
2. **Environment Variables**:

| Nome | Valore |
|---|---|
| `SUPABASE_URL` | Project URL (https://….supabase.co) |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave secret / service_role (solo qui, mai nel sito) |
| `SUPABASE_ANON_KEY` | chiave publishable / anon |
| `SMTP_USER`, `SMTP_PASS` | casella Aruba che invia gli avvisi |
| `NOTIFICA_EMAIL` | vito@studiolongobardi.it (richieste dal sito e articoli da approvare) |
| `MARKETING_EMAIL` | marketing@studiolongobardi.it (articoli da approvare) |
| `META_PAGE_ID`, `META_PAGE_TOKEN` | pagina Facebook dello studio e suo token (vedi punto 4) |
| `CRON_SECRET` | una parola lunga a caso: protegge l'aggiornamento forzato dei post |

3. **Deploy**. Poi apri `…vercel.app/diagnostica`: tutte le voci devono dire *presente* / *ok*.
4. **Settings → Spend Management**: stesso budget e "Pause production deployment" del sito personale.

### 3. Staff del blog
1. Dopo il primo deploy su Vercel (l'invito porta alla pagina /staff, che deve esistere). Supabase → **Authentication → Users → Invite user**: un invito per ogni persona (riceve l'email, sceglie la password su /staff).
2. **SQL Editor**: esegui `supabase/staff.sql` (Vito = direzione, marketing@ = marketing). Per altri autori copia un blocco del file e metti ruolo `autore`.

Un articolo va online solo con **entrambe** le approvazioni (direzione + marketing). Se il testo cambia, le approvazioni ripartono.

### 4. Instagram e Facebook
Serve un'app su developers.facebook.com collegata alla pagina dello studio (Instagram professionale già collegato alla pagina).
Con lo strumento **Graph API Explorer**: token utente con i permessi `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `business_management` → estenderlo (Access Token Debugger → *Extend*) → chiamare `me/accounts`: lì ci sono `id` della pagina (`META_PAGE_ID`) e il suo `access_token` permanente (`META_PAGE_TOKEN`).
I post si aggiornano da soli (ogni 30 minuti al massimo, e ogni mattina alle 7). Per nascondere un post: tabella `post_social`, colonna `visibile` = false.

### 5. Dominio (solo alla fine)
Vercel → **Settings → Domains**: `studiolongobardi.it` e `www.studiolongobardi.it`. Poi su Aruba i record DNS indicati da Vercel.

## Dove leggere i dati
Area staff → **Richieste** (stato, note, export Excel). In alternativa Supabase → **Table Editor**: `richieste` (contatti e test, colonna `stato`), `richieste_libro`, `iscritti`, `articoli`, `post_social`.
