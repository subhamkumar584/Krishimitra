import os
import sys
import json
import httpx

# Load env from backend/.env if present
from dotenv import load_dotenv

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, "..", ".."))
load_dotenv(os.path.join(root, "backend", ".env"))
load_dotenv()  # root .env if exists

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


def rest_generate(message: str) -> dict:
    if not GEMINI_API_KEY:
        return {"ok": False, "error": "GEMINI_API_KEY not set"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    params = {"key": GEMINI_API_KEY}
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": message}]} 
        ]
    }
    try:
        with httpx.Client(timeout=20) as client:
            r = client.post(url, params=params, json=payload)
            data = {"status": r.status_code}
            r.raise_for_status()
            body = r.json()
            text = ""
            for cand in (body.get("candidates") or []):
                for part in (cand.get("content", {}).get("parts") or []):
                    if "text" in part:
                        text += part["text"]
            data["ok"] = bool(text.strip())
            data["reply_preview"] = text[:200]
            return data
    except Exception as e:
        return {"ok": False, "error": str(e)}


def main():
    msg = "hello from test" if len(sys.argv) < 2 else " ".join(sys.argv[1:])
    print("Testing Gemini via REST API...\n")
    result = rest_generate(msg)
    print(json.dumps(result, indent=2))
    print("\nDone.")


if __name__ == "__main__":
    main()