"""
app.py
------
Application entry point. Run with:

    python app.py

The API will be available at http://localhost:5000
(the frontend/index.html can call it directly via fetch()).
"""

import os

from flask import Flask, send_from_directory
from flask_cors import CORS

import config
from routes import api
from utils import setup_logger

logger = setup_logger()

FRONTEND_DIR = os.path.abspath(os.path.join(config.BASE_DIR, "..", "frontend"))


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    CORS(app, resources={r"/*": {"origins": config.CORS_ORIGINS}})

    app.register_blueprint(api, url_prefix="")

    @app.route("/")
    def index():
        """Serve the built frontend if it exists next to backend/, otherwise
        return a small API index so the service is still self-describing."""
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_path):
            return send_from_directory(FRONTEND_DIR, "index.html")
        return {
            "service": "Bike Rental Prediction API",
            "status": "running",
            "endpoints": [
                "GET  /health",
                "GET  /features",
                "POST /predict",
                "GET  /metrics",
                "GET  /model-info",
                "GET  /history",
                "DELETE /history",
                "POST /download-json",
            ],
        }

    @app.route("/<path:filename>")
    def frontend_assets(filename):
        """Serve frontend static assets (css/js/assets) when the whole
        project is run from a single Flask process instead of a separate
        static server."""
        full_path = os.path.join(FRONTEND_DIR, filename)
        if os.path.exists(full_path):
            return send_from_directory(FRONTEND_DIR, filename)
        return {"success": False, "message": "Not found"}, 404

    @app.errorhandler(404)
    def not_found(_e):
        return {"success": False, "message": "Resource not found"}, 404

    @app.errorhandler(500)
    def server_error(e):
        logger.exception("Unhandled server error")
        return {"success": False, "message": "Internal server error", "detail": str(e)}, 500

    return app


app = create_app()


if __name__ == "__main__":
    logger.info("Starting Bike Rental Prediction API on %s:%s", config.HOST, config.PORT)
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
