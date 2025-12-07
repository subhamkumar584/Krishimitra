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


def _fallback_plan(crop: str, season: str | None = None) -> Dict[str, Any]:
    stages = [
        {
            "name": "Land Preparation",
            "start_day": 0,
            "end_day": 7,
            "tasks": ["Plough field", "Incorporate FYM/compost", "Bed preparation"],
            "alerts": ["Avoid waterlogging"]
        },
        {
            "name": "Sowing/Transplanting",
            "start_day": 8,
            "end_day": 14,
            "tasks": ["Seed treatment", "Maintain spacing", "Irrigate lightly"],
            "alerts": ["Use certified seeds"]
        },
        {
            "name": "Vegetative Growth",
            "start_day": 15,
            "end_day": 45,
            "tasks": ["Weeding", "Top dress nitrogen", "Irrigation as needed"],
            "alerts": ["Scout for pests weekly"]
        },
        {
            "name": "Flowering/Fruiting",
            "start_day": 46,
            "end_day": 90,
            "tasks": ["Micronutrient spray if deficient", "Pest-disease management"],
            "alerts": ["Avoid spraying during rain"]
        },
        {
            "name": "Harvest",
            "start_day": 91,
            "end_day": 120,
            "tasks": ["Harvest at proper maturity", "Post-harvest handling"],
            "alerts": ["Dry and store in clean bags"]
        },
    ]
    # Minimal generic recommendations
    recommendations = {
        "fertilizer": {
            "basal": "Apply well-decomposed FYM 1-2 tons/acre; DAP 50 kg/acre at sowing",
            "top_dressing": "Split urea applications at 25-30 DAS and 45-50 DAS",
            "micronutrients": "ZnSO4 10 kg/acre if deficient",
            "npk_ratio": "Approx N:P:K = 80:40:40 kg/ha (adjust by crop)"
        },
        "soil": {
            "ideal_types": ["loamy", "alluvial"],
            "ph_range": "6.5 - 7.5",
            "prep": "Good tilth, proper drainage; avoid waterlogging"
        },
        "crop_details": {
            "varieties": ["Use locally recommended certified seeds"],
            "seed_rate": "As per crop (e.g., 2-3 kg/acre cotton; 30-35 kg/acre soybean)",
            "spacing": "As per crop (e.g., 90x45 cm for cotton; 30x10 cm for soybean)",
            "irrigation": "Light, frequent irrigation; adjust with rainfall",
            "season": season or "kharif"
        },
        "diseases": [
            {"name": "General sucking pests", "symptoms": "Leaf curling, stunted growth",
             "management": "Yellow sticky traps; neem oil sprays; recommended insecticides if severe"}
        ]
    }
    return {
        "plan": {
            "crop": crop,
            "season": season or "kharif",
            "stages": stages
        },
        "recommendations": recommendations,
        "notes": "Fallback generic plan. Provide region/soil for better accuracy.",
        "model": "rules-fallback"
    }


def plan_from_inputs(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a crop plan with stages using Gemini. Inputs: crop, season, start (optional), region, soil, language."""
    crop = (inputs.get("crop") or "").strip() or "crop"
    season = (inputs.get("season") or "").strip() or None
    language = inputs.get("language")

    if settings.GEMINI_API_KEY and genai is not None:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(settings.GEMINI_MODEL)

            schema_hint = {
                "plan": {
                    "crop": "...",
                    "season": "...",
                    "start": "YYYY-MM-DD or null",
                    "stages": [
                        {
                            "name": "...",
                            "start_day": 0,
                            "end_day": 7,
                            "tasks": ["..."],
                            "alerts": ["..."]
                        }
                    ]
                },
                "recommendations": {
                    "fertilizer": {
                        "basal": "...",
                        "top_dressing": "...",
                        "micronutrients": "...",
                        "npk_ratio": "..."
                    },
                    "soil": {
                        "ideal_types": ["..."],
                        "ph_range": "...",
                        "prep": "..."
                    },
                    "crop_details": {
                        "varieties": ["..."],
                        "seed_rate": "...",
                        "spacing": "...",
                        "irrigation": "...",
                        "season": "..."
                    },
                    "diseases": [
                        {"name": "...", "symptoms": "...", "management": "..."}
                    ]
                },
                "notes": "..."
            }

            # Language mapping for better prompts
            lang_instructions = {
                'hi': 'Write all text content in Hindi language. Use clear, simple Hindi that farmers can understand.',
                'or': 'Write all text content in Odia language. Use clear, simple Odia that farmers can understand.',
                'en': 'Write all text content in English language. Use clear, simple English that farmers can understand.'
            }
            lang_instruction = lang_instructions.get(language, lang_instructions['en']) if language else lang_instructions['en']
            
            user_payload = {
                "inputs": inputs,
                "language": language or "en"
            }
            system_prompt = (
                "You are an agricultural planner. Create a concise crop growth plan broken into stages with start_day/end_day, "
                "key tasks and alerts. Keep it practical for Indian farmers. "
                f"{lang_instruction} "
                "Output STRICT JSON only matching the schema with all text fields translated appropriately."
            )
            prompt = (
                f"SYSTEM\n{system_prompt}\n\n"
                f"SCHEMA HINT\n{json.dumps(schema_hint)}\n\n"
                f"USER INPUT\n{json.dumps(user_payload, ensure_ascii=False)}\n\n"
                "Return JSON only."
            )
            resp = model.generate_content(prompt)
            txt = resp.text or "{}"
            try:
                data = json.loads(txt)
            except Exception:
                start_i, end_i = txt.find("{"), txt.rfind("}")
                if start_i != -1 and end_i != -1 and end_i > start_i:
                    data = json.loads(txt[start_i:end_i+1])
                else:
                    raise
            data["model"] = settings.GEMINI_MODEL
            # basic normalization
            if "plan" not in data:
                data["plan"] = {"crop": crop, "season": season, "stages": []}
            if "recommendations" not in data:
                data["recommendations"] = _fallback_plan(crop, season).get("recommendations")
            return data
        except Exception:
            pass
    return _fallback_plan(crop, season)


def chat_from_message(message: str, language: str | None = None) -> Dict[str, Any]:
    """Simple Gemini-backed chat for agricultural Q&A. Returns { reply, model }"""
    msg = (message or "").strip()
    if not msg:
        return {"reply": "Please type your question.", "model": "none"}

    if settings.GEMINI_API_KEY and genai is not None:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            
            # Language mapping for better prompts
            lang_instructions = {
                'hi': 'Respond in clear, simple Hindi that farmers can understand.',
                'or': 'Respond in clear, simple Odia that farmers can understand.',
                'en': 'Respond in clear, simple English that farmers can understand.'
            }
            lang_instruction = lang_instructions.get(language, lang_instructions['en']) if language else lang_instructions['en']
            
            sys = (
                "You are KrishiMitra, a concise and practical agricultural assistant for India. "
                "Answer briefly and clearly. "
                f"{lang_instruction}"
            )
            prompt = f"SYSTEM\n{sys}\n\nLANGUAGE={language or 'en'}\n\nUSER\n{msg}"
            resp = model.generate_content(prompt)
            text = (resp.text or "").strip()
            return {"reply": text, "model": settings.GEMINI_MODEL}
        except Exception:
            pass
    # Fallback
    return {"reply": "I couldn't reach the AI service right now. Please try again later.", "model": "rules-fallback"}
