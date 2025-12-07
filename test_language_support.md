# Language Support Test Guide

This guide helps verify that language switching works correctly across all AI components in KrishiMitra.

## Components to Test

### 1. Chatbot (Floating AI Button)
- **Location**: Floating button on bottom-right corner
- **Test Steps**:
  1. Change language in top-right navbar (English/Hindi/Odia)
  2. Click AI floating button
  3. Ask a farming question (e.g., "What crops grow well in black soil?")
  4. Verify response is in selected language

### 2. Soil Recommendations (Dashboard)
- **Location**: Homepage soil recommendation section
- **Test Steps**:
  1. Change language in navbar
  2. Fill soil type, pH, season
  3. Click "Get Recommendations" 
  4. Verify AI response is in selected language

### 3. Disease Detection (Disease Page)
- **Location**: /disease page
- **Test Steps**:
  1. Change language in navbar
  2. Upload plant image
  3. Add optional crop name
  4. Click "Diagnose"
  5. Verify disease analysis is in selected language

### 4. Crop Tracker Planning (/tracker)
- **Location**: /tracker page
- **Test Steps**:
  1. Change language in navbar
  2. Enter crop name, season, start date
  3. Click "Create Plan"
  4. Verify crop planning stages and recommendations are in selected language

### 5. Advisory Chat (/advisory)
- **Location**: Advisory page
- **Test Steps**:
  1. Change language in navbar
  2. Ask agricultural questions
  3. Verify responses are in selected language

## Expected Language Support

- **English (en)**: Default language, all responses in English
- **Hindi (hi)**: All AI responses should be in Hindi with proper Devanagari script
- **Odia (or)**: All AI responses should be in Odia with proper script

## Backend Endpoints Updated

All these endpoints now accept and use `language` parameter:
- `/api/v1/ai/recommend/soil` - Soil recommendations
- `/api/v1/ai/chat` - Chatbot responses  
- `/api/v1/disease/diagnose` - Disease detection
- `/api/v1/tracker/plan-ai` - Crop planning
- `/api/v1/ai/recommend/fertilizer` - Fertilizer recommendations

## Fallback Behavior

If Gemini AI is unavailable, the system falls back to rule-based responses that are also localized based on the selected language.

## Testing Notes

1. Language switching should be instant - no page reload required
2. All new AI requests should use the currently selected language
3. Previous responses remain in their original language until new requests are made
4. UI text (buttons, labels) changes immediately via i18n system
5. AI response content changes on next API call

## Common Issues to Check

- Mixed language responses (some English, some translated)
- UI elements not updating when language changes
- API calls not sending correct language parameter
- Fallback responses not being localized
- Language persistence across page refreshes