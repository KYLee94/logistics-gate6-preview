const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const EDGE_FUNCTION = 'll-dashboard-api';
const DEFAULT_ORIGIN = 'https://kylee94.github.io';
const DEFAULT_LIMIT = 120;
const DEFAULT_MODEL = 'gemini-2.0-flash';
const REQUEST_DELAY_MS = 2150;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function invoke(endpoint, anonKey, origin, token, action, payload, attempt = 0) {
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
  if (response.status === 429 && attempt < 3) {
    await sleep(10_000 + attempt * 10_000);
    return invoke(endpoint, anonKey, origin, token, action, payload, attempt + 1);
  }
  return { action, status: response.status, ok: response.ok, body };
}

const INTERNAL_PATTERN = /\bll_[a-z0-9_]+\b|public\.|asset_id|tenant_id|source_hash|document_id|chunk_id|fact_id|provider|fallback|service role|JWT|Edge Function|answer_focus|required_facts|matched_tables/iu;
const MOJIBAKE_MARKERS = ['占', '筌', '媛쒖', '留덉', '嫄곕', '怨듦', '由ы', '荑좎', '?쒖', '?꾨', '�'];
const INSUFFICIENT_PATTERN = /(확인할 수 없습니다|근거를 찾지 못|제공된 데이터.*없|정보가 없습니다|근거가 부족)/u;
const SOURCE_PATTERN = /(IGIS|시장 DB|리포트|보고서|Excel|sheet|row|p\.|페이지|쿠시먼|세빌스|알스퀘어|젠스타|Genstar|Cushman|Savills|Rsquare)/iu;

const CASES = [];

function add(category, question, options = {}) {
  CASES.push({ id: `MKT-${String(CASES.length + 1).padStart(3, '0')}`, category, question, ...options });
}

