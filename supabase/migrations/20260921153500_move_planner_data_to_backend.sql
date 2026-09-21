-- Move planner configuration and seeded itinerary data into Postgres.
-- Existing custom events/wishes are preserved. Seed rows use stable legacy keys
-- so this migration remains idempotent if retried.

alter table public.planners
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists pto_allowance integer not null default 0
    check (pto_allowance >= 0);

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid not null references public.planners(id) on delete cascade,
  title text not null,
  summary text not null default '',
  badge text not null default '',
  start_date date not null,
  end_date date not null,
  is_featured boolean not null default false,
  legacy_key text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create unique index if not exists itineraries_planner_legacy_key_uidx
  on public.itineraries (planner_id, legacy_key)
  where legacy_key is not null;

alter table public.events
  add column if not exists itinerary_id uuid references public.itineraries(id) on delete set null,
  add column if not exists legacy_key text;

create unique index if not exists events_planner_legacy_key_uidx
  on public.events (planner_id, legacy_key)
  where legacy_key is not null;

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid not null references public.planners(id) on delete cascade,
  person_name text not null,
  availability_date date not null,
  status text not null check (status in ('working','off','busy','free')),
  note text not null default '',
  legacy_key text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists availability_planner_person_date_uidx
  on public.availability (planner_id, person_name, availability_date);

create unique index if not exists availability_planner_legacy_key_uidx
  on public.availability (planner_id, legacy_key)
  where legacy_key is not null;

drop trigger if exists set_itineraries_updated_at on public.itineraries;
create trigger set_itineraries_updated_at
before update on public.itineraries
for each row execute function public.set_updated_at();

drop trigger if exists set_availability_updated_at on public.availability;
create trigger set_availability_updated_at
before update on public.availability
for each row execute function public.set_updated_at();

alter table public.itineraries enable row level security;
alter table public.availability enable row level security;

drop policy if exists itineraries_select_for_members on public.itineraries;
create policy itineraries_select_for_members
on public.itineraries for select to authenticated
using (public.is_planner_member(planner_id));

drop policy if exists itineraries_insert_for_members on public.itineraries;
create policy itineraries_insert_for_members
on public.itineraries for insert to authenticated
with check (public.is_planner_member(planner_id) and created_by = auth.uid());

drop policy if exists itineraries_update_for_members on public.itineraries;
create policy itineraries_update_for_members
on public.itineraries for update to authenticated
using (public.is_planner_member(planner_id))
with check (public.is_planner_member(planner_id));

drop policy if exists itineraries_delete_for_members on public.itineraries;
create policy itineraries_delete_for_members
on public.itineraries for delete to authenticated
using (public.is_planner_member(planner_id));

drop policy if exists availability_select_for_members on public.availability;
create policy availability_select_for_members
on public.availability for select to authenticated
using (public.is_planner_member(planner_id));

drop policy if exists availability_insert_for_members on public.availability;
create policy availability_insert_for_members
on public.availability for insert to authenticated
with check (public.is_planner_member(planner_id) and created_by = auth.uid());

drop policy if exists availability_update_for_members on public.availability;
create policy availability_update_for_members
on public.availability for update to authenticated
using (public.is_planner_member(planner_id))
with check (public.is_planner_member(planner_id));

drop policy if exists availability_delete_for_members on public.availability;
create policy availability_delete_for_members
on public.availability for delete to authenticated
using (public.is_planner_member(planner_id));

grant select, insert, update, delete on
  public.itineraries,
  public.availability
to authenticated;

-- Configure existing planners for this current visit. Future planners remain
-- user-configurable and do not receive this seed migration.
update public.planners
set start_date = coalesce(start_date, date '2026-11-04'),
    end_date = coalesce(end_date, date '2026-12-10'),
    pto_allowance = case when pto_allowance = 0 then 8 else pto_allowance end;

-- Seed three featured itinerary groups for each existing planner.
insert into public.itineraries
  (planner_id,title,summary,badge,start_date,end_date,is_featured,legacy_key,created_by)
select p.id,'Edmonton Staycation',
       'Low-effort first weekend while Jen adjusts to jet lag. Hotel, spa and shopping are the main point.',
       'Road trip',date '2026-11-07',date '2026-11-08',true,'edmonton',p.created_by
from public.planners p
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.itineraries
  (planner_id,title,summary,badge,start_date,end_date,is_featured,legacy_key,created_by)
select p.id,'Toronto + Niagara Falls',
       'Niagara overnight, Markham Chinese food and half a day downtown.',
       '3 PTO days',date '2026-11-16',date '2026-11-18',true,'toronto',p.created_by
from public.planners p
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.itineraries
  (planner_id,title,summary,badge,start_date,end_date,is_featured,legacy_key,created_by)
select p.id,'Final Days Together',
       'Keep the final four days flexible for weather, ski conditions, Canmore and departure.',
       '4 PTO days',date '2026-12-07',date '2026-12-10',true,'final',p.created_by
from public.planners p
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

-- Seed calendar events. Existing user-created events are not touched.
insert into public.events
  (planner_id,event_date,title,summary,event_type,is_pto,itinerary_id,legacy_key,created_by)
