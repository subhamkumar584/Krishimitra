import json
from typing import Any, Dict, List

from app.core.config import settings

# Gemini SDK
try:
    import google.generativeai as genai
except Exception:  # pragma: no cover
    genai = None  # type: ignore


def _fallback_rules(soil: Dict[str, Any], language: str | None = None) -> Dict[str, Any]:
    stype = (soil.get("soil_type") or "").lower()
    season = (soil.get("season") or "").lower()

    # Very simple heuristics; can be expanded with localized content
    mapping: Dict[str, List[Dict[str, Any]]] = {
        "black": [
            {"crop": "Cotton", "ideal_season": "Kharif", "seed_rate": "2-3 kg/acre",
             "spacing": "90x45 cm", "irrigation": "Every 7-10 days",
             "fertilizer": {"basal": "NPK 10:26:26 - 50 kg/acre",
                             "top_dressing": "Urea split at 30 & 60 DAS",
                             "micronutrients": "ZnSO4 10 kg/acre if deficient"},
             "pest_disease_watch": "Pink bollworm, sucking pests",
             "steps": [
                 {"step": "Land preparation", "when": "Before onset of monsoon"},
                 {"step": "Sowing", "when": "With first good rains"},
                 {"step": "Weeding & top dress", "when": "30-35 DAS"}
             ]},
            {"crop": "Soybean", "ideal_season": "Kharif", "seed_rate": "30-35 kg/acre",
             "spacing": "30x10 cm", "irrigation": "As needed; avoid waterlogging",
             "fertilizer": {"basal": "DAP 50 kg/acre", "top_dressing": "Urea 20 kg/acre at 30 DAS"},
             "pest_disease_watch": "Girdle beetle, rust"}
        ],
        "alluvial": [
            {"crop": "Wheat", "ideal_season": "Rabi", "seed_rate": "40-45 kg/acre",
             "spacing": "20-22 cm", "irrigation": "5-6 irrigations",
             "fertilizer": {"basal": "DAP 50 kg/acre", "top_dressing": "Urea 30 kg/acre at CRI & tillering"}},
            {"crop": "Rice", "ideal_season": "Kharif/Rabi", "seed_rate": "4-6 kg/acre (transplant)",
             "spacing": "20x15 cm", "irrigation": "Maintain puddled water",
             "fertilizer": {"basal": "NPK 10:26:26 - 40 kg/acre", "top_dressing": "Urea split 3 doses"}}
        ],
        "red": [
            {"crop": "Groundnut", "ideal_season": "Kharif/Rabi", "seed_rate": "40-45 kg/acre",
             "spacing": "30x10 cm", "irrigation": "Light, frequent",
             "fertilizer": {"basal": "Gypsum 100 kg/acre at flowering"}},
            {"crop": "Millets (Pearl/Foxtail)", "ideal_season": "Kharif/Rabi"}
        ],
        "loamy": [
            {"crop": "Vegetables (Tomato/Chilli)", "ideal_season": "Round the year with irrigation"},
            {"crop": "Wheat", "ideal_season": "Rabi"}
        ],
        "sandy": [
            {"crop": "Cumin", "ideal_season": "Rabi"},
            {"crop": "Groundnut", "ideal_season": "Kharif"}
        ],
    }

    recos = mapping.get(stype) or mapping.get("loamy") or []
    return {
        "recommendations": recos[:3],
        "notes": "Fallback rules used. Provide pH and NPK for better accuracy.",
        "model": "rules-fallback"
    }


def _gemini_generate(soil: Dict[str, Any], language: str | None) -> Dict[str, Any]:
    assert genai is not None and settings.GEMINI_API_KEY, "Gemini not configured"
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    system_prompt = (
        "You are an agricultural expert for India. Given soil attributes, respond with 2-3 suitable crops "
        "along with fertilizer plans, planting steps, and ideal seasons. If a language code is provided, "
        "write farmer-friendly, concise instructions in that language. Return STRICT JSON only."
    )

    schema_hint = {
        "recommendations": [
            {
                "crop": "...",
                "ideal_season": "...",
                "seed_rate": "...",
                "spacing": "...",
                "irrigation": "...",
                "fertilizer": {
                    "basal": "...",
                    "top_dressing": "...",
                    "micronutrients": "..."
                },
                "pest_disease_watch": "...",
                "steps": [
                    {"step": "...", "when": "...", "details": "..."}
                ]
            }
        ],
        "notes": "..."
    }

    user_payload = {
        "soil": soil,
        "language": language or "en"
    }

    prompt = (
        f"SYSTEM:\n{system_prompt}\n\n"
        f"JSON schema hint (keys to include):\n{json.dumps(schema_hint)}\n\n"
        f"USER INPUT (use as context):\n{json.dumps(user_payload, ensure_ascii=False)}\n\n"
        "Respond with JSON ONLY. No prose."
    )

    resp = model.generate_content(prompt)
    txt = resp.text or "{}"
    try:
        data = json.loads(txt)
    except Exception:
        # Try to extract JSON substring
        start = txt.find("{")
        end = txt.rfind("}")
        if start != -1 and end != -1 and end > start:
            data = json.loads(txt[start:end+1])
        else:
            raise
    data["model"] = settings.GEMINI_MODEL
    return data


def recommend_from_soil(soil: Dict[str, Any], language: str | None = None) -> Dict[str, Any]:
    """Return structured recommendations using Gemini if configured, else fallback rules."""
    if settings.GEMINI_API_KEY and genai is not None:
        try:
            return _gemini_generate(soil, language)
        except Exception:
            # Safety net: fall back to local rules on any failure
            pass
    return _fallback_rules(soil, language)
