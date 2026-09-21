# Supabase backend

Database changes for this project are version-controlled in `supabase/migrations/`.

## Initial model

- `planners` — one shared trip-planning workspace.
- `planner_members` — users who can collaborate on a planner.
- `events` — scheduled calendar items.
- `wishes` — unscheduled ideas that can later be linked to an event.

The schema is auth-ready and uses Row Level Security so only authenticated planner members can read or modify a planner's data.

The GitHub integration is configured to deploy database migrations from the `main` branch.
