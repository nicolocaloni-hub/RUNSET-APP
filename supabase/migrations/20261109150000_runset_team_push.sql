-- Colori fissi dei runner, orario di convocazione con avviso di ritardo,
-- assistenti di produzione invitati per email, notifiche push.

-- ---------------------------------------------------------------------------
-- Colore fisso per runner: assegnato alla creazione, non cambia più.
-- ---------------------------------------------------------------------------

alter table public.people add column color text check (color ~ '^#[0-9A-F]{6}$');

create function private.assign_runner_color() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_palette text[] := array['#FF5B1F', '#2563EB', '#DB2777', '#CA8A04', '#0891B2', '#65A30D', '#7C3AED', '#DC2626'];
  v_used text[];
  v_color text;
begin
  if new.category <> 'RUNNER' or new.color is not null then
    return new;
  end if;
  select coalesce(array_agg(color), '{}') into v_used
  from public.people where production_id = new.production_id and category = 'RUNNER';
  select c into v_color from unnest(v_palette) with ordinality as p(c, i)
  where c <> all (v_used) order by i limit 1;
  new.color := coalesce(v_color, v_palette[1 + cardinality(v_used) % cardinality(v_palette)]);
  return new;
end;
$$;
create trigger people_runner_color before insert on public.people
  for each row execute function private.assign_runner_color();

-- Runner già esistenti: stesso ordine (per id) usato finora dall'app.
update public.people p set color = (array['#FF5B1F', '#2563EB', '#DB2777', '#CA8A04', '#0891B2', '#65A30D', '#7C3AED', '#DC2626'])[1 + (r.n - 1) % 8]
from (select id, row_number() over (partition by production_id order by id) as n
      from public.people where category = 'RUNNER') r
where p.id = r.id;

-- ---------------------------------------------------------------------------
-- Orario di convocazione e avviso di ritardo.
-- ---------------------------------------------------------------------------

alter table public.people add column pickup_time time;
alter table public.people add constraint people_pickup_time_check check (category <> 'RUNNER' or pickup_time is null);
grant insert (pickup_time), update (pickup_time) on public.people to authenticated;

alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check
  check (type in ('PICKUP', 'UNDO', 'ALERT', 'SET', 'DAY', 'ARRIVING', 'LATE'));

-- Ogni minuto: chi deve essere recuperato entro 10 minuti e il suo runner non è
-- entro 1 km (o non condivide il GPS) genera un evento LATE, una volta per giornata.
-- shortcut: orari in fuso Europe/Rome e senza scavalcare la mezzanotte; aggiungere un fuso per produzione se servirà all'estero.
create function private.check_late() returns void
language sql security definer set search_path = '' as $$
  insert into public.events(production_id, type, data, runner_id, person_id)
  select p.production_id, 'LATE',
         jsonb_build_object('person', p.name, 'runner', r.name, 'time', to_char(p.pickup_time, 'HH24:MI'),
                            'meters', case when l.live then round(private.distance_m(rp.lat, rp.lng, p.lat, p.lng))::int end,
                            'day', pr.day_number),
         r.id, p.id
  from public.people p
  join public.productions pr on pr.id = p.production_id
  join public.people r on r.id = p.assigned_runner_id
  left join public.runner_positions rp on rp.runner_id = r.id
  cross join lateral (
    select coalesce(rp.sharing and rp.lat is not null and rp.updated_at > now() - interval '2 minutes', false) as live
  ) l
  where p.pickup_time is not null
    and (now() at time zone 'Europe/Rome')::time between p.pickup_time - interval '10 minutes' and p.pickup_time
    and not (l.live and private.distance_m(rp.lat, rp.lng, p.lat, p.lng) <= 1000)
    and not exists (
      select 1 from public.pickups pk
      where pk.person_id = p.id and pk.day_number = pr.day_number and pk.undone_at is null)
    and not exists (
      select 1 from public.events e
      where e.person_id = p.id and e.type = 'LATE' and (e.data ->> 'day')::int = pr.day_number);
$$;
revoke execute on function private.check_late() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('runset-check-late', '* * * * *', 'select private.check_late()');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assistenti di produzione: il produttore invita un'email; chi accede con
-- quell'email (confermata: "Confirm email" è attivo) diventa produttore della
-- produzione. Solo chi l'ha creata può eliminarla.
-- ---------------------------------------------------------------------------

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  created_at timestamptz not null default now(),
  unique (production_id, email)
);
alter table public.staff_invites enable row level security;
revoke all on public.staff_invites from anon, authenticated;
grant select, delete on public.staff_invites to authenticated;
create policy staff_invites_select on public.staff_invites for select to authenticated
  using (private.is_producer(production_id));