function buildCases() {
  add('거래사례_랭킹', '2025년 거래된 물류센터 중 연면적 기준 top 3 알려줘.', {
    mustInclude: ['청라로지스틱스센터', '로지스밸리 안산물류센터', '석남복합물류'],
    mustNotInclude: ['2023 Q2', '이천로지포트'],
    evidenceRequired: true,
  });
  add('거래사례_랭킹', '2025년 거래사례에서 면적이 제일 큰 물류센터 5개만 순서대로 알려줘.', {
    mustInclude: ['청라로지스틱스센터', '로지스밸리 안산물류센터', '석남복합물류'],
    evidenceRequired: true,
  });

  const years = ['2023', '2024', '2025'];
  const rankMetrics = [
    ['연면적', '연면적 기준으로 큰'],
    ['거래가격', '거래가격 기준으로 큰'],
    ['평당가', '평당가 기준으로 높은'],
  ];
  years.forEach((year) => {
    rankMetrics.forEach(([metric, label]) => {
      add('거래사례_랭킹', `${year}년 거래사례 중 ${label} 물류센터 top 3 알려줘.`, { mustInclude: [year], evidenceRequired: true });
      add('거래사례_랭킹', `${year}년 물류센터 거래를 ${metric} 순서로 정리해줘.`, { mustInclude: [year], evidenceRequired: true });
    });
  });

  ['청라로지스틱스센터', '로지스밸리 안산물류센터', '석남복합물류', '이천로지포트물류센터', '해천글로벌 냉동창고'].forEach((name) => {
    add('거래사례_개별', `${name} 거래사례에서 매수자와 매도자, 거래가격을 알려줘.`, { mustInclude: [name], evidenceRequired: true });
    add('거래사례_개별', `${name}은 시장자료에서 어떤 거래로 잡혀 있어?`, { mustInclude: [name], evidenceRequired: true });
  });

  ['수도권', '서부권', '동남권', '남부권', '충청권', '부산권'].forEach((region) => {
    add('권역_시장동향', `${region} 물류센터 시장 동향을 저장된 자료 기준으로 요약해줘.`, { mustInclude: [region], evidenceRequired: true });
    add('권역_시장동향', `${region}에서 공급이나 거래 관련해서 확인되는 내용 알려줘.`, { mustInclude: [region], evidenceRequired: true });
  });

  ['2025', '2026'].forEach((year) => {
    add('공급예정', `${year}년 물류센터 공급 예정 사례를 권역과 연면적 중심으로 알려줘.`, { mustInclude: [year], evidenceRequired: true });
    add('공급예정', `${year}년 수도권 물류센터 공급 전망은 어때?`, { mustInclude: [year], evidenceRequired: true });
    add('공급예정', `${year}년 저온 물류센터 공급 예정이 있으면 알려줘.`, { mustInclude: [year], evidenceRequired: true });
    add('공급예정', `${year}년 상온 물류센터 공급 예정이 있으면 알려줘.`, { mustInclude: [year], evidenceRequired: true });
  });

  [
    ['젠스타메이트', '2025년 1분기'],
    ['젠스타메이트', '2025년 2분기'],
    ['젠스타메이트', '2025년 3분기'],
    ['젠스타메이트', '2026년 1분기'],
    ['알스퀘어', '2025 1H'],
    ['알스퀘어', '2025 2H'],
    ['쿠시먼', '2025'],
    ['쿠시먼', '2026'],
    ['세빌스', '2026'],
  ].forEach(([publisher, period]) => {
    add('발행기관_리포트', `${publisher} ${period} 물류센터 리포트 핵심 내용을 요약해줘.`, { mustInclude: [publisher], evidenceRequired: true });
    add('발행기관_리포트', `${publisher} ${period} 자료에서 시장 전망은 어떻게 보고 있어?`, { mustInclude: [publisher], evidenceRequired: true });
  });

  ['공실률', '임대료', 'cap rate', '수익률', '금리', '거래규모', '거래빈도', '평균 거래 평당가'].forEach((topic) => {
    add('시장지표', `시장자료에서 ${topic} 관련 근거를 찾아서 설명해줘.`, { mustInclude: [topic.split(' ')[0]], evidenceRequired: true });
    add('시장지표', `${topic}이 물류센터 시장에 어떤 의미인지 저장된 자료 기준으로 설명해줘.`, { evidenceRequired: true });
  });

  [
    '시장자료에서 공통적으로 말하는 리스크는 뭐야?',
    '최근 물류센터 시장에서 공급 과잉 리스크가 언급돼?',
    '공실률과 임대료 사이의 관계를 자료 기준으로 설명해줘.',
    '금리와 cap rate가 물류센터 거래에 미치는 영향이 언급돼?',
    '저온 물류센터 수요에 대한 코멘트가 있어?',
    '상온 물류센터 수요에 대한 코멘트가 있어?',
    '수도권과 비수도권 시장 분위기를 비교해줘.',
    '2025년 자료와 2026년 자료에서 전망이 달라진 부분이 있어?',
  ].forEach((question) => add('시장해석_리스크', question, { evidenceRequired: true }));

  [
    '저장된 시장자료 중 최신 기준일은 언제야?',
    '2026년 2분기 실적 자료가 저장돼 있어?',
    'PDF 리포트와 Excel DB 중 숫자 답변은 무엇을 우선해야 해?',
    '자료마다 기준시점이 다르면 어떻게 해석해야 해?',
    '거래사례 숫자와 리포트 문장 근거를 구분해서 설명해줘.',
    '시장자료 답변에 어떤 출처가 사용됐는지 알려줘.',
  ].forEach((question) => add('출처_최신성', question, { evidenceRequired: true, allowInsufficient: /2분기/.test(question) }));

  [
    ['쿠팡이 임차한 자산과 시장 공실률을 비교해서 시사점을 알려줘.', ['쿠팡']],
    ['아레나스 양지 물류센터를 시장자료 관점에서 보면 어떤 점을 봐야 해?', ['아레나스']],
    ['부산송정 물류센터와 부산권 시장자료를 같이 보면 어떤 시사점이 있어?', ['부산']],
    ['화성 석포리 물류센터와 수도권 공급 전망을 비교해줘.', ['화성']],
    ['스카이박스 자산과 인천권 시장자료를 같이 설명해줘.', ['스카이박스']],
  ].forEach(([question, terms]) => add('운영DB_시장비교', question, { mustInclude: terms, evidenceRequired: true }));

  [
    '저장된 자료만 기준으로 2027년 물류센터 확정 임대료 전망이 있어?',
    '시장자료에 없는 특정 비상장 회사 재무정보까지 말할 수 있어?',
    '자료에 근거가 없는 숫자면 어떻게 답해야 해?',
  ].forEach((question) => add('근거부족_차단', question, { allowInsufficient: true }));

  const variants = [
    ['거래사례_랭킹', '2025년 거래된 것 중 면적 큰 순서로 세 개만 다시 정리해줘.', ['청라로지스틱스센터']],
    ['거래사례_랭킹', '시장자료 기준으로 2025년 물류센터 거래 top 3, 연면적 기준이야.', ['청라로지스틱스센터']],
    ['공급예정', '2026년에 완공 예정인 물류센터 사례를 몇 개만 보여줘.', ['2026']],
    ['공급예정', '공급 예정 자료에서 2026년 Q3 사례를 찾아줘.', ['2026']],
    ['발행기관_리포트', '쿠시먼 자료만 보고 2026년 시장 전망을 알려줘.', ['쿠시먼']],
    ['발행기관_리포트', '젠스타메이트 자료 기준으로 2026년 1분기 분위기 알려줘.', ['젠스타']],
    ['발행기관_리포트', '알스퀘어 2025년 하반기 리포트에서 중요한 내용이 뭐야?', ['알스퀘어']],
    ['시장지표', '명목 cap rate 관련 표나 문장을 근거로 설명해줘.', ['cap']],
    ['시장해석_리스크', '물류센터 시장에서 임차 수요는 어떤 식으로 설명돼?', ['수요']],
    ['출처_최신성', '가장 최근 리포트 기준으로만 짧게 요약해줘.', ['2026']],
  ];
  variants.forEach(([category, question, mustInclude]) => add(category, question, { mustInclude, evidenceRequired: true }));
}

