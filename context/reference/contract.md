# AquaMaa data contract v1.0 (working draft)

The shared format for every part of AquaMaa. It is a draft that we can change together. The exact format is in [schema.json](schema.json), and sample data for each name below is in [examples.json](examples.json).

## Who uses what

| Person | Owns | Mocks while building |
|---|---|---|
| Munira | ESP32 and sensors: `POST /ingest` | Backend: `ingest-response` |
| Mais | Data: database, simulated stations, public datasets | Agent: `suitability`, `alerts` |
| Roaa | Agent: `POST /agent/ask` | Backend: `latest`, `history`, `stations` |
| Deema | Website and integration owner | All response examples |
| Mohammed (DCMP) | Persona text, knowledge-base documents, video | `agent-response`, to see how citations appear |

Owners for the backend API and login, the suitability engine and the robot are still to be decided. See [AquaNova.md](../AquaNova.md).

## Rules for everyone

1. **Timestamps** are UTC in the form `2026-11-04T09:15:02Z`. Only the dashboard converts to Qatar time.
2. **A failed reading is `null`, never `0`.** A zero looks like real data.
3. **Parameter names include the unit,** and every value also carries a `unit` field.
4. **Every value keeps its provenance,** all the way to the screen and the robot.
5. **No hard-coded values.** This is a challenge rule. Everything downstream reads from the stage before it.
6. **Secrets stay in environment variables.** Never commit them, and never put them in firmware that goes in the repo.

## Parameters

| `parameter` | `unit` | Source |
|---|---|---|
| `temperature_c` | `degC` | Sensor |
| `tds_mg_l` | `mg/L` | Salinity sensor (see open check 1) |
| `ph` | `pH` | Sensor |
| `turbidity_ntu` | `NTU` | Sensor |
| `water_level_cm` | `cm` | Sensor |
| `ec_us_cm` | `uS/cm` | Sensor if the probe reports it, otherwise lab or research data |
| `sar` | `ratio` | Lab or synthetic only |
| `chloride_mg_l` | `mg/L` | Lab or synthetic only |
| `boron_mg_l` | `mg/L` | Lab or synthetic only |
| `nitrate_mg_l` | `mg/L` | Lab or synthetic only, always as NO3 |

## Labels

**`provenance`: where a value came from**

| Value | Meaning | Show as |
|---|---|---|
| `measured` | Live reading from our sensor | MEASURED |
| `lab` | Lab result | LAB |
| `official` | Published by a government body, for national context only | OFFICIAL |
| `research_synthetic` | Generated from published study statistics | SYNTHETIC (research-based) |
| `scenario_synthetic` | Made-up demo scenario | SYNTHETIC (scenario) |

The backend ties each key to the provenance it may send. A simulator key that sends `measured` is rejected. This is what keeps synthetic data from passing as real.

**`flags`: problems with a value.** An empty list means no known problem.

| Flag | Set by | Meaning |
|---|---|---|
| `uncalibrated` | Firmware | Sensor has not been calibrated |
| `estimated` | Firmware | Value was converted, such as TDS from conductivity |
| `out_of_range` | Firmware | Outside the sensor's physical range |
| `sensor_fault` | Firmware | Read failed or the probe is disconnected |
| `stuck` | Analytics | Value has stopped changing |
| `drift_suspected` | Analytics | Slow change that looks like sensor drift |
| `time_estimated` | Backend | No device clock, so server time was used |

## Roles

`kahramaa_planner` (main demo workspace), `municipality_agri`, `mecc_environment`, `admin`.

The role always comes from the login token. It is never read from a URL or request body, and the agent gets only the access of the person asking.

## Endpoints

The base path is `/api/v1`. Errors use `error`.

| Method and path | Auth | Purpose | Example |
|---|---|---|---|
| `POST /ingest` | `X-Device-Key` | Send readings, from the ESP32 or simulator | `ingest-request`, `ingest-response` |
| `POST /auth/login` | None | Log in | `login-request`, `login-response` |
| `GET /stations` | Bearer | Stations and their sensors | `stations` |
| `GET /stations/{id}/latest` | Bearer | Newest value of each parameter | `latest` |
| `GET /stations/{id}/history?parameter=&from=&to=&limit=` | Bearer | Time series for one parameter | `history` |
| `GET /stations/{id}/suitability?profile=` | Bearer | Suitability result | `suitability` |
| `GET /alerts?station_id=&status=` | Bearer | Alerts | `alerts` |
| `GET /dashboard?view=` | Bearer | Panels and ready-made insights for the user's role and category. No question needed. | `dashboard` |
| `POST /agent/ask` | Bearer | Ask the agent a question | `agent-request`, `agent-response` |
| `GET /context/national` | Bearer | Official national statistics, never shown as one well's condition | `national-context` |
| `GET /robot/say?intent=&station_id=` | `X-Robot-Key` | Text for the robot to speak | `robot-say` |

## Sending readings (Munira)

```json
{
  "schema_version": "1.0",
  "station_id": "ST-LIVE-01",
  "boot_id": "7f3a91c2",
  "provenance": "measured",
  "readings": [
    {
      "seq": 1042,
      "recorded_at": "2026-11-04T09:15:02Z",
      "measurements": [
        { "sensor_id": "ST-LIVE-01-PH", "parameter": "ph", "value": 7.42, "unit": "pH", "flags": ["uncalibrated"] }
      ]
    }
  ]
}
```

