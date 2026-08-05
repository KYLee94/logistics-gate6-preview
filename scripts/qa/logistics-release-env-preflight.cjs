const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
    }));
}

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
  ...readEnvFile(path.join(ROOT, '.env.production')),
};

const envValue = (...keys) => keys.map((key) => process.env[key] || fileEnv[key]).find(Boolean) || '';
const isPlaceholder = (value) => !value || /dummy|placeholder|example|your-|your_|changeme|test-key/iu.test(String(value));
const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {};

const checks = [
  {
    name: 'VITE_SUPABASE_URL',
    ok: !isPlaceholder(envValue('VITE_SUPABASE_URL', 'LOGISTICS_SUPABASE_URL'))
      && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/iu.test(envValue('VITE_SUPABASE_URL', 'LOGISTICS_SUPABASE_URL')),
    detail: 'Supabase URL must be the deployed project URL, not the dummy fallback.',
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    ok: !isPlaceholder(envValue('VITE_SUPABASE_ANON_KEY', 'LOGISTICS_SUPABASE_ANON_KEY'))
      && envValue('VITE_SUPABASE_ANON_KEY', 'LOGISTICS_SUPABASE_ANON_KEY').length > 80,
    detail: 'Anon key must be available before release smoke tests run.',
  },
  {
    name: 'build-base-path',
    ok: /--base=\/logistics-gate6-preview\//u.test(scripts['build:preview'] || ''),
    detail: 'GitHub Pages build must use /logistics-gate6-preview/ as the base path.',
  },
  {
    name: 'deploy-target',
    ok: /KYLee94\/logistics-gate6-preview\.git/u.test(scripts.deploy || ''),
    detail: 'Deploy script must publish to KYLee94/logistics-gate6-preview.',
  },
];

const report = {
  ok: checks.every((check) => check.ok),
  generated_at: new Date().toISOString(),
  checks,
};

ensureOutDir();
const latest = path.join(OUT_DIR, 'release-env-preflight-latest.json');
fs.writeFileSync(latest, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: report.ok, artifact: path.relative(ROOT, latest), failed: checks.filter((check) => !check.ok).map((check) => check.name) }, null, 2));
if (!report.ok) process.exitCode = 1;
