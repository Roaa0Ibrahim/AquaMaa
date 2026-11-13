-- AquaMaa: Supabase setup for the dashboard (read-only access to public.readings).
-- Run once in the Supabase SQL editor as the project owner. Safe to re-run.
--
-- The dashboard uses the PUBLISHABLE key, which maps to the `anon` role. AquaMaa has its own
-- sign-in and does not use Supabase Auth, so the browser queries as `anon`. This policy therefore
-- makes readings readable by anyone who holds the publishable key. If readings must be private,
-- put the dashboard behind Supabase Auth and change the role below to `authenticated`.

-- 1. Row Level Security stays ON; the dashboard only needs SELECT.
alter table public.readings enable row level security;

drop policy if exists "dashboard can read readings" on public.readings;
create policy "dashboard can read readings"
  on public.readings
  for select
  to anon, authenticated
  using (true);

-- Do NOT grant the dashboard insert/update/delete. Check what else exists first:
--   select policyname, cmd, roles from pg_policies where tablename = 'readings';
-- (Your devices must keep whatever insert path they use today; this script does not touch it.)

-- 2. Indexes for "latest reading per device" and time-range history queries.
create index if not exists readings_created_at_idx on public.readings (created_at desc);
create index if not exists readings_device_created_idx on public.readings (device_id, created_at desc);

-- 3. Realtime: publish inserts so the dashboard updates without polling.
do $$
begin
  alter publication supabase_realtime add table public.readings;
exception
  when duplicate_object then null;  -- already published
end $$;
