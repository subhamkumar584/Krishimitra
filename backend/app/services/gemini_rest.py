import httpx
from typing import Dict, Any
from ..config import settings


def _extract_text_from_candidates(data: Dict[str, Any]) -> str:
    text = ""
    for cand in (data.get("candidates") or []):
        for part in (cand.get("content", {}).get("parts") or []):
            if "text" in part:
                text += part["text"]
    return (text or "").strip()


def _model_fallbacks() -> list[str]:
    first = (settings.GEMINI_MODEL or "gemini-2.5-flash").strip()
    if first.startswith("models/"):
        first = first.split("/", 1)[1]
    return [
        first,
        f"{first}-latest",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-2.0-flash-001",
        "gemini-2.5-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ]


def _gemini_rest_generate_text(prompt: str) -> str:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("no_api_key")
    params = {"key": settings.GEMINI_API_KEY}
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    with httpx.Client(timeout=20) as client:
        last_err = None
        for m in _model_fallbacks():
            try:
                url = f"https://generativelanguage.googleapis.com/v1/models/{m}:generateContent"
                r = client.post(url, params=params, json=payload)
                if r.status_code == 404:
                    continue
                r.raise_for_status()
                data = r.json()
                text = _extract_text_from_candidates(data)
                if text:
                    return text
            except Exception as e:
                last_err = e
        raise RuntimeError("gemini_unavailable") from last_err


def chat_from_message_rest(message: str, language: str | None = None) -> Dict[str, Any]:
    msg = (message or "").strip()
    if not msg:
        return {"reply": "Please type your question.", "model": "none"}
    if not settings.GEMINI_API_KEY:
        return {"reply": "AI key is not configured.", "model": "rules-fallback"}
    sys = (
        "You are KrishiMitra, a concise and practical agricultural assistant for India. "
        "Answer briefly and clearly. Use the user's language if specified."
    )
    prompt = f"SYSTEM\n{sys}\n\nLANGUAGE={language or 'en'}\n\nUSER\n{msg}"
    params = {"key": settings.GEMINI_API_KEY}
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": prompt}]}
        ]
    }
    # Try configured model first, then common fallbacks
    fallbacks = _model_fallbacks()

    try:
        with httpx.Client(timeout=20) as client:
            last_error = None
            for m in fallbacks:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1/models/{m}:generateContent"
                    r = client.post(url, params=params, json=payload)
                    if r.status_code == 404:
                        continue
                    r.raise_for_status()
                    data = r.json()
                    text = _extract_text_from_candidates(data) or "Sorry, I couldn't generate a reply."
                    return {"reply": text, "model": m}
                except Exception as e:
                    last_error = str(e)
            # If all models failed
            return {"reply": "I couldn't reach the AI service right now. Please try again later.", "model": "rules-fallback"}
    except Exception:
        return {"reply": "I couldn't reach the AI service right now. Please try again later.", "model": "rules-fallback"}
