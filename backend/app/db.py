from __future__ import annotations
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy import create_engine

Base = declarative_base()
_engine = None
SessionLocal: sessionmaker | None = None


def init_engine(url: str):
    global _engine
    _engine = create_engine(url, pool_pre_ping=True, future=True)
    return _engine


def init_session(engine):
    global SessionLocal
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Session:
    assert SessionLocal is not None, "Session not initialized"
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
