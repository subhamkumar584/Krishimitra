from __future__ import annotations
from typing import Any, Dict, Optional, Tuple
import re

from .gemini_core import recommend_from_soil
from .gemini_rest import chat_from_message_rest
from .gemini import chat_from_message
from ..config import settings
import httpx


class AgentService:
    """
    Simple agentic orchestrator for KrishiMitra.
    - Classifies intent from user message
    - Invokes internal tools (weather, prices, soil recommendation)
    - Optionally asks Gemini to compose a concise, localized reply using tool outputs
    """

    def __init__(self) -> None:
        pass

    # --------- Public API ---------
    def handle(self, message: str, language: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        msg = (message or "").strip()
        if not msg:
            return {"reply": "Please type your question.", "model": "none"}

        intent, entities = self._classify(msg)
        try:
            if intent == "weather":
                data = self._tool_weather(entities)
                return self._compose_weather_reply(data, language)
            if intent == "prices":
                data = self._tool_prices(entities)
                return self._compose_prices_reply(data, language)
            if intent == "soil_reco":
                data = self._tool_soil_reco(entities, language)
                return self._compose_soil_reply(data, language)
            # Fallback to Gemini general chat (REST client)
            return chat_from_message_rest(msg, language)
        except Exception:
            # On any exception, try Gemini chat as last resort
            try:
                return chat_from_message(msg, language)
            except Exception:
                return {"reply": "I couldn't complete this request right now. Please try again later.", "model": "rules-fallback"}

    # --------- Intent classification ---------
    def _classify(self, msg: str) -> Tuple[str, Dict[str, Any]]:
        mlow = msg.lower()
        # Detect season keywords
        season = None
        for s in ["kharif", "rabi", "zaid"]:
            if s in mlow:
                season = s
                break
        # Quick soil keywords
        if any(k in mlow for k in ["soil", "ph", "fertilizer", "recommend", "black soil", "red soil", "alluvial", "loamy", "sandy"]):
            soil_type = None
            for st in ["black", "alluvial", "red", "loamy", "sandy"]:
                if st in mlow:
                    soil_type = st
                    break
            # Extract approximate pH if present
            ph_match = re.search(r"ph\s*([0-9]+(?:\.[0-9]+)?)", mlow)
            ph = float(ph_match.group(1)) if ph_match else None
            return "soil_reco", {"soil_type": soil_type, "ph": ph, "season": season}

        # Weather intent requires lat/lon e.g. "weather 21.15,79.08"
        if "weather" in mlow:
            coords = re.findall(r"(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)", mlow)
            if coords:
                lat, lon = coords[0]
                return "weather", {"lat": lat, "lon": lon}
            return "weather", {}

        # Market prices
        if any(k in mlow for k in ["price", "prices", "rate", "mandi", "market"]):
            # Extract commodity simple
            words = re.findall(r"[a-zA-Z]+", mlow)
            commodity = None
            for w in words:
                if w not in {"price", "prices", "rate", "mandi", "market", "what", "is", "the"}:
                    commodity = w
                    break
            return "prices", {"commodity": commodity}

        return "chat", {}

    # --------- Tools ---------
    def _tool_weather(self, entities: Dict[str, Any]) -> Dict[str, Any]:
        lat = entities.get("lat")
        lon = entities.get("lon")
        if not (lat and lon):
            return {"error": "Please provide your location as 'weather <lat>,<lon>' e.g., weather 21.15,79.08"}
        api = settings.OPENWEATHER_API_KEY
        if not api:
            return {"error": "Weather API key not configured"}
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api}&units=metric"
        with httpx.Client(timeout=15) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.json()

    def _tool_prices(self, entities: Dict[str, Any]) -> Dict[str, Any]:
        # Stubbed price data; could call an external API here
        commodity = entities.get("commodity") or "wheat"
        return {"prices": [{"commodity": commodity, "market": "Local Mandi", "unit": "kg", "price": 22.5}]}

    def _tool_soil_reco(self, entities: Dict[str, Any], language: Optional[str]) -> Dict[str, Any]:
        soil = {
            "soil_type": entities.get("soil_type") or "loamy",
            "ph": entities.get("ph"),
            "season": entities.get("season")
        }
        return recommend_from_soil(soil, language)

    # --------- Compose replies ---------
    def _compose_weather_reply(self, data: Dict[str, Any], language: Optional[str]) -> Dict[str, Any]:
        if "error" in data:
            return {"reply": data["error"], "model": "rules-fallback"}
        name = data.get("name") or "your area"
        main = data.get("main", {})
        temp = main.get("temp")
        desc = ""
        wx = data.get("weather") or []
        if wx:
            desc = (wx[0].get("description") or "").capitalize()
        
        # Localize response based on language
        if language == 'hi':
            reply = f"{name} में मौसम: {temp}°C. {desc}. तदनुसार सिंचाई और छिड़काव करें।"
        elif language == 'or':
            reply = f"{name} ରେ ଆବହାୱା: {temp}°C. {desc}. ତଦନୁସାରେ ସିଂଚନ ଏବଂ ସ୍ପ୍ରେ କରନ୍ତୁ।"
        else:
            reply = f"Weather in {name}: {temp}°C. {desc}. Carry out irrigation and spraying accordingly."
        return {"reply": reply, "model": "tool-weather"}

    def _compose_prices_reply(self, data: Dict[str, Any], language: Optional[str]) -> Dict[str, Any]:
        arr = data.get("prices") or []
        if not arr:
            if language == 'hi':
                reply = "अभी कोई मूल्य जानकारी उपलब्ध नहीं।"
            elif language == 'or':
                reply = "ଇତରେ କୌଣସି ମୂଲ୍ଯ ତଥ୍ଯ ଉପଲବ୍ଧ ନାହିଁ।"
            else:
                reply = "No price data available right now."
            return {"reply": reply, "model": "rules-fallback"}
        p = arr[0]
        
        # Localize response based on language
        if language == 'hi':
            reply = f"{p['market']} में {p['commodity'].title()} का बाजार भाव: ₹{p['price']}/{p['unit']}."
        elif language == 'or':
            reply = f"{p['market']} ରେ {p['commodity'].title()} ର ମାର୍କେଟ ଭାବ: ₹{p['price']}/{p['unit']}."
        else:
            reply = f"Market price for {p['commodity'].title()} in {p['market']}: ₹{p['price']}/{p['unit']}."
        return {"reply": reply, "model": "tool-prices"}

    def _compose_soil_reply(self, data: Dict[str, Any], language: Optional[str]) -> Dict[str, Any]:
        recos = data.get("recommendations") or []
        if not recos:
            if language == 'hi':
                reply = "मैं उपयुक्त फसल का सुझाव नहीं दे सका।"
            elif language == 'or':
                reply = "ମୁଁ ଉପଯୁକ୍ତ ଫସଲର ସୁପାରିଶ ଦେଇ ପାରିଲି ନାହିଁ।"
            else:
                reply = "I couldn't find a suitable crop recommendation."
            return {"reply": reply, "model": data.get("model") or "rules-fallback"}
        first = recos[0]
        crop = first.get("crop")
        season = first.get("ideal_season") or ""
        fert = first.get("fertilizer") or {}
        fert_line = ", ".join([v for v in [fert.get("basal"), fert.get("top_dressing")] if v])
        
        # Localize response based on language
        if language == 'hi':
            reply = f"सुझाई गई फसल: {crop} ({season}). उर्वरक योजना: {fert_line or 'पैकेज ऑफ प्रैक्टिसेज का पालन करें'}."
        elif language == 'or':
            reply = f"ସୁପାରିଶ ଫସଲ: {crop} ({season}). ଉର୍ବରକ ଯୋଜନା: {fert_line or 'ପ୍ଯାକେଜ ଅଫ ପ୍ରାକ୍ଟିସ ପାଳନ କରନ୍ତୁ'}."
        else:
            reply = f"Suggested crop: {crop} ({season}). Fertilizer plan: {fert_line or 'follow package of practices'}."
        return {"reply": reply, "model": data.get("model") or "rules"}
