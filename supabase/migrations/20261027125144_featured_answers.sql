begin;
create or replace function public.valid_picture_results(details jsonb, total integer)
returns boolean language plpgsql immutable set search_path = '' as $$
declare picture jsonb; score numeric; years numeric; distance numeric; combined numeric := 0;
begin
  if details is null then return true; end if;
  if jsonb_typeof(details) <> 'array' then return false; end if;
  if jsonb_array_length(details) <> 5 then return false; end if;
  for picture in select value from jsonb_array_elements(details) loop
    if jsonb_typeof(picture) <> 'object' or not (picture ?& array['points','years_off','distance_km']) then return false; end if;
    if jsonb_typeof(picture->'points') <> 'number' then return false; end if;
    score := (picture->>'points')::numeric;
    if score < 0 or score > 10000 or trunc(score) <> score then return false; end if;
    if jsonb_typeof(picture->'years_off') not in ('number','null') or jsonb_typeof(picture->'distance_km') not in ('number','null') then return false; end if;
    years := (picture->>'years_off')::numeric;
    distance := (picture->>'distance_km')::numeric;
    if years < 0 or years > 2147483647 or trunc(years) <> years or distance < 0 or distance > 1000000000 then return false; end if;
    if picture ? 'actual_year' and picture->'actual_year' <> 'null'::jsonb then
      if jsonb_typeof(picture->'actual_year') <> 'number' then return false; end if;
      years := (picture->>'actual_year')::numeric;
      if years < 1 or years > 9999 or trunc(years) <> years then return false; end if;
    end if;
    if picture ? 'actual_location' and picture->'actual_location' <> 'null'::jsonb then
      if jsonb_typeof(picture->'actual_location') <> 'object'
         or not ((picture->'actual_location') ?& array['lat','lng'])
         or jsonb_typeof(picture->'actual_location'->'lat') <> 'number'
         or jsonb_typeof(picture->'actual_location'->'lng') <> 'number' then return false; end if;
      if abs((picture->'actual_location'->>'lat')::numeric) > 90
         or abs((picture->'actual_location'->>'lng')::numeric) > 180 then return false; end if;
    end if;
    combined := combined + score;
  end loop;
  return combined = total;
exception when others then return false;
end;
$$;

