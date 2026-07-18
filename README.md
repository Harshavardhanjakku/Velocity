# Velocity — Bike Rental Prediction Dashboard

A premium, glassmorphic AI dashboard that runs **your already-trained** ANN model
(`bike_rental_model.pth` + `scaler.pkl` + `feature_columns.pkl`) through a Flask API and
visualizes predictions in a hand-built HTML/CSS/JS frontend. Nothing is retrained.

## Quick start

```bash
# 1. Drop your trained artifacts into backend/
cp /path/to/bike_rental_model.pth backend/
cp /path/to/scaler.pkl backend/
cp /path/to/feature_columns.pkl backend/

# 2. Install backend dependencies
cd backend
pip install -r requirements.txt --break-system-packages   # omit the flag on Windows/most setups

# 3. Run
python app.py
```

Open **http://localhost:5000** — Flask serves the frontend directly, so there's nothing else
to start. See `backend/PLACE_MODEL_FILES_HERE.txt` for the optional `metrics.json` step that
unlocks the RMSE / MAE / R² / Accuracy panel.

If you'd rather serve the frontend separately (e.g. from VS Code Live Server), see
`frontend/README.md` — the frontend auto-detects the API host, or you can point it anywhere
with `window.BIKE_API_BASE_URL`.

## What's inside

```
BikeRentalPrediction/
├── backend/                     Flask API — loads your model, never retrains it
│   ├── app.py                   Entry point (also serves the frontend)
│   ├── config.py                Paths, constants, server settings
│   ├── model.py                 ANN architecture (must mirror training exactly)
│   ├── predictor.py              Loads artifacts, runs inference, computes feature importance
│   ├── routes.py                All API endpoints
│   ├── utils.py                 Logging, response envelopes, validation
│   ├── requirements.txt
│   └── PLACE_MODEL_FILES_HERE.txt
│
└── frontend/                    Pure HTML/CSS/vanilla JS — no framework, no build step
    ├── index.html
    ├── css/  (variables, style, animations, dashboard, responsive)
    ├── js/   (utils, storage, api, validation, animations, charts, dashboard, app)
    └── README.md
```

## API reference

| Method | Path             | Purpose |
|--------|------------------|---------|
| GET    | `/`              | Serves the frontend |
| GET    | `/health`        | Service + model health check |
| GET    | `/features`      | Auto-generated form configuration from `feature_columns.pkl` |
| POST   | `/predict`       | Run a prediction (JSON body: `{ "<feature>": value, ... }`) |
| GET    | `/metrics`       | RMSE / MAE / R² / accuracy (from `metrics.json`, if present) |
| GET    | `/model-info`    | Architecture, hyperparameters, computed feature importance |
| GET    | `/history`       | List stored predictions (`?limit=N` optional) |
| DELETE | `/history`       | Clear stored predictions |
| POST   | `/download-json` | Export a JSON payload (defaults to full history) as a file |

## Design notes

The palette, typography, and effect list (glassmorphism, neumorphism, aurora mesh, glow,
dark/light themes) follow the brief's explicit color tokens and font choices exactly. Two
substitutions were made in favor of quality over checkbox-matching — both explained in
`frontend/README.md`:

- **Particles.js** → a small dependency-free canvas particle field (the original library has
  been unmaintained for years).
- **Lottie animation** → an inline animated SVG hero illustration (no `.lottie`/`.json` asset
  was supplied to embed).

Feature importance on the "Model Insights" panel is computed for real from your loaded
model's first-layer weights (mean absolute weight per input) — it is not mocked data.

## Requirements

- Python 3.9+
- A modern browser (Chrome, Edge, Firefox, Safari)
- Your three trained artifacts: `bike_rental_model.pth`, `scaler.pkl`, `feature_columns.pkl`
"# Velocity" 
