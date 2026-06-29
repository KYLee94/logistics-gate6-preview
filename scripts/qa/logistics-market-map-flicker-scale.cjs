const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactDir = path.join(repoRoot, 'qa-artifacts', 'logistics-gate6');
fs.mkdirSync(artifactDir, { recursive: true });

const source = fs.readFileSync(path.join(repoRoot, 'src/components/system/workspace/LogisticsSectorModules.jsx'), 'utf8');
const markerEffect = source.match(/useEffect\(\(\) => \{\s*let cancelled = false;[\s\S]*?\}, \[markerRows, selectedMapRegion, forceOsm, clusterIconHtml\]\);/u)?.[0] || '';
const stableCleanup = /return \(\) => \{\s*cancelled = true;\s*clearNaverHealthMonitor\(\);\s*\};\s*\}, \[markerRows, selectedMapRegion, forceOsm, clusterIconHtml\]\);/u.test(markerEffect);

const checks = [
  ['health_verified_ref', /naverHealthVerifiedRef/u.test(source)],
  ['no_custom_50km_scale_overlay', !/data-testid="market-map-scale-bar"|>50km</u.test(source)],
  ['region_overview_zoom_configured', /const REGION_OVERVIEW_ZOOM = 7;/u.test(source)],
  ['marker_effect_has_stable_cleanup', stableCleanup],
  ['marker_effect_cleanup_keeps_markers', stableCleanup],
  ['marker_effect_cleanup_keeps_zoom_listener', stableCleanup],
  ['naver_health_not_repeated_after_verified', /naverHealthVerifiedRef\.current && !hasNaverMapAuthFailure/u.test(source)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, generated_at: new Date().toISOString(), checks: Object.fromEntries(checks), failed };
const artifact = path.join(artifactDir, 'market-map-flicker-scale-latest.json');
fs.writeFileSync(artifact, JSON.stringify(result, null, 2), 'utf8');
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, artifact }, null, 2));
