from flask import Flask
from .routes_ai import bp as ai_bp
from .routes_ai_extensions import bp as ai_ext_bp
from .routes_ai_health import bp as ai_health_bp
from .routes_payments import bp as payments_bp
from .routes_auth import bp as auth_bp
from .routes_marketplace import bp as market_bp
from .routes_weather import bp as weather_bp
from .routes_info import bp as info_bp
from .routes_tracker import bp as tracker_bp
from .routes_disease import bp as disease_bp
from .routes_cart import bp as cart_bp
from .routes_cold_storage import bp as cold_storage_bp
from .routes_reviews import bp as reviews_bp
from .routes_analytics import bp as analytics_bp
from .routes_media import bp as media_bp
from .routes_equipment import bp as equipment_bp


def register_routes(app: Flask) -> None:
    app.register_blueprint(auth_bp)
    app.register_blueprint(market_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(ai_ext_bp)
    app.register_blueprint(ai_health_bp)
    app.register_blueprint(weather_bp)
    app.register_blueprint(info_bp)
    app.register_blueprint(tracker_bp)
    app.register_blueprint(disease_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(cold_storage_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(media_bp)
    app.register_blueprint(equipment_bp)
