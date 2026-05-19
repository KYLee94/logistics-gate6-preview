# Gate 6 progress tracker

- Updated: 2026-05-19
- Source of truth: `gate6-progress-tracker-20260515.json`
- Overall: 152 / 235 (64.7%)

| Stage | Area | Done/Total | Rate |
|---:|---|---:|---:|
| 2 | 공통 데이터 기준 | 7 / 16 | 43.8% |
| 3 | 업무 로그 메인 페이지 | 22 / 27 | 81.5% |
| 4 | Dashboard 공통 | 6 / 11 | 54.5% |
| 5 | Weekly 탭 | 12 / 16 | 75.0% |
| 6 | Home 탭 | 28 / 34 | 82.4% |
| 7 | Asset 탭 | 12 / 15 | 80.0% |
| 8 | Company 탭 | 10 / 14 | 71.4% |
| 9 | Data Playground | 10 / 11 | 90.9% |
| 10 | Data Quality | 15 / 19 | 78.9% |
| 11 | Analysis Tools | 4 / 6 | 66.7% |
| 12 | 승인대기 대상 | 10 / 17 | 58.8% |
| 13 | 외부권한대기 대상 | 5 / 11 | 45.5% |
| 14 | QA 계획 | 11 / 24 | 45.8% |
| 15 | 최종 완료 기준 | 0 / 14 | 0.0% |

## Latest Session Updates

| Stage | ID | Status | Item |
|---:|---|---|---|
| 7 | 7.15 | done | 아레나스양지물류센터 Asset 탭 층별 배치를 `normalizedRows` 21개 계약 row와 12개 층 라벨(1~10, B1, B2) 기준으로 다시 구성했습니다. 문자열 tenant fallback도 보강했습니다. |
| 14 | 14.24 | done | 아레나스양지물류센터 층별 배치/만기 스냅샷 회귀 QA를 추가하고 통과했습니다. Evidence: `arenaYangjiNormalizedRows=21`, `arenaYangjiRowsWithExpiry=21`, `arenaYangjiFloorCount=12`. |
| 12 | 12.19 | done | `kylee94/logistics-gate6-preview` GitHub Pages 배포 스크립트의 preview build/deploy 옵션을 수정하고 최신 번들을 배포했습니다. Evidence: live index `200`, asset `/logistics-gate6-preview/assets/index-ZZ58eKbF.js`. |

## Latest Verification

- Static QA: `node qa-artifacts/logistics-gate6/current-request-data-task-static-qa-20260519.cjs` => pass
- ESLint target file: `npx eslint src/components/system/workspace/WorkspaceLogistics.jsx` => pass
- Preview build/deploy: `npm run deploy` => published
- Live readback: `https://kylee94.github.io/logistics-gate6-preview/` index => 200, JS bundle => `index-ZZ58eKbF.js`
