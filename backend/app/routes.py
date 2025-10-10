from flask import Flask
from .routes_ai import bp as ai_bp
from .routes_payments import bp as payments_bp


def register_routes(app: Flask) -> None:
    app.register_blueprint(ai_bp)
    app.register_blueprint(payments_bp)
