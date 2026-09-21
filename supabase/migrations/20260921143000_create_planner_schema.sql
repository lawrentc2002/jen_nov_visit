-- Jen Visit Planner initial schema
-- Production-style, auth-ready shared planner model for Supabase/Postgres.

create extension if not exists pgcrypto;

create table if not exists public.planners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.planner_members (
  planner_id uuid not null references public.planners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (planner_id, user_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid not null references public.planners(id) on delete cascade,
  event_date date not null,
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '',
  event_type text not null default 'activity'
    check (event_type in ('activity','trip','local')),
  is_pto boolean not null default false,
  source_wish_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid not null references public.planners(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  notes text not null default '',
  category text not null default 'activity'
    check (category in ('activity','food','trip','shopping','other')),
  status text not null default 'open'
    check (status in ('open','planned','resolved')),
  scheduled_event_id uuid references public.events(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events
  add constraint events_source_wish_id_fkey
  foreign key (source_wish_id)
  references public.wishes(id)
  on delete set null;

create index if not exists events_planner_date_idx
  on public.events (planner_id, event_date);

create index if not exists wishes_planner_status_idx
  on public.wishes (planner_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists set_wishes_updated_at on public.wishes;
create trigger set_wishes_updated_at
before update on public.wishes
for each row execute function public.set_updated_at();

create or replace function public.add_planner_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.planner_members (planner_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists add_planner_owner_after_insert on public.planners;
create trigger add_planner_owner_after_insert
after insert on public.planners
for each row execute function public.add_planner_owner();

alter table public.planners enable row level security;
alter table public.planner_members enable row level security;
alter table public.events enable row level security;
alter table public.wishes enable row level security;

create or replace function public.is_planner_member(target_planner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.planner_members pm
    where pm.planner_id = target_planner_id
      and pm.user_id = auth.uid()
  );
$fn$;

create or replace function public.is_planner_owner(target_planner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from public.planner_members pm
    where pm.planner_id = target_planner_id
      and pm.user_id = auth.uid()
      and pm.role = 'owner'
  );
$fn$;

drop policy if exists planners_select_for_members on public.planners;
create policy planners_select_for_members
on public.planners
for select
to authenticated
using (public.is_planner_member(id));

drop policy if exists planners_insert_self on public.planners;
create policy planners_insert_self
on public.planners
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists planners_update_owner on public.planners;
create policy planners_update_owner
on public.planners
for update
to authenticated
using (public.is_planner_owner(id))
with check (public.is_planner_owner(id));

drop policy if exists planner_members_select_for_members on public.planner_members;
create policy planner_members_select_for_members
on public.planner_members
for select
to authenticated
using (public.is_planner_member(planner_id));

drop policy if exists planner_members_insert_owner_only on public.planner_members;
create policy planner_members_insert_owner_only
on public.planner_members
for insert
to authenticated
with check (public.is_planner_owner(planner_id));

drop policy if exists planner_members_delete_owner_only on public.planner_members;
create policy planner_members_delete_owner_only
on public.planner_members
for delete
to authenticated
using (public.is_planner_owner(planner_id));

drop policy if exists events_select_for_members on public.events;
create policy events_select_for_members
on public.events
for select
to authenticated
using (public.is_planner_member(planner_id));

drop policy if exists events_insert_for_members on public.events;
create policy events_insert_for_members
on public.events
for insert
to authenticated
with check (
  public.is_planner_member(planner_id)
  and created_by = auth.uid()
);

drop policy if exists events_update_for_members on public.events;
create policy events_update_for_members
on public.events
for update
to authenticated
using (public.is_planner_member(planner_id))
with check (public.is_planner_member(planner_id));

drop policy if exists events_delete_for_members on public.events;
create policy events_delete_for_members
on public.events
for delete
to authenticated
using (public.is_planner_member(planner_id));

drop policy if exists wishes_select_for_members on public.wishes;
create policy wishes_select_for_members
on public.wishes
for select
to authenticated
using (public.is_planner_member(planner_id));

drop policy if exists wishes_insert_for_members on public.wishes;
create policy wishes_insert_for_members
on public.wishes
for insert
to authenticated
with check (
  public.is_planner_member(planner_id)
  and created_by = auth.uid()
);

drop policy if exists wishes_update_for_members on public.wishes;
create policy wishes_update_for_members
on public.wishes
for update
to authenticated
using (public.is_planner_member(planner_id))
with check (public.is_planner_member(planner_id));

drop policy if exists wishes_delete_for_members on public.wishes;
create policy wishes_delete_for_members
on public.wishes
for delete
to authenticated
using (public.is_planner_member(planner_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.planners,
  public.planner_members,
  public.events,
  public.wishes
to authenticated;
