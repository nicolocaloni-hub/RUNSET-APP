-- RunSet: schema iniziale su Supabase.
-- Ogni produzione è isolata dalla RLS. Le scritture sensibili passano da funzioni
-- SECURITY DEFINER che controllano ruolo e appartenenza prima di agire.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table public.productions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  producer_name text not null check (char_length(btrim(producer_name)) between 1 and 120),
  producer_phone text not null default '' check (char_length(producer_phone) <= 40),
  -- Contatore della giornata di lavorazione: "Nuova giornata" lo incrementa e
  -- azzera i recuperi senza cancellare lo storico.
  day_number integer not null default 1 check (day_number >= 1),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  category text not null check (category in ('RUNNER', 'ACTOR', 'TROUPE')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  role text not null default '' check (char_length(role) <= 100),
  phone text not null default '' check (char_length(phone) <= 40),
  address text not null default '' check (char_length(address) <= 500),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  assigned_runner_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  -- I runner non hanno un punto fisso: la loro posizione arriva dal GPS.
  check (category = 'RUNNER' or lat is not null),
  check (category <> 'RUNNER' or assigned_runner_id is null)
);
create index people_production_idx on public.people(production_id);
create index people_assigned_idx on public.people(assigned_runner_id);

create table public.members (
  production_id uuid not null references public.productions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('producer', 'runner')),
  person_id uuid unique references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (production_id, user_id),
  check ((role = 'producer') = (person_id is null))
);
create index members_user_idx on public.members(user_id);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text not null default '' check (char_length(address) <= 500),
  manager_name text not null default '' check (char_length(manager_name) <= 120),
  phone text not null default '' check (char_length(phone) <= 40),
  note text not null default '' check (char_length(note) <= 2000),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);
create index sets_production_idx on public.sets(production_id);

create table public.pickups (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  runner_id uuid references public.people(id) on delete set null,
  day_number integer not null,
  picked_at timestamptz not null default now(),
  undone_at timestamptz
);
create unique index pickups_active_unique
  on public.pickups(person_id, day_number) where undone_at is null;
create index pickups_production_idx on public.pickups(production_id, day_number);

