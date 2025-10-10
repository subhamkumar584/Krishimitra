# KrishiMitra Backend (FastAPI)

A modular FastAPI backend for farmer-focused services: marketplace, multilingual chatbot (Gemini), advisory (weather/market), AI recommendations, crop tracker, and Razorpay payments.

Quickstart
- Create and activate a virtual environment
  - Windows (PowerShell):
    python -m venv .venv
    .venv\Scripts\Activate.ps1
- Install dependencies:
    pip install -r requirements.txt
- Copy env template and fill values:
    copy .env.example .env
  - Set DATABASE_URL (PostgreSQL), GEMINI_API_KEY, OPENWEATHER_API_KEY
  - Add Razorpay keys later when available (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET)
- Run the server:
    uvicorn app.main:app --host 0.0.0.0 --port 8000

API highlights
- GET /health – health check
- POST /api/v1/ai/recommend/soil – soil-based crop & fertilizer recommendations
- POST /api/v1/payments/create-order – create Razorpay order (INR)
- POST /api/v1/payments/webhook – Razorpay webhook receiver

Deployment (Render)
- Web Service: start command uvicorn app.main:app --host 0.0.0.0 --port $PORT
- Environment variables: DATABASE_URL, GEMINI_API_KEY, OPENWEATHER_API_KEY, RAZORPAY_*
- PostgreSQL: provision a managed instance and point DATABASE_URL to it

Notes
- Tables are auto-created on startup when AUTO_CREATE_TABLES=true (use Alembic migrations later).
- Gemini is used for cloud inference; a rules-based fallback is provided when GEMINI_API_KEY is missing.
