import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return str(v).strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    ENV: str = os.getenv("FLASK_ENV", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    ALLOWED_ORIGINS: list[str] = [o.strip() for o in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",") if o.strip()]

    DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/krishimitra")
    AUTO_CREATE_TABLES: bool = _bool("AUTO_CREATE_TABLES", True)

    # Gemini
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # Weather
    OPENWEATHER_API_KEY: str | None = os.getenv("OPENWEATHER_API_KEY")

    # Razorpay
    RAZORPAY_KEY_ID: str | None = os.getenv("RAZORPAY_KEY_ID")
    RAZORPAY_KEY_SECRET: str | None = os.getenv("RAZORPAY_KEY_SECRET")
    RAZORPAY_WEBHOOK_SECRET: str | None = os.getenv("RAZORPAY_WEBHOOK_SECRET")


settings = Settings()