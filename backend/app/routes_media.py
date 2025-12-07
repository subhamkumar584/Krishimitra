from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from .auth import role_required
from .services.cloudinary_service import CloudinaryService
from .services.gemini_image import analyze_quality_and_price
import httpx

bp = Blueprint("media", __name__, url_prefix="/api/v1/media")

@bp.post("/upload")
@jwt_required()
@role_required("farmer", "equipmetal", "admin")
def upload_media():
    """Upload an image to Cloudinary and return its URL(s)"""
    if "image" not in request.files:
        return jsonify({"error": "image file required"}), 400
    image = request.files["image"]
    folder = request.form.get("folder", "krishimitra/products")

    result = CloudinaryService.upload_image(image, folder)
    if not result.get("success"):
        return jsonify({"error": result.get("error", "upload_failed")}), 400

    return jsonify({
        "url": result.get("url"),
        "thumbnail_url": result.get("thumbnail_url"),
        "medium_url": result.get("medium_url"),
        "public_id": result.get("public_id")
    })


@bp.post("/analyze")
@jwt_required()
@role_required("farmer", "equipmetal", "admin")
def analyze_media():
    """Analyze product image and return quality/price suggestion via Gemini.
    Accepts:
      - multipart/form-data with 'image' file, optional fields: title, category, unit, location, current_price
      - or JSON with 'image_url' and optional context fields
    """
    try:
        ctx = {}
        # Prefer multipart
        if request.files.get("image"):
            img = request.files["image"]
            image_bytes = img.read()
            mime = img.mimetype or "image/jpeg"
            # context from form
            ctx = {
                "title": request.form.get("title"),
                "category": request.form.get("category"),
                "unit": request.form.get("unit"),
                "location": request.form.get("location"),
                "current_price": request.form.get("current_price"),
            }
        else:
            data = request.get_json(silent=True) or {}
            image_url = data.get("image_url")
            if not image_url:
                return jsonify({"error": "image or image_url required"}), 400
            with httpx.Client(timeout=20) as client:
                r = client.get(image_url)
                r.raise_for_status()
                image_bytes = r.content
            mime = "image/jpeg"
            ctx = {
                "title": data.get("title"),
                "category": data.get("category"),
                "unit": data.get("unit"),
                "location": data.get("location"),
                "current_price": data.get("current_price"),
            }
        ai = analyze_quality_and_price(image_bytes, mime, ctx)
        return jsonify({"ai": ai})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
