"""
predictor.py
------------
Loads the three artifacts produced by the user's training script:

    bike_rental_model.pth
    scaler.pkl
    feature_columns.pkl

and exposes a single ModelService singleton used by routes.py.

IMPORTANT: this module never retrains or mutates the model. It only loads
weights into the ANNModel architecture defined in model.py and calls it in
eval() mode.
"""

import json
import os
import threading
from typing import Dict, List

import joblib
import numpy as np
import torch

import config
from model import ANNModel
from utils import setup_logger

logger = setup_logger()


# ---------------------------------------------------------------------------
# Optional, purely cosmetic metadata for well-known UCI "Bike Sharing"
# dataset columns. This is ONLY used to make the auto-generated form nicer
# (icons / tooltips / sensible slider ranges). Any column that isn't in this
# dictionary still works perfectly -- it just falls back to a generic
# numeric input. Nothing here is required for prediction correctness.
# ---------------------------------------------------------------------------
KNOWN_FEATURE_METADATA = {
    "instant": {"label": "Record Index", "icon": "fa-hashtag", "type": "number",
                "min": 1, "max": 20000, "step": 1, "default": 1,
                "tooltip": "Sequential row index from the original dataset."},
    "season": {"label": "Season", "icon": "fa-leaf", "type": "select",
               "options": [{"value": 1, "label": "Spring"}, {"value": 2, "label": "Summer"},
                           {"value": 3, "label": "Fall"}, {"value": 4, "label": "Winter"}],
               "default": 1, "tooltip": "Meteorological season."},
    "yr": {"label": "Year", "icon": "fa-calendar", "type": "select",
           "options": [{"value": 0, "label": "2011"}, {"value": 1, "label": "2012"}],
           "default": 0, "tooltip": "Year of the record (0 = 2011, 1 = 2012)."},
    "mnth": {"label": "Month", "icon": "fa-calendar-days", "type": "select",
             "options": [{"value": i, "label": m} for i, m in enumerate(
                 ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], start=1)],
             "default": 1, "tooltip": "Calendar month (1-12)."},
    "hr": {"label": "Hour of Day", "icon": "fa-clock", "type": "slider",
           "min": 0, "max": 23, "step": 1, "default": 12,
           "tooltip": "Hour of the day, 0-23."},
    "holiday": {"label": "Holiday", "icon": "fa-champagne-glasses", "type": "select",
                "options": [{"value": 0, "label": "No"}, {"value": 1, "label": "Yes"}],
                "default": 0, "tooltip": "Whether the day is a public holiday."},
    "weekday": {"label": "Day of Week", "icon": "fa-calendar-week", "type": "select",
                "options": [{"value": i, "label": d} for i, d in enumerate(
                    ["Sunday", "Monday", "Tuesday", "Wednesday",
                     "Thursday", "Friday", "Saturday"])],
                "default": 0, "tooltip": "Day of the week (0 = Sunday)."},
    "workingday": {"label": "Working Day", "icon": "fa-briefcase", "type": "select",
                   "options": [{"value": 0, "label": "No"}, {"value": 1, "label": "Yes"}],
                   "default": 1, "tooltip": "1 if neither a weekend nor a holiday."},
    "weathersit": {"label": "Weather Situation", "icon": "fa-cloud-sun", "type": "select",
                   "options": [
                       {"value": 1, "label": "Clear / Few Clouds"},
                       {"value": 2, "label": "Mist / Cloudy"},
                       {"value": 3, "label": "Light Snow / Rain"},
                       {"value": 4, "label": "Heavy Rain / Snow / Fog"},
                   ], "default": 1, "tooltip": "Categorical weather condition."},
    "temp": {"label": "Temperature (normalized)", "icon": "fa-temperature-half", "type": "slider",
             "min": 0, "max": 1, "step": 0.01, "default": 0.5,
             "tooltip": "Normalized temperature in Celsius, scaled 0-1 (t-tmin)/(tmax-tmin)."},
    "atemp": {"label": "Feels-Like Temp (normalized)", "icon": "fa-temperature-three-quarters",
              "type": "slider", "min": 0, "max": 1, "step": 0.01, "default": 0.5,
              "tooltip": "Normalized 'feels like' temperature, scaled 0-1."},
    "hum": {"label": "Humidity (normalized)", "icon": "fa-droplet", "type": "slider",
            "min": 0, "max": 1, "step": 0.01, "default": 0.5,
            "tooltip": "Normalized relative humidity, scaled 0-1."},
    "windspeed": {"label": "Wind Speed (normalized)", "icon": "fa-wind", "type": "slider",
                  "min": 0, "max": 1, "step": 0.01, "default": 0.2,
                  "tooltip": "Normalized wind speed, scaled 0-1."},
}

