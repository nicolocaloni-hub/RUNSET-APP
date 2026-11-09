-- Km percorsi nella giornata da ogni runner, per il riepilogo e i rimborsi.
-- Non si salva il percorso: solo il totale e l'ultimo punto contato (ancora).

alter table public.runner_positions
  add column day_meters double precision not null default 0,
  add column meters_day integer,
  add column anchor_lat double precision,
  add column anchor_lng double precision;

create function private.track_distance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_day integer;
  v_meters double precision;
begin
  -- Contano solo fix condivisi e precisi.
  if not new.sharing or new.lat is null or coalesce(new.accuracy, 9999) > 50 then
    return new;
  end if;
  select day_number into v_day from public.productions where id = new.production_id;
  if new.meters_day is distinct from v_day or new.anchor_lat is null then
    if new.meters_day is distinct from v_day then
      new.day_meters := 0;
    end if;
    new.meters_day := v_day;
    new.anchor_lat := new.lat;
    new.anchor_lng := new.lng;
    return new;
  end if;
  v_meters := private.distance_m(new.anchor_lat, new.anchor_lng, new.lat, new.lng);
  -- Sotto la soglia è rumore del GPS: l'ancora resta ferma finché il runner si muove davvero.
  if v_meters < greatest(25, new.accuracy * 1.5) then
    return new;
  end if;
  -- Salti oltre 3 km (GPS spento a lungo, fix sbagliato) non vengono sommati.
  if v_meters <= 3000 then
    new.day_meters := new.day_meters + v_meters;
  end if;
  new.anchor_lat := new.lat;
  new.anchor_lng := new.lng;
  return new;
end;
$$;
revoke execute on function private.track_distance() from public, anon, authenticated;

create trigger runner_positions_distance before insert or update of lat, lng, sharing on public.runner_positions
  for each row execute function private.track_distance();
