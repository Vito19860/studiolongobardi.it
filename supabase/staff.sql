-- Studio Longobardi · chi può entrare nell'area staff del blog
-- Da eseguire DOPO aver invitato le persone (Authentication → Users → Invite user).
-- Si può rieseguire: aggiorna i dati senza duplicare.
-- Per aggiungere un autore: copia un blocco, cambia email, nome, qualifica, foto e metti ruolo 'autore'.

-- Direzione: approva gli articoli
insert into public.staff (user_id, nome, qualifica, foto, ruolo)
select id, 'Vito Longobardi', 'Fondatore · Fisco e strategia', 'img/vito.jpg', 'direzione'
from auth.users where lower(email) = 'vito@studiolongobardi.it'
on conflict (user_id) do update set nome = excluded.nome, qualifica = excluded.qualifica, foto = excluded.foto, ruolo = excluded.ruolo, attivo = true;

-- Marketing: approva gli articoli
insert into public.staff (user_id, nome, qualifica, foto, ruolo)
select id, 'Marketing', 'Studio Longobardi', null, 'marketing'
from auth.users where lower(email) = 'marketing@studiolongobardi.it'
on conflict (user_id) do update set nome = excluded.nome, qualifica = excluded.qualifica, ruolo = excluded.ruolo, attivo = true;

-- Controllo: deve mostrare 2 righe
select s.nome, s.ruolo, u.email from public.staff s join auth.users u on u.id = s.user_id order by s.ruolo;
