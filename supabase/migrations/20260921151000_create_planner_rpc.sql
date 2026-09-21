-- Create planners through a server-side RPC so initial ownership can be
-- established atomically without tripping planner/member RLS bootstrapping.

create or replace function public.create_planner(planner_name text)
returns table (
  id uuid,
  name text,
  invite_code text
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

  insert into public.planners (name, created_by)
  values (trim(planner_name), auth.uid())
  returning * into new_planner;

  -- The existing AFTER INSERT trigger adds the owner membership.
  return query
  select new_planner.id, new_planner.name, new_planner.invite_code;
end;
$create$;

grant execute on function public.create_planner(text) to authenticated;
