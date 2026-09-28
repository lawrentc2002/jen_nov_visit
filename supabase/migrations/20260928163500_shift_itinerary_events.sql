create or replace function public.update_itinerary_and_shift_events(
  itinerary_uuid uuid,
  new_title text,
  new_start_date date,
  new_end_date date,
  new_badge text,
  new_summary text,
  new_is_featured boolean
)
returns public.itineraries
language plpgsql
security definer
set search_path = public
as $fn$
declare
  current_itinerary public.itineraries;
  current_planner public.planners;
  day_shift integer;
  shifted_min date;
  shifted_max date;
  updated_itinerary public.itineraries;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into current_itinerary
  from public.itineraries
  where id = itinerary_uuid;

  if current_itinerary.id is null then
    raise exception 'Itinerary not found';
  end if;

  if not public.is_planner_member(current_itinerary.planner_id) then
    raise exception 'Not authorized';
  end if;

  if nullif(trim(new_title), '') is null then
    raise exception 'Itinerary title is required';
  end if;

  if new_start_date is null or new_end_date is null or new_end_date < new_start_date then
    raise exception 'Invalid itinerary date range';
  end if;

  select *
  into current_planner
  from public.planners
  where id = current_itinerary.planner_id;

  if new_start_date < current_planner.start_date or new_end_date > current_planner.end_date then
    raise exception 'Itinerary must stay inside the planner date range';
  end if;

  day_shift := new_start_date - current_itinerary.start_date;

  if day_shift <> 0 then
    select min(event_date + day_shift), max(event_date + day_shift)
    into shifted_min, shifted_max
    from public.events
    where itinerary_id = itinerary_uuid;

    if shifted_min is not null and (
      shifted_min < current_planner.start_date
      or shifted_max > current_planner.end_date
    ) then
      raise exception 'Moving this itinerary would place linked events outside the planner date range';
    end if;

    update public.events
    set event_date = event_date + day_shift
    where itinerary_id = itinerary_uuid;
  end if;

  update public.itineraries
  set
    title = trim(new_title),
    start_date = new_start_date,
    end_date = new_end_date,
    badge = nullif(trim(new_badge), ''),
    summary = coalesce(new_summary, ''),
    is_featured = coalesce(new_is_featured, false)
  where id = itinerary_uuid
  returning * into updated_itinerary;

  return updated_itinerary;
end;
$fn$;

grant execute on function public.update_itinerary_and_shift_events(
  uuid, text, date, date, text, text, boolean
) to authenticated;
