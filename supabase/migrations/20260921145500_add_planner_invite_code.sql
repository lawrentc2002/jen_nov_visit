-- Add share-code collaboration for the planner.

alter table public.planners
  add column if not exists invite_code text;

update public.planners
set invite_code = upper(encode(gen_random_bytes(5), 'hex'))
where invite_code is null;

alter table public.planners
  alter column invite_code set default upper(encode(gen_random_bytes(5), 'hex'));

alter table public.planners
  alter column invite_code set not null;

create unique index if not exists planners_invite_code_uidx
  on public.planners (invite_code);

create or replace function public.join_planner_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $join$
declare
  target_id uuid;
begin
  select id
    into target_id
  from public.planners
  where invite_code = upper(trim(code))
  limit 1;

  if target_id is null then
    raise exception 'Invalid planner code';
  end if;

  insert into public.planner_members (planner_id, user_id, role)
  values (target_id, auth.uid(), 'member')
  on conflict (planner_id, user_id) do nothing;

  return target_id;
end;
$join$;

grant execute on function public.join_planner_by_code(text) to authenticated;
