from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.ai import SoilRecommendationRequest, SoilRecommendationResponse
from app.services.gemini import recommend_from_soil
from app.models.soil import SoilRecommendationLog

router = APIRouter()

@router.post("/recommend/soil", response_model=SoilRecommendationResponse)
def recommend_soil(payload: SoilRecommendationRequest, db: Session = Depends(get_db)):
    data = recommend_from_soil(payload.soil.model_dump(), payload.language)

    # Persist log
    log = SoilRecommendationLog(
        request={"soil": payload.soil.model_dump(), "language": payload.language},
        response=data,
        model_name=data.get("model"),
    )
    db.add(log)
    db.commit()

    return data
