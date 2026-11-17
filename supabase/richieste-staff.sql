-- Studio Longobardi · archivio richieste dentro l'area staff
-- Da eseguire UNA volta: SQL Editor → New query → incolla → Run. Si può rieseguire.
-- Chi vede le richieste: ruoli direzione, marketing e segreteria (nuovo ruolo, solo per gestire i contatti).

-- nuovo ruolo "segreteria"
alter table public.staff drop constraint if exists staff_ruolo_check;
alter table public.staff add constraint staff_ruolo_check check (ruolo in ('autore','direzione','marketing','segreteria'));

-- campi di lavoro sulle richieste
alter table public.richieste add column if not exists nota text;
alter table public.richieste add column if not exists gestita_da text;
alter table public.richieste add column if not exists aggiornata_il timestamptz;

create or replace function public.vede_richieste() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mio_ruolo() in ('direzione','marketing','segreteria'), false)
$$;
revoke all on function public.vede_richieste() from public, anon;
grant execute on function public.vede_richieste() to authenticated;

-- richieste: lettura e aggiornamento (stato, nota) per chi le gestisce; eliminazione solo direzione
drop policy if exists "gestione legge richieste" on public.richieste;
create policy "gestione legge richieste" on public.richieste for select to authenticated using (public.vede_richieste());
drop policy if exists "gestione aggiorna richieste" on public.richieste;
create policy "gestione aggiorna richieste" on public.richieste for update to authenticated using (public.vede_richieste()) with check (public.vede_richieste());
drop policy if exists "direzione elimina richieste" on public.richieste;
create policy "direzione elimina richieste" on public.richieste for delete to authenticated using (public.mio_ruolo() = 'direzione');

-- dalla pagina si possono cambiare solo stato e nota (non i dati lasciati dal cliente)
create or replace function public.richieste_modifica() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  new := jsonb_populate_record(old, jsonb_build_object('stato', new.stato, 'nota', new.nota));
  new.aggiornata_il := now();
  new.gestita_da := (select nome from public.staff where user_id = auth.uid());
  return new;
end $$;
drop trigger if exists richieste_modifica on public.richieste;
create trigger richieste_modifica before update on public.richieste for each row execute function public.richieste_modifica();

-- libro e iscritti: sola lettura per chi gestisce; eliminazione solo direzione (es. richiesta di cancellazione)
drop policy if exists "gestione legge libro" on public.richieste_libro;
create policy "gestione legge libro" on public.richieste_libro for select to authenticated using (public.vede_richieste());
drop policy if exists "direzione elimina libro" on public.richieste_libro;
create policy "direzione elimina libro" on public.richieste_libro for delete to authenticated using (public.mio_ruolo() = 'direzione');
drop policy if exists "gestione legge iscritti" on public.iscritti;
create policy "gestione legge iscritti" on public.iscritti for select to authenticated using (public.vede_richieste());
drop policy if exists "direzione elimina iscritti" on public.iscritti;
create policy "direzione elimina iscritti" on public.iscritti for delete to authenticated using (public.mio_ruolo() = 'direzione');
