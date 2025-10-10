import os
from dotenv import load_dotenv

# Load env from backend/.env first (if present), then from root .env
load_dotenv(dotenv_path=os.path.join("backend", ".env"), override=False)
load_dotenv(override=False)

from backend.app import create_app  # noqa: E402
from backend.app.config import settings  # noqa: E402

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", settings.PORT))
    debug = settings.ENV == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
