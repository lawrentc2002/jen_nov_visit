-- Make planner creation fully data-driven for future planners.

drop function if exists public.create_planner(text);

create or replace function public.create_planner(
  planner_name text,
  planner_start_date date,
  planner_end_date date,
  planner_pto_allowance integer default 0
)
returns table (
  id uuid,
  name text,
  invite_code text,
  start_date date,
  end_date date,
  pto_allowance integer
)
language plpgsql
security definer
set search_path = public
as $create$
declare
  new_planner public.planners;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(planner_name), '') is null then
    raise exception 'Planner name is required';
  end if;

  if planner_start_date is null or planner_end_date is null then
    raise exception 'Planner dates are required';
  end if;

  if planner_end_date < planner_start_date then
    raise exception 'End date must be on or after start date';
  end if;

  if coalesce(planner_pto_allowance,0) < 0 then
    raise exception 'PTO allowance cannot be negative';
  end if;

  insert into public.planners
    (name, created_by, start_date, end_date, pto_allowance)
  values
    (trim(planner_name), auth.uid(), planner_start_date, planner_end_date, coalesce(planner_pto_allowance,0))
  returning * into new_planner;

  return query
  select new_planner.id, new_planner.name, new_planner.invite_code,
         new_planner.start_date, new_planner.end_date, new_planner.pto_allowance;
end;
$create$;

grant execute on function public.create_planner(text,date,date,integer) to authenticated;
