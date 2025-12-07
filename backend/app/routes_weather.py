from flask import Blueprint, request, jsonify
import httpx
from .config import settings

bp = Blueprint("weather", __name__, url_prefix="/api/v1/weather")

@bp.get("")
def get_weather():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    if not (lat and lon):
        return jsonify({"error": "lat and lon required"}), 400
    api = settings.OPENWEATHER_API_KEY
    if not api:
        return jsonify({"error": "OPENWEATHER_API_KEY not configured"}), 503
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api}&units=metric"
    try:
        r = httpx.get(url, timeout=10)
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 502
