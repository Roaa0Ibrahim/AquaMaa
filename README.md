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
