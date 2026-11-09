-- Le notifiche push partono dalla Edge Function "push" di Supabase.
-- Nessuna chiave passa dal client o dal repository: il segreto tra database e
-- funzione nasce qui, le chiavi VAPID le genera la funzione al primo avvio.
-- Tutto resta nel Vault.

do $$
begin
  -- Vault esiste solo su Supabase; il controllo interno è separato per non essere analizzato altrove.
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    if not exists (select 1 from vault.secrets where name = 'runset_push_secret') then
      perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'runset_push_secret',
                                  'Autorizza il database a chiamare la funzione push');
    end if;
  end if;
end;
$$;

-- Solo la Edge Function (service_role) legge la configurazione.
create function public.push_config() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_config jsonb;
begin
  execute 'select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets
           where name in (''runset_push_secret'', ''runset_vapid_public'', ''runset_vapid_private'')'
  into v_config;
  return coalesce(v_config, '{}'::jsonb);
end;
$$;

create function public.push_store_vapid(p_public text, p_private text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Una sola coppia di chiavi: se due avvii concorrenti la generano, vince la prima.
  perform pg_advisory_xact_lock(hashtext('runset_vapid'));
  if exists (select 1 from vault.secrets where name = 'runset_vapid_public') then
    return;
  end if;
  perform vault.create_secret(p_public, 'runset_vapid_public', 'Chiave pubblica VAPID');
  perform vault.create_secret(p_private, 'runset_vapid_private', 'Chiave privata VAPID');
end;
$$;

-- Iscrizioni scadute (il servizio push risponde 404/410).
create function public.push_forget(p_endpoints text[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
$$;

revoke execute on function public.push_config(), public.push_store_vapid(text, text), public.push_forget(text[])
  from public, anon, authenticated;
grant execute on function public.push_config(), public.push_store_vapid(text, text), public.push_forget(text[])
  to service_role;

create or replace function private.push_event() returns trigger
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
