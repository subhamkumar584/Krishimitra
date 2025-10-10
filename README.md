# KrishiMitra Monorepo

Structure
- backend/ – Flask REST API (MySQL + SQLAlchemy), Gemini and OpenWeather integrations, Razorpay server endpoints
- frontend/ – Next.js + React UI with Razorpay Checkout integration

Security note
- Do NOT hardcode API keys or passwords in code. Put them in environment variables.
- Fill backend/.env (server-only) and frontend/.env.local (client-safe values only)

Quickstart (backend)
- Create virtual env (PowerShell):
    python -m venv .venv
    .venv\Scripts\Activate.ps1
- Install deps:
    pip install -r backend/requirements.txt
- Copy env template and set values:
    copy backend\.env.example backend\.env
  Required env vars in backend/.env:
    FLASK_ENV=development
    DATABASE_URL=mysql+pymysql://root:YOUR_DB_PASSWORD@localhost:3306/krishimitra
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY
    GEMINI_MODEL=gemini-1.5-flash
    OPENWEATHER_API_KEY=YOUR_OPENWEATHER_KEY
    RAZORPAY_KEY_ID=YOUR_PUBLIC_KEY_ID
    RAZORPAY_KEY_SECRET=YOUR_SECRET
    RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
- Run dev server:
    python app.py
    # Optional: set PORT via env if you want a different port
    # PowerShell: $env:PORT="8000"

Quickstart (frontend)
- Requires Node 18+ and pnpm or npm
- cd frontend
- Install deps: pnpm install (or npm install)
- Copy env template and set values:
    copy .env.local.example .env.local
  Frontend env (safe for client):
    NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
    NEXT_PUBLIC_RAZORPAY_KEY_ID=YOUR_PUBLIC_KEY_ID
- Start UI: pnpm dev (or npm run dev)

Core endpoints
- GET /health
- POST /api/v1/ai/recommend/soil
- POST /api/v1/payments/create-order
- POST /api/v1/payments/webhook
