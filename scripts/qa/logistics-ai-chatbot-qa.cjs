const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const OUT_JSON = path.join(OUT_DIR, 'ai-chatbot-qa-20260521.json');
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

function argsValue(name, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
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
  if (token) return { token, source: 'LOGISTICS_SUPABASE_ACCESS_TOKEN' };
  const email = argsValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argsValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
  if (!email || !password) throw new Error('Set LOGISTICS_SUPABASE_ACCESS_TOKEN, or LOGISTICS_SUPABASE_EMAIL and LOGISTICS_SUPABASE_PASSWORD.');
  return { token: await signInForAccessToken(supabaseUrl, anonKey, email, password), source: 'password_grant' };
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
  return { action, status: response.status, ok: response.ok, body };
}

function assertStatus(result, expected) {
  if (result.status !== expected) {
    const message = result.body?.message || result.body?.error || JSON.stringify(result.body).slice(0, 300);
    throw new Error(`${result.action} expected ${expected}, got ${result.status}: ${message}`);
  }
}

function assertCleanAnswer(result, label) {
  assertStatus(result, 200);
  if (result.body?.ok !== true) throw new Error(`${label} returned ok=false`);
  const answer = String(result.body?.answer || '');
  if (!answer.trim()) throw new Error(`${label} returned empty answer`);
  if (/\bll_[a-z0-9_]+\b/iu.test(answer)) throw new Error(`${label} exposed internal table name: ${answer}`);
  if (/source[_ -]?cell|source[_ -]?row|provider|fallback|Edge Function|service role|JWT/iu.test(answer)) {
    throw new Error(`${label} exposed implementation detail: ${answer}`);
  }
  if (Array.isArray(result.body?.evidence) && result.body.evidence.length > 0) {
    throw new Error(`${label} returned raw evidence rows to browser.`);
  }
  return answer;
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argsValue('origin', DEFAULT_ORIGIN);
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);

  const assetCount = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '지금 내가 데이터 분석할 수 있는 자산이 몇 개야?',
    history: [],
  });
  const assetCountAnswer = assertCleanAnswer(assetCount, 'asset count');
  if (!/17|자산/iu.test(assetCountAnswer)) throw new Error(`asset count answer is not useful: ${assetCountAnswer}`);

  const assetLookup = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '인천 석남 물류센터 있어?',
    history: [{ role: 'user', content: '내 담당 자산 중 인천권 자산을 확인해줘' }],
  });
  const assetLookupAnswer = assertCleanAnswer(assetLookup, 'asset lookup');
  if (!/인천|석남|물류센터/iu.test(assetLookupAnswer)) throw new Error(`asset lookup answer is not asset-specific: ${assetLookupAnswer}`);

  const busanOperations = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '부산 송정 물류센터 운영 현황 말해줘',
    history: [],
  });
  const busanOperationsAnswer = assertCleanAnswer(busanOperations, 'busan operations summary');
  if (!/부산.*송정|부산송정/iu.test(busanOperationsAnswer)
    || !/(운영\s*현황|총\s*연면적|임대면적|월\s*임관리비|공실률)/iu.test(busanOperationsAnswer)) {
    throw new Error(`busan operations summary is not asset-specific: ${busanOperationsAnswer}`);
  }
  if (/주요\s*임차인은\s*-/iu.test(busanOperationsAnswer)) {
    throw new Error(`busan operations summary exposed placeholder tenant: ${busanOperationsAnswer}`);
  }

  const busanArea = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '부산 송정 물류센터 총 연면적과 임대면적 알려줘',
    history: [],
  });
  const busanAreaAnswer = assertCleanAnswer(busanArea, 'busan area summary');
  if (!/부산.*송정|부산송정/iu.test(busanAreaAnswer) || !/총\s*연면적|임대면적/iu.test(busanAreaAnswer)) {
    throw new Error(`busan area summary is not useful: ${busanAreaAnswer}`);
  }

  const arenaMonthlyCost = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '아레나스 양지 물류센터 월 임관리비 총액 얼마야?',
    history: [],
  });
  const arenaMonthlyCostAnswer = assertCleanAnswer(arenaMonthlyCost, 'arena monthly cost');
  if (!/아레나스.*양지|아레나스양지/iu.test(arenaMonthlyCostAnswer) || !/월\s*임관리비/iu.test(arenaMonthlyCostAnswer) || !/억|원/iu.test(arenaMonthlyCostAnswer)) {
    throw new Error(`arena monthly cost answer is not useful: ${arenaMonthlyCostAnswer}`);
  }

  const followUp = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '그 자산 E. NOC는?',
    history: [
      { role: 'user', content: '인천 석남 물류센터 있어?' },
      { role: 'assistant', content: assetLookupAnswer },
    ],
  });
  const followUpAnswer = assertCleanAnswer(followUp, 'context follow-up');
  if (!/(E\.?\s*NOC|원|근거|확인)/iu.test(followUpAnswer)) {
    throw new Error(`context follow-up answer did not address E. NOC: ${followUpAnswer}`);
  }

  const bukukENoc = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '부국물류센터 e. noc 알려줘',
    history: [
      { role: 'user', content: '아레나스 안성 E. NOC 알려줘' },
      { role: 'assistant', content: '아레나스안성의 E. NOC는 33,305원입니다.' },
    ],
  });
  const bukukENocAnswer = assertCleanAnswer(bukukENoc, 'bukuk e.noc');
  if (!/부국|E\.?\s*NOC|원/iu.test(bukukENocAnswer) || /아레나스안성/iu.test(bukukENocAnswer)) {
    throw new Error(`bukuk e.noc answer is not current-question specific: ${bukukENocAnswer}`);
  }

  const arenaTopTenant = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '아레나스 양지에서 최대 면적 임차하고 있는 임차인은 누구야?',
    history: [],
  });
  const arenaTopTenantAnswer = assertCleanAnswer(arenaTopTenant, 'arena top tenant');
  if (!/아레나스/iu.test(arenaTopTenantAnswer)
    || !/양지/iu.test(arenaTopTenantAnswer)
    || !/(가장\s*많은\s*면적|임대면적은|임차인은)/iu.test(arenaTopTenantAnswer)
    || !/평/iu.test(arenaTopTenantAnswer)
    || /관련\s*임차인은|창원|asset_|tenant_/iu.test(arenaTopTenantAnswer)) {
    throw new Error(`arena top tenant answer is not asset-specific: ${arenaTopTenantAnswer}`);
  }

  const arenaTenantMetric = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '면적 얼마나 임차하고 있고, e. noc는 얼마야?',
    history: [
      { role: 'user', content: '아레나스 양지에서 최대 면적 임차하고 있는 임차인은 누구야?' },
      { role: 'assistant', content: arenaTopTenantAnswer },
    ],
  });
  const arenaTenantMetricAnswer = assertCleanAnswer(arenaTenantMetric, 'arena tenant metric follow-up');
  if (!/아레나스/iu.test(arenaTenantMetricAnswer)
    || !/양지/iu.test(arenaTenantMetricAnswer)
    || !/임차하고\s*있/iu.test(arenaTenantMetricAnswer)
    || !/평/iu.test(arenaTenantMetricAnswer)
    || !/E\.?\s*NOC/iu.test(arenaTenantMetricAnswer)
    || !/원/iu.test(arenaTenantMetricAnswer)
    || /창원|두동|asset_|tenant_/iu.test(arenaTenantMetricAnswer)) {
    throw new Error(`arena tenant metric follow-up lost context: ${arenaTenantMetricAnswer}`);
  }

  const portfolioVacancy = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
    question: '전체 자산 평균 공실률 얼마야?',
    history: [],
  });
  const portfolioVacancyAnswer = assertCleanAnswer(portfolioVacancy, 'portfolio vacancy');
  if (!/공실률|%/iu.test(portfolioVacancyAnswer) || /\basset_[a-z0-9_]+\b/iu.test(portfolioVacancyAnswer)) {
    throw new Error(`portfolio vacancy answer is not a vacancy-rate answer: ${portfolioVacancyAnswer}`);
  }

  const demoBlocked = await invoke(endpoint, anonKey, origin, '', 'ai/search-chat-demo', {
    question: '운영 URL에서 demo fallback이 열려 있나요?',
  });
  if (![401, 403].includes(demoBlocked.status)) {
    throw new Error(`ai/search-chat-demo should be blocked in production origin, got ${demoBlocked.status}`);
  }

  const output = {
    ok: true,
    generated_at: new Date().toISOString(),
    endpoint: endpoint.replace(/https:\/\/([^./]+)\./u, 'https://$1.redacted.'),
    origin,
    auth_source: auth.source,
    checks: {
      asset_count: { status: assetCount.status, answer: assetCountAnswer },
      asset_lookup: { status: assetLookup.status, answer: assetLookupAnswer },
      busan_operations_summary: { status: busanOperations.status, answer: busanOperationsAnswer },
      busan_area_summary: { status: busanArea.status, answer: busanAreaAnswer },
      arena_monthly_cost: { status: arenaMonthlyCost.status, answer: arenaMonthlyCostAnswer },
      context_follow_up: { status: followUp.status, answer: followUpAnswer },
      bukuk_e_noc: { status: bukukENoc.status, answer: bukukENocAnswer },
      arena_top_tenant: { status: arenaTopTenant.status, answer: arenaTopTenantAnswer },
      arena_tenant_metric_follow_up: { status: arenaTenantMetric.status, answer: arenaTenantMetricAnswer },
      portfolio_vacancy: { status: portfolioVacancy.status, answer: portfolioVacancyAnswer },
      production_demo_blocked: demoBlocked.status,
    },
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