create policy staff_invites_delete on public.staff_invites for delete to authenticated
  using (private.is_producer(production_id));

drop policy productions_delete on public.productions;
create policy productions_delete on public.productions for delete to authenticated
  using (created_by = auth.uid() and private.is_producer(id));

create function public.invite_staff(p_production uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_producer(p_production) or private.is_anonymous() then
    raise exception 'producer_required' using errcode = '42501';
  end if;
  if (select count(*) from public.staff_invites where production_id = p_production) >= 10 then
    raise exception 'staff_limit' using errcode = '22023';
  end if;
  insert into public.staff_invites(production_id, email)
  values (p_production, lower(btrim(p_email)))
  on conflict (production_id, email) do nothing;
exception when check_violation then
  raise exception 'invalid_email' using errcode = '22023';
end;
$$;

-- Chiamata dall'app a ogni accesso del produttore.
create function public.claim_staff_invites()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_count integer;
begin
  if auth.uid() is null or private.is_anonymous() or coalesce(v_email, '') = '' then
    return 0;
  end if;
  insert into public.members(production_id, user_id, role)
  select production_id, auth.uid(), 'producer' from public.staff_invites where email = v_email
  on conflict (production_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  delete from public.staff_invites where email = v_email;
  return v_count;
end;
$$;

create function public.list_staff(p_production uuid)
returns table (user_id uuid, email text, is_owner boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_producer(p_production) then
    raise exception 'producer_required' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.user_id = pr.created_by
    from public.members m
    join auth.users u on u.id = m.user_id
    join public.productions pr on pr.id = m.production_id
    where m.production_id = p_production and m.role = 'producer'
    order by m.created_at;
end;
$$;

create function public.remove_staff(p_production uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_producer(p_production) then
    raise exception 'producer_required' using errcode = '42501';
  end if;
  if exists (select 1 from public.productions where id = p_production and created_by = p_user) then
    raise exception 'owner_cannot_leave' using errcode = '22023';
  end if;
  delete from public.members where production_id = p_production and user_id = p_user and role = 'producer';
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifiche push: le iscrizioni dei produttori; a ogni evento importante il
-- database chiama /api/push (Vercel) che le invia con le chiavi VAPID.
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  lang text not null default 'it' check (lang in ('it', 'en')),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_lang text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_anonymous() then
    raise exception 'producer_account_required' using errcode = '42501';
  end if;
  insert into public.push_subscriptions(endpoint, user_id, p256dh, auth, lang)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, case when p_lang = 'en' then 'en' else 'it' end)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang;
  -- Al massimo 10 dispositivi per utente: i più vecchi escono.
  delete from public.push_subscriptions where endpoint in (
    select endpoint from public.push_subscriptions where user_id = auth.uid()
    order by created_at desc offset 10);
end;
$$;

create function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end;
$$;

create function private.push_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
  v_subs jsonb;
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'net' and p.proname = 'http_post'
  ) then
    return new;
  end if;
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'lang', s.lang))
  into v_subs
  from public.push_subscriptions s
  join public.members m on m.user_id = s.user_id
  where m.production_id = new.production_id and m.role = 'producer';
  if v_subs is null then
    return new;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'runset_push_secret';
  if v_secret is null then
    return new;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
  using 'https://fkgyrjmgyipazskqnxwd.supabase.co/functions/v1/push',
        jsonb_build_object('event', jsonb_build_object('id', new.id, 'type', new.type, 'data', new.data), 'subs', v_subs),
        jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret);
  return new;
exception when others then
  -- Una notifica persa non deve mai bloccare un recupero o una segnalazione.
  return new;
end;
$$;
create trigger events_push after insert on public.events
  for each row when (new.type in ('PICKUP', 'ARRIVING', 'ALERT', 'LATE'))
  execute function private.push_event();

revoke execute on function private.assign_runner_color(), private.push_event() from public, anon, authenticated;
revoke execute on function public.invite_staff(uuid, text), public.claim_staff_invites(), public.list_staff(uuid),
  public.remove_staff(uuid, uuid), public.save_push_subscription(text, text, text, text),
  public.delete_push_subscription(text) from public, anon;
grant execute on function public.invite_staff(uuid, text), public.claim_staff_invites(), public.list_staff(uuid),
  public.remove_staff(uuid, uuid), public.save_push_subscription(text, text, text, text),
  public.delete_push_subscription(text) to authenticated;
