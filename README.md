# API-WR — World Rowing Stats

Vue 3 + Vite front-end for the [World Rowing Sotic Cloud API](https://world-rowing-api.soticcloud.net/stats/api).

## Development

```bash
npm install
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173).

## Production build

```bash
npm run build
npm run preview
```

Output: `dist/` (serve as static site; SPA fallback to `index.html`).

## CORS proxy (optional)

Some endpoints may require a local proxy during development:

```bash
python proxy.py
```

Runs on `http://127.0.0.1:8765` and forwards to the World Rowing API with `Access-Control-Allow-Origin: *`.

Enable the proxy toggle in **Analyse** (stored in `localStorage` as `wr_analyse_prefs.proxy`).

## Legacy pages

Pre-refactor monolith HTML pages are archived in [`legacy/`](legacy/) for reference:

- `legacy/index.html` — Results
- `legacy/schedule.html` — Schedule
- `legacy/live.html` — Live tracker
- `legacy/analyse.html` — Analyse / replay
- `legacy/nations.html` — redirect stub

## Tests

```bash
npm test
```

## Routes

| Path | Page |
|------|------|
| `/` | Results |
| `/schedule` | Schedule |
| `/live` | Live tracker |
| `/analyse` | Analyse / replay plots |
| `/nations` | Nations stats |

Legacy URLs (`/index.html`, `/live.html`, …) redirect to the Vue routes.
