import hmac
import hashlib
from typing import Any, Dict, Optional

import razorpay  # type: ignore

from ..config import settings


class RazorpayService:
    def __init__(self) -> None:
        if not (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET):
            self.client = None
        else:
            self.client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

    def is_configured(self) -> bool:
        return self.client is not None

    def create_order(self, amount_paise: int, currency: str = "INR", receipt: Optional[str] = None) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("Razorpay is not configured")
        payload = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt or "receipt",
            "payment_capture": 1,
        }
        return self.client.order.create(data=payload)

    @staticmethod
    def verify_webhook_signature(body: bytes, signature: str) -> bool:
        secret = settings.RAZORPAY_WEBHOOK_SECRET
        if not secret:
            return False
        expected = hmac.new(bytes(secret, 'utf-8'), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
