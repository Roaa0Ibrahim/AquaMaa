# AquaMaa

Groundwater intelligence dashboard for Qatar. Express API + SQLite (Node's built-in `node:sqlite`) + a dependency-free frontend (Leaflet loaded from CDN for maps).

## Run

```bash
npm install
npm run seed     # creates data/aquamaa.db with DEMONSTRATION data
npm start        # http://localhost:3000  (PORT to override)
```

Requires Node 22.13+. All demo users share the password `AquaMaa-Demo-2026` (override with `AQUAMAA_DEMO_PASSWORD` when seeding).
Demo accounts are listed on the login page while the database is in `demonstration` mode.

## Data

All seeded wells, stations, readings and extraction figures are demonstration data and are labelled as such in the UI.
Replace the tables in `server/db.js` with real feeds before operational use. Derived figures (ratio, YoY change, coverage,
% suitable) are computed server-side in `server/index.js`.

## Not yet implemented

Aquifer Assessment, Risk Assessment, Hydrological Resilience, Alternative Water Sources, Predictive Analysis,
Research & Statistics, Sustainability Goals. They show an honest placeholder rather than invented figures.

## Live sensor data (Supabase) and AI assistant frontend

**Setup**
1. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (publishable/anon key only). Never put the database password, a service-role key or an AI key in frontend code. `SUPABASE_DB_URL` is for trusted server-side tooling only.
2. Run `supabase/setup.sql` once in the Supabase SQL editor: it enables RLS, adds an anon/authenticated SELECT policy on `public.readings` (anyone holding the publishable key can then read readings), adds indexes and puts the table in the `supabase_realtime` publication.
3. `npm install && npm start`.

**Behaviour**
- KPIs, charts and the water-quality assessment come only from SELECT queries on `public.readings`. If access is denied, the config is missing or the table is empty, the dashboard shows the exact problem, never substitute values.
- Aggregation is shared in `public/lib/sensors.js`: latest valid reading per device per parameter, freshness window, median/min/max/count per parameter. Missing values are never zero. pH is shown as a median pH, not a mixed-water pH.
- Turbidity is shown as a raw reading plus voltage and is never labelled NTU. It does not contribute to the assessment until `turbidity.calibration` is validated in `config/thresholds.json`.
- All thresholds are in `config/thresholds.json` with sources. Defaults are unconfirmed references, not Qatari regulatory limits. The assessment is a preliminary monitoring indicator, not a drinking-water certification.
- Live status shows "Live" only when a Realtime subscription is active; otherwise "Polling" (configurable) or an error.
- The Registered wells and Monitoring stations cards and the map remain demonstration data.

**Assistant (frontend only)**: `public/assistant.js`. STT, the model and spoken output are yours to build. Hooks are documented at the top of the file; the model goes in `server/assistant-model.js` (`generate()`; `POST /api/assistant` returns 501 until then). The server builds read-only grounding from fixed queries and treats browser context as untrusted.

**Tests**: `npm test` (uses a test-only fake PostgREST in `test/fake-supabase.js`).
