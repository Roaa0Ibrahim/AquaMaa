-- AquaMaa: put back the columns removed from public.readings, from public.readings_backup.
-- Run once in the Supabase SQL editor as the project owner. All or nothing (one transaction).
--
-- Restores, matched row by row on id:  device_id, ph_raw, ph_voltage, turbidity_raw, turbidity_voltage, ph_source
-- (only the ones readings_backup actually has; the others are added back empty, with a notice).
-- The new columns (turbidity_index, turbidity_status, water_level_status) are kept as they are.
-- Then repairs what the removal broke: the device index, the pH source column, and the two
-- insert triggers (well_id from device_id, pH from ph_voltage), so new ESP32 readings are accepted.

begin;

-- 1. Add the columns back and copy their values from the backup.
do $$
declare
  cols  text[] := array['device_id', 'ph_raw', 'ph_voltage', 'turbidity_raw', 'turbidity_voltage', 'ph_source'];
  types text[] := array['text',      'integer', 'real',      'integer',       'real',              'text'];
  sets  text := '';
  n     integer;
begin
  if to_regclass('public.readings_backup') is null then
    raise exception 'public.readings_backup was not found';
  end if;
  for i in 1 .. array_length(cols, 1) loop
    execute format('alter table public.readings add column if not exists %I %s', cols[i], types[i]);
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'readings_backup' and column_name = cols[i]) then
      sets := sets || case when sets = '' then '' else ', ' end || format('%I = b.%I', cols[i], cols[i]);
    else
      raise notice 'readings_backup has no column "%": added back empty', cols[i];
    end if;
  end loop;
  if sets = '' then
    raise exception 'readings_backup has none of the columns to restore';
  end if;
  execute 'update public.readings r set ' || sets || ' from public.readings_backup b where b.id = r.id';
  get diagnostics n = row_count;
  raise notice 'rows restored from readings_backup: %', n;
end $$;

-- 2. One sensor in the system today: a reading that arrives without device_id belongs to it,
--    so the dashboard (which groups by device) never drops it. Change when a second sensor exists.
update public.readings set device_id = 'AquaNova-ESP32-01' where device_id is null;
alter table public.readings alter column device_id set default 'AquaNova-ESP32-01';
alter table public.readings alter column device_id set not null;

create index if not exists readings_device_created_idx on public.readings (device_id, created_at desc);

-- 3. Where each pH value came from: restored above; any row the backup lacked is labelled here.
update public.readings set ph_source = 'estimate_factory_default'
 where ph_source is null and ph is not null and ph_voltage is not null;

-- 4. Insert triggers, rebuilt so they can never reject a reading.
--    well_id: from the device's registered well; an unknown device gets the next well number.
create or replace function public.assign_well_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  w integer;
begin
  if new.device_id is null then                 -- defensive: keep whatever well_id was sent
    new.well_id := coalesce(new.well_id, 1);
    return new;
  end if;
  select d.well_id into w from public.devices d where d.device_id = new.device_id;
  if w is null then
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

--    pH: computed from ph_voltage when the device does not send it (needs supabase/ph_from_voltage.sql).
do $$
begin
  if to_regprocedure('public.fill_ph()') is not null then
    execute 'drop trigger if exists readings_fill_ph on public.readings';
    execute 'create trigger readings_fill_ph before insert on public.readings for each row execute function public.fill_ph()';
  else
    raise notice 'public.fill_ph() not found: run supabase/ph_from_voltage.sql after this file';
  end if;
end $$;

commit;

-- Check (should show the restored values on the newest rows):
--   select id, created_at, device_id, well_id, ph, ph_voltage, ph_source, turbidity_raw, tds_ppm, temperature
--   from public.readings order by id desc limit 10;
--   select count(*) filter (where ph_voltage is null) as missing_ph_voltage,
--          count(*) filter (where turbidity_raw is null) as missing_turbidity
--   from public.readings;
