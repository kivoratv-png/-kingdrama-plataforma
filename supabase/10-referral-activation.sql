begin;
alter table public.subscriptions add column if not exists payment_confirmed_at timestamptz;

-- This is an internal outbox of paid activations, never a customer-written queue.
create table if not exists public.referral_activation_jobs (
  id uuid primary key default gen_random_uuid(),
  subscription_id bigint not null references public.subscriptions(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  payment_id text unique not null check(length(payment_id) between 1 and 200),
  paid_at timestamptz not null,
  state text not null default 'pending' check(state in('pending','completed','skipped','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists referral_jobs_pending on public.referral_activation_jobs(next_attempt_at) where state in('pending','failed');
alter table public.referral_activation_jobs enable row level security;
revoke all on public.referral_activation_jobs from public,anon,authenticated;

create or replace function public.credit_referral_payment(p_payment_id text,p_buyer uuid,p_subscription bigint,p_paid_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare invitation public.referral_signups%rowtype; target public.subscriptions%rowtype; reward_id uuid;
  previous_reward_write text:=coalesce(current_setting('kingdrama.referral_reward_write',true),'');
begin
  if p_payment_id is null or length(p_payment_id) not between 1 and 200 or p_paid_at is null or p_paid_at>now()+interval '5 minutes' then raise exception 'Pagamento inválido';end if;
  select * into invitation from public.referral_signups where referred_user_id=p_buyer;
  if not found or p_paid_at<invitation.created_at then return false;end if;
  perform pg_advisory_xact_lock(hashtextextended(invitation.referrer_user_id::text,19));
  if exists(select 1 from public.referral_rewards where referred_user_id=p_buyer or (provider='lowify' and payment_id=p_payment_id)) then return false;end if;
  if not exists(select 1 from public.subscriptions where id=p_subscription and user_id=p_buyer and provider='lowify'
    and provider_ref=p_payment_id and status='active' and (ends_at is null or ends_at>now())
    and trim(coalesce(plan,''))<>'' and lower(plan) not in('cortesia','courtesy','trial','teste','bonus','referral')) then raise exception 'Assinatura do pagamento não confirmada';end if;
  select * into target from public.subscriptions where user_id=invitation.referrer_user_id and status in('active','expired')
    order by (status='active' and (ends_at is null or ends_at>now())) desc,updated_at desc,id desc limit 1 for update;
  if target.id is null then raise exception 'Assinatura de quem indicou precisa ser conferida';end if;
  insert into public.referral_rewards(referrer_user_id,referred_user_id,provider,payment_id,paid_at,subscription_id)
    values(invitation.referrer_user_id,p_buyer,'lowify',p_payment_id,p_paid_at,target.id)
    on conflict do nothing returning id into reward_id;
  if reward_id is null then return false;end if;
  if target.ends_at is not null then
    -- This flag also prevents cascades when a retry runs outside a trigger.
    perform set_config('kingdrama.referral_reward_write','on',true);
    update public.subscriptions set ends_at=greatest(target.ends_at,now())+interval '10 days',status='active',updated_at=now() where id=target.id;
    perform set_config('kingdrama.referral_reward_write',previous_reward_write,true);
  end if;
  return true;
end; $$;

create or replace function public.process_referral_activation(p_job uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.referral_activation_jobs%rowtype; credited boolean;
begin
  select * into job from public.referral_activation_jobs where id=p_job for update;
  if job.id is null or job.state in('completed','skipped') then return false;end if;
  update public.referral_activation_jobs set attempts=attempts+1,updated_at=now() where id=p_job;
  begin
    -- Recheck current server data on every retry, including manual revocations.
    if not exists(select 1 from public.subscriptions s where s.id=job.subscription_id and s.user_id=job.buyer_id
      and s.status='active' and s.provider='lowify' and s.provider_ref=job.payment_id
      and (s.ends_at is null or s.ends_at>now())
      and trim(coalesce(s.plan,''))<>'' and lower(s.plan) not in('cortesia','courtesy','trial','teste','bonus','referral')) then
      update public.referral_activation_jobs set state='skipped',last_error_code=null,updated_at=now() where id=p_job;
      return false;
    end if;
    credited:=public.credit_referral_payment(job.payment_id,job.buyer_id,job.subscription_id,job.paid_at);
    update public.referral_activation_jobs set state=case when credited then 'completed' else 'skipped' end,
      last_error_code=null,updated_at=now() where id=p_job;
    return credited;
  exception when others then
    -- A referral failure must never undo the buyer's paid account activation.
    -- Credit and expiry changes inside this block roll back together on failure.
    update public.referral_activation_jobs set state='failed',last_error_code=sqlstate,
      next_attempt_at=now()+interval '5 minutes',updated_at=now() where id=p_job;
    return false;
  end;
end; $$;

create or replace function public.queue_referral_activation() returns trigger
language plpgsql security definer set search_path='' as $$
declare job_id uuid;
begin
  -- Extending a referrer's subscription as a reward is not a new paid sale.
  if current_setting('kingdrama.referral_reward_write',true)='on' then return new;end if;
  if new.status<>'active' or new.provider is distinct from 'lowify'
    or coalesce(length(new.provider_ref),0) not between 1 and 200 or trim(new.provider_ref)=''
    or (new.ends_at is not null and new.ends_at<=now())
    or trim(coalesce(new.plan,''))='' or lower(new.plan) in('cortesia','courtesy','trial','teste','bonus','referral')
    or not exists(select 1 from public.referral_signups where referred_user_id=new.user_id) then return new;end if;
  insert into public.referral_activation_jobs(subscription_id,buyer_id,payment_id,paid_at)
    values(new.id,new.user_id,new.provider_ref,coalesce(new.payment_confirmed_at,now()))
    on conflict(payment_id) do nothing returning id into job_id;
  if job_id is null then
    select id into job_id from public.referral_activation_jobs
      where payment_id=new.provider_ref and buyer_id=new.user_id and state in('pending','failed');
  end if;
  if job_id is not null then perform public.process_referral_activation(job_id);end if;
  return new;
end; $$;
drop trigger if exists on_paid_subscription_referral on public.subscriptions;
create trigger on_paid_subscription_referral after insert or update of status,ends_at,provider,provider_ref,payment_confirmed_at
  on public.subscriptions for each row execute function public.queue_referral_activation();

create or replace function public.retry_referral_activations(p_limit integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job record; tried integer:=0; completed integer:=0; failed integer:=0;
begin
  for job in select id from public.referral_activation_jobs where state in('pending','failed') and attempts<10 and next_attempt_at<=now()
    order by created_at limit greatest(1,least(coalesce(p_limit,20),100)) for update skip locked loop
    tried:=tried+1;
    if public.process_referral_activation(job.id) then completed:=completed+1;
    elsif exists(select 1 from public.referral_activation_jobs where id=job.id and state='failed') then failed:=failed+1;end if;
  end loop;
  return jsonb_build_object('attempted',tried,'completed',completed,'failed',failed);
end; $$;

-- Include pending signups without exposing invitees' names, emails, or IDs.
create or replace function public.referral_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); eligible boolean;
begin
  if viewer is null then raise exception 'Entre na sua conta' using errcode='42501';end if;
  eligible:=exists(select 1 from public.subscriptions s where s.user_id=viewer and s.status='active' and (s.ends_at is null or s.ends_at>now()));
  return jsonb_build_object('eligible',eligible,
    'code',case when eligible then (select code from public.referral_codes where user_id=viewer) else null end,
    'validReferrals',(select count(*) from public.referral_rewards where referrer_user_id=viewer),
    'pendingReferrals',(select count(*) from public.referral_signups i where i.referrer_user_id=viewer and not exists(select 1 from public.referral_rewards r where r.referred_user_id=i.referred_user_id)),
    'daysEarned',coalesce((select sum(days) from public.referral_rewards where referrer_user_id=viewer),0));
end; $$;

revoke all on function public.process_referral_activation(uuid),public.queue_referral_activation(),public.retry_referral_activations(integer) from public,anon,authenticated;
grant execute on function public.process_referral_activation(uuid),public.retry_referral_activations(integer) to service_role;

-- Recover already-recorded paid activations, if any, without touching courtesy
-- accounts or awarding anything merely because the migration was installed.
insert into public.referral_activation_jobs(subscription_id,buyer_id,payment_id,paid_at)
  select s.id,s.user_id,s.provider_ref,coalesce(s.payment_confirmed_at,s.started_at,s.updated_at)
  from public.subscriptions s join public.referral_signups i on i.referred_user_id=s.user_id
  where s.status='active' and s.provider='lowify' and coalesce(length(s.provider_ref),0) between 1 and 200 and trim(s.provider_ref)<>''
    and (s.ends_at is null or s.ends_at>now())
    and trim(coalesce(s.plan,''))<>'' and lower(s.plan) not in('cortesia','courtesy','trial','teste','bonus','referral')
    and not exists(select 1 from public.referral_rewards r where r.referred_user_id=s.user_id)
  on conflict(payment_id) do nothing;
commit;