select p.id,date '2026-11-07','Edmonton · Day 1',
       'Drive from Calgary, Pura Botanicals perfume session, hotel and spa.',
       'trip',false,i.id,'edmonton_day1',p.created_by
from public.planners p
join public.itineraries i on i.planner_id=p.id and i.legacy_key='edmonton'
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.events
  (planner_id,event_date,title,summary,event_type,is_pto,itinerary_id,legacy_key,created_by)
select p.id,date '2026-11-08','Edmonton · Day 2',
       'West Edmonton Mall, MUJI and relaxed shopping; optional Muttart Conservatory.',
       'trip',false,i.id,'edmonton_day2',p.created_by
from public.planners p
join public.itineraries i on i.planner_id=p.id and i.legacy_key='edmonton'
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.events
  (planner_id,event_date,title,summary,event_type,is_pto,legacy_key,created_by)
select p.id,date '2026-11-11','Remembrance Day',
       'Both off. Keep flexible because Jen may work late Nov 10; Everwild or an easy Calgary date day.',
       'local',false,'remembrance_day',p.created_by
from public.planners p
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.events
  (planner_id,event_date,title,summary,event_type,is_pto,itinerary_id,legacy_key,created_by)
select p.id,date '2026-11-16','Toronto · Niagara',
       'Fly YYC to YYZ, pick up rental car, drive to Niagara and stay Fallsview.',
       'trip',true,i.id,'toronto_day1',p.created_by
from public.planners p
join public.itineraries i on i.planner_id=p.id and i.legacy_key='toronto'
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.events
  (planner_id,event_date,title,summary,event_type,is_pto,itinerary_id,legacy_key,created_by)
select p.id,date '2026-11-17','Toronto · Markham',
       'Niagara morning, Markham Chinese food, return car downtown and stay near Union.',
       'trip',true,i.id,'toronto_day2',p.created_by
from public.planners p
join public.itineraries i on i.planner_id=p.id and i.legacy_key='toronto'
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.events
  (planner_id,event_date,title,summary,event_type,is_pto,itinerary_id,legacy_key,created_by)
select p.id,date '2026-11-18','Toronto · Downtown',
       'Half-day downtown, then UP Express to YYZ and fly home.',
       'trip',true,i.id,'toronto_day3',p.created_by
from public.planners p
join public.itineraries i on i.planner_id=p.id and i.legacy_key='toronto'
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.events
  (planner_id,event_date,title,summary,event_type,is_pto,legacy_key,created_by)
select p.id,date '2026-11-24','Everwild Nordic Spa',
       'Placeholder after-work spa night in Canmore.',
       'activity',false,'everwild_spa',p.created_by
from public.planners p
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.events
  (planner_id,event_date,title,summary,event_type,is_pto,legacy_key,created_by)
select p.id,date '2026-12-01','WinSport Ski Night',
       'Tentative after-work ski evening, weather and hill opening permitting.',
       'activity',false,'winsport_dec1',p.created_by
from public.planners p
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

insert into public.events
  (planner_id,event_date,title,summary,event_type,is_pto,itinerary_id,legacy_key,created_by)
select p.id,d.dt,'PTO · final block',
       case d.dt
         when date '2026-12-07' then 'Open full day; good candidate for Canmore / Everwild overnight.'
         when date '2026-12-08' then 'Tentative WinSport ski day or evening.'
         when date '2026-12-09' then 'Open final full day together.'
         when date '2026-12-10' then 'Departure / airport day.'
       end,
       case when d.dt=date '2026-12-08' then 'activity' else 'trip' end,
       true,i.id,'final_'||to_char(d.dt,'YYYYMMDD'),p.created_by
from public.planners p
join public.itineraries i on i.planner_id=p.id and i.legacy_key='final'
cross join (values
  (date '2026-12-07'),
  (date '2026-12-08'),
  (date '2026-12-09'),
  (date '2026-12-10')
) as d(dt)
on conflict (planner_id, legacy_key) where legacy_key is not null do nothing;

-- Jen's availability from the original frontend.
insert into public.availability
  (planner_id,person_name,availability_date,status,note,legacy_key,created_by)
select p.id,'Jen',d.dt,'working','Jen working','jen_work_'||to_char(d.dt,'YYYYMMDD'),p.created_by
from public.planners p
cross join (
  select gs::date as dt
  from generate_series(date '2026-11-09',date '2026-11-10',interval '1 day') gs
  union all
  select gs::date from generate_series(date '2026-11-12',date '2026-11-15',interval '1 day') gs
  union all
  select gs::date from generate_series(date '2026-11-20',date '2026-11-22',interval '1 day') gs
  union all
  select gs::date from generate_series(date '2026-11-27',date '2026-11-29',interval '1 day') gs
  union all
  select gs::date from generate_series(date '2026-12-04',date '2026-12-06',interval '1 day') gs
) d
on conflict (planner_id, person_name, availability_date) do nothing;

insert into public.availability
  (planner_id,person_name,availability_date,status,note,legacy_key,created_by)
select p.id,'Jen',date '2026-11-11','off','Both off for Remembrance Day','jen_off_20261111',p.created_by
from public.planners p
on conflict (planner_id, person_name, availability_date) do nothing;