function hasMojibake(value) {
  const text = String(value || '');
  return MOJIBAKE_MARKERS.some((marker) => text.includes(marker));
}

function containsAll(source, terms = []) {
  const normalized = String(source || '').toLowerCase().replace(/\s+/gu, '');
  return terms.every((term) => normalized.includes(String(term || '').toLowerCase().replace(/\s+/gu, '')));
}

function containsAny(source, terms = []) {
  const normalized = String(source || '').toLowerCase().replace(/\s+/gu, '');
  return terms.some((term) => normalized.includes(String(term || '').toLowerCase().replace(/\s+/gu, '')));
}

function validateCase(testCase, response, statusData) {
  const answer = String(response.body?.answer || response.body?.message || '');
  const evidence = Array.isArray(response.body?.evidence) ? response.body.evidence : [];
  const combined = `${answer}\n${JSON.stringify(evidence)}`;
  const errors = [];

  if (response.status !== 200 || response.body?.ok !== true) errors.push(`chat failed ${response.status}`);
  if (answer.trim().length < 35) errors.push('answer too short');
  if (INTERNAL_PATTERN.test(combined)) errors.push('internal implementation detail leaked');
  if (hasMojibake(combined)) errors.push('mojibake detected');
  if (!testCase.allowInsufficient && INSUFFICIENT_PATTERN.test(answer)) errors.push('answered as insufficient for answerable case');
  if (testCase.evidenceRequired && !evidence.length) errors.push('missing public evidence');
  if (testCase.evidenceRequired && !SOURCE_PATTERN.test(combined)) errors.push('missing human-readable source');
  if (testCase.mustInclude?.length && !containsAll(combined, testCase.mustInclude)) errors.push(`missing required terms: ${testCase.mustInclude.join(', ')}`);
  if (testCase.mustIncludeAny?.length && !containsAny(combined, testCase.mustIncludeAny)) errors.push(`missing one of required terms: ${testCase.mustIncludeAny.join(', ')}`);
  if (testCase.mustNotInclude?.length && containsAny(answer, testCase.mustNotInclude)) errors.push(`forbidden terms found: ${testCase.mustNotInclude.join(', ')}`);
  if (Number(statusData.documents || 0) < 12) errors.push('market document count below expected 12');
  if (Number(statusData.facts || 0) < 1000) errors.push('market fact count below expected 1000');
  if (Number(statusData.chunks || 0) < 500) errors.push('market chunk count below expected 500');
  if (Number(statusData.preserved_documents || 0) < 12) errors.push('original source preservation below expected 12');
  if (Number(statusData.preserved_extracted_texts || 0) < 12) errors.push('extracted text preservation below expected 12');

  return {
    passed: errors.length === 0,
    errors,
    answer,
    evidence,
  };
}

