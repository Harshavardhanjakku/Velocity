"""
utils.py
--------
Small, dependency-free helpers shared across the backend: logging setup,
consistent JSON response envelopes, and payload validation.
"""

import logging
import re
from datetime import datetime, timezone

from flask import jsonify

import config


def setup_logger() -> logging.Logger:
    """Configure and return the application-wide logger."""
    logger = logging.getLogger("bike_rental_api")
    if logger.handlers:
        return logger  # already configured (avoids duplicate handlers on reload)

    logger.setLevel(logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    try:
        file_handler = logging.FileHandler(config.LOG_PATH)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except OSError:
        # Filesystem may be read-only in some deployments -- console logging
        # alone is fine in that case.
        pass

    return logger


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def success_response(data=None, message: str = "OK", status_code: int = 200):
    payload = {
        "success": True,
        "message": message,
        "timestamp": now_iso(),
    }
    if data is not None:
        payload["data"] = data
    return jsonify(payload), status_code


def error_response(message: str, status_code: int = 400, errors=None):
    payload = {
        "success": False,
        "message": message,
        "timestamp": now_iso(),
    }
    if errors is not None:
        payload["errors"] = errors
    return jsonify(payload), status_code


_SAFE_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_\-\.]+$")


def validate_payload(payload: dict, feature_columns: list):
    """
    Validate an incoming prediction request payload against the exact
    feature columns the model was trained on.

    Returns (cleaned_values: dict, fatal_errors: list[str], warnings: list[str])
    """
    errors = []

    if not isinstance(payload, dict):
        return {}, ["Request body must be a JSON object."], []

    missing = [col for col in feature_columns if col not in payload]
    unknown = [
        key for key in payload.keys()
        if key not in feature_columns and _SAFE_KEY_PATTERN.match(str(key))
    ]

    if missing:
        errors.append(f"Missing required feature(s): {', '.join(missing)}")

    cleaned = {}
    for col in feature_columns:
        if col not in payload:
            continue
        raw_value = payload[col]
        try:
            cleaned[col] = float(raw_value)
        except (TypeError, ValueError):
            errors.append(f"Feature '{col}' must be numeric (received: {raw_value!r}).")

    # Unknown fields are not fatal -- the model simply ignores anything it
    # wasn't trained on -- but they're worth surfacing in case of a typo.
    warnings = []
    if unknown:
        warnings.append(f"Ignored unrecognised field(s): {', '.join(unknown)}")

    return cleaned, errors, warnings
