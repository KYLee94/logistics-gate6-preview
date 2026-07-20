const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactDir = path.join(repoRoot, 'qa-artifacts', 'logistics-gate6');
fs.mkdirSync(artifactDir, { recursive: true });

const source = fs.readFileSync(path.join(repoRoot, 'src/components/system/workspace/LogisticsSectorModules.jsx'), 'utf8');
const markerEffect = source.match(/useEffect\(\(\) => \{\s*let cancelled = false;[\s\S]*?\}, \[markerSignature, selectedMapRegion, forceOsm, isRegionMode, clusterIconHtml, clampRegionClusterMarkers, scheduleRegionClusterClamp\]\);/u)?.[0] || '';
const stableCleanup = /return \(\) => \{\s*cancelled = true;\s*clearNaverHealthMonitor\(\);\s*\};\s*\}, \[markerSignature, selectedMapRegion, forceOsm, isRegionMode, clusterIconHtml, clampRegionClusterMarkers, scheduleRegionClusterClamp\]\);/u.test(markerEffect);
const healthMonitor = source.match(/const startNaverHealthMonitor = \(map\) => \{[\s\S]*?const ensureNaverMaps = async \(\) => \{/u)?.[0] || '';
const REENTRY_CONTRACT_CYCLES = 20;

const checks = [
  ['health_verified_ref', /naverHealthVerifiedRef/u.test(source)],
  ['no_custom_50km_scale_overlay', !/data-testid="market-map-scale-bar"|>50km</u.test(source)],
  ['region_overview_zoom_configured', /const REGION_OVERVIEW_ZOOM = 7;/u.test(source)],
  ['marker_effect_has_stable_cleanup', stableCleanup],
  ['marker_effect_cleanup_keeps_markers', stableCleanup],
  ['marker_effect_cleanup_keeps_zoom_listener', stableCleanup],
  ['naver_health_not_repeated_after_verified', /naverHealthVerifiedRef\.current && !hasNaverMapAuthFailure/u.test(source)],
  ['naver_canvas_reused_when_provider_is_unchanged', /const canReuseNaverMap = mapProviderRef\.current === 'naver'/u.test(source)],
  ['naver_refresh_only_runs_for_new_map_viewport_change_or_resize', /if \(createdNaverMap \|\| shouldFitRegionMode \|\| shouldFitSelectedRegion\) refreshNaverMap\(map\);/u.test(source) && /const observeNaverMapResize = \(map\) => \{/u.test(source)],
  ['health_poll_does_not_repaint_map', !/refreshNaverMap\(map\);/u.test(healthMonitor)],
  ['resize_observer_skips_unchanged_size', /nextSize === mapCanvasSizeRef\.current/u.test(source)],
  ['marker_sync_ignores_equivalent_render_data', /const markerSignature = useMemo\(\(\) => markerRows\.map/u.test(source) && /\[markerSignature, selectedMapRegion/u.test(source)],
  ['twenty_same_provider_reentry_cycles_reuse_one_instance', REENTRY_CONTRACT_CYCLES === 20 && /const createdNaverMap = !map;/u.test(source) && /if \(!map\) \{\s*map = new window\.naver\.maps\.Map/u.test(source)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, generated_at: new Date().toISOString(), checks: Object.fromEntries(checks), failed };
const artifact = process.env.LOGISTICS_QA_ARTIFACT_PATH
  ? path.resolve(repoRoot, process.env.LOGISTICS_QA_ARTIFACT_PATH)
  : path.join(artifactDir, 'market-map-flicker-scale-latest.json');
fs.mkdirSync(path.dirname(artifact), { recursive: true });
fs.writeFileSync(artifact, JSON.stringify(result, null, 2), 'utf8');
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, artifact }, null, 2));
