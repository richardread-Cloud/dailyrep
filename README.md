# DailyRep

A strength-training app: it plans each session, times rests between sets, and adjusts your weights with Double Progression so you keep getting stronger safely. Words used in the code and UI are defined in [GLOSSARY.md](GLOSSARY.md), and the key decisions are in [docs/adr/](docs/adr/).

## Run it

```sh
npm install
npm run dev              # local dev server, also reachable from a phone on the same Wi-Fi
npm test                 # progression rules, warm-ups and storage
npm run build:artifact   # one-file test build: dist-artifact/dailyrep.html
```

The test build is published as a private page for trying the app on a phone. The installable home-screen app (offline support and icon), Google sign-in and Supabase sync come next. See docs/adr/0002 and 0003.

## Layout

| Path | What's there |
|---|---|
| `src/domain/` | Pure rules with tests: progression, warm-ups, units and the starter program |
| `src/data/` | On-device storage (IndexedDB via Dexie) and every read and write the screens use |
| `src/lib/` | The Built-in Exercise library with its Demos, and the daily quotes. These copies are now the source of truth; the ones in `prototypes/` are frozen. |
| `src/screens/`, `src/components/` | The React UI. The Session screen follows the layout chosen in `prototypes/` (variant D) |
| `assets/brand/` | Logo, icons and colours |
| `prototypes/` | Throwaway prototypes and what they decided (see its README) |
