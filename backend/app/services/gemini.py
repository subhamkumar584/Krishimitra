import json
from typing import Any, Dict, List
from ..config import settings

try:
    import google.generativeai as genai
except Exception:
    genai = None  # type: ignore


def _fallback_rules(soil: Dict[str, Any], language: str | None = None) -> Dict[str, Any]:
    stype = (soil.get("soil_type") or "").lower()

    mapping: Dict[str, List[Dict[str, Any]]] = {
        "black": [
            {"crop": "Cotton", "ideal_season": "Kharif", "seed_rate": "2-3 kg/acre",
             "spacing": "90x45 cm", "irrigation": "Every 7-10 days",
             "fertilizer": {"basal": "NPK 10:26:26 - 50 kg/acre",
                             "top_dressing": "Urea split at 30 & 60 DAS",
                             "micronutrients": "ZnSO4 10 kg/acre if deficient"}}
        ],
        "alluvial": [
            {"crop": "Wheat", "ideal_season": "Rabi", "seed_rate": "40-45 kg/acre",
             "spacing": "20-22 cm", "irrigation": "5-6 irrigations"}
        ],
        "red": [
            {"crop": "Groundnut", "ideal_season": "Kharif/Rabi"}
        ],
        "loamy": [
            {"crop": "Vegetables (Tomato/Chilli)", "ideal_season": "Year-round with irrigation"}
        ],
        "sandy": [
            {"crop": "Cumin", "ideal_season": "Rabi"}
        ],
    }

    recos = mapping.get(stype) or mapping.get("loamy") or []
    return {"recommendations": recos[:3], "notes": "rules-fallback used", "model": "rules-fallback"}


def _gemini_generate(soil: Dict[str, Any], language: str | None) -> Dict[str, Any]:
    assert genai is not None and settings.GEMINI_API_KEY, "Gemini not configured"
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    system_prompt = (
        "You are an agricultural expert. Given soil attributes, produce 2-3 crops with fertilizer plan,"
        " planting steps, and ideal seasons. If a language is provided, localize for farmers."
        " Return STRICT JSON only."
    )

    schema_hint = {
        "recommendations": [
            {
                "crop": "...",
                "ideal_season": "...",
                "seed_rate": "...",
                "spacing": "...",
                "irrigation": "...",
                "fertilizer": {"basal": "...", "top_dressing": "...", "micronutrients": "..."},
                "pest_disease_watch": "...",
                "steps": [{"step": "...", "when": "...", "details": "..."}]
            }
        ],
        "notes": "..."
    }

    payload = {"soil": soil, "language": language or "en"}
    prompt = (
        f"SYSTEM:\n{system_prompt}\n\n"
        f"JSON schema hint:\n{json.dumps(schema_hint)}\n\n"
        f"USER INPUT:\n{json.dumps(payload, ensure_ascii=False)}\n\n"
        "Respond with JSON ONLY."
    )

    resp = model.generate_content(prompt)
    txt = resp.text or "{}"
    try:
        data = json.loads(txt)
    except Exception:
        start, end = txt.find("{"), txt.rfind("}")
        if start != -1 and end != -1 and end > start:
            data = json.loads(txt[start:end+1])
        else:
            raise
    data["model"] = settings.GEMINI_MODEL
    return data


def recommend_from_soil(soil: Dict[str, Any], language: str | None = None) -> Dict[str, Any]:
    if settings.GEMINI_API_KEY and genai is not None:
        try:
            return _gemini_generate(soil, language)
        except Exception:
            pass
    return _fallback_rules(soil, language)
