create table if not exists public.itinerary_tasks (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid not null references public.planners(id) on delete cascade,
  itinerary_id uuid references public.itineraries(id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  status text not null default 'todo' check (status in ('todo','done')),
  due_date date,
  notes text,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists itinerary_tasks_planner_status_idx
  on public.itinerary_tasks(planner_id, status);

create index if not exists itinerary_tasks_itinerary_idx
  on public.itinerary_tasks(itinerary_id);

drop trigger if exists itinerary_tasks_set_updated_at on public.itinerary_tasks;
create trigger itinerary_tasks_set_updated_at
before update on public.itinerary_tasks
for each row execute function public.set_updated_at();

alter table public.itinerary_tasks enable row level security;

drop policy if exists "planner members can read tasks" on public.itinerary_tasks;
create policy "planner members can read tasks"
on public.itinerary_tasks for select
to authenticated
using (public.is_planner_member(planner_id));

drop policy if exists "planner members can create tasks" on public.itinerary_tasks;
create policy "planner members can create tasks"
on public.itinerary_tasks for insert
to authenticated
with check (
  public.is_planner_member(planner_id)
  and created_by = auth.uid()
  and (
    itinerary_id is null
    or exists (
      select 1 from public.itineraries i
      where i.id = itinerary_id and i.planner_id = itinerary_tasks.planner_id
    )
  )
);

drop policy if exists "planner members can update tasks" on public.itinerary_tasks;
create policy "planner members can update tasks"
on public.itinerary_tasks for update
to authenticated
using (public.is_planner_member(planner_id))
with check (
  public.is_planner_member(planner_id)
  and (
    itinerary_id is null
    or exists (
      select 1 from public.itineraries i
      where i.id = itinerary_id and i.planner_id = itinerary_tasks.planner_id
    )
  )
);

drop policy if exists "planner members can delete tasks" on public.itinerary_tasks;
create policy "planner members can delete tasks"
on public.itinerary_tasks for delete
to authenticated
using (public.is_planner_member(planner_id));

grant select, insert, update, delete on public.itinerary_tasks to authenticated;
