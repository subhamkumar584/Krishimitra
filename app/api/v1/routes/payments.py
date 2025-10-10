from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.payment import Payment
from app.services.razorpay_client import RazorpayService

router = APIRouter()


class CreateOrderRequest(BaseModel):
    amount: int  # amount in paise
    currency: str = "INR"
    receipt: Optional[str] = None
    order_ref: Optional[str] = None


@router.post("/create-order")
def create_order(payload: CreateOrderRequest, db: Session = Depends(get_db)):
    svc = RazorpayService()
    if not svc.is_configured():
        raise HTTPException(status_code=503, detail="Razorpay is not configured")

    order = svc.create_order(amount_paise=payload.amount, currency=payload.currency, receipt=payload.receipt)

    payment = Payment(
        order_ref=payload.order_ref,
        razorpay_order_id=order.get("id"),
        amount=payload.amount,
        currency=payload.currency,
        status=order.get("status", "created"),
        receipt=payload.receipt,
    )
    db.add(payment)
    db.commit()

    return {"order": order}


@router.post("/webhook")
async def razorpay_webhook(request: Request, x_razorpay_signature: str = Header(None)):
    body = await request.body()
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    svc = RazorpayService()
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing signature header")
    if not svc.verify_webhook_signature(body, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    # TODO: parse event and update payment/order status accordingly
    return {"status": "received"}
