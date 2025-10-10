from __future__ import annotations
import os
from flask import Flask
from flask_cors import CORS
from .config import settings
from .db import init_engine, init_session, Base
from .routes import register_routes


def create_app() -> Flask:
    app = Flask(__name__)

    # CORS
    CORS(app, origins=settings.ALLOWED_ORIGINS, supports_credentials=True)

    # DB init
    engine = init_engine(settings.DATABASE_URL)
    init_session(engine)
    if settings.AUTO_CREATE_TABLES:
        Base.metadata.create_all(bind=engine)

    # Routes
    register_routes(app)

    @app.get("/health")
    def health():  # type: ignore
        return {"status": "ok"}

    return app
