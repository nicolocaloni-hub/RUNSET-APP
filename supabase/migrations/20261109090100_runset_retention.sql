-- Conservazione limitata dei dati (GDPR): ogni notte alle 03:15 UTC
--   * eventi più vecchi di 90 giorni eliminati;
--   * ultime posizioni GPS non aggiornate da 30 giorni cancellate;
--   * inviti scaduti eliminati.
-- Attiva solo dove pg_cron è disponibile (Supabase); altrove non fa nulla.

create function private.purge_old_data() returns void
language sql security definer set search_path = '' as $$
  delete from public.events where created_at < now() - interval '90 days';
  update public.runner_positions
    set lat = null, lng = null, accuracy = null, sharing = false
    where updated_at < now() - interval '30 days' and lat is not null;
  delete from public.invites where expires_at < now();
$$;
revoke execute on function private.purge_old_data() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('runset-purge-old-data', '15 3 * * *', 'select private.purge_old_data()');
  end if;
end;
$$;
