from sqlalchemy import Column, DateTime, Integer, String, JSON
from datetime import datetime
from .db import Base


class SoilRecommendationLog(Base):
    __tablename__ = "soil_recommendation_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user_id = Column(String, nullable=True)

    request = Column(JSON, nullable=False)
    response = Column(JSON, nullable=False)

    model_name = Column(String, nullable=True)
