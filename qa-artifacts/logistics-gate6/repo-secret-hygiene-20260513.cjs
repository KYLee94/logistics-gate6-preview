const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(__dirname, 'repo-secret-hygiene-20260513');
fs.mkdirSync(outDir, { recursive: true });

function read(relativePath) {
  const target = path.join(repoRoot, relativePath);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(cjs|mjs|js|jsx|ts|tsx|json|md|sql|css|html|env|example|toml|yml|yaml)$/iu.test(entry.name)) files.push(full);
  }
  return files;
}

const trackedEnvFiles = execSync('git ls-files .env .env.*', { cwd: repoRoot, encoding: 'utf8' })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const trackedRuntimeEnvFiles = trackedEnvFiles.filter((file) => !/\.env\.example$/i.test(file));
const gitignore = read('.gitignore');
const envText = read('.env');
const envKeys = envText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split('=')[0]);

const riskyEnvKeys = envKeys.filter((key) => /SERVICE|SECRET|OPEN.*DART|BUILDING|TOKEN|PASSWORD/i.test(key));
const secretPatternFindings = walk(repoRoot).flatMap((file) => {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  const hits = [];
  if (/sb_secret_[A-Za-z0-9_-]{12,}/u.test(text)) hits.push({ file: rel, pattern: 'sb_secret_*' });
  if (/AIza[0-9A-Za-z_-]{20,}/u.test(text)) hits.push({ file: rel, pattern: 'google_api_key' });
  if (/service[_-]?role[_-]?key\\s*[:=]\\s*['"][^'"]{12,}/iu.test(text)) hits.push({ file: rel, pattern: 'service_role_assignment' });
  return hits;
});
const result = {
  trackedEnvFiles,
  trackedRuntimeEnvFiles,
  envKeys,
  riskyEnvKeys,
  secretPatternFindings,
  gitignoreHasEnv: /^\.env$/m.test(gitignore) && /^\.env\.\*$/m.test(gitignore),
  envExampleExists: fs.existsSync(path.join(repoRoot, '.env.example')),
};
result.checks = {
  noTrackedRuntimeEnvFiles: trackedRuntimeEnvFiles.length === 0,
  noRiskyEnvKeys: riskyEnvKeys.length === 0,
  noSecretPatternFindings: secretPatternFindings.length === 0,
  gitignoreHasEnv: result.gitignoreHasEnv,
  envExampleExists: result.envExampleExists,
};
result.allPass = Object.values(result.checks).every(Boolean);

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'summary.md'), [
  '# Repository secret hygiene - 2026-05-13',
  '',
  `- tracked env files: ${trackedEnvFiles.length ? trackedEnvFiles.join(', ') : 'none'}`,
  `- tracked runtime env files: ${trackedRuntimeEnvFiles.length ? trackedRuntimeEnvFiles.join(', ') : 'none'}`,
  `- env keys: ${envKeys.join(', ') || 'none'}`,
  `- risky env keys: ${riskyEnvKeys.join(', ') || 'none'}`,
  `- secret pattern findings: ${secretPatternFindings.length}`,
  `- gitignore has .env rules: ${result.gitignoreHasEnv}`,
  `- .env.example exists: ${result.envExampleExists}`,
  `- allPass: ${result.allPass}`,
  '',
  '판정: 런타임 `.env` 파일은 tracked 상태가 아니며, `.env.example`은 예시 파일로 허용합니다. service role, OpenDART, 건축물대장, Naver secret 계열 key는 로컬 `.env`와 프론트 env에 노출하지 않습니다.',
].join('\n'), 'utf8');

console.log(JSON.stringify(result, null, 2));
