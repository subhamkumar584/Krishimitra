from datetime import datetime
from typing import Optional
from sqlalchemy import Column, DateTime, Integer, String, JSON
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import Base


class SoilRecommendationLog(Base):
    __tablename__ = "soil_recommendation_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Optional association for later (user sessions)
    user_id = Column(String, nullable=True)

    # Store input + output for auditing
    request = Column(JSON, nullable=False)
    response = Column(JSON, nullable=False)

    model_name = Column(String, nullable=True)
