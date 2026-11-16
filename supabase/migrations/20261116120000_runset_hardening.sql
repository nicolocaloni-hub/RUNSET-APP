-- Hardening 2026-11. Non applicare in automatico: rivedere prima.

-- (a) claim_staff_invites: richiede email confermata.
create or replace function public.claim_staff_invites()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_count integer;
begin
  if auth.uid() is null or private.is_anonymous() or coalesce(v_email, '') = '' then
    return 0;
  end if;
  if not exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null) then
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

-- (b) endpoint push solo su servizi noti. NOT VALID: le righe esistenti non bloccano la migrazione.
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_host_check
  check (endpoint ~ '^https://([a-z0-9-]+\.)*(googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/')
  not valid;
-- Dopo aver controllato/ripulito le righe non conformi, eseguire a parte:
--   alter table public.push_subscriptions validate constraint push_subscriptions_endpoint_host_check;

-- (c) save_push_subscription: un endpoint già di un altro utente non viene riassegnato.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_lang text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_anonymous() then
    raise exception 'producer_account_required' using errcode = '42501';
  end if;
  insert into public.push_subscriptions(endpoint, user_id, p256dh, auth, lang)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, case when p_lang = 'en' then 'en' else 'it' end)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang
    where public.push_subscriptions.user_id = auth.uid();
  -- Al massimo 10 dispositivi per utente: i più vecchi escono.
  delete from public.push_subscriptions where endpoint in (
    select endpoint from public.push_subscriptions where user_id = auth.uid()
    order by created_at desc offset 10);
end;
$$;
