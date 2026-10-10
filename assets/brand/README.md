# DailyRep brand

## Files

| File | Use |
|---|---|
| `dailyrep-logo.png` | Full logo (mark + wordmark) on the dark background, as supplied. |
| `dailyrep-icon.svg` | App icon master: the mark on a full-bleed dark square. |
| `dailyrep-icon-1024.png` | Icon rendered from the SVG, for app-store style listings. |
| `dailyrep-icon-512.png`, `dailyrep-icon-192.png` | Web app manifest icons (Android home screen). The mark sits well inside the 80% safe zone, so these can be declared `"purpose": "any maskable"`. |
| `apple-touch-icon.png` | 180×180 icon iOS uses when the app is added to the home screen (`<link rel="apple-touch-icon" href="/apple-touch-icon.png">`). |

## Colours

| Token | Hex | Role |
|---|---|---|
| Ink dark | `#2C2C24` | Icon background, dark-theme background, light-theme text, text on orange buttons |
| Chalk | `#F5F5F2` | The mark's upright stroke, light-theme background, dark-theme text |
| Orange | `#F87F3B` | The mark's ring, "Rep", primary buttons, timers, progress |

Orange is too light for small text on the chalk background (about 2.4:1 contrast). Small orange text uses `#B8541A` in the light theme and `#FA9A62` in the dark theme. Buttons with an orange fill use dark `#2C2C24` text, not white.

## Type

- **Wordmark:** Montserrat, "Daily" Regular and "Rep" Bold in orange.
- **In-app UI** (from the prototypes): Barlow for text and Barlow Condensed for numbers.

## In the app

- The in-app logo is the mark drawn inline plus a live "Daily**Rep**" wordmark. The mark's upright stroke takes the current text colour, so the logo works on both the light and dark themes. The ring always stays orange.
- Manifest: `name` and `short_name` "DailyRep", `theme_color` and `background_color` `#2C2C24`.
