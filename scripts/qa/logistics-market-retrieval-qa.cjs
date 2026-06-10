const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';

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

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (fileEnv[key]) return fileEnv[key];
  }
  return '';
}

function argValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

async function signInForAccessToken(supabaseUrl, anonKey, email, password) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/u, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    const message = body.msg || body.message || body.error_description || body.error || 'unknown auth error';
    throw new Error(`Supabase Auth login failed (${response.status}): ${message}`);
  }
  return body.access_token;
}

async function resolveAccessToken(supabaseUrl, anonKey) {
  const token = envValue('LOGISTICS_SUPABASE_ACCESS_TOKEN');
  if (token) return token;
  const email = argValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return signInForAccessToken(supabaseUrl, anonKey, email, password);
}

async function invoke(endpoint, anonKey, origin, token, action, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: token ? `Bearer ${token}` : '',
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({ action, payload }),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, body };
}

const MOJIBAKE_MARKERS = ['�', '荑', '臾쇰', '嫄곕', '遺꾧린', '留덉', '?좎', '?뚯', '?쒖', '?먮'];
const RETRIEVAL_CASES = [
  { question: '수도권 공급 전망', expected: ['공급', '수도권'] },
  { question: '2026년 1분기 젠스타메이트 리포트', expected: ['젠스타', '2026'] },
  { question: '쿠시먼 2026 물류센터 시장 전망', expected: ['쿠시먼', '2026'] },
  { question: '세빌스 2026 물류센터 전망', expected: ['세빌스', '2026'] },
  { question: '알스퀘어 2025 2H 물류센터 리포트', expected: ['알스퀘어', '2025'] },
  { question: '물류센터 거래사례 매수자 매도자', expected: ['거래', '매수'] },
  { question: '물류센터 cap rate 수익률', expected: ['cap', '수익률'] },
  { question: '시장 공실률 흐름', expected: ['공실'] },
  { question: '저온 물류센터 수요', expected: ['저온', '수요'] },
  { question: '금리 자본시장 영향', expected: ['금리'] },
  { question: '공급예정 데이터 권역별', expected: ['공급', '권역'] },
  { question: 'Excel DB와 PDF 리포트 숫자 우선순위', expected: ['Excel', 'PDF'] },
];

function hasMojibake(text) {
  return MOJIBAKE_MARKERS.some((marker) => String(text || '').includes(marker));
}

function containsAny(text, terms) {
  const source = String(text || '').toLowerCase();
  return terms.some((term) => source.includes(String(term).toLowerCase()));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = envValue('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const origin = argValue('origin', DEFAULT_ORIGIN);
  const token = await resolveAccessToken(supabaseUrl, anonKey);
  const results = [];

  for (const testCase of RETRIEVAL_CASES) {
    const response = await invoke(endpoint, anonKey, origin, token, 'market-docs/search', { question: testCase.question, limit: 8 });
    const evidence = Array.isArray(response.body?.data?.evidence) ? response.body.data.evidence : [];
    const evidenceText = JSON.stringify(evidence);
    const errors = [];
    if (response.status !== 200 || response.body?.ok !== true) errors.push(`search failed ${response.status}`);
    if (!evidence.length) errors.push('missing evidence');
    if (hasMojibake(evidenceText)) errors.push('mojibake detected in evidence');
    if (!containsAny(evidenceText, testCase.expected)) errors.push(`expected terms missing: ${testCase.expected.join(', ')}`);
    if (!/(세빌스|알스퀘어|젠스타|쿠시먼|IGIS|리포트|보고서|기준|sheet|row|p\.)/u.test(evidenceText)) errors.push('human-readable source locator missing');
    results.push({
      question: testCase.question,
      expected: testCase.expected,
      passed: errors.length === 0,
      errors,
      status: response.status,
      retrieval_status: response.body?.data?.retrieval_status || '',
      evidence_count: evidence.length,
      evidence_preview: evidence.slice(0, 3),
    });
    console.log(`${errors.length ? 'FAIL' : 'PASS'} ${testCase.question}`);
  }

  const artifact = {
    generated_at: new Date().toISOString(),
    endpoint,
    origin,
    case_count: results.length,
    pass_count: results.filter((row) => row.passed).length,
    fail_count: results.filter((row) => !row.passed).length,
    semantic_vector_status: results.some((row) => String(row.retrieval_status || '').startsWith('semantic_'))
      ? 'semantic_vector_used'
      : 'semantic_vector_not_used_or_fallback',
    pass: results.every((row) => row.passed),
    results,
  };
  const outPath = path.join(OUT_DIR, `market-retrieval-qa-${timestampForFile()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');
  console.log(`artifact=${outPath}`);
  if (!artifact.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
