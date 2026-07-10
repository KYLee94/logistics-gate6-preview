const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] || fallback) : fallback;
}

function walk(value, timestamps = []) {
  if (!value || typeof value !== 'object') return timestamps;
  Object.entries(value).forEach(([key, child]) => {
    if (/generated_at|created_at|started_at|finished_at|completed_at|timestamp/iu.test(key) && typeof child === 'string') {
      const ms = Date.parse(child);
      if (Number.isFinite(ms)) timestamps.push({ key, value: child, ms });
    }
    if (child && typeof child === 'object') walk(child, timestamps);
  });
  return timestamps;
}

const maxAgeHours = Number(argValue('max-age-hours', '24'));
const sinceArg = argValue('since', process.env.RELEASE_STARTED_AT || '');
const cutoffMs = sinceArg ? Date.parse(sinceArg) : Date.now() - maxAgeHours * 60 * 60 * 1000;
if (!Number.isFinite(cutoffMs)) throw new Error(`Invalid --since value: ${sinceArg}`);

const DEFAULT_RELEASE_LATEST_FILES = [
  'release-env-preflight-latest.json',
  'dangerous-script-audit-latest.json',
  'full-surface-audit-latest.json',
  'full-app-loading-stability-latest.json',
  'market-data-browser-smoke-latest.json',
  'data-management-live-browser-flow-latest.json',
  'logout-browser-smoke-latest.json',
  'news-api-smoke-latest.json',
  'market-data-readback-smoke-latest.json',
];

const requiredArg = argValue('files', '');
const latestFiles = (requiredArg
  ? requiredArg.split(',').map((name) => name.trim()).filter(Boolean)
  : DEFAULT_RELEASE_LATEST_FILES
).sort();

const checks = latestFiles.map((name) => {
  const file = path.join(OUT_DIR, name);
  if (!fs.existsSync(file)) {
    return {
      file: path.relative(ROOT, file).replace(/\\/gu, '/'),
      ok: false,
      missing: true,
    };
  }
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const timestamps = walk(json);
    const newest = timestamps.sort((a, b) => b.ms - a.ms)[0] || null;
    const stale = !newest || newest.ms < cutoffMs;
    const sourceReportOk = json.ok === true;
    const falsePositiveRisk = (
      json.checks?.latest_artifacts_all_usable === false
      || json.latest_artifacts_all_usable === false
      || json.skipped === true
      || /skipped|fallback-only|local-only|mock/iu.test(JSON.stringify(json).slice(0, 20000))
    );
    return {
      file: path.relative(ROOT, file).replace(/\\/gu, '/'),
      ok: sourceReportOk && !stale && !falsePositiveRisk,
      source_report_ok: sourceReportOk,
      newest_timestamp: newest?.value || null,
      stale,
      false_positive_risk: falsePositiveRisk,
    };
  } catch (error) {
    return {
      file: path.relative(ROOT, file).replace(/\\/gu, '/'),
      ok: false,
      error: error.message,
    };
  }
});

const report = {
  ok: checks.length > 0 && checks.every((check) => check.ok),
  generated_at: new Date().toISOString(),
  cutoff: new Date(cutoffMs).toISOString(),
  latest_file_count: latestFiles.length,
  checks,
};

const writeArtifact = argValue('write-artifact', 'false') === 'true';
let artifact = null;
if (writeArtifact) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const latest = path.join(OUT_DIR, 'release-artifact-freshness-latest.json');
  fs.writeFileSync(latest, `${JSON.stringify(report, null, 2)}\n`);
  artifact = path.relative(ROOT, latest).replace(/\\/gu, '/');
}
console.log(JSON.stringify({ ok: report.ok, artifact, failed: checks.filter((check) => !check.ok).length, checks }, null, 2));
if (!report.ok) process.exitCode = 1;
