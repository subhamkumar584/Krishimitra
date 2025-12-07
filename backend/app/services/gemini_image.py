import base64
import json
from typing import Dict, Any, Optional

import httpx

from .gemini_core import _parse_json_strict
from ..config import settings

try:
    import google.generativeai as genai
except Exception:
    genai = None  # type: ignore


def _rest_generate_with_image(prompt: str, image_b64: str, mime_type: str) -> str:
    # Try multiple model slugs
    first = (settings.GEMINI_MODEL or "gemini-2.5-flash").strip()
    if first.startswith("models/"):
        first = first.split("/", 1)[1]
    models = [
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
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": image_b64}},
                ],
            }
        ]
    }
    params = {"key": settings.GEMINI_API_KEY}
    with httpx.Client(timeout=30) as client:
        last_exc: Optional[Exception] = None
        for m in models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1/models/{m}:generateContent"
                r = client.post(url, params=params, json=payload)
                if r.status_code == 404:
                    continue
                r.raise_for_status()
                data = r.json()
                # Concatenate parts text
                text = ""
                for cand in (data.get("candidates") or []):
                    for part in (cand.get("content", {}).get("parts") or []):
                        if "text" in part:
                            text += part["text"]
                return text or "{}"
            except Exception as e:
                last_exc = e
                continue
        if last_exc:
            raise last_exc
        return "{}"


def analyze_quality_and_price(image_bytes: bytes, mime_type: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Analyze product quality/condition from an image and suggest a price in INR.
    Expected JSON schema returned:
    {
      condition: "excellent" | "good" | "fair" | "poor",
      quality_score: number,            # 0.0 - 1.0
      suggested_price_in_inr: number,   # per unit INR, best estimate
      notes: string,
      model: string
    }
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("gemini_unavailable")

    # Build prompt
    info = context or {}
    unit = (info.get("unit") or "unit").strip()
    category = (info.get("category") or "").strip()
    title = (info.get("title") or "").strip()
    location = (info.get("location") or "").strip()
    current_price = info.get("current_price")

    system_prompt = (
        "You are a quality inspector and pricing assistant for Indian farm marketplace listings. "
        "Given a product image and minimal context (title/category/unit/location and current farmer price if any), "
        "estimate the visible condition as one of: excellent, good, fair, poor. Also estimate a fair suggested_price_in_inr "
        "for the given unit. Keep suggestions practical for Indian markets. Return STRICT JSON only matching the schema."
    )
    user_prompt = (
        f"CONTEXT\n"
        f"title={title}\ncategory={category}\nunit={unit}\nlocation={location}\ncurrent_price={current_price}\n"
        "Respond with JSON only."
    )

    # SDK path first
    if genai is not None:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            parts = [system_prompt, user_prompt, {
                "mime_type": mime_type,
                "data": image_bytes,
            }]
            resp = model.generate_content(parts)
            txt = resp.text or "{}"
            data = _parse_json_strict(txt)
            data["model"] = settings.GEMINI_MODEL
            return data
        except Exception:
            pass

    # REST path (base64 inline)
    try:
        b64 = base64.b64encode(image_bytes).decode("ascii")
        txt = _rest_generate_with_image(f"{system_prompt}\n\n{user_prompt}", b64, mime_type)
        data = _parse_json_strict(txt)
        data["model"] = settings.GEMINI_MODEL
        return data
    except Exception as e:
        raise RuntimeError("gemini_unavailable") from e


def diagnose_disease(image_bytes: bytes, mime_type: str, crop: Optional[str] = None, language: Optional[str] = None) -> Dict[str, Any]:
    """Diagnose plant disease from image using Gemini. Returns structured dict.
    Output schema:
    {
      disease: str,
      confidence: str,
      description: str,
      management: [str],
      model: str
    }
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("gemini_unavailable")

    # Language mapping for better prompts
    lang_instructions = {
        'hi': 'Write all text content in Hindi language. Use clear, simple Hindi that farmers can understand.',
        'or': 'Write all text content in Odia language. Use clear, simple Odia that farmers can understand.',
        'en': 'Write all text content in English language. Use clear, simple English that farmers can understand.'
    }
    lang_instruction = lang_instructions.get(language, lang_instructions['en']) if language else lang_instructions['en']
    
    system_prompt = (
        "You are an expert plant pathologist. Given a photo of a crop plant, identify the most likely disease "
        "(or say 'healthy' if none), provide a short description of symptoms, and 3-5 practical management steps. "
        f"{lang_instruction} "
        "Return STRICT JSON only, matching this schema: {disease, confidence, description, management[]} with all text fields translated appropriately."
    )
    user_prompt = (
        f"LANGUAGE={language or 'en'}\n"
        f"CROP={crop or ''}\n"
        "Respond with JSON only."
    )

    # SDK path first
    if genai is not None:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            parts = [system_prompt, user_prompt, {
                "mime_type": mime_type,
                "data": image_bytes,
            }]
            resp = model.generate_content(parts)
            txt = resp.text or "{}"
            data = _parse_json_strict(txt)
            data["model"] = settings.GEMINI_MODEL
            return data
        except Exception:
            pass

    # REST path (base64 inline image)
    try:
        b64 = base64.b64encode(image_bytes).decode("ascii")
        txt = _rest_generate_with_image(f"{system_prompt}\n\n{user_prompt}", b64, mime_type)
        data = _parse_json_strict(txt)
        data["model"] = settings.GEMINI_MODEL
        return data
    except Exception as e:
        raise RuntimeError("gemini_unavailable") from e