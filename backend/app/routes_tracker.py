from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from flask_jwt_extended import get_jwt_identity

from .db import get_db
from .services.gemini_core import plan_from_inputs_strict, _fallback_plan as __fb

bp = Blueprint("tracker", __name__, url_prefix="/api/v1/tracker")

# Minimal crop plan storage in-memory stub (replace with DB model later)
_plans = {}

@bp.post("/plans")
def create_plan():
    data = request.get_json(force=True) or {}
    uid = request.headers.get("X-User-Id") or "0"
    pid = str(len(_plans) + 1)
    plan = {"id": pid, "user_id": uid, "crop": data.get("crop"), "season": data.get("season"), "start": data.get("start")}
    _plans[pid] = plan
    return jsonify(plan)

@bp.get("/plans")
def list_plans():
    return jsonify({"plans": list(_plans.values())})

@bp.post("/plan-ai")
def plan_ai():
    payload = request.get_json(force=True) or {}
    try:
        data = plan_from_inputs_strict(payload)
    except Exception:
        crop = (payload.get("crop") or "crop")
        season = payload.get("season")
        data = __fb(crop, season)
    return jsonify(data)
