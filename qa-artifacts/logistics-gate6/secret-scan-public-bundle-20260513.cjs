const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(__dirname, 'secret-scan-public-bundle-20260513');
fs.mkdirSync(outDir, { recursive: true });

const scanRoots = ['src', 'dist', 'public']
  .map((name) => path.join(repoRoot, name))
  .filter((target) => fs.existsSync(target));

const denyPatterns = [
  { id: 'service_role', regex: /service[_-]?role/i },
  { id: 'supabase_secret_key', regex: /supabase[^\\n\\r]{0,40}(secret|service)/i },
  { id: 'opendart_key', regex: /opendart[^\\n\\r]{0,80}(key|token|secret)/i },
  { id: 'building_register_key', regex: /(BUILDING_REGISTER|BUILDING_REGISTER_API|건축물대장[^\\n\\r]{0,40}(API키|인증키|serviceKey|secret|token)|building[_-]?register[^\\n\\r]{0,40}(api[_-]?key|secret|token))/i },
  { id: 'ncp_secret_header', regex: /X-NCP-APIGW-API-KEY(?!-ID)/i },
  { id: 'client_secret_label', regex: /(client[_ -]?secret|api[_ -]?secret)[\\s:=]+['"][^'"]{8,}['"]/i },
  { id: 'jwt_like_token', regex: /eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}/ },
];

const allowedFiles = new Set([
  path.normalize('src/components/system/workspace/WorkspaceLogistics.jsx'),
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(target);
    return [target];
  });
}

const files = scanRoots.flatMap(walk).filter((file) => /\.(js|jsx|ts|tsx|json|html|css|map)$/i.test(file));
const findings = [];

for (const file of files) {
  const relative = path.relative(repoRoot, file);
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of denyPatterns) {
    if (pattern.regex.test(text)) {
      const allowed = allowedFiles.has(path.normalize(relative))
        && pattern.id === 'ncp_secret_header'
        && text.includes('VITE_NAVER_MAPS_CLIENT_ID');
      findings.push({ file: relative, pattern: pattern.id, allowed });
    }
  }
}

const result = {
  scannedRoots: scanRoots.map((target) => path.relative(repoRoot, target)),
  scannedFiles: files.length,
  findings,
  blockingFindings: findings.filter((item) => !item.allowed),
  allPass: findings.every((item) => item.allowed),
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
fs.writeFileSync(
  path.join(outDir, 'summary.md'),
  [
    '# Public bundle secret scan - 2026-05-13',
    '',
    `- scanned roots: ${result.scannedRoots.join(', ')}`,
    `- scanned files: ${result.scannedFiles}`,
    `- blocking findings: ${result.blockingFindings.length}`,
    `- allPass: ${result.allPass}`,
    '',
    '| file | pattern | allowed |',
    '|---|---|---|',
    ...(result.findings.length
      ? result.findings.map((item) => `| ${item.file} | ${item.pattern} | ${item.allowed ? 'yes' : 'no'} |`)
      : ['| - | - | - |']),
  ].join('\n'),
  'utf8'
);

console.log(JSON.stringify(result, null, 2));
process.exit(result.allPass ? 0 : 1);