GENERIC_FALLBACK = {
    "label": None,  # filled in dynamically from the column name
    "icon": "fa-sliders",
    "type": "number",
    "min": 0,
    "max": 100,
    "step": 1,
    "default": 0,
    "tooltip": "Numeric model feature.",
}


def _humanize(col_name: str) -> str:
    return col_name.replace("_", " ").strip().title()


class ModelService:
    """Thread-safe singleton that owns the loaded model/scaler/columns."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        self.model = None
        self.scaler = None
        self.feature_columns: List[str] = []
        self.load_error = None
        self.loaded_at = None

        self._load_artifacts()

    # ------------------------------------------------------------------
    def _load_artifacts(self):
        try:
            if not os.path.exists(config.FEATURE_COLUMNS_PATH):
                raise FileNotFoundError(
                    f"feature_columns.pkl not found at {config.FEATURE_COLUMNS_PATH}"
                )
            if not os.path.exists(config.SCALER_PATH):
                raise FileNotFoundError(f"scaler.pkl not found at {config.SCALER_PATH}")
            if not os.path.exists(config.MODEL_PATH):
                raise FileNotFoundError(
                    f"bike_rental_model.pth not found at {config.MODEL_PATH}"
                )

            self.feature_columns = list(joblib.load(config.FEATURE_COLUMNS_PATH))
            self.scaler = joblib.load(config.SCALER_PATH)

            model = ANNModel(input_dim=len(self.feature_columns))
            state_dict = torch.load(config.MODEL_PATH, map_location="cpu")
            model.load_state_dict(state_dict)
            model.eval()

            self.model = model
            self.load_error = None
            logger.info(
                "Model artifacts loaded successfully (%d features).",
                len(self.feature_columns),
            )
        except Exception as exc:  # noqa: BLE001 -- we want to surface any load issue
            self.load_error = str(exc)
            logger.error("Failed to load model artifacts: %s", exc)

    # ------------------------------------------------------------------
    @property
    def is_ready(self) -> bool:
        return self.model is not None and self.scaler is not None and bool(self.feature_columns)

    # ------------------------------------------------------------------
    def get_feature_config(self) -> List[dict]:
        """Build the dynamic form configuration straight from feature_columns.pkl."""
        configs = []
        for col in self.feature_columns:
            meta = KNOWN_FEATURE_METADATA.get(col)
            if meta:
                entry = dict(meta)
            else:
                entry = dict(GENERIC_FALLBACK)
                entry["label"] = _humanize(col)
            entry["name"] = col
            entry.setdefault("label", _humanize(col))
            configs.append(entry)
        return configs

    # ------------------------------------------------------------------
    def predict(self, feature_values: Dict[str, float]) -> float:
        if not self.is_ready:
            raise RuntimeError(self.load_error or "Model is not loaded.")

        ordered = [float(feature_values[col]) for col in self.feature_columns]
        arr = np.array(ordered, dtype=np.float32).reshape(1, -1)

        scaled = self.scaler.transform(arr)
        tensor = torch.tensor(scaled, dtype=torch.float32)

        with torch.no_grad():
            output = self.model(tensor)

        prediction = float(output.item())
        # Rental counts can't be negative -- clip at zero for display purposes.
        return max(0.0, prediction)

    # ------------------------------------------------------------------
    def get_feature_importance(self) -> List[dict]:
        """
        A lightweight, real (not fabricated) importance proxy computed
        directly from the trained model: the mean absolute weight each
        input feature carries into the first hidden layer. This is a
        first-order approximation, not a substitute for SHAP/permutation
        importance, but it costs nothing extra and reflects the actual
        loaded weights.
        """
        if not self.is_ready:
            return []
        first_layer_weights = self.model.fc1.weight.detach().cpu().numpy()  # shape (64, n_features)
        raw_importance = np.mean(np.abs(first_layer_weights), axis=0)
        total = raw_importance.sum() or 1.0
        normalized = raw_importance / total
        ranked = sorted(
            zip(self.feature_columns, normalized.tolist()),
            key=lambda item: item[1],
            reverse=True,
        )
        return [{"feature": name, "importance": round(score, 4)} for name, score in ranked]

    # ------------------------------------------------------------------
    def get_metrics(self) -> dict:
        if os.path.exists(config.METRICS_PATH):
            try:
                with open(config.METRICS_PATH, "r", encoding="utf-8") as f:
                    return {"available": True, **json.load(f)}
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("Could not read metrics.json: %s", exc)
        return {
            "available": False,
            "message": (
                "No metrics.json found. Save RMSE / MAE / R2 / accuracy from your "
                "training script's evaluation step to backend/metrics.json to "
                "populate this panel."
            ),
        }


model_service = ModelService()
