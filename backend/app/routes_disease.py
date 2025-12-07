from flask import Blueprint, request, jsonify
from .services.gemini_image import diagnose_disease

bp = Blueprint("disease", __name__, url_prefix="/api/v1/disease")

@bp.get("/ping")
def ping():
    return jsonify({"status": "ok"})

@bp.post("/diagnose")
def diagnose():
    if "image" not in request.files:
        return jsonify({"error": "image file required"}), 400
    f = request.files["image"]
    image_bytes = f.read()
    mime_type = f.mimetype or "image/jpeg"
    crop = request.form.get("crop")
    language = request.form.get("language")
    try:
        data = diagnose_disease(image_bytes, mime_type, crop=crop, language=language)
        return jsonify(data)
    except Exception:
        # Fallback generic response
        return jsonify({
            "error": "gemini_unavailable",
            "fallback": {
                "disease": "unknown",
                "confidence": "low",
                "description": "Could not determine disease.",
                "management": [
                    "Remove severely affected leaves",
                    "Improve field sanitation",
                    "Use recommended fungicide/insecticide if symptoms worsen"
                ],
                "model": "rules-fallback"
            }
        }), 503