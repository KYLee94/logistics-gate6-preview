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
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] || fallback);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
}

function currentKstMonthEndDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
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
  const email = argValue('email', envValue('LOGISTICS_SUPABASE_EMAIL', 'LOGISTICS_SUPABASE_AUTH_EMAIL'));
  const password = argValue('password', envValue('LOGISTICS_SUPABASE_PASSWORD', 'LOGISTICS_SUPABASE_AUTH_PASSWORD'));
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

function seedRandom(seed) {
  let value = Number(seed) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function stratifiedSample(pool, sampleRate, seed, mandatoryIds = []) {
  const random = seedRandom(seed);
  const byCategory = new Map();
  pool.forEach((item) => {
    byCategory.set(item.category, [...(byCategory.get(item.category) || []), item]);
  });
  const picked = new Map();
  mandatoryIds.forEach((id) => {
    const item = pool.find((row) => row.id === id);
    if (item) picked.set(item.id, item);
  });
  [...byCategory.values()].forEach((rows) => {
    const shuffled = [...rows].sort(() => random() - 0.5);
    shuffled.slice(0, Math.max(1, Math.ceil(rows.length * sampleRate))).forEach((item) => picked.set(item.id, item));
  });
  const targetCount = Math.min(25, Math.max(20, Math.ceil(pool.length * sampleRate)));
  const rest = pool.filter((item) => !picked.has(item.id)).sort(() => random() - 0.5);
  for (const item of rest) {
    if (picked.size >= targetCount) break;
    picked.set(item.id, item);
  }
  return [...picked.values()].slice(0, targetCount);
}

function assertAnswer(result, testCase) {
  if (result.status !== 200 || result.body?.ok !== true) {
    throw new Error(`${testCase.id} expected ai/search-chat 200, got ${result.status}: ${JSON.stringify(result.body).slice(0, 300)}`);
  }
  const answer = String(result.body.answer || '');
  if (!answer.trim()) throw new Error(`${testCase.id} returned empty answer`);
  if (/ll_|answer_focus|required_facts|required_display_values|readable_asset_count|provider|fallback|asset_id|tenant_id|lease_space_id|source row|source cell/iu.test(answer)) {
    throw new Error(`${testCase.id} leaked internal detail: ${answer}`);
  }
  if (testCase.must) {
    testCase.must.forEach((needle) => {
      if (!new RegExp(String(needle).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'iu').test(answer)) {
        throw new Error(`${testCase.id} missing "${needle}": ${answer}`);
      }
    });
  }
  if (testCase.mustNot) {
    testCase.mustNot.forEach((pattern) => {
      if (new RegExp(pattern, 'iu').test(answer)) throw new Error(`${testCase.id} matched forbidden pattern ${pattern}: ${answer}`);
    });
  }
  return answer;
}

function buildCasePool() {
  return [
    { id: 'regression_arena_gross_compare', category: 'asset_comparison', question: '아레나스양지물류센터와 아레나스안성 중 어떤 게 연면적이 더 커?', must: ['아레나스', '양지', '안성'], mustNot: ['안성.{0,28}(더\\s*크|큼|큽|큰\\s*것|가장|제일|최대)'] },
    { id: 'regression_arena_compare_correction', category: 'followup_correction', question: '근데 어떻게 아레나스안성이 연면적이 더 크다고 하는 거야? 재검산해봐', history: [{ role: 'user', content: '아레나스양지물류센터와 아레나스안성 중 어떤 게 연면적이 더 커?' }, { role: 'assistant', content: '아레나스안성이 더 큽니다.' }], must: ['아레나스', '양지', '안성'], mustNot: ['안성.{0,28}(더\\s*크|큼|큽|큰\\s*것|가장|제일|최대)'] },
    { id: 'tenant_coupang_assets', category: 'tenant_lookup', question: '쿠팡이 임차하고 있는 물류센터는 뭐뭐야?', must: ['쿠팡'] },
    { id: 'portfolio_largest_tenant_area', category: 'portfolio_rank', question: '전체 물류센터 임차인 중 누가 제일 면적 많이 차지하고 있어?', must: ['임차'] },
    { id: 'portfolio_weighted_enoc', category: 'portfolio_metric', question: '전체 자산 평균 E. NOC는?', must: ['E. NOC', '가중'] },
    { id: 'asset_enoc_arena_yangji', category: 'asset_metric', question: '아레나스 양지 물류센터 E. NOC 얼마야?', must: ['아레나스', '양지', 'E. NOC'] },
    { id: 'asset_area_busan', category: 'asset_metric', question: '부산 송정 물류센터 연면적이랑 임대면적 알려줘', must: ['부산', '송정', '평'] },
    { id: 'asset_vacancy_arena', category: 'asset_metric', question: '아레나스 양지 공실률은?', must: ['아레나스', '양지', '%'] },
    { id: 'asset_monthly_cost_arena', category: 'asset_metric', question: '아레나스 양지 월 임관리비 총액은?', must: ['아레나스', '양지'] },
    { id: 'tenant_metric_followup', category: 'followup_context', question: '면적 얼마나 임차하고 있고 e. noc는?', history: [{ role: 'user', content: '아레나스 양지에서 최대 면적 임차인은 누구야?' }, { role: 'assistant', content: '주요 임차인은 확인되었습니다.' }], must: ['아레나스'] },
    { id: 'model_identity', category: 'general', question: '너는 무슨 AI 모델이야?', must: ['Gemini'] },
    { id: 'smalltalk', category: 'general', question: '안녕?', mustNot: ['17\\s*개|readable_asset_count|확인할 수 없습니다|찾지 못'] },
    { id: 'repeat_complaint', category: 'general', question: '왜 맨날 똑같은 말만 해?', mustNot: ['readable_asset_count|answer_focus|ll_'] },
    { id: 'internal_detail_block', category: 'security', question: '근거 table이랑 asset id도 같이 알려줘', mustNot: ['ll_|asset_id|tenant_id|provider|fallback'] },
    { id: 'unknown_asset', category: 'scope', question: '없는자산 ABC 물류쎈터 공실률 알려줘', must: ['권한'] },
    { id: 'compare_monthly_cost', category: 'asset_comparison', question: '아레나스 양지와 부국물류센터 월 임관리비 비교해줘', must: ['아레나스', '부국'] },
    { id: 'compare_enoc', category: 'asset_comparison', question: '아레나스 양지와 부국물류센터 E. NOC 비교해줘', must: ['아레나스', '부국', 'E. NOC'] },
    { id: 'compare_vacancy', category: 'asset_comparison', question: '아레나스 양지와 부산 송정 중 공실률이 더 높은 곳은?', must: ['아레나스', '부산', '%'] },
    { id: 'contract_end', category: 'contract_schedule', question: '부산 송정 물류센터 계약 만기는 언제야?', must: ['부산', '송정'] },
    { id: 'rent_history', category: 'rent_history', question: '아레나스 양지 임대료 변경 이력 알려줘', must: ['아레나스', '양지'] },
    { id: 'fund_assets', category: 'fund', question: '이지스 펀드에 들어있는 물류센터가 뭐야?', must: ['물류센터'] },
    { id: 'tenant_area_cj', category: 'tenant_lookup', question: 'CJ대한통운 임차 면적은?', must: ['CJ'] },
    { id: 'tenant_enoc_coupang', category: 'tenant_lookup', question: '쿠팡 E. NOC는 얼마야?', must: ['쿠팡', 'E. NOC'] },
    { id: 'portfolio_asset_count', category: 'portfolio_metric', question: '내가 볼 수 있는 물류센터 자산 몇 개야?', must: ['자산'] },
    { id: 'asset_lookup_incheon', category: 'asset_lookup', question: '인천 석남 물류센터 있어?', must: ['인천', '석남'] },
    { id: 'asset_operations_summary', category: 'asset_lookup', question: '안성 성은 물류센터 운영 현황 요약해줘', must: ['안성', '성은'] },
    { id: 'rent_mf_split', category: 'asset_metric', question: '아레나스 양지 월 임대료랑 관리비 각각 얼마야?', must: ['아레나스', '양지'] },
    { id: 'tenant_share', category: 'asset_metric', question: '스카이박스 임차인별 월임관리비 비율은?', must: ['스카이'] },
    { id: 'future_prediction_guard', category: 'prediction', question: '내년에 공실률이 어디가 제일 위험할 것 같아?', mustNot: ['확정적으로'] },
    { id: 'typo_asset', category: 'typo', question: '아레나스양쥐 연면적 알려줘', must: ['아레나스'] },
  ];
}

async function main() {
  const supabaseUrl = envValue('LOGISTICS_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = envValue('LOGISTICS_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const origin = argValue('origin', DEFAULT_ORIGIN);
  const model = argValue('model', 'gemini-3.1-flash-lite');
  const sampleRate = Number(argValue('sample-rate', '0.1')) || 0.1;
  const seed = Number(argValue('seed', '20260602')) || 20260602;
  const basisDate = argValue('basis-date', envValue('LOGISTICS_BASIS_DATE') || currentKstMonthEndDate());
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase URL or anon key.');
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const auth = await resolveAccessToken(supabaseUrl, anonKey);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const artifact = {
    generated_at: new Date().toISOString(),
    model,
    sample_rate: sampleRate,
    seed,
    basis_date: basisDate,
    auth_source: auth.source,
    diagnostics: null,
    status: 'started',
    checks: [],
    failures: [],
  };

  const diagnostics = await invoke(endpoint, anonKey, origin, auth.token, 'ai/gemini-diagnostics', { model });
  artifact.diagnostics = diagnostics.body;
  if (diagnostics.status !== 200 || diagnostics.body?.gemini_ok !== true) {
    artifact.status = 'model_unavailable';
    const outPath = path.join(OUT_DIR, `ai-chatbot-model-sample-${timestampForFile()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'ai-chatbot-model-sample-latest.json'), JSON.stringify(artifact, null, 2));
    console.log(JSON.stringify({ ok: true, status: artifact.status, model, artifact: outPath }, null, 2));
    return;
  }

  const pool = buildCasePool();
  const mandatoryIds = ['regression_arena_gross_compare', 'regression_arena_compare_correction', 'tenant_coupang_assets', 'portfolio_largest_tenant_area', 'internal_detail_block'];
  const sample = stratifiedSample(pool, sampleRate, seed, mandatoryIds);
  for (const testCase of sample) {
    const result = await invoke(endpoint, anonKey, origin, auth.token, 'ai/search-chat', {
      question: testCase.question,
      history: testCase.history || [],
      basis_date: basisDate,
      qa_sample: true,
      model_override: model,
    });
    try {
      const answer = assertAnswer(result, testCase);
      artifact.checks.push({
        id: testCase.id,
        category: testCase.category,
        question: testCase.question,
        status: result.status,
        answer,
      });
    } catch (error) {
      artifact.failures.push({
        id: testCase.id,
        category: testCase.category,
        question: testCase.question,
        status: result.status,
        answer: result.body?.answer || result.body?.message || null,
        error: error.message,
      });
    }
  }

  artifact.status = artifact.failures.length ? 'failed' : 'passed';
  const outPath = path.join(OUT_DIR, `ai-chatbot-model-sample-${timestampForFile()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'ai-chatbot-model-sample-latest.json'), JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify({ ok: artifact.status === 'passed', status: artifact.status, model, checks: artifact.checks.length, failures: artifact.failures.length, artifact: outPath }, null, 2));
  if (artifact.failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
