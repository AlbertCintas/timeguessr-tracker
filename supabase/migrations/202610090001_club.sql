create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  avatar_path text
);
create table public.administrators (player_id uuid primary key references public.profiles(id) on delete cascade);
create table public.games (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily', 'custom')),
  daily_date date unique,
  name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((kind = 'daily' and daily_date is not null and name is null) or (kind = 'custom' and daily_date is null and length(trim(name)) between 1 and 80))
);
create table public.results (
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null check (points >= 0),
  primary key (game_id, player_id)
);
create index results_player on public.results(player_id);
create table public.invitations (
  token_hash text primary key,
  make_admin boolean not null default false,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz
);
alter table public.profiles enable row level security;
alter table public.administrators enable row level security;
alter table public.games enable row level security;
alter table public.results enable row level security;
alter table public.invitations enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.administrators where player_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_edit on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy admin_self on public.administrators for select to authenticated using (player_id = (select auth.uid()));
create policy games_read on public.games for select to anon, authenticated using (true);
create policy results_read on public.results for select to anon, authenticated using (true);
create policy results_insert on public.results for insert to authenticated with check (player_id = (select auth.uid()) or public.is_admin());
create policy results_update on public.results for update to authenticated using (player_id = (select auth.uid()) or public.is_admin()) with check (player_id = (select auth.uid()) or public.is_admin());
create policy results_delete on public.results for delete to authenticated using (player_id = (select auth.uid()) or public.is_admin());
revoke all on public.profiles, public.administrators, public.games, public.results, public.invitations from anon, authenticated;
grant select on public.profiles, public.games, public.results to anon, authenticated;
grant select on public.administrators to authenticated;
grant update(display_name, avatar_path) on public.profiles to authenticated;
grant insert, update(points), delete on public.results to authenticated;
create function public.get_or_create_game(game_date date default null, game_name text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare game_id uuid;
begin
  if not exists(select 1 from public.profiles where id = auth.uid()) then raise exception 'Sign in to create a game'; end if;
  if game_date is not null then
    if game_date > (now() at time zone 'Europe/Madrid')::date then raise exception 'Choose today or a past date'; end if;
    insert into public.games(kind, daily_date, created_by) values ('daily', game_date, auth.uid()) on conflict(daily_date) do nothing returning id into game_id;
    if game_id is null then select id into game_id from public.games where daily_date = game_date; end if;
  else
    if game_name is null or length(trim(game_name)) not between 1 and 80 then raise exception 'Enter a game name'; end if;
    insert into public.games(kind, name, created_by) values ('custom', trim(game_name), auth.uid()) returning id into game_id;
  end if;
  return game_id;
end;
$$;
revoke all on function public.get_or_create_game(date,text) from public;
grant execute on function public.get_or_create_game(date,text) to authenticated;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']);
create policy avatar_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_read on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