- **Keep the original reading:** `raw` is optional and holds the unconverted sensor output, such as the ADC count, next to the converted `value`. Never overwrite it.
- **Sample every 2 seconds** and send straight away. With the dashboard polling every 1 second, that leaves room inside the 5-second limit.
- **Surviving a disconnect:** keep unsent readings in a memory buffer. On reconnect, send them in batches of up to 100, oldest first, with their original `seq` and `recorded_at`.
- **No duplicates:** `boot_id` is a new random value at each power-on, and `seq` starts at 0. The database enforces one row per `station_id + boot_id + seq + parameter`, so a resend is counted as a duplicate and does no harm. Treat a duplicate as success.
- **No clock yet:** if NTP hasn't synced, send `recorded_at: null`. The backend then uses the arrival time and adds `time_estimated`.
- **Boot alone:** Wi-Fi details live on the device, and it must start sending after a plain power-on with no laptop attached.

## Storing readings (Mais)

- Store one row per measurement: `station_id, sensor_id, parameter, raw, value, unit, flags, provenance, boot_id, seq, recorded_at, received_at`. The challenge requires time, sensor ID and value on every record.
- Lab results use the same `POST /ingest` with `provenance: lab` and their own key, so there is one path into the database.
- Suitability results and alerts go in their own tables and never change the readings.
- **Check storage early.** One live station at 2 seconds is 216,000 rows a day. Before you choose a free tier, check its storage limit and whether it pauses when idle. If space is tight, thin older rows to one per minute.
- **Connection status** comes from the age of the newest reading:

| Station kind | Sends every | `stale` after | `offline` after |
|---|---|---|---|
| Live | 2 s | 15 s | 60 s |
| Simulated | 60 s | 180 s | 600 s |

## Suitability rules

The suitability engine is plain code, and it alone decides the outcome. The LLM only explains the result.

| Outcome | When |
|---|---|
| `suitable` | Every parameter the profile needs is present and passes |
| `conditional` | Nothing fails, but something is cautionary or missing |
| `not_recommended` | At least one parameter fails |
| `insufficient_data` | Key values are missing, `offline`, or flagged `sensor_fault`, `stuck` or `drift_suspected` |

- Sensors alone can never produce `suitable`, because the irrigation profile also needs `sar`, `chloride_mg_l` and `boron_mg_l`.
- Limits live in one versioned rules file, reported as `rule_set_version`. They don't appear in this contract on purpose. The values read from FAO 29 are in [limits.csv](limits.csv), including the unit conversions for chloride and nitrate.
- `irrigation` is the one fully worked profile. Until the others are built, `landscaping` and `non_potable` return `insufficient_data`.

## Agent (Roaa)

- `status` is `answered`, `insufficient_data` or `refused`.
- Each answer has two versions: `web_answer` for the website and phone, and `robot_speech` for text-to-speech. Both use the same evidence.
- Every number in `answer` must trace to an `evidence` item.
- Each answer has an `audit_id`, and the question, role and tools used are logged under it.
- `policy_links` connects an answer to goals in [policy-goals.csv](policy-goals.csv). Links are AquaMaa's own mapping, never an official endorsement.
- Tools are read-only with fixed parameters, and there is no free-form SQL: `get_latest`, `get_history`, `compare_stations`, `get_alerts`, `get_suitability`, `get_national_context`, `get_policy_goals`.

## Robot

The backend writes the sentence and the robot just says it, which keeps robot code small. Each call must read the database fresh, with no caching, so the reviewer test works: change a sensor value, ask the robot, hear the new value.

- `intent` is `current_readings`, `irrigation_check` or `alerts`. That covers the two-question minimum, with one to spare.
- `speech` is plain ASCII of at most 300 characters, with units as words, such as "milligrams per liter". It is ASCII because older robot software can mishandle other characters.
- `gesture` is `none`, `explain`, `warn` or `nod`. Map these to real animations on the robot.
- If `connection` isn't `online`, `speech` must say the data is old or unavailable. The robot never reads an old value as current.

## Stations

| ID | Purpose |
|---|---|
| `ST-LIVE-01` | Our real station, in A25, using bench water samples |
| `ST-SYN-01` onward | 6 to 8 simulated stations, using the scenarios `stable`, `coastal_intrusion`, `recharge_improving`, `frozen_sensor` and `drifting_sensor` |

- Simulated stations post through the same `/ingest` as the ESP32, with their own key.
- `ST-LIVE-01` uses `source_type: bench_sample`, because it is measuring sample water and not a well.
- `location.is_illustrative: true` means the map position isn't a real well.

## Open checks

Each of these could change a field.

1. **Salinity sensor (Munira).** The deck lists "salinity", while the workshop slide reportedly shows a TDS sensor. That slide's title also says six sensors but it shows five types, so count the probes in the kit. Check the datasheet too. If the probe reports conductivity or ppt, convert to `tds_mg_l` in firmware, add the `estimated` flag and record the conversion factor.
2. **Water level (Munira).** The pictured probe looks like a contact type, which may only detect water rather than measure depth. If it can't give real centimeters, calibrate it against a ruler or tell the integration owner before sending values.
3. **Robot network (robot owner, with the robot expert).** Confirm the robot can reach the cloud backend over HTTPS. Older robot software may fail on modern HTTPS, so test this first. A relay on a laptop would break the plan to run without you next week.
4. **Synthetic data (committee).** Ask whether simulated stations are allowed under the "no hard-coded values" rule, with one live station alongside them.
