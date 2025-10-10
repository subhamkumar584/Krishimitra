from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String
from app.db.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Our internal order ref (optional if you have your own order table later)
    order_ref = Column(String, nullable=True)

    # Razorpay identifiers
    razorpay_order_id = Column(String, index=True, nullable=True)
    razorpay_payment_id = Column(String, index=True, nullable=True)

    # Payment details
    amount = Column(Integer, nullable=False)  # amount in paise
    currency = Column(String, default="INR", nullable=False)
    status = Column(String, nullable=False, default="created")  # created/authorized/captured/failed
    receipt = Column(String, nullable=True)
