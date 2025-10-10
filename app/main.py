from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine
from app.db.base import Base
from app.api.v1.router import api_router

app = FastAPI(title="KrishiMitra API", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router under /api/v1
app.include_router(api_router, prefix="/api/v1")

# Plain health at root too
@app.get("/health")
def root_health():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup():
    # Auto create tables in early development (use Alembic later)
    if settings.AUTO_CREATE_TABLES:
        Base.metadata.create_all(bind=engine)
