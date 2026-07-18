"""
config.py
---------
Centralised configuration for the Bike Rental Prediction backend.
All paths are resolved relative to this file so the app can be launched
from any working directory.
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Trained-artifact paths (these three files are produced by the user's own
# training script and are loaded verbatim -- they are NEVER retrained here).
# ---------------------------------------------------------------------------
MODEL_PATH = os.path.join(BASE_DIR, "bike_rental_model.pth")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.pkl")
FEATURE_COLUMNS_PATH = os.path.join(BASE_DIR, "feature_columns.pkl")

# Optional file. If present, /metrics will read RMSE / MAE / R2 / accuracy
# from it. Generate it once after training with something like:
#
#   import json
#   json.dump(
#       {"rmse": rmse.item(), "mae": mae.item(), "r2": r2, "accuracy": accuracy},
#       open("backend/metrics.json", "w"),
#   )
#
# If the file is absent, GET /metrics still responds (200) but reports
# that no persisted metrics are available yet.
METRICS_PATH = os.path.join(BASE_DIR, "metrics.json")

# ---------------------------------------------------------------------------
# Model architecture (must exactly mirror the training script)
# ---------------------------------------------------------------------------
HIDDEN_LAYER_1 = 64
HIDDEN_LAYER_2 = 32
OUTPUT_DIM = 1

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------
HOST = os.environ.get("BIKE_APP_HOST", "0.0.0.0")
PORT = int(os.environ.get("BIKE_APP_PORT", "5000"))
DEBUG = os.environ.get("BIKE_APP_DEBUG", "true").lower() == "true"

# Allow the static frontend (served from file:// or a dev server on any port)
# to talk to this API.
CORS_ORIGINS = "*"

# Maximum number of predictions kept in the in-memory / on-disk history log.
MAX_HISTORY_ITEMS = 500

# History is persisted to a small JSON file so it survives a server restart.
HISTORY_PATH = os.path.join(BASE_DIR, "prediction_history.json")

LOG_PATH = os.path.join(BASE_DIR, "app.log")
