begin;
-- Redacted structures only; never an authoritative payment queue.
create table if not exists public.lowify_schema_samples (
 digest text primary key check(digest ~ '^[a-f0-9]{64}$'),
 shape jsonb not null check(octet_length(shape::text)<=65536),
 header_names jsonb not null,
 content_type text not null,
 created_at timestamptz not null default now()
);
alter table public.lowify_schema_samples enable row level security;
revoke all on public.lowify_schema_samples from public,anon,authenticated;
grant select on public.lowify_schema_samples to service_role;
create or replace function public.capture_lowify_schema(p_digest text,p_shape jsonb,p_header_names jsonb,p_content_type text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('lowify-schema-capture',29));
 delete from public.lowify_schema_samples where created_at<now()-interval '7 days';
 if exists(select 1 from public.lowify_schema_samples where digest=p_digest) then return true;end if;
 if (select count(*) from public.lowify_schema_samples)>=40 then return false;end if;
 insert into public.lowify_schema_samples(digest,shape,header_names,content_type) values(p_digest,p_shape,p_header_names,left(p_content_type,100));
 return true;
end;$$;
revoke all on function public.capture_lowify_schema(text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.capture_lowify_schema(text,jsonb,jsonb,text) to service_role;
commit;
