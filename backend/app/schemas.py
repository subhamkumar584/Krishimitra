from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SoilAttributes(BaseModel):
    soil_type: str = Field(..., description="black, alluvial, red, loamy, sandy")
    ph: Optional[float] = Field(None, ge=0, le=14)
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    region: Optional[str] = None
    season: Optional[str] = None
    acreage: Optional[float] = None


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
    soil: Dict[str, Any]
    language: Optional[str] = None
