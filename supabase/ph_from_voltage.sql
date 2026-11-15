-- AquaMaa: compute pH in the database from the probe voltage (ph_voltage).
-- Run once in the Supabase SQL editor as the project owner. Safe to re-run.
--
-- Probe: DFRobot Gravity Analog pH Sensor V2 (SEN0161-V2), datasheet in database/08-sensors/.
-- Its library converts voltage to pH with two points: the voltage in pH 7.0 buffer ("neutral")
-- and in pH 4.0 buffer ("acid"):   pH = 7 - 3 * (V - neutral) / (acid - neutral)
--
-- No buffer calibration has been done yet, so the starting values are DFRobot's factory
-- defaults (neutral 1500 mV, acid 2032.44 mV). The result is an ESTIMATE (confirmed = false).
-- After a real calibration, update the one row in public.ph_calibration and run
--   select public.recompute_ph();
-- Every reader (website, Pepper, the AI agent) then shows the same corrected pH.

begin;

-- 1. The calibration: one row, edited when the probe is calibrated.
create table if not exists public.ph_calibration (
  id          integer primary key default 1 check (id = 1),
  neutral_mv  real not null,               -- probe voltage in pH 7.0 (mV)
  acid_mv     real not null,               -- probe voltage in pH 4.0 (mV)
  confirmed   boolean not null default false,
  source      text not null,
  updated_at  timestamptz not null default now()
);
insert into public.ph_calibration (id, neutral_mv, acid_mv, confirmed, source)
values (1, 1500, 2032.44, false, 'DFRobot SEN0161-V2 factory defaults (no buffer calibration yet)')
on conflict (id) do nothing;

alter table public.ph_calibration enable row level security;
drop policy if exists "dashboard can read ph calibration" on public.ph_calibration;
create policy "dashboard can read ph calibration" on public.ph_calibration
  for select to anon, authenticated using (true);

-- 2. Where the computed pH came from, so it can be recomputed (and labelled) later.
alter table public.readings add column if not exists ph_source text;

-- 3. The conversion. Returns null for impossible voltages (0 V glitches, a dry or
--    disconnected probe) instead of an invented value.
create or replace function public.ph_from_voltage(v_volts real)
returns real
language sql
stable
set search_path = public
as $$
  select case
    when v_volts is null or v_volts <= 0 then null
    else (
      select case when p between 0 and 14 then round(p::numeric, 2)::real end
      from (select 7 - 3 * (v_volts * 1000 - c.neutral_mv) / (c.acid_mv - c.neutral_mv) as p
            from public.ph_calibration c where c.id = 1) x
    )
  end;
$$;

-- 4. On every insert: if the device did not send pH, compute it from the voltage.
--    A pH sent by the device (e.g. after on-device calibration) is kept as is.
create or replace function public.fill_ph()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ph is null and new.ph_voltage is not null then
    new.ph := public.ph_from_voltage(new.ph_voltage);
    if new.ph is not null then
      new.ph_source := (select case when confirmed then 'calibrated' else 'estimate_factory_default' end
                        from public.ph_calibration where id = 1);
    end if;
  elsif new.ph is not null and new.ph_source is null then
    new.ph_source := 'device';
  end if;
  return new;
end;
$$;

drop trigger if exists readings_fill_ph on public.readings;
create trigger readings_fill_ph
  before insert on public.readings
  for each row execute function public.fill_ph();

-- 5. Recompute every pH that the database computed (never one the device sent).
--    Run after changing public.ph_calibration.
create or replace function public.recompute_ph()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.readings r
     set ph = public.ph_from_voltage(r.ph_voltage),
         ph_source = case when public.ph_from_voltage(r.ph_voltage) is null then null
                          else (select case when confirmed then 'calibrated' else 'estimate_factory_default' end
                                from public.ph_calibration where id = 1) end
   where r.ph_source is distinct from 'device'
     and r.ph_voltage is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.recompute_ph() from public, anon, authenticated;

-- 6. Fill the existing readings.
select public.recompute_ph() as readings_updated;

commit;

-- Check:
--   select date_trunc('hour', created_at) h, round(avg(ph_voltage)::numeric,3) v, round(avg(ph)::numeric,2) ph, min(ph_source)
--   from public.readings group by 1 order by 1;
--
-- After a real two-point calibration (probe in pH 7 and pH 4 buffer, note each voltage in mV):
--   update public.ph_calibration set neutral_mv = <mV in pH 7>, acid_mv = <mV in pH 4>,
--          confirmed = true, source = 'Two-point buffer calibration, <date>', updated_at = now();
--   select public.recompute_ph();
