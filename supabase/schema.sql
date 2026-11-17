-- Studio Longobardi · www.studiolongobardi.it
-- Database del sito. Da eseguire UNA volta nel progetto Supabase "studiolongobardi":
-- SQL Editor → New query → incolla tutto il file → Run.
-- Si può rieseguire senza danni: crea solo ciò che manca.

-- =====================================================================
-- 1. RICHIESTE DAL SITO (contatti, check-up, test)
-- =====================================================================
create table if not exists public.richieste (
  id                 bigint generated always as identity primary key,
  creata_il          timestamptz not null default now(),
  tipo               text not null default 'contatto' check (tipo in ('contatto','test')),
  nome               text not null,
  email              text,
  telefono           text,
  azienda            text,
  area               text not null default 'Altro',
  messaggio          text,
  dati               jsonb,                 -- risposte e punteggio del test
  consenso_privacy   boolean not null default false,
  consenso_marketing boolean not null default false,
  origine            text,
  stato              text not null default 'nuova' check (stato in ('nuova','in_lavorazione','chiusa'))
);
create index if not exists richieste_creata_il_idx on public.richieste (creata_il desc);
alter table public.richieste enable row level security;

-- =====================================================================
-- 2. LIBRO "INTELLIGENZA FISCALE" (download in cambio dell'email)
-- =====================================================================
create table if not exists public.richieste_libro (
  id               bigint generated always as identity primary key,
  creata_il        timestamptz not null default now(),
  nome             text not null,
  email            text not null unique,
  consenso_privacy boolean not null default false,
  download         integer not null default 1
);
alter table public.richieste_libro enable row level security;
insert into storage.buckets (id, name, public) values ('libri', 'libri', false) on conflict (id) do nothing;

-- =====================================================================
-- 3. ISCRITTI (avvisi Elevate, aggiornamenti del blog)
-- =====================================================================
create table if not exists public.iscritti (
  id          bigint generated always as identity primary key,
  creato_il   timestamptz not null default now(),
  email       text not null,
  lista       text not null check (lista in ('elevate','blog')),
  consenso    boolean not null default true,
  unique (email, lista)
);
alter table public.iscritti enable row level security;

-- =====================================================================
-- 4. POST SOCIAL (copiati in automatico da Instagram e Facebook)
-- =====================================================================
create table if not exists public.post_social (
  id            text primary key,              -- id del post su Meta
  rete          text not null check (rete in ('ig','fb')),
  tipo          text not null default 'foto',  -- foto, reel, carosello, video
  testo         text,
  immagine      text,                          -- copia dell'immagine su Supabase Storage (bucket "social")
  link          text not null,                 -- indirizzo del post originale
  pubblicato_il timestamptz not null,
  visibile      boolean not null default true  -- metti false per nascondere un post dal sito
);
create index if not exists post_social_data_idx on public.post_social (pubblicato_il desc);
alter table public.post_social enable row level security;

create table if not exists public.impostazioni (
  chiave text primary key,
  valore text,
  aggiornato_il timestamptz not null default now()
);
alter table public.impostazioni enable row level security;
insert into storage.buckets (id, name, public) values ('social', 'social', true) on conflict (id) do nothing;

-- =====================================================================
-- 5. BLOG: STAFF E ARTICOLI CON DOPPIA APPROVAZIONE
-- Ogni articolo va online solo quando lo approvano sia la direzione (Vito)
-- sia il marketing.
-- =====================================================================
create table if not exists public.staff (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  nome     text not null,
  qualifica text,                       -- es. "Consulente del Lavoro"
  foto     text,                        -- es. "img/andrea.jpg"
  ruolo    text not null default 'autore' check (ruolo in ('autore','direzione','marketing')),
  attivo   boolean not null default true
);
alter table public.staff enable row level security;

create or replace function public.mio_ruolo() returns text
language sql stable security definer set search_path = public as $$
  select ruolo from public.staff where user_id = auth.uid() and attivo
$$;
revoke all on function public.mio_ruolo() from public, anon;
grant execute on function public.mio_ruolo() to authenticated;

drop policy if exists "staff legge staff" on public.staff;
create policy "staff legge staff" on public.staff for select to authenticated
  using (public.mio_ruolo() is not null);

create table if not exists public.articoli (
  id             bigint generated always as identity primary key,
  slug           text not null unique,
  titolo         text not null,
  categoria      text not null default 'Fisco' check (categoria in ('Fisco','Lavoro','Controllo di gestione','Holding','Crescita')),
  sommario       text,
  corpo          text not null default '',      -- testo semplice: "## " sottotitolo, "- " elenco, **grassetto**
  immagine       text default 'img/colonnato.jpg',
  autore_id      uuid references auth.users(id) on delete set null,
  autore_nome    text not null,
  autore_ruolo   text,
  autore_foto    text,
  stato          text not null default 'bozza' check (stato in ('bozza','in_revisione','pubblicato','respinto')),
  ok_direzione   boolean not null default false,
  ok_marketing   boolean not null default false,
  nota_revisione text,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  pubblicato_il  timestamptz
);
create index if not exists articoli_pubblicati_idx on public.articoli (stato, pubblicato_il desc);
alter table public.articoli enable row level security;

-- Regole automatiche sugli articoli
create or replace function public.articoli_regole() returns trigger
language plpgsql set search_path = public as $$
declare r text := public.mio_ruolo();
begin
  new.aggiornato_il := now();
  -- dal SQL Editor o dalle funzioni del server (nessun utente collegato) le regole non si applicano
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.ok_direzione := false; new.ok_marketing := false; new.pubblicato_il := null;
    if new.stato not in ('bozza','in_revisione') then new.stato := 'bozza'; end if;
    return new;
  end if;
  -- solo direzione e marketing possono dare la propria approvazione
  if r is distinct from 'direzione' then new.ok_direzione := old.ok_direzione; end if;
  if r is distinct from 'marketing' then new.ok_marketing := old.ok_marketing; end if;
  -- se cambia il testo, le approvazioni ripartono da zero
  if (new.titolo, new.corpo, new.sommario, new.categoria, new.immagine) is distinct from
     (old.titolo, old.corpo, old.sommario, old.categoria, old.immagine) then
    new.ok_direzione := false; new.ok_marketing := false;
    if old.stato = 'pubblicato' then new.stato := 'in_revisione'; end if;
  end if;
  -- l'autore non può pubblicare da solo
  if new.stato = 'pubblicato' and not (new.ok_direzione and new.ok_marketing) then
    new.stato := case when old.stato = 'pubblicato' then 'in_revisione' else old.stato end;
  end if;
  -- doppia approvazione → online
  if new.ok_direzione and new.ok_marketing and new.stato in ('in_revisione','bozza','pubblicato') then
    new.stato := 'pubblicato';
    if new.pubblicato_il is null then new.pubblicato_il := now(); end if;
  end if;
  if new.stato = 'respinto' then new.ok_direzione := false; new.ok_marketing := false; end if;
  return new;
end $$;
drop trigger if exists articoli_regole on public.articoli;
create trigger articoli_regole before insert or update on public.articoli
  for each row execute function public.articoli_regole();

drop policy if exists "staff legge articoli" on public.articoli;
create policy "staff legge articoli" on public.articoli for select to authenticated
  using (public.mio_ruolo() is not null);
drop policy if exists "staff scrive articoli" on public.articoli;
create policy "staff scrive articoli" on public.articoli for insert to authenticated
  with check (public.mio_ruolo() is not null and autore_id = auth.uid());
drop policy if exists "autore modifica i suoi, approvatori tutti" on public.articoli;
create policy "autore modifica i suoi, approvatori tutti" on public.articoli for update to authenticated
  using (public.mio_ruolo() in ('direzione','marketing') or autore_id = auth.uid())
  with check (public.mio_ruolo() in ('direzione','marketing') or autore_id = auth.uid());
drop policy if exists "elimina bozze proprie o approvatori" on public.articoli;
create policy "elimina bozze proprie o approvatori" on public.articoli for delete to authenticated
  using (public.mio_ruolo() in ('direzione','marketing') or (autore_id = auth.uid() and stato in ('bozza','respinto')));

-- Immagini degli articoli (bucket pubblico "blog"): lo staff può caricarle
insert into storage.buckets (id, name, public) values ('blog', 'blog', true) on conflict (id) do nothing;
drop policy if exists "staff carica immagini blog" on storage.objects;
create policy "staff carica immagini blog" on storage.objects for insert to authenticated
  with check (bucket_id = 'blog' and public.mio_ruolo() is not null);
