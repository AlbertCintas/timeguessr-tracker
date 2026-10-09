begin;
alter table public.results add column if not exists rounds jsonb;
alter table public.results add column if not exists daily_number integer;
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
    combined := combined + score;
  end loop;
  return combined = total;
exception when others then return false;
end;
$$;
do $$
begin
  if not exists(select 1 from pg_constraint where conrelid = 'public.results'::regclass and conname = 'results_picture_details_valid') then
    alter table public.results add constraint results_picture_details_valid check (public.valid_picture_results(rounds, points));
  end if;
  if not exists(select 1 from pg_constraint where conrelid = 'public.results'::regclass and conname = 'results_daily_number_valid') then
    alter table public.results add constraint results_daily_number_valid check (daily_number between 1 and 1000000);
  end if;
end;
$$;
grant update(rounds, daily_number) on public.results to authenticated;
commit;
