-- AquaMaa: add well_id to public.readings.
-- Run once in the Supabase SQL editor as the project owner.
--
--  * Every existing reading is assigned to well 1.
--  * public.devices maps each sensor (device_id) to a well.
--  * On every insert, a trigger looks up the device_id and sets well_id automatically.
--    A device that is not registered yet gets the next well number (max + 1) and is registered.
--    To put a new sensor in an existing well, register it BEFORE it sends data, e.g.:
--      insert into public.devices (device_id, well_id) values ('AquaNova-ESP32-02', 1);

begin;

-- 1. Sensor -> well mapping.
create table if not exists public.devices (
  device_id  text primary key,
  well_id    integer not null check (well_id > 0),
  created_at timestamptz not null default now()
);
create index if not exists devices_well_idx on public.devices (well_id);

-- RLS on, with no policies: only the owner and the trigger below can change the mapping.
alter table public.devices enable row level security;

-- Every sensor that already sent data belongs to well 1.
insert into public.devices (device_id, well_id)
select distinct device_id, 1 from public.readings
on conflict (device_id) do nothing;

-- 2. New column: existing rows get 1 (instant, no table rewrite), then the default is removed
--    so new rows are always set by the trigger.
alter table public.readings add column if not exists well_id integer not null default 1;
alter table public.readings alter column well_id drop default;

create index if not exists readings_well_created_idx on public.readings (well_id, created_at desc);

-- 3. Trigger: derive well_id from device_id on every insert.
create or replace function public.assign_well_id()
returns trigger
language plpgsql
security definer           -- devices insert through the anon/service role; this lets the
set search_path = public   -- trigger read/write public.devices regardless of their RLS
as $$
declare
  w integer;
begin
  select d.well_id into w from public.devices d where d.device_id = new.device_id;

  if w is null then
    -- Unknown sensor: give it the next well number. The lock stops two first-time
    -- inserts from claiming the same number at once.
    perform pg_advisory_xact_lock(hashtext('aquamaa.assign_well_id'));
    select d.well_id into w from public.devices d where d.device_id = new.device_id;
    if w is null then
      select coalesce(max(d.well_id), 0) + 1 into w from public.devices d;
      insert into public.devices (device_id, well_id) values (new.device_id, w);
    end if;
  end if;

  new.well_id := w;
  return new;
end;
$$;

drop trigger if exists readings_assign_well_id on public.readings;
create trigger readings_assign_well_id
  before insert on public.readings
  for each row execute function public.assign_well_id();

commit;

-- Check:
--   select well_id, device_id, count(*) from public.readings group by 1, 2 order by 1;
--   select * from public.devices order by well_id;
