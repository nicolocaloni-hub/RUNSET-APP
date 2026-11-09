-- Avviso "sta arrivando": quando un runner che condivide il GPS entra entro 250 m
-- dal punto di incontro di una persona assegnata e non ancora recuperata, si crea
-- un evento ARRIVING (una volta per persona e giornata). Il produttore lo riceve
-- in tempo reale come ogni altro evento.

alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check
  check (type in ('PICKUP', 'UNDO', 'ALERT', 'SET', 'DAY', 'ARRIVING'));

create function private.distance_m(lat1 double precision, lng1 double precision,
                                   lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 2 * 6371000 * asin(sqrt(least(1,
    sin(radians(lat2 - lat1) / 2) ^ 2
    + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2)));
$$;

create function private.check_arrivals(p_runner uuid, p_lat double precision, p_lng double precision)
returns void language sql security definer set search_path = '' as $$
  insert into public.events(production_id, type, data, runner_id, person_id)
  select p.production_id, 'ARRIVING',
         jsonb_build_object('person', p.name, 'runner', r.name,
                            'meters', round(d.meters)::int, 'day', pr.day_number),
         p_runner, p.id
  from public.people p
  join public.productions pr on pr.id = p.production_id
  join public.people r on r.id = p_runner
  cross join lateral (select private.distance_m(p_lat, p_lng, p.lat, p.lng) as meters) d
  where p.assigned_runner_id = p_runner
    and p.category <> 'RUNNER'
    and p.lat is not null and p.lng is not null
    and d.meters <= 250
    and not exists (
      select 1 from public.pickups pk
      where pk.person_id = p.id and pk.day_number = pr.day_number and pk.undone_at is null)
    and not exists (
      select 1 from public.events e
      where e.person_id = p.id and e.type = 'ARRIVING' and (e.data ->> 'day')::int = pr.day_number);
$$;

revoke execute on function private.distance_m(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;
revoke execute on function private.check_arrivals(uuid, double precision, double precision)
  from public, anon, authenticated;

create or replace function public.report_position(
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
  else
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
  end if;
  -- Fix troppo imprecisi non generano avvisi di arrivo.
  if p_sharing and p_accuracy <= 100 then
    perform private.check_arrivals(v_runner, p_lat, p_lng);
  end if;
end;
$$;
