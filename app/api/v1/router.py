from fastapi import APIRouter

from app.api.v1.routes import ai, payments, health

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])  # /health
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])  # /api/v1/ai
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])  # /api/v1/payments
