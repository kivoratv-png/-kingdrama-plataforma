begin;
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text unique not null default replace(gen_random_uuid()::text,'-','') check(code ~ '^[a-f0-9]{32}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.referral_signups (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check(referred_user_id<>referrer_user_id)
);
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid unique references auth.users(id) on delete set null,
  provider text not null check(provider='lowify'),
  payment_id text not null,
  days integer not null default 10 check(days=10),
  paid_at timestamptz not null,
  credited_at timestamptz not null default now(),
  subscription_id bigint references public.subscriptions(id) on delete set null,
  unique(provider,payment_id)
);
create index if not exists referral_signups_referrer on public.referral_signups(referrer_user_id);
create index if not exists referral_rewards_referrer on public.referral_rewards(referrer_user_id);
alter table public.referral_codes enable row level security;
alter table public.referral_signups enable row level security;
alter table public.referral_rewards enable row level security;
revoke all on public.referral_codes,public.referral_signups,public.referral_rewards from public,anon,authenticated;

create or replace function public.referral_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); eligible boolean;
begin
  if viewer is null then raise exception 'Entre na sua conta' using errcode='42501'; end if;
  eligible:=exists(select 1 from public.subscriptions s where s.user_id=viewer and s.status='active' and (s.ends_at is null or s.ends_at>now()));
  return jsonb_build_object('eligible',eligible,
    'code',case when eligible then (select code from public.referral_codes where user_id=viewer) else null end,
    'validReferrals',(select count(*) from public.referral_rewards where referrer_user_id=viewer),
    'daysEarned',coalesce((select sum(days) from public.referral_rewards where referrer_user_id=viewer),0));
end; $$;

create or replace function public.create_referral_code() returns text
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); invitation text;
begin
  if viewer is null or not exists(select 1 from public.subscriptions s where s.user_id=viewer and s.status='active' and (s.ends_at is null or s.ends_at>now())) then
    raise exception 'Somente assinantes com acesso ativo podem gerar um link de indicação.' using errcode='42501';
  end if;
  insert into public.referral_codes(user_id) values(viewer) on conflict(user_id) do nothing;
  select code into invitation from public.referral_codes where user_id=viewer;
  return invitation;
end; $$;

-- Capture a referral only while creating a new account. Later metadata updates
-- cannot change the inviter. Invalid/expired codes never prevent signup.
create or replace function public.capture_referral_signup() returns trigger
language plpgsql security definer set search_path='' as $$
declare inviter uuid; invitation text:=new.raw_user_meta_data->>'referral_code';
begin
  if coalesce(invitation,'') !~ '^[a-f0-9]{32}$' then return new;end if;
  select c.user_id into inviter from public.referral_codes c where c.code=invitation
    and c.user_id<>new.id and exists(select 1 from public.subscriptions s where s.user_id=c.user_id and s.status='active' and (s.ends_at is null or s.ends_at>now()));
  if inviter is not null then insert into public.referral_signups(referred_user_id,referrer_user_id)
    values(new.id,inviter) on conflict(referred_user_id) do nothing;end if;
  return new;
end; $$;
drop trigger if exists on_referral_signup on auth.users;
create trigger on_referral_signup after insert on auth.users for each row execute function public.capture_referral_signup();

-- Backend-only building block for the future VERIFIED Lowify webhook. There is
-- deliberately no HTTP endpoint or client permission to award days. The payment
-- handler must first validate Lowify's signature/status/product/amount and record
-- the buyer's subscription with provider_ref equal to that approved payment ID.
create or replace function public.credit_referral_payment(p_payment_id text,p_buyer uuid,p_subscription bigint,p_paid_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare invitation public.referral_signups%rowtype; target public.subscriptions%rowtype; reward_id uuid;
begin
  if p_payment_id is null or length(p_payment_id) not between 1 and 200 or p_paid_at is null or p_paid_at>now()+interval '5 minutes' then raise exception 'Pagamento inválido';end if;
  select * into invitation from public.referral_signups where referred_user_id=p_buyer;
  if not found then return false;end if;
  if p_paid_at<invitation.created_at then return false;end if;
  perform pg_advisory_xact_lock(hashtextextended(invitation.referrer_user_id::text,19));
  if exists(select 1 from public.referral_rewards where referred_user_id=p_buyer or (provider='lowify' and payment_id=p_payment_id)) then return false;end if;
  if not exists(select 1 from public.subscriptions where id=p_subscription and user_id=p_buyer and provider='lowify'
    and provider_ref=p_payment_id and status='active' and (ends_at is null or ends_at>p_paid_at)) then raise exception 'Assinatura do pagamento não confirmada';end if;
  select * into target from public.subscriptions where user_id=invitation.referrer_user_id and status in('active','expired')
    order by (status='active' and (ends_at is null or ends_at>now())) desc,updated_at desc,id desc limit 1 for update;
  if target.id is null then raise exception 'Assinatura de quem indicou precisa ser conferida';end if;
  insert into public.referral_rewards(referrer_user_id,referred_user_id,provider,payment_id,paid_at,subscription_id)
    values(invitation.referrer_user_id,p_buyer,'lowify',p_payment_id,p_paid_at,target.id)
    on conflict do nothing returning id into reward_id;
  if reward_id is null then return false;end if;
  if target.ends_at is not null then
    update public.subscriptions set ends_at=greatest(target.ends_at,now())+interval '10 days',status='active',updated_at=now() where id=target.id;
  end if;
  return true;
end; $$;

revoke all on function public.referral_dashboard(),public.create_referral_code(),public.capture_referral_signup(),public.credit_referral_payment(text,uuid,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.referral_dashboard(),public.create_referral_code() to authenticated;
grant execute on function public.credit_referral_payment(text,uuid,bigint,timestamptz) to service_role;
commit;
