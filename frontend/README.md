# Velocity — Frontend

Pure HTML5 / CSS3 / vanilla ES6 JavaScript. No build step, no framework, no bundler.

## Running

The frontend talks to the Flask API over `fetch()`. You have two options:

**Option A — served by Flask (simplest)**
Just run the backend (`python backend/app.py`) and open `http://localhost:5000`.
`app.py` serves `frontend/index.html` and all of `frontend/css` / `frontend/js` directly, so
nothing else is needed.

**Option B — separate static server**
Serve `frontend/` with any static file server (e.g. `python -m http.server 8080` from inside
`frontend/`), then open `http://localhost:8080`. The frontend auto-targets
`http://<same-hostname>:5000` for the API. To point at a different backend URL, set it before
the other scripts load:

```html
<script>window.BIKE_API_BASE_URL = "http://localhost:5000";</script>
```

## File map

| File                  | Responsibility |
|-----------------------|----------------|
| `css/variables.css`   | Design tokens — colors, type scale, spacing, radii, shadows (dark + light theme) |
| `css/style.css`       | Base reset, layout, navbar, hero, buttons, glass/neumorphic primitives, forms |
| `css/animations.css`  | All `@keyframes` and animation utility classes |
| `css/dashboard.css`   | KPI cards, charts, result card, metric rings, history table, toasts, modal |
| `css/responsive.css`  | Breakpoints (ultra-wide → mobile) + print stylesheet |
| `js/utils.js`         | Formatting, counters, clipboard, CSV/JSON helpers |
| `js/storage.js`       | `localStorage` wrapper for theme + a client-side history mirror |
| `js/api.js`           | `fetch` wrapper with timeout + retry, one function per endpoint |
| `js/validation.js`    | Real-time field validation against `/features` metadata |
| `js/animations.js`    | Canvas particle field, cursor glow, tilt, ripple, scroll-reveal |
| `js/charts.js`        | Every Chart.js + the one ApexCharts chart |
| `js/dashboard.js`     | Form generation, prediction flow, KPIs, history table, toasts |
| `js/app.js`           | Bootstraps everything: theme, navbar, loader, shortcuts, wiring |

## Notable substitutions from the original spec

- **Particles.js → custom canvas particle field.** Particles.js has been unmaintained for
  years; a ~60-line dependency-free canvas implementation in `animations.js` gives the same
  ambient effect without an extra network request or an abandoned library.
- **Lottie → inline animated SVG.** No `.json` Lottie asset was supplied, so the hero uses a
  lightweight animated SVG (route line + bike glyph) instead. If you have a Lottie file, drop
  it in `assets/lottie/` and swap the hero `<svg>` block in `index.html` for a
  `<lottie-player>` (via the `@lottiefiles/lottie-player` CDN package).

## Keyboard shortcuts

- `Ctrl/Cmd + Enter` — run a prediction from anywhere on the page
- `/` — focus the history search box
- `Esc` — close any open modal or the mobile nav