create or replace function public.import_timeguessr_result(
  challenge_date date, challenge_number integer, source_key text,
  played_date date, total integer, pictures jsonb, timer_seconds integer default 0, replay_game_id text default null
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
  if replay_game_id is not null and (challenge_date is not null or replay_game_id !~ '^[a-f0-9]{64}:[a-f0-9]{32}$') then raise exception 'Invalid replay identity'; end if;
  if challenge_date is not null then
    if challenge_number is null or challenge_number not between 1 and 1000000 or challenge_date < date '2023-06-01' or challenge_date > (now() at time zone 'Europe/Madrid')::date or source_key is not null then raise exception 'Invalid daily challenge date'; end if;
    insert into public.games(kind, daily_date, created_by) values ('daily', challenge_date, player) on conflict(daily_date) do nothing;
    select id into target from public.games where daily_date = challenge_date for update;
  else
    if challenge_number is not null or source_key is null or source_key !~ '^timeguessr:v1:[a-f0-9]{64}$' then raise exception 'Invalid game identity'; end if;
    select id into target from public.games where external_key = source_key for update;
    if target is null and replay_game_id is not null then
      select id into target from public.games where (replay_id = replay_game_id or (replay_id is null and name = replay_game_id)) and games.timer_seconds = import_timeguessr_result.timer_seconds for update;
    end if;
    if target is null then
      insert into public.games(kind, name, external_key, played_on, created_by, replay_id, timer_seconds)
      values ('custom', coalesce(replay_game_id || case when timer_seconds > 0 then ' · ' || timer_seconds || 's' else '' end, 'Timeguessr' || case when timer_seconds > 0 then ' · ' || timer_seconds || 's' else '' end || ' · ' || right(source_key, 6)), source_key, played_date, player, replay_game_id, timer_seconds)
      on conflict do nothing returning id into target;
      if target is null then
        select id into target from public.games where external_key = source_key or ((replay_id = replay_game_id or (replay_id is null and name = replay_game_id)) and games.timer_seconds = import_timeguessr_result.timer_seconds) for update;
      end if;
    end if;
    if replay_game_id is not null then
      if exists(select 1 from public.games where id = target and replay_id is not null and replay_id <> replay_game_id) then raise exception 'Replay identity does not match this game'; end if;
      update public.games set replay_id = replay_game_id, name = replay_game_id || case when import_timeguessr_result.timer_seconds > 0 then ' · ' || import_timeguessr_result.timer_seconds || 's' else '' end, timer_seconds = import_timeguessr_result.timer_seconds where id = target;
    end if;
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
      if (old_picture->>'actual_year' is not null and new_picture->>'actual_year' is not null and old_picture->'actual_year' <> new_picture->'actual_year') or
         (old_picture->>'actual_location' is not null and new_picture->>'actual_location' is not null and old_picture->'actual_location' <> new_picture->'actual_location') then
        return jsonb_build_object('status','conflict','game_id',target);
      end if;
      merged := merged || jsonb_build_array(jsonb_build_object(
        'points',old_picture->'points',
        'years_off',coalesce(nullif(old_picture->'years_off','null'::jsonb),new_picture->'years_off'),
        'distance_km',coalesce(nullif(old_picture->'distance_km','null'::jsonb),new_picture->'distance_km')
      ) || jsonb_strip_nulls(jsonb_build_object(
        'actual_year',coalesce(nullif(old_picture->'actual_year','null'::jsonb),new_picture->'actual_year'),
        'actual_location',coalesce(nullif(old_picture->'actual_location','null'::jsonb),new_picture->'actual_location')
      )));
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
revoke all on function public.import_timeguessr_result(date,integer,text,date,integer,jsonb,integer,text) from public, anon, authenticated;
grant execute on function public.import_timeguessr_result(date,integer,text,date,integer,jsonb,integer,text) to authenticated;
-- Shared photograph answers are independent of whether any player shared detailed scores.
create or replace function public.valid_timeguessr_answers(answers jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare picture jsonb; details jsonb := '[]'::jsonb; has_answer boolean := false;
begin
  if answers is null then return true; end if;
  if jsonb_typeof(answers) <> 'array' or jsonb_array_length(answers) <> 5 then return false; end if;
  for picture in select value from jsonb_array_elements(answers) loop
    if jsonb_typeof(picture) <> 'object' or not (picture ?& array['actual_year','actual_location'])
       or picture - 'actual_year' - 'actual_location' <> '{}'::jsonb then return false; end if;
    has_answer := has_answer or picture->>'actual_year' is not null or picture->>'actual_location' is not null;
    details := details || jsonb_build_array(picture || jsonb_build_object('points',0,'years_off',null,'distance_km',null));
  end loop;
  return has_answer and public.valid_picture_results(details,0);
exception when others then return false;
end;
$$;
alter table public.games add column if not exists correct_answers jsonb check (public.valid_timeguessr_answers(correct_answers));
alter table public.games add column if not exists answers_source_url text;
alter table public.games add column if not exists answers_backfill_checked_at timestamptz;

-- Any signed-in club member may enrich shared answers for an already-played game.
-- This grants no ability to edit another player's score or to create a game.
create or replace function public.timeguessr_backfill_candidates()
returns table(id uuid, kind text, daily_date date, replay_id text, name text)
language sql stable security invoker set search_path = '' as $$
  select g.id, g.kind, g.daily_date, g.replay_id, g.name
  from public.games g
  where exists(select 1 from public.profiles p where p.id = (select auth.uid()))
    and exists(select 1 from public.results r where r.game_id = g.id)
    and (g.answers_backfill_checked_at is null or g.answers_backfill_checked_at < now() - interval '1 day')
    and (g.correct_answers is null or exists(
      select 1 from jsonb_array_elements(g.correct_answers) a
      where a->>'actual_year' is null or a->>'actual_location' is null
    ))
  order by g.answers_backfill_checked_at nulls first, g.id
  limit 3;
$$;
create or replace function public.backfill_timeguessr_answers(target_game uuid, answers jsonb, source_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  game public.games%rowtype;
  merged jsonb := '[]'::jsonb;
  previous jsonb;
  incoming jsonb;
  i integer;
  player uuid := auth.uid();
  expected_replay text;
begin
  if player is null or not exists(select 1 from public.profiles where id = player) then raise exception 'Sign in to backfill answers'; end if;
  select * into game from public.games where id = target_game for update;
  if game.id is null or not exists(select 1 from public.results where game_id = target_game) then raise exception 'Only played games can be backfilled'; end if;
  if answers is null then
    update public.games set answers_backfill_checked_at = now() where id = target_game;
    return jsonb_build_object('status','unavailable');
  end if;
  if not public.valid_timeguessr_answers(answers) then raise exception 'Invalid photograph answers'; end if;
  if game.kind = 'daily' then
    if source_url is null or (source_url !~ '^https://timeguessr\.com/play\?mode=daily&archive=[0-9]+-[a-f0-9]+$' and source_url is distinct from 'https://timeguessr.com/archive?month=' || to_char(game.daily_date,'YYYY-MM')) then raise exception 'Invalid daily source'; end if;
  else
    expected_replay := coalesce(game.replay_id,case when game.name ~ '^[a-f0-9]{64}:[a-f0-9]{32}$' then game.name end);
    if expected_replay is null or source_url is distinct from 'https://timeguessr.com/game-settings?RA=' || replace(expected_replay,':','%3A') then raise exception 'Invalid replay source'; end if;
  end if;
  for i in 0..4 loop
    previous := game.correct_answers->i;
    incoming := answers->i;
    if (previous->>'actual_year' is not null and incoming->>'actual_year' is not null and previous->'actual_year' <> incoming->'actual_year')
       or (previous->>'actual_location' is not null and incoming->>'actual_location' is not null and previous->'actual_location' <> incoming->'actual_location') then
      update public.games set answers_backfill_checked_at = now() where id = target_game;
      return jsonb_build_object('status','conflict');
    end if;
    merged := merged || jsonb_build_array(jsonb_build_object(
      'actual_year',coalesce(nullif(previous->'actual_year','null'::jsonb),incoming->'actual_year'),
      'actual_location',coalesce(nullif(previous->'actual_location','null'::jsonb),incoming->'actual_location')
    ));
  end loop;
  update public.games set correct_answers = merged, answers_source_url = source_url, answers_backfill_checked_at = now() where id = target_game;
  return jsonb_build_object('status',case when merged is distinct from game.correct_answers then 'enriched' else 'already_saved' end);
end;
$$;
revoke all on function public.timeguessr_backfill_candidates() from public,anon,authenticated;
revoke all on function public.backfill_timeguessr_answers(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.timeguessr_backfill_candidates() to authenticated;
grant execute on function public.backfill_timeguessr_answers(uuid,jsonb,text) to authenticated;

commit;
