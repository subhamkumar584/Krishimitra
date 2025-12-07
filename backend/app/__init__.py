from __future__ import annotations
import os
from flask import Flask
from flask_cors import CORS
from .config import settings
from .db import init_engine, init_session, Base
from .routes import register_routes
from .auth import init_jwt


def create_app() -> Flask:
    app = Flask(__name__)

    # CORS
    CORS(app, origins=settings.ALLOWED_ORIGINS, supports_credentials=True)

    # Accept trailing slashes
    app.url_map.strict_slashes = False

    # Limit uploads (Flask level) e.g., 32MB
    app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024

    # DB init
    engine = init_engine(settings.DATABASE_URL)
    init_session(engine)
    if settings.AUTO_CREATE_TABLES:
        Base.metadata.create_all(bind=engine)

    # JWT
    init_jwt(app)

    # Routes
    register_routes(app)

    @app.get("/health")
    def health():  # type: ignore
        return {"status": "ok"}

    # ---- JSON error handlers ----
    from werkzeug.exceptions import HTTPException, RequestEntityTooLarge
    from flask import jsonify

    @app.errorhandler(RequestEntityTooLarge)
    def handle_413(e):  # type: ignore
        return jsonify({"error": "request_too_large", "detail": "Image too large. Try a smaller image."}), 413

    @app.errorhandler(HTTPException)
    def handle_http(e):  # type: ignore
        return jsonify({"error": e.name, "code": e.code}), e.code

    @app.errorhandler(Exception)
    def handle_exc(e):  # type: ignore
        return jsonify({"error": "internal_server_error"}), 500

    return app
