from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from .schemas import SoilRecommendationRequest
from .services.gemini import recommend_from_soil
from .db import get_db
from .models import SoilRecommendationLog

bp = Blueprint("ai", __name__, url_prefix="/api/v1/ai")


@bp.post("/recommend/soil")
def recommend_soil():
    payload = request.get_json(force=True) or {}
    try:
        req = SoilRecommendationRequest(**payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    data = recommend_from_soil(req.soil, req.language)

    # Persist log
    for db in get_db():
        session: Session = db
        log = SoilRecommendationLog(
            request={"soil": req.soil, "language": req.language},
            response=data,
            model_name=data.get("model"),
        )
        session.add(log)
        session.commit()

    return jsonify(data)
