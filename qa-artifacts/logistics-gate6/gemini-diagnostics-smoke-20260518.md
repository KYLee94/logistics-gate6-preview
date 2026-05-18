# Gemini 2.5 Flash diagnostics smoke - 2026-05-18

## Scope
- Project: qvegpozwrcmspdvjokiz
- Edge Function: ll-dashboard-api
- Preview URL origin: https://kylee94.github.io
- Preview path: /logistics-gate6-preview/
- Model: gemini-2.5-flash

## Edge diagnostics smoke
- Request action: ai/gemini-diagnostics
- Origin header: https://kylee94.github.io
- HTTP status: 200
- Access-Control-Allow-Origin: https://kylee94.github.io
- edge_reached: true
- origin_allowed: true
- demo_origin_allowed: true
- gemini_ok: true
- provider_status: 200
- key_configured: true
- key_hash: 59eff6b58ab2
- answer_preview: Gemini diagnostics OK

## Demo search smoke
- Request action: ai/search-chat-demo
- Origin header: https://kylee94.github.io
- HTTP status: 200
- Access-Control-Allow-Origin: https://kylee94.github.io
- ok: true
- mode: demo
- model: gemini-2.5-flash
- evidence_count: 12

## Preview bundle readback
- URL: https://kylee94.github.io/logistics-gate6-preview/
- Cache-busted HTML readback asset: assets/index-C0-xFOHk.js
- JS status: 200
- JS contains ai/gemini-diagnostics: true
- JS contains connection diagnostics button text: true
- JS contains separated Edge Function failure message: true

## Local QA
- eslint: pass
- edge-api-security-static-qa-20260514: allPass=true, logisticsGatePass=true
- repo-secret-hygiene-20260513: allPass=true
- npm run build -- --base=/logistics-gate6-preview/: pass
