begin;
-- Only these paid plans allow three connected devices. Unknown plans default to one.
insert into public.plan_device_limits(plan,device_limit) values
('weekly',1),('semanal',1),('plano semanal',1),('g18z8v',1),
('monthly',1),('mensal',1),('plano mensal',1),('p3qfuf',1),
('quarterly',3),('trimestral',3),('plano trimestral',3),('zpo7gw',3),
('semiannual',3),('semestral',3),('plano semestral',3),('ld4imo',3)
on conflict(plan) do update set device_limit=excluded.device_limit;
create or replace function public.account_device_limit() returns integer
language sql stable security definer set search_path='' as $$
 select coalesce((select coalesce(l.device_limit,1) from public.subscriptions s
 left join public.plan_device_limits l on l.plan=lower(trim(s.plan))
 where s.user_id=auth.uid() and s.status='active' and (s.ends_at is null or s.ends_at>now())
 order by s.updated_at desc,s.id desc limit 1),1);
$$;
-- Recheck the current limit on every authorization, including after expiration/downgrade.
create or replace function public.account_session_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from (
 select d.session_id from public.active_account_devices d
 join auth.sessions s on s.id=d.session_id and s.user_id=d.user_id
 where d.user_id=auth.uid() and (s.not_after is null or s.not_after>now())
 order by d.activated_at desc,d.session_id desc limit public.account_device_limit()
 ) allowed where session_id=nullif(auth.jwt()->>'session_id','')::uuid);
$$;
create or replace function public.customer_requests() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('limit',2,'unlimited',exists(select 1 from public.request_entitlements where user_id=auth.uid() and unlimited_until>now()),
  'used',(select count(*) from public.drama_requests where user_id=auth.uid()),
  'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
    select d.id,d.name,d.notes,d.status,d.admin_note,d.created_at,d.updated_at,
      case when t.published then t.id else null end as title_id,
      case when t.published then t.name else null end as title_name,
      case when t.published then 'available' when d.status='available' then 'adding' else d.status end as display_status
    from public.drama_requests d left join public.titles t on t.id=d.title_id where d.user_id=auth.uid()
  )r),'[]'::jsonb));
$$;

create or replace function public.submit_drama_request(p_name text,p_notes text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); rid uuid;
begin
  if viewer is null then raise exception 'Entre na sua conta'; end if;
  if public.platform_admin_status() then raise exception 'Use o painel administrativo para gerenciar pedidos'; end if;
  if length(trim(p_name)) not between 2 and 150 or length(coalesce(p_notes,''))>1000 then raise exception 'Confira o nome e as observações do pedido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(viewer::text,9));
  if exists(select 1 from public.drama_requests where user_id=viewer and lower(trim(name))=lower(trim(p_name))) then raise exception 'Você já pediu este dorama'; end if;
  if (select count(*) from public.drama_requests where user_id=viewer)>=2
    and not exists(select 1 from public.request_entitlements where user_id=viewer and unlimited_until>now()) then
    raise exception 'Você usou os 2 pedidos. Para pedir mais, adicione Pedidos ilimitados ao seu plano.';
  end if;
  insert into public.drama_requests(user_id,name,notes) values(viewer,trim(p_name),trim(coalesce(p_notes,''))) returning id into rid;
  return rid;
end; $$;

commit;
