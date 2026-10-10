# Local-first storage on the device, synced to Supabase

Every Set is written to on-device storage (IndexedDB) first and synced to Supabase in the background whenever there is signal; Supabase holds the master copy so a new device can restore everything. We rejected writing straight to Supabase because gyms often have no signal and logging a Set must never fail or stall, and rejected device-only storage because Safari can clear site data and a lost phone would lose all history.

## Consequences

- Logged Sets are append-only, so they never conflict; for everything else (Templates, Exercise settings, the Lifter's unit) the most recent edit wins.
- Supabase's free tier pauses idle projects; the app keeps working offline and simply syncs once the project is resumed.
