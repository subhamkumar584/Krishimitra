from typing import List, Optional
from pydantic import BaseModel, Field


class SoilAttributes(BaseModel):
    soil_type: str = Field(..., description="e.g., black, alluvial, red, loamy, sandy")
    ph: Optional[float] = Field(None, ge=0, le=14)
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    region: Optional[str] = Field(None, description="District/State/Geo reference")
    season: Optional[str] = Field(None, description="rabi/kharif/zaid or month window")
    acreage: Optional[float] = Field(None, description="Area in acres or hectares")


class FertilizerPlan(BaseModel):
    basal: Optional[str] = None
    top_dressing: Optional[str] = None
    micronutrients: Optional[str] = None


class PlantingStep(BaseModel):
    step: str
    when: Optional[str] = None
    details: Optional[str] = None


class RecommendationCrop(BaseModel):
    crop: str
    ideal_season: Optional[str] = None
    seed_rate: Optional[str] = None
    spacing: Optional[str] = None
    irrigation: Optional[str] = None
    fertilizer: Optional[FertilizerPlan] = None
    pest_disease_watch: Optional[str] = None
    steps: Optional[List[PlantingStep]] = None


class SoilRecommendationRequest(BaseModel):
    soil: SoilAttributes
    language: Optional[str] = Field(None, description="Preferred language code, e.g. hi, en, mr")


class SoilRecommendationResponse(BaseModel):
    recommendations: List[RecommendationCrop]
    notes: Optional[str] = None
    model: Optional[str] = None
