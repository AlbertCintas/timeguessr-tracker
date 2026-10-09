begin;
alter table public.games drop constraint if exists games_check;
alter table public.games add constraint games_check check (
  (kind = 'daily' and daily_date is not null and name is null) or
  (kind = 'custom' and daily_date is null and length(trim(name)) between 1 and 250)
);
create unique index if not exists games_timeguessr_id on public.games(name)
where kind = 'custom' and name ~ '^[a-f0-9]{64}:[a-f0-9]{32}$';
create or replace function public.get_or_create_game(game_date date default null, game_name text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare game_id uuid;
begin
  if not exists(select 1 from public.profiles where id = auth.uid()) then raise exception 'Sign in to create a game'; end if;
  if game_date is not null then
    if game_date > (now() at time zone 'Europe/Madrid')::date then raise exception 'Choose today or a past date'; end if;
    insert into public.games(kind, daily_date, created_by) values ('daily', game_date, auth.uid()) on conflict(daily_date) do nothing returning id into game_id;
    if game_id is null then select id into game_id from public.games where daily_date = game_date; end if;
  else
    if game_name is null or length(trim(game_name)) not between 1 and 250 then raise exception 'Enter a game name'; end if;
    game_name := trim(game_name);
    if game_name ~* '^[a-f0-9]{64}:[a-f0-9]{32}$' then game_name := lower(game_name); end if;
    insert into public.games(kind, name, created_by) values ('custom', game_name, auth.uid())
    on conflict(name) where kind = 'custom' and name ~ '^[a-f0-9]{64}:[a-f0-9]{32}$' do nothing returning id into game_id;
    if game_id is null then select id into game_id from public.games where kind = 'custom' and name = game_name; end if;
  end if;
  return game_id;
end;
$$;
commit;
