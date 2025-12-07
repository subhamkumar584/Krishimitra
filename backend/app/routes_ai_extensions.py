from flask import Blueprint, request, jsonify
from .services.gemini import recommend_from_soil

bp = Blueprint("ai_ext", __name__, url_prefix="/api/v1/ai")

@bp.post("/recommend/fertilizer")
def recommend_fertilizer():
    payload = request.get_json(force=True) or {}
    # Reuse Gemini with different prompt via soil keys; stub for now delegates to same function
    soil = payload.get("soil") or {}
    language = payload.get("language")
    data = recommend_from_soil(soil, language)
    return jsonify(data)

@bp.post("/predict/yield")
def predict_yield():
    payload = request.get_json(force=True) or {}
    # Simple heuristic stub: area * factor by season
    area = float(payload.get("area", 1))
    crop = (payload.get("crop") or "").lower()
    season = (payload.get("season") or "kharif").lower()
    factor = 20 if season == "rabi" else 15
    est = area * factor  # quintal per hectare (demo)
    return jsonify({"crop": crop, "season": season, "area": area, "estimate": est, "unit": "quintal"})

@bp.post("/chat")
def chat_generic():
    payload = request.get_json(force=True) or {}
    query = payload.get("message") or ""
    language = payload.get("language")
    from .services.agent import AgentService
    agent = AgentService()
    data = agent.handle(query, language)
    return jsonify(data)

@bp.get("/chat")
def chat_generic_get():
    # Convenience GET for testing in browser or curl
    query = request.args.get("message") or request.args.get("q") or "hello"
    language = request.args.get("language") or request.args.get("lang")
    from .services.agent import AgentService
    agent = AgentService()
    data = agent.handle(query, language)
    return jsonify(data)
