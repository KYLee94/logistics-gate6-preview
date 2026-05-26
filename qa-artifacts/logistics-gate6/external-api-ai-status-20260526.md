# External API / AI Status - 2026-05-26

## Scope

This is a first-pass status review for OpenDART, building-register, Naver map/geocode, and AI chatbot wiring. It is not a provider live-data certification.

## Edge Function Status

File reviewed: `supabase/functions/ll-dashboard-api/index.ts`

### OpenDART

- Action: `opendart/company`
- Server-side function: `callOpenDart`
- Secret source: Edge Function environment variable `OPENDART_API_KEY`
- Client-side secret exposure: not found in frontend source.
- Controls found:
  - Authorization context required.
  - Per-user rate limit exists.
  - Cache read/write path exists.
  - Audit event is written.
  - Stale cache fallback exists for provider failure.
- Remaining evidence needed:
  - live provider smoke with a known `corp_code`
  - cache readback
  - UI confirmation in Company tab

### Building Register

- Action: `building-register/summary`
- Server-side function: `callBuildingRegister`
- Secret source: Edge Function environment variables, not frontend.
- Required payload: `sigungu_cd`, `bjdong_cd`, `bun`, `ji`
- Controls found:
  - Authorization context required.
  - Per-user rate limit exists.
  - Cache read/write path exists.
  - Audit event is written.
  - Stale cache fallback exists for provider failure.
- Remaining evidence needed:
  - live provider smoke with one asset that has complete building-register query keys
  - readback of cached response
  - UI confirmation in Asset tab

### Naver Map / Geocode

- Actions:
  - `naver/maps-config`
  - `naver/geocode`
- Frontend map SDK loading path found in `WorkspaceLogistics.jsx`.
- Marker rendering path found for Home/Company maps.
- Controls found:
  - geocode uses server-side action and cache.
  - map client id is returned via config action; secret key is not bundled.
- Remaining evidence needed:
  - live map render smoke
  - marker hover/click smoke
  - geocode cache readback for uncertain addresses

## AI Chatbot Status

Files reviewed:

- `supabase/functions/ll-dashboard-api/index.ts`
- `src/components/system/workspace/WorkspaceLogistics.jsx`
- `scripts/qa/logistics-ai-chatbot-qa.cjs`

### Implemented Actions

- `ai/provider-diagnostics`
- `ai/gemini-diagnostics`
- `ai/search-chat`
- `ai/search-chat-demo`

### Provider Handling

- Groq key path exists: `GROQ_API_KEY`
- Google AI key path exists: `GOOGLE_AI_KEY` or `GEMINI_API_KEY`
- Google model guard exists: paid models are blocked unless explicitly allowed.
- The UI sends recent `history` with each chat request.

### Current Quality Risks

- The chatbot still needs stronger evidence selection before model generation.
- Short follow-up questions can lose entity context if the server does not resolve pronouns and previous selected asset/company consistently.
- Some answers may still expose technical evidence labels unless response formatting is constrained.
- Permission filtering must happen before both retrieval and model prompt construction.

### Required Next QA

- Ask the chatbot:
  - portfolio asset count
  - specific asset existence
  - specific E. NOC
  - follow-up question without repeating the asset name
  - permission-out-of-scope asset
- Expected:
  - answer only within readable asset scope
  - no unrelated asset ids in user-facing answer
  - context-aware follow-up resolution
  - audit event written

## Status

- Server-only wiring: partial pass.
- Secret exposure from frontend source: no direct exposure found in reviewed paths.
- Live provider smoke: still needed.
- AI answer quality/context: not complete; kept in checklist under external API / AI.

## Reviewer Addendum

- `opendart/company`, `building-register/summary`, `naver/geocode` require authenticated context and are not frontend-secret based.
- `naver/maps-config`, `ai/provider-diagnostics`, `ai/gemini-diagnostics`, and `ai/search-chat-demo` are public pre-auth actions gated by origin allowlist. These should receive rate limit/audit hardening before being treated as production-complete.
- External API cache hit currently returns without a matching audit event. This is acceptable for performance but incomplete for full operational traceability.
- `naver/geocode` exists on the Edge side, but no current frontend call was found. It should either be wired to uncertain-address classification or explicitly parked as server-only utility.
- AI provider calls may send readable internal evidence to Groq/Gemini. Before broad rollout, the prompt evidence payload should be minimized and permission-filtered before provider call.
