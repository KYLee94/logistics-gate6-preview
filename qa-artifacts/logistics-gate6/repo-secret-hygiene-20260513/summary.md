# Repository secret hygiene - 2026-05-13

- tracked env files: .env.example
- tracked runtime env files: none
- env keys: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- risky env keys: none
- secret pattern findings: 0
- gitignore has .env rules: true
- .env.example exists: true
- allPass: true

판정: 런타임 `.env` 파일은 tracked 상태가 아니며, `.env.example`은 예시 파일로 허용합니다. service role, OpenDART, 건축물대장, Naver secret 계열 key는 로컬 `.env`와 프론트 env에 노출하지 않습니다.