-- Una riga per runner con l'ultima posizione: niente storico dei movimenti.
create table public.runner_positions (
  runner_id uuid primary key references public.people(id) on delete cascade,
  production_id uuid not null references public.productions(id) on delete cascade,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  accuracy real check (accuracy between 0 and 10000),
  sharing boolean not null default false,
  -- Orologio del dispositivo: serve solo a ordinare i campioni dello stesso
  -- telefono. La validità "live" usa updated_at, cioè l'ora del server.
  client_ts timestamptz,
  updated_at timestamptz not null default now()
);
create index runner_positions_production_idx on public.runner_positions(production_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  type text not null check (type in ('PICKUP', 'UNDO', 'ALERT', 'SET', 'DAY')),
  -- Nomi e valori salvati al momento dell'evento; il testo è tradotto dal client.
  data jsonb not null default '{}'::jsonb,
  runner_id uuid references public.people(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now()
);
create index events_production_idx on public.events(production_id, created_at desc);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  runner_id uuid not null references public.people(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Funzioni di supporto per la RLS (schema privato, non esposto dalle API)
-- ---------------------------------------------------------------------------

create function private.is_producer(p_production uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.production_id = p_production and m.user_id = auth.uid() and m.role = 'producer'
  );
$$;

create function private.is_member(p_production uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.production_id = p_production and m.user_id = auth.uid()
  );
$$;

create function private.my_runner(p_production uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.person_id from public.members m
  where m.production_id = p_production and m.user_id = auth.uid() and m.role = 'runner';
$$;

create function private.is_anonymous() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create function private.token_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Vincoli applicativi
-- ---------------------------------------------------------------------------

create function private.check_person() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.production_id <> old.production_id or new.category <> old.category then
      raise exception 'person_immutable' using errcode = '22023';
    end if;
  elsif (select count(*) from public.people where production_id = new.production_id) >= 300 then
    raise exception 'people_limit' using errcode = '22023';
  end if;
  if new.assigned_runner_id is not null and not exists (
    select 1 from public.people r
    where r.id = new.assigned_runner_id and r.production_id = new.production_id and r.category = 'RUNNER'
  ) then
    raise exception 'runner_not_found' using errcode = '22023';
  end if;
  new.name := btrim(new.name);
  new.updated_at := now();
  return new;
end;
$$;
create trigger people_check before insert or update on public.people
  for each row execute function private.check_person();

create function private.check_set() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.production_id <> old.production_id then
    raise exception 'set_immutable' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.sets where production_id = new.production_id) >= 50 then
    raise exception 'sets_limit' using errcode = '22023';
  end if;
  new.name := btrim(new.name);
  return new;
end;
$$;
create trigger sets_check before insert or update on public.sets
  for each row execute function private.check_set();

create function private.set_created_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.events(production_id, type, data)
  values (new.production_id, 'SET', jsonb_build_object('set', new.name, 'address', new.address));
  return new;
end;
$$;
create trigger sets_created_event after insert on public.sets
  for each row execute function private.set_created_event();

create function private.keep_recent_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.events
  where production_id = new.production_id
    and id not in (
      select id from public.events where production_id = new.production_id
      order by created_at desc limit 1000
    );
  return null;
end;
$$;
create trigger events_keep_recent after insert on public.events
  for each row execute function private.keep_recent_events();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.productions enable row level security;
alter table public.people enable row level security;
alter table public.members enable row level security;
alter table public.sets enable row level security;
alter table public.pickups enable row level security;
alter table public.runner_positions enable row level security;
alter table public.events enable row level security;
alter table public.invites enable row level security;

revoke all on public.productions, public.people, public.members, public.sets, public.pickups,
  public.runner_positions, public.events, public.invites from anon, authenticated;

grant select, delete on public.productions to authenticated;
grant update (name, producer_name, producer_phone) on public.productions to authenticated;
grant select on public.members, public.pickups, public.runner_positions, public.events to authenticated;
-- L'hash del token non serve al client: resta leggibile solo alle funzioni.
grant select (id, production_id, runner_id, created_at, expires_at, used_at) on public.invites to authenticated;
grant select, delete on public.people, public.sets to authenticated;
grant insert (production_id, category, name, role, phone, address, lat, lng, assigned_runner_id),
  update (name, role, phone, address, lat, lng, assigned_runner_id) on public.people to authenticated;
grant insert (production_id, name, address, manager_name, phone, note, lat, lng),
  update (name, address, manager_name, phone, note, lat, lng) on public.sets to authenticated;

create policy productions_select on public.productions for select to authenticated
  using (private.is_member(id));
create policy productions_update on public.productions for update to authenticated
  using (private.is_producer(id)) with check (private.is_producer(id));
create policy productions_delete on public.productions for delete to authenticated
  using (private.is_producer(id));

create policy members_select on public.members for select to authenticated
  using (user_id = auth.uid() or private.is_producer(production_id));

create policy people_select on public.people for select to authenticated
  using (
    private.is_producer(production_id)
    or id = private.my_runner(production_id)
    or assigned_runner_id = private.my_runner(production_id)
  );
create policy people_insert on public.people for insert to authenticated
  with check (private.is_producer(production_id));
create policy people_update on public.people for update to authenticated
  using (private.is_producer(production_id)) with check (private.is_producer(production_id));
create policy people_delete on public.people for delete to authenticated
  using (private.is_producer(production_id));

create policy sets_select on public.sets for select to authenticated
  using (private.is_member(production_id));
create policy sets_insert on public.sets for insert to authenticated
  with check (private.is_producer(production_id));
create policy sets_update on public.sets for update to authenticated
  using (private.is_producer(production_id)) with check (private.is_producer(production_id));
create policy sets_delete on public.sets for delete to authenticated
  using (private.is_producer(production_id));

create policy pickups_select on public.pickups for select to authenticated
  using (
    private.is_producer(production_id)
    or exists (
      select 1 from public.people p
      where p.id = person_id and p.assigned_runner_id = private.my_runner(production_id)
    )
  );

create policy positions_select on public.runner_positions for select to authenticated
  using (private.is_producer(production_id) or runner_id = private.my_runner(production_id));

create policy events_select on public.events for select to authenticated
  using (
    private.is_producer(production_id)
    or (private.is_member(production_id)
        and (runner_id is null or runner_id = private.my_runner(production_id)))
  );

create policy invites_select on public.invites for select to authenticated
  using (private.is_producer(production_id));

-- ---------------------------------------------------------------------------
-- Funzioni chiamabili dal client (RPC)
-- ---------------------------------------------------------------------------

create function public.create_production(p_name text, p_producer_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or private.is_anonymous() then
    raise exception 'producer_account_required' using errcode = '42501';
  end if;
  if (select count(*) from public.members where user_id = auth.uid() and role = 'producer') >= 20 then
    raise exception 'productions_limit' using errcode = '22023';
  end if;
  insert into public.productions(name, producer_name, created_by)
  values (btrim(p_name), btrim(p_producer_name), auth.uid())
  returning id into v_id;
  insert into public.members(production_id, user_id, role) values (v_id, auth.uid(), 'producer');
  return v_id;
end;
$$;

-- Crea un invito monouso. Revoca inviti precedenti e dispositivi già collegati
-- per quel runner. Restituisce il token in chiaro una sola volta.
create function public.create_invite(p_runner uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_production uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  select production_id into v_production from public.people
  where id = p_runner and category = 'RUNNER';
  if v_production is null or not private.is_producer(v_production) then
    raise exception 'runner_not_found' using errcode = '42501';
  end if;
  delete from public.invites where runner_id = p_runner;
  delete from public.members where person_id = p_runner;
  update public.runner_positions set sharing = false, client_ts = null where runner_id = p_runner;
  insert into public.invites(production_id, runner_id, token_hash)
  values (v_production, p_runner, private.token_hash(v_token));
  return v_token;
end;
$$;

create function public.redeem_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_invite from public.invites
  where token_hash = private.token_hash(coalesce(p_token, ''))
    and used_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'invite_invalid' using errcode = '42501';
  end if;
  if private.is_producer(v_invite.production_id) then
    raise exception 'already_producer' using errcode = '22023';
  end if;
  update public.invites set used_at = now() where id = v_invite.id;
  delete from public.members where person_id = v_invite.runner_id;
  delete from public.members where production_id = v_invite.production_id and user_id = auth.uid();
  insert into public.members(production_id, user_id, role, person_id)
  values (v_invite.production_id, auth.uid(), 'runner', v_invite.runner_id);
  return v_invite.production_id;
end;
$$;

create function public.report_position(
  p_production uuid,
  p_sharing boolean,
  p_client_ts timestamptz,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy real default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_runner uuid := private.my_runner(p_production);
  v_current public.runner_positions%rowtype;
begin
  if v_runner is null then
    raise exception 'runner_required' using errcode = '42501';
  end if;
  if p_client_ts is null then
    raise exception 'timestamp_required' using errcode = '22023';
  end if;
  if p_sharing and (
    p_lat is null or p_lng is null or p_accuracy is null
    or p_lat not between -90 and 90 or p_lng not between -180 and 180
    or p_accuracy not between 0 and 10000
  ) then
    raise exception 'invalid_position' using errcode = '22023';
  end if;

  select * into v_current from public.runner_positions where runner_id = v_runner for update;
  if not found then
    insert into public.runner_positions(runner_id, production_id, lat, lng, accuracy, sharing, client_ts)
    values (v_runner, p_production,
            case when p_sharing then p_lat end, case when p_sharing then p_lng end,
            case when p_sharing then p_accuracy end, p_sharing, p_client_ts);
    return;
  end if;
  -- Campioni in ritardo non annullano una scelta più recente; a parità vince lo stop.
  if v_current.client_ts is not null and (
    p_client_ts < v_current.client_ts or (p_client_ts = v_current.client_ts and p_sharing)
  ) then
    return;
  end if;
  -- Al massimo un aggiornamento GPS ogni 2 secondi per runner; gli stop passano sempre.
  if p_sharing and v_current.sharing and v_current.updated_at > now() - interval '2 seconds' then
    return;
  end if;
  update public.runner_positions set
    sharing = p_sharing,
    client_ts = p_client_ts,
    lat = case when p_sharing then p_lat else lat end,
    lng = case when p_sharing then p_lng else lng end,
    accuracy = case when p_sharing then p_accuracy else accuracy end,
    updated_at = case when p_sharing then now() else updated_at end
  where runner_id = v_runner;
end;
$$;

create function public.confirm_pickup(p_person uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_person public.people%rowtype;
  v_runner_name text;
  v_day integer;
  v_inserted integer;
begin
  select * into v_person from public.people where id = p_person and category <> 'RUNNER';
  if not found or v_person.assigned_runner_id is null
     or v_person.assigned_runner_id is distinct from private.my_runner(v_person.production_id) then
    raise exception 'person_not_assigned' using errcode = '42501';
  end if;
  select day_number into v_day from public.productions where id = v_person.production_id;
  insert into public.pickups(production_id, person_id, runner_id, day_number)
  values (v_person.production_id, p_person, v_person.assigned_runner_id, v_day)
  on conflict (person_id, day_number) where undone_at is null do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    select name into v_runner_name from public.people where id = v_person.assigned_runner_id;
    insert into public.events(production_id, type, data, runner_id, person_id)
    values (v_person.production_id, 'PICKUP',
            jsonb_build_object('person', v_person.name, 'runner', v_runner_name),
            v_person.assigned_runner_id, p_person);
  end if;
  return v_inserted = 1;
end;
$$;

-- Il produttore può sempre annullare; il runner solo un suo recupero degli ultimi 10 minuti.
create function public.undo_pickup(p_person uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_pickup public.pickups%rowtype;
  v_person_name text;
begin
  select pk.* into v_pickup from public.pickups pk
  join public.productions pr on pr.id = pk.production_id
  where pk.person_id = p_person and pk.day_number = pr.day_number and pk.undone_at is null
  for update of pk;
  if not found then
    raise exception 'pickup_not_found' using errcode = '22023';
  end if;
  if not (
    private.is_producer(v_pickup.production_id)
    or (v_pickup.runner_id = private.my_runner(v_pickup.production_id)
        and v_pickup.picked_at > now() - interval '10 minutes')
  ) then
    raise exception 'undo_not_allowed' using errcode = '42501';
  end if;
  update public.pickups set undone_at = now() where id = v_pickup.id;
  select name into v_person_name from public.people where id = p_person;
  insert into public.events(production_id, type, data, runner_id, person_id)
  values (v_pickup.production_id, 'UNDO', jsonb_build_object('person', v_person_name),
          v_pickup.runner_id, p_person);
end;
$$;

create function public.send_alert(p_production uuid, p_type text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_runner uuid := private.my_runner(p_production);
  v_runner_name text;
begin
  if v_runner is null then
    raise exception 'runner_required' using errcode = '42501';
  end if;
  if p_type not in ('TRAFFIC', 'INCIDENT', 'FUEL') then
    raise exception 'invalid_alert' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.events
    where production_id = p_production and runner_id = v_runner and type = 'ALERT'
      and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'alert_throttled' using errcode = '22023';
  end if;
  select name into v_runner_name from public.people where id = v_runner;
  insert into public.events(production_id, type, data, runner_id)
  values (p_production, 'ALERT', jsonb_build_object('alert', p_type, 'runner', v_runner_name), v_runner);
end;
$$;

create function public.start_new_day(p_production uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_day integer;
begin
  if not private.is_producer(p_production) then
    raise exception 'producer_required' using errcode = '42501';
  end if;
  update public.productions set day_number = day_number + 1
  where id = p_production returning day_number into v_day;
  insert into public.events(production_id, type, data)
  values (p_production, 'DAY', jsonb_build_object('day', v_day));
  return v_day;
end;
$$;

-- Ora del server: il client calcola lo scarto del proprio orologio, così la
-- soglia "live" non dipende dall'ora impostata sul telefono.
create function public.server_time() returns timestamptz
language sql stable set search_path = '' as $$ select now() $$;
grant execute on function public.server_time() to anon, authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.create_production(text, text), public.create_invite(uuid),
  public.redeem_invite(text), public.report_position(uuid, boolean, timestamptz, double precision, double precision, real),
  public.confirm_pickup(uuid), public.undo_pickup(uuid), public.send_alert(uuid, text),
  public.start_new_day(uuid) from public, anon;
grant execute on function public.create_production(text, text), public.create_invite(uuid),
  public.redeem_invite(text), public.report_position(uuid, boolean, timestamptz, double precision, double precision, real),
  public.confirm_pickup(uuid), public.undo_pickup(uuid), public.send_alert(uuid, text),
  public.start_new_day(uuid) to authenticated;
-- La RLS chiama le funzioni di supporto con i permessi dell'utente.
grant usage on schema private to authenticated;
grant execute on function private.is_producer(uuid), private.is_member(uuid),
  private.my_runner(uuid), private.is_anonymous() to authenticated;

-- ---------------------------------------------------------------------------
-- Tempo reale (la pubblicazione esiste solo su Supabase)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.productions, public.people, public.sets, public.pickups,
      public.runner_positions, public.events;
  end if;
end;
$$;