async function main() {
  buildCases();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = envValue('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
  const model = argValue('model', DEFAULT_MODEL);
  if (model === 'gemini-3.1-flash-lite') {
    throw new Error('QA must not call gemini-3.1-flash-lite. Use gemini-2.0-flash for tests; 3.1 Flash-Lite is reserved for deployed human use.');
  }
  const endpoint = `${supabaseUrl.replace(/\/$/u, '')}/functions/v1/${EDGE_FUNCTION}`;
  const origin = argValue('origin', DEFAULT_ORIGIN);
  const token = await resolveAccessToken(supabaseUrl, anonKey);
  const requestedLimit = Number(argValue('limit', DEFAULT_LIMIT)) || DEFAULT_LIMIT;
  const cases = CASES.slice(0, Math.min(Math.max(1, requestedLimit), CASES.length));
  const status = await invoke(endpoint, anonKey, origin, token, 'market-docs/status', {});
  if (status.status !== 200 || status.body?.ok !== true) throw new Error(`market-docs/status failed: ${status.status} ${JSON.stringify(status.body)}`);
  const statusData = status.body.data || {};
  const results = [];

  for (const testCase of cases) {
    const response = await invoke(endpoint, anonKey, origin, token, 'ai/search-chat', {
      question: testCase.question,
      history: [],
      qa_sample: true,
      answer_scope: testCase.scope || 'market',
      model_override: model,
    });
    const validation = validateCase(testCase, response, statusData);
    results.push({
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      passed: validation.passed,
      errors: validation.errors,
      status: response.status,
      answer_preview: validation.answer.slice(0, 500),
      evidence_count: validation.evidence.length,
      evidence_preview: validation.evidence.slice(0, 4),
    });
    console.log(`${validation.passed ? 'PASS' : 'FAIL'} ${testCase.id} [${testCase.category}] ${testCase.question}`);
    if (!validation.passed) console.log(`  ${validation.errors.join(' / ')}`);
    await sleep(Number(argValue('delay-ms', REQUEST_DELAY_MS)) || REQUEST_DELAY_MS);
  }

  const categorySummary = {};
  for (const result of results) {
    categorySummary[result.category] ||= { total: 0, pass: 0, fail: 0 };
    categorySummary[result.category].total += 1;
    if (result.passed) categorySummary[result.category].pass += 1;
    else categorySummary[result.category].fail += 1;
  }

  const artifact = {
    generated_at: new Date().toISOString(),
    endpoint,
    origin,
    model,
    generated_case_count: CASES.length,
    executed_case_count: results.length,
    pass_count: results.filter((row) => row.passed).length,
    fail_count: results.filter((row) => !row.passed).length,
    pass: results.every((row) => row.passed),
    category_summary: categorySummary,
    status: statusData,
    results,
  };
  const outPath = path.join(OUT_DIR, `market-chatbot-qa-${timestampForFile()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'market-chatbot-qa-latest.json'), JSON.stringify(artifact, null, 2), 'utf8');
  console.log(`artifact=${outPath}`);
  if (!artifact.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
