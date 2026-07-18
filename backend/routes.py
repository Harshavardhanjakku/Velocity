"""
routes.py
---------
All HTTP endpoints for the Bike Rental Prediction API.

    GET    /              -> serves the frontend (or an API index if no frontend build present)
    GET    /health         -> service + model health check
    GET    /features       -> auto-generated form configuration from feature_columns.pkl
    POST   /predict        -> run a prediction through the loaded model
    GET    /metrics         -> RMSE / MAE / R2 / accuracy (from metrics.json, if present)
    GET    /model-info      -> architecture / training hyperparameters
    GET    /history         -> list stored predictions
    DELETE /history         -> clear stored predictions
    POST   /download-json   -> export a JSON payload (history or a single result) as a file
"""

import io
import json
import os
import uuid

from flask import Blueprint, request, send_file

import config
from predictor import model_service
from utils import success_response, error_response, validate_payload, now_iso, setup_logger

logger = setup_logger()

api = Blueprint("api", __name__)


# ---------------------------------------------------------------------------
# Simple JSON-file-backed history store (kept intentionally lightweight).
# ---------------------------------------------------------------------------
def _read_history():
    if not os.path.exists(config.HISTORY_PATH):
        return []
    try:
        with open(config.HISTORY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _write_history(items):
    try:
        with open(config.HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(items[-config.MAX_HISTORY_ITEMS:], f, indent=2)
    except OSError as exc:
        logger.warning("Could not persist history: %s", exc)


# ---------------------------------------------------------------------------
@api.route("/health", methods=["GET"])
def health():
    return success_response(
        {
            "status": "online" if model_service.is_ready else "degraded",
            "model_loaded": model_service.is_ready,
            "load_error": model_service.load_error,
            "feature_count": len(model_service.feature_columns),
            "server_time": now_iso(),
        },
        message="Service is healthy" if model_service.is_ready else "Model not loaded",
    )


@api.route("/features", methods=["GET"])
def features():
    if not model_service.feature_columns:
        return error_response(
            "feature_columns.pkl could not be loaded. Place your trained "
            "artifacts in the backend/ directory and restart the server.",
            status_code=503,
        )
    return success_response(
        {
            "features": model_service.get_feature_config(),
            "count": len(model_service.feature_columns),
        }
    )


@api.route("/predict", methods=["POST"])
def predict():
    if not model_service.is_ready:
        return error_response(
            f"Model is not ready: {model_service.load_error}", status_code=503
        )

    payload = request.get_json(silent=True)
    if payload is None:
        return error_response("Request body must be valid JSON.", status_code=400)

    cleaned, fatal_errors, warnings = validate_payload(payload, model_service.feature_columns)
    if fatal_errors:
        return error_response("Validation failed.", status_code=422, errors=fatal_errors)

    try:
        prediction = model_service.predict(cleaned)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Prediction failed")
        return error_response(f"Prediction failed: {exc}", status_code=500)

    record = {
        "id": str(uuid.uuid4()),
        "timestamp": now_iso(),
        "inputs": cleaned,
        "prediction": round(prediction),
        "raw_prediction": prediction,
    }

    history = _read_history()
    history.append(record)
    _write_history(history)

    response_data = dict(record)
    if warnings:
        response_data["warnings"] = warnings

    return success_response(response_data, message="Prediction complete")


@api.route("/metrics", methods=["GET"])
def metrics():
    return success_response(model_service.get_metrics())


@api.route("/model-info", methods=["GET"])
def model_info():
    from model import MODEL_METADATA

    info = dict(MODEL_METADATA)
    info["input_features"] = len(model_service.feature_columns)
    info["feature_names"] = model_service.feature_columns
    info["model_loaded"] = model_service.is_ready
    info["feature_importance"] = model_service.get_feature_importance()
    return success_response(info)


@api.route("/history", methods=["GET"])
def get_history():
    history = _read_history()
    limit = request.args.get("limit", type=int)
    if limit:
        history = history[-limit:]
    return success_response({"history": list(reversed(history)), "count": len(history)})


@api.route("/history", methods=["DELETE"])
def clear_history():
    _write_history([])
    return success_response(message="History cleared")


@api.route("/download-json", methods=["POST"])
def download_json():
    payload = request.get_json(silent=True) or {}
    export_data = payload.get("data", _read_history())
    filename = payload.get("filename", "bike_rental_export.json")
    if not filename.endswith(".json"):
        filename += ".json"

    buffer = io.BytesIO(json.dumps(export_data, indent=2).encode("utf-8"))
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype="application/json",
        as_attachment=True,
        download_name=filename,
    )
