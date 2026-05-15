# 경산 쿠팡물류센터 전용면적 Supabase readback

- 실행일: 2026-05-15 KST
- 프로젝트: `qvegpozwrcmspdvjokiz`
- 범위: `public.ll_rent_history` 3건, `public.ll_lease_spaces` 1건, `public.ll_data_quality_findings` 4건

## ll_rent_history readback

| row | 임대면적 | 전용면적 readback | 상태 |
| --- | ---: | ---: | --- |
| `...|1|na|20240801|133` | 870 | 852.09 | corrected |
| `...|1|na|20240801|134` | 8603.64 | 8055.63 | corrected |
| `...|b2|na|20240801|136` | 1543.14 | 1444.85 | corrected |

## ll_lease_spaces readback

| lease_space_id | source row | 온도 | 임대면적 | 전용면적 | E.NOC | 상태 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `...|1|na` | `sheet_db_general:r000029` | Y | 8603.64 | 8055.63 | 53808.55 | corrected |
| `...|b2|na` | `sheet_db_general:r000032` | Y | 10914.64 | 10219.43 | 58550.53 | suspected_error |

## 확인 사항

- `ll_rent_history`에는 사용자가 지정한 전용면적 3건이 모두 저장됐습니다.
- `ll_lease_spaces`는 현재 `lease_space_id`가 층만 기준으로 만들어져 1층 N/Y, B2 N/Y가 충돌합니다. 그래서 존재하는 1층 Y row만 보정했고, 1층 N/B2 N의 누락은 `dq_gyeongsan_lease_space_id_collision_20260515` finding으로 남겼습니다.
- 원본 보존 테이블(`ll_source_cells`, `ll_sheet_rows`)은 원본 Excel 증거로 유지해야 하므로 이번 직접 보정에서 변경하지 않았습니다.
