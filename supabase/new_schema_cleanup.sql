-- AquaMaa: database clean-up for the new readings table (15 Nov 2026).
-- Run once in the Supabase SQL editor as the project owner. Safe to re-run.
--
-- The ESP32 now computes pH itself and sends: ph, temperature, tds_ppm, turbidity_index,
-- turbidity_status, water_level_status (device_id defaults to AquaNova-ESP32-01).
-- The raw columns (ph_raw, ph_voltage, turbidity_raw, turbidity_voltage, ph_source) are gone, so the
-- pH-from-voltage trigger and its helpers refer to columns that no longer exist: a reading sent
-- without ph would make the insert FAIL. This removes them. The well_id trigger stays (it only uses
-- device_id and well_id).

begin;

drop trigger  if exists readings_fill_ph on public.readings;
drop function if exists public.fill_ph();
drop function if exists public.recompute_ph();
drop function if exists public.ph_from_voltage(real);
drop table    if exists public.ph_calibration;

commit;

-- Check: only readings_assign_well_id should be left.
--   select tgname from pg_trigger where tgrelid = 'public.readings'::regclass and not tgisinternal;
