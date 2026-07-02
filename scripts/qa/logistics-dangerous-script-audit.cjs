const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const SCANNED_EXT = new Set(['.js', '.cjs', '.mjs', '.ts', '.sql', '.ps1']);
const ALLOWED_DIRS = [
  'supabase/migrations/',
  'supabase/functions/',
  'scripts/ops/',
  'scripts/qa/',
  'scripts/integrations/',
  'scripts/ingest/',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SCANNED_EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const patterns = [
  { key: 'sql-delete', regex: /\bdelete\s+from\b/iu },
  { key: 'sql-drop', regex: /\bdrop\s+(table|schema|function|policy)\b/iu },
  { key: 'sql-truncate', regex: /\btruncate\s+table\b/iu },
  { key: 'policy-delete', regex: /\bfor\s+delete\b/iu },
  { key: 'supabase-delete', regex: /\.delete\s*\(/u },
  { key: 'recursive-delete', regex: /rmSync\s*\([^)]*recursive\s*:\s*true|Remove-Item\b[^;\n]*-Recurse/iu },
  { key: 'service-role', regex: /SERVICE_ROLE|service_role/iu },
];

const findings = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/gu, '/');
  const text = fs.readFileSync(file, 'utf8');
  patterns.forEach((pattern) => {
    if (!pattern.regex.test(text)) return;
    const allowed = ALLOWED_DIRS.some((prefix) => rel.startsWith(prefix));
    findings.push({
      file: rel,
      pattern: pattern.key,
      severity: allowed ? 'review' : 'blocking',
    });
  });
}

const report = {
  ok: findings.every((finding) => finding.severity !== 'blocking'),
  generated_at: new Date().toISOString(),
  blocking_count: findings.filter((finding) => finding.severity === 'blocking').length,
  review_count: findings.filter((finding) => finding.severity === 'review').length,
  findings,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const latest = path.join(OUT_DIR, 'dangerous-script-audit-latest.json');
fs.writeFileSync(latest, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: report.ok, artifact: path.relative(ROOT, latest), blocking: report.blocking_count, review: report.review_count }, null, 2));
if (!report.ok) process.exitCode = 1;
