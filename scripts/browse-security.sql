begin;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','browse-test@example.invalid');
insert into public.titles(id,name,published) values('__browse_public__','Browse public test',true),('__browse_hidden__','Browse hidden test',false);
insert into public.episodes(title_id,number,name,published) values('__browse_public__',1,'Published episode',true),('__browse_public__',2,'Hidden episode',false),('__browse_hidden__',1,'Hidden title episode',true);
insert into public.episode_sources(episode_id,bunny_video_id) select id,'private-test-video' from public.episodes where title_id='__browse_public__' and number=1;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$begin
  if public.has_access() then raise exception 'Unpaid user gained playback access';end if;
  if (select count(*) from public.titles where id in('__browse_public__','__browse_hidden__'))<>1 then raise exception 'Title visibility failure';end if;
  if (select count(*) from public.episodes where title_id in('__browse_public__','__browse_hidden__'))<>1 then raise exception 'Episode metadata visibility failure';end if;
  begin
    if exists(select 1 from public.episode_sources where bunny_video_id='private-test-video') then raise exception 'Streaming source leaked';end if;
  exception when insufficient_privilege then null;
  end;
  insert into public.favorites(user_id,title_id) values(auth.uid(),'__browse_public__');
  if not exists(select 1 from public.favorites where user_id=auth.uid() and title_id='__browse_public__') then raise exception 'Unpaid favorite failed';end if;
end $$;
reset role;
rollback;
