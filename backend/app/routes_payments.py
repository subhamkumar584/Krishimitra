from flask import Blueprint, request, jsonify
from .services.razorpay_service import RazorpayService
from .config import settings
from sqlalchemy.orm import Session
from .db import get_db
from .models import SoilRecommendationLog

bp = Blueprint("payments", __name__, url_prefix="/api/v1/payments")


@bp.post("/create-order")
def create_order():
    data = request.get_json(force=True) or {}
    amount = int(data.get("amount", 0))  # in paise (INR)
    currency = data.get("currency", "INR")
    receipt = data.get("receipt")

    svc = RazorpayService()
    if not svc.is_configured():
        return jsonify({"error": "Razorpay is not configured"}), 503

    try:
        order = svc.create_order(amount_paise=amount, currency=currency, receipt=receipt)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"order": order})


@bp.post("/webhook")
def webhook():
    signature = request.headers.get("X-Razorpay-Signature", "")
    body = request.get_data() or b""

    svc = RazorpayService()
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        return jsonify({"error": "Webhook secret not configured"}), 503

    if not signature or not svc.verify_webhook_signature(body, signature):
        return jsonify({"error": "Invalid signature"}), 400

    event = request.get_json(silent=True) or {}
    # TODO: handle event types to update DB
    return jsonify({"status": "received"})
