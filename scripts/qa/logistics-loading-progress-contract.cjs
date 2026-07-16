const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'LogisticsSectorModules.jsx');
const WORKSPACE_SOURCE_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`${name}: function not found`);
  const paramsStart = source.indexOf('(', start + marker.length);
  if (paramsStart === -1) throw new Error(`${name}: parameter list not found`);
  let parameterDepth = 0;
  let parameterQuote = '';
  let parameterEscaped = false;
  let paramsEnd = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];
    if (parameterQuote) {
      if (parameterEscaped) parameterEscaped = false;
      else if (char === '\\') parameterEscaped = true;
      else if (char === parameterQuote) parameterQuote = '';
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      parameterQuote = char;
      continue;
    }
    if (char === '(') parameterDepth += 1;
    if (char === ')') {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }
  if (paramsEnd === -1) throw new Error(`${name}: parameter list does not close`);
  const open = source.indexOf('{', paramsEnd);
  if (open === -1) throw new Error(`${name}: opening brace not found`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name}: closing brace not found`);
}

function sourceFunction(source, name) {
  const declaration = extractFunction(source, name);
  return new Function(`${declaration}\nreturn ${name};`)();
}

function requireMatch(source, pattern, label) {
  if (!pattern.test(source)) throw new Error(`Missing contract: ${label}`);
  return label;
}

function evaluateCheck(report, id, description, fn) {
  try {
    report.checks.push({ id, description, ok: true, evidence: fn() });
  } catch (error) {
    report.checks.push({ id, description, ok: false, error: error?.message || String(error) });
  }
}

function verifyScenario(createTrace, progressForTrace, scenario) {
  const observed = scenario.events.map((event) => {
    const trace = createTrace(event.input);
    return {
      stage: trace.stage,
      attempt: trace.attempt,
      completed_steps: trace.completedSteps,
      total_steps: trace.totalSteps,
      progress: progressForTrace(trace),
    };
  });
  const expected = scenario.expected;
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error(`${scenario.id}: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(observed)}`);
  }
  if (observed.some((event) => event.completed_steps < 0 || event.completed_steps > event.total_steps)) {
    throw new Error(`${scenario.id}: invalid completed/total step relationship`);
  }
  if (observed[0]?.progress <= 0) {
    throw new Error(`${scenario.id}: initial progress must be greater than zero`);
  }
  if (observed.some((event, index) => index > 0 && event.progress < observed[index - 1].progress)) {
    throw new Error(`${scenario.id}: progress must not decrease`);
  }
  return { id: scenario.id, events: observed };
}

function main() {
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  const workspaceSource = fs.readFileSync(WORKSPACE_SOURCE_PATH, 'utf8');
  const createTrace = sourceFunction(source, 'createEdgeDataLoadingTrace');
  const progressForTrace = sourceFunction(source, 'edgeDataLoadingProgress');
  const report = {
    ok: false,
    script: 'qa:loading-progress-contract',
    mode: 'source-trace-contract',
    primary_success: 'executed loading trace functions and source wiring assertions',
    artifact_freshness_used: false,
    local_only_artifact_used: false,
    live_url_used: false,
    source: path.relative(ROOT, SOURCE_PATH).replace(/\\/gu, '/'),
    checks: [],
  };

  const scenarios = [
    {
      id: 'cold-load',
      events: [
        { input: { stage: 'queued', attempt: 0 } },
        { input: { stage: 'loading', attempt: 1, startedAt: 101 } },
        { input: { stage: 'processing', attempt: 1, startedAt: 101 } },
        { input: { stage: 'ready', attempt: 1, startedAt: 101, finishedAt: 102, hasData: true } },
      ],
      expected: [
        { stage: 'queued', attempt: 0, completed_steps: 1, total_steps: 4, progress: 25 },
        { stage: 'loading', attempt: 1, completed_steps: 2, total_steps: 4, progress: 50 },
        { stage: 'processing', attempt: 1, completed_steps: 3, total_steps: 4, progress: 75 },
        { stage: 'ready', attempt: 1, completed_steps: 4, total_steps: 4, progress: 100 },
      ],
    },
    {
      id: 'cached-tab-revalidation',
      events: [
        { input: { stage: 'refreshing', attempt: 1, startedAt: 21, hasData: true } },
        { input: { stage: 'processing', attempt: 1, startedAt: 21, hasData: true } },
        { input: { stage: 'ready', attempt: 1, startedAt: 21, finishedAt: 22, hasData: true } },
      ],
      expected: [
        { stage: 'refreshing', attempt: 1, completed_steps: 2, total_steps: 4, progress: 50 },
        { stage: 'processing', attempt: 1, completed_steps: 3, total_steps: 4, progress: 75 },
        { stage: 'ready', attempt: 1, completed_steps: 4, total_steps: 4, progress: 100 },
      ],
    },
    {
      id: 'idle-return-retry',
      events: [
        { input: { stage: 'queued', attempt: 0 } },
        { input: { stage: 'loading', attempt: 1, startedAt: 31 } },
        { input: { stage: 'retrying', attempt: 2, startedAt: 31 } },
        { input: { stage: 'processing', attempt: 2, startedAt: 31 } },
        { input: { stage: 'ready', attempt: 2, startedAt: 31, finishedAt: 32, hasData: true } },
      ],
      expected: [
        { stage: 'queued', attempt: 0, completed_steps: 1, total_steps: 4, progress: 25 },
        { stage: 'loading', attempt: 1, completed_steps: 2, total_steps: 4, progress: 50 },
        { stage: 'retrying', attempt: 2, completed_steps: 2, total_steps: 4, progress: 50 },
        { stage: 'processing', attempt: 2, completed_steps: 3, total_steps: 4, progress: 75 },
        { stage: 'ready', attempt: 2, completed_steps: 4, total_steps: 4, progress: 100 },
      ],
    },
    {
      id: 'retained-data-failure',
      events: [
        { input: { stage: 'refreshing', attempt: 1, startedAt: 41, hasData: true } },
        { input: { stage: 'failed', attempt: 2, startedAt: 41, finishedAt: 42, hasData: true } },
      ],
      expected: [
        { stage: 'refreshing', attempt: 1, completed_steps: 2, total_steps: 4, progress: 50 },
        { stage: 'failed', attempt: 2, completed_steps: 4, total_steps: 4, progress: 100 },
      ],
    },
  ];

  evaluateCheck(report, 'trace-stage-progress-order', 'Queued, loading, processing, refreshing, retrying, ready, and retained-failure traces produce the expected ordered progress contract without advancing a fake clock.', () => (
    scenarios.map((scenario) => verifyScenario(createTrace, progressForTrace, scenario))
  ));

  evaluateCheck(report, 'hook-emits-all-terminal-stages', 'The data hook creates trace records for queued, loading, refreshing, retrying, processing, ready, and failed paths.', () => {
    const hook = extractFunction(source, 'useEdgeData');
    return [
      requireMatch(hook, /loadingStage:\s*'queued'[\s\S]{0,220}loadingTrace:\s*createEdgeDataLoadingTrace\(\)/u, 'queued trace'),
      requireMatch(hook, /loadingStage:[\s\S]{0,220}stage:\s*options\.__retry[\s\S]{0,220}'loading'/u, 'loading trace'),
      requireMatch(hook, /stage:\s*options\.__retry \? 'retrying' : 'refreshing'/u, 'refreshing trace'),
      requireMatch(hook, /loadingStage:\s*'retrying'[\s\S]{0,220}stage:\s*'retrying'/u, 'retry trace'),
      requireMatch(hook, /loadingStage:\s*'processing'[\s\S]{0,220}stage:\s*'processing'/u, 'processing trace'),
      requireMatch(hook, /loadingStage:\s*'ready'[\s\S]{0,220}stage:\s*'ready'/u, 'ready trace'),
      requireMatch(hook, /loadingStage:\s*'failed'[\s\S]{0,220}stage:\s*'failed'/u, 'failed trace'),
    ];
  });

  evaluateCheck(report, 'progress-ui-receives-trace-fields', 'Loading UI exposes the trace stage and completed/total steps instead of deriving progress from a timer.', () => {
    const badge = extractFunction(source, 'MarketDataLoadingBadge');
    return [
      requireMatch(badge, /data-loading-stage=\{loadingStage\}/u, 'loading stage data attribute'),
      requireMatch(badge, /data-loading-completed-steps=\{loadingTrace\?\.completedSteps\}/u, 'completed step data attribute'),
      requireMatch(badge, /data-loading-total-steps=\{loadingTrace\?\.totalSteps\}/u, 'total step data attribute'),
      requireMatch(badge, /const safeProgress = Math\.max\(1, Math\.min\(100, Math\.round\(Number\(progress\) \|\| 0\)\)\)/u, 'positive bounded progress display'),
      requireMatch(source, /<MarketDataLoadingBadge loading=\{loading\} progress=\{edgeDataLoadingProgress\(loadingTrace\)\}/u, 'trace-derived market progress'),
      requireMatch(source, /<MarketDataLoadingBadge loading progress=\{edgeDataLoadingProgress\(loadingTrace\)\}/u, 'trace-derived approval progress'),
    ];
  });

  evaluateCheck(report, 'dashboard-progress-uses-active-request-tracker', 'Dashboard loading reflects active request state without timer-driven 96 percent plateaus or backward resets.', () => {
    const shell = extractFunction(workspaceSource, 'DashboardShell');
    if (/setInterval|Math\.min\(96|Math\.min\([^\n]*84/u.test(shell)) {
      throw new Error('DashboardShell still contains timer-driven or backward progress logic.');
    }
    return [
      requireMatch(shell, /reportModuleLoading/u, 'active module loading tracker'),
      requireMatch(shell, /activeDashboardLoading/u, 'active dashboard loading state'),
    ];
  });

  evaluateCheck(report, 'progress-contract-has-no-qa-fake-clock', 'This contract script does not use fake timers or artifact freshness as evidence.', () => {
    const scriptSource = fs.readFileSync(__filename, 'utf8');
    const fakeTimerIndicators = [
      'use' + 'Fake' + 'Timers',
      'advance' + 'Timers' + 'ByTime',
      'jest.' + 'run' + 'All' + 'Timers',
      'vi.' + 'use' + 'Fake' + 'Timers',
      'sinon.' + 'use' + 'Fake' + 'Timers',
    ];
    if (fakeTimerIndicators.some((indicator) => scriptSource.includes(indicator))) {
      throw new Error('A fake timer API was found in the QA contract.');
    }
    const artifactIndicators = ['qa-' + 'artifacts', 'freshness-' + 'latest', 'latest' + '.json'];
    if (artifactIndicators.some((indicator) => scriptSource.includes(indicator))) {
      throw new Error('An artifact freshness source was found in the QA contract.');
    }
    return 'No fake clock or artifact freshness dependency found.';
  });

  report.ok = report.checks.every((check) => check.ok);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
}
