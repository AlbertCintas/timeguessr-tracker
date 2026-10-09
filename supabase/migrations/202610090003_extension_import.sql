begin;
alter table public.games add column if not exists external_key text;
alter table public.games add column if not exists played_on date;
create unique index if not exists games_external_key on public.games(external_key) where external_key is not null;
create or replace function public.import_timeguessr_result(
  challenge_date date, challenge_number integer, source_key text,
  played_date date, total integer, pictures jsonb, timer_seconds integer default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player uuid := auth.uid();
  target uuid;
  existing public.results%rowtype;
  merged jsonb;
  updated boolean := false;
  old_picture jsonb;
  new_picture jsonb;
  i integer;
begin
  if player is null or not exists(select 1 from public.profiles where id = player) then raise exception 'Sign in to import a game'; end if;
  if total is null or total not between 0 and 50000 or pictures is null or not public.valid_picture_results(pictures, total) then raise exception 'Invalid five-picture result'; end if;
  if played_date is null or played_date > (now() at time zone 'Europe/Madrid')::date or played_date < date '2023-06-01' then raise exception 'Invalid played date'; end if;
  if timer_seconds is null or timer_seconds not between 0 and 86400 then raise exception 'Invalid timer'; end if;
  if challenge_date is not null then
    if challenge_number is null or challenge_number not between 1 and 1000000 or challenge_date < date '2023-06-01' or challenge_date > (now() at time zone 'Europe/Madrid')::date or source_key is not null then raise exception 'Invalid daily challenge date'; end if;
    insert into public.games(kind, daily_date, created_by) values ('daily', challenge_date, player) on conflict(daily_date) do nothing;
    select id into target from public.games where daily_date = challenge_date for update;
  else
    if challenge_number is not null or source_key is null or source_key !~ '^timeguessr:v1:[a-f0-9]{64}$' then raise exception 'Invalid game identity'; end if;
    insert into public.games(kind, name, external_key, played_on, created_by)
    values ('custom', 'Timeguessr · ' || to_char(played_date, 'DD/MM/YY') || case when timer_seconds > 0 then ' · ' || timer_seconds || 's' else '' end || ' · ' || right(source_key, 6), source_key, played_date, player)
    on conflict(external_key) where external_key is not null do nothing;
    select id into target from public.games where external_key = source_key for update;
  end if;
  insert into public.results(game_id, player_id, points, rounds, daily_number)
  values(target, player, total, pictures, challenge_number) on conflict(game_id,player_id) do nothing;
  if found then return jsonb_build_object('status','saved','game_id',target); end if;
  select * into existing from public.results where game_id = target and player_id = player for update;
  if existing.points <> total or (existing.daily_number is not null and challenge_number is distinct from existing.daily_number) then
    return jsonb_build_object('status','conflict','game_id',target);
  end if;
  if existing.rounds is null then
    merged := pictures;
    updated := true;
  else
    merged := '[]'::jsonb;
    for i in 0..4 loop
      old_picture := existing.rounds->i;
      new_picture := pictures->i;
      if old_picture->'points' <> new_picture->'points' or
         (old_picture->>'years_off' is not null and new_picture->>'years_off' is not null and old_picture->'years_off' <> new_picture->'years_off') or
         (old_picture->>'distance_km' is not null and new_picture->>'distance_km' is not null and old_picture->'distance_km' <> new_picture->'distance_km') then
        return jsonb_build_object('status','conflict','game_id',target);
      end if;
      merged := merged || jsonb_build_array(jsonb_build_object(
        'points',old_picture->'points',
        'years_off',coalesce(nullif(old_picture->'years_off','null'::jsonb),new_picture->'years_off'),
        'distance_km',coalesce(nullif(old_picture->'distance_km','null'::jsonb),new_picture->'distance_km')
      ));
    end loop;
    updated := merged <> existing.rounds;
  end if;
  updated := updated or (existing.daily_number is null and challenge_number is not null);
  if updated then
    update public.results set rounds = merged, daily_number = coalesce(daily_number,challenge_number) where game_id = target and player_id = player;
  end if;
  return jsonb_build_object('status',case when updated then 'enriched' else 'already_saved' end,'game_id',target);
end;
$$;
revoke all on function public.import_timeguessr_result(date,integer,text,date,integer,jsonb,integer) from public, anon, authenticated;
grant execute on function public.import_timeguessr_result(date,integer,text,date,integer,jsonb,integer) to authenticated;
commit;
