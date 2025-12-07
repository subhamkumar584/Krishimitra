from flask import Blueprint, request, jsonify
from .services.gemini_rest import chat_from_message_rest
from .config import settings
import httpx

bp = Blueprint("ai_health", __name__, url_prefix="/api/v1/ai")

@bp.get("/diagnose")
def diagnose():
    msg = request.args.get("msg", "hello")
    data = chat_from_message_rest(msg, "en")
    ok = data.get("model") != "rules-fallback"

    # Low-level REST probe for detailed status
    status = None
    error = None
    try:
        base_model = settings.GEMINI_MODEL
        params = {"key": settings.GEMINI_API_KEY}
        payload = {"contents": [{"role": "user", "parts": [{"text": "PING"}]}]}
        with httpx.Client(timeout=10) as client:
            url = f"https://generativelanguage.googleapis.com/v1/models/{base_model}:generateContent"
            r = client.post(url, params=params, json=payload)
            if r.status_code == 404:
                url2 = f"https://generativelanguage.googleapis.com/v1/models/{base_model}-latest:generateContent"
                r = client.post(url2, params=params, json=payload)
            status = r.status_code
            if r.status_code >= 400:
                try:
                    error = r.text[:300]
                except Exception:
                    error = f"HTTP {r.status_code}"
            # Also fetch model list for guidance (v1 and v1beta)
            model_names = []
            try:
                lm_v1 = client.get("https://generativelanguage.googleapis.com/v1/models", params=params)
                lj1 = lm_v1.json()
                model_names += [m.get("name") for m in (lj1.get("models") or []) if m.get("name")]
            except Exception:
                pass
            try:
                lm_v1b = client.get("https://generativelanguage.googleapis.com/v1beta/models", params=params)
                lj2 = lm_v1b.json()
                model_names += [m.get("name") for m in (lj2.get("models") or []) if m.get("name")]
            except Exception:
                pass
            # Dedup and shorten
            model_names = list(dict.fromkeys(model_names))
    except Exception as e:
        error = str(e)
        model_names = []

    return jsonify({
        "ok": ok,
        "model": data.get("model"),
        "reply_preview": (data.get("reply") or "")[:200],
        "rest_status": status,
        "rest_error": error,
        "available_models": model_names[:10]
    })
