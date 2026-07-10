const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'qa-artifacts', 'logistics-gate6');
const SELF_PATH = 'scripts/qa/logistics-dangerous-script-audit.cjs';
const SCANNED_EXT = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx', '.sql', '.ps1']);

const RULES = [
  { key: 'db-drop-cascade', regex: /\bdrop\s+(?:table|schema|function|policy|view|type)\b[\s\S]{0,240}?\bcascade\b/giu, alwaysBlocking: true },
  { key: 'sql-drop', regex: /\bdrop\s+(?:table|schema|function|policy|view|type)\b/giu },
  { key: 'sql-truncate', regex: /\btruncate\s+(?:table\s+)?/giu },
  { key: 'sql-delete', regex: /\bdelete\s+from\b/giu },
  { key: 'sql-update', regex: /\bupdate\s+(?:public\.)?[a-z_][a-z0-9_]*\s+set\b/giu },
  { key: 'sql-insert', regex: /\binsert\s+into\b/giu },
  { key: 'supabase-delete', regex: /\.from\s*\([^)]*\)[\s\S]{0,240}?\.delete\s*\(/gu },
  { key: 'supabase-update', regex: /\.from\s*\([^)]*\)[\s\S]{0,240}?\.update\s*\(/gu },
  { key: 'supabase-insert', regex: /\.from\s*\([^)]*\)[\s\S]{0,240}?\.insert\s*\(/gu },
  { key: 'supabase-upsert', regex: /\.from\s*\([^)]*\)[\s\S]{0,240}?\.upsert\s*\(/gu },
  {
    key: 'mutation-action',
    regex: /(?:\binvoke\s*\([\s\S]{0,400}?|\baction\s*:\s*)['"][^'"]*(?:cleanup|delete|save|submit|approve|reject|restore|backfill|publish|refresh)[^'"]*['"]/giu,
  },
  { key: 'recursive-delete', regex: /rmSync\s*\([^)]*recursive\s*:\s*true|Remove-Item\b[^;\n]*-Recurse/giu },
  { key: 'service-role', regex: /SERVICE_ROLE|service_role/giu, privilegeOnly: true },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'qa-artifacts') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SCANNED_EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/u).length;
}

function hasExplicitApplyGuard(text) {
  const readsApplyFlag = /(?:(?:process\.argv|args?)\.includes\(\s*['"]--apply['"]\s*\)|hasFlag\(\s*['"]apply['"]\s*\)|args?Value\(\s*['"]apply['"])/u.test(text);
  const defaultsToDryRun = /(?:dryRun|dry_run)\s*(?:=|:)\s*!\s*apply\b|if\s*\(\s*!\s*apply\s*\)/u.test(text);
  return readsApplyFlag && defaultsToDryRun;
}

function hasGuardedQaCleanup(text) {
  return /\bfinally\s*\{/u.test(text)
    && /(?:cleanup|dedupe_key|qa[_-](?:row|stamp|probe)|tempDir)/iu.test(text)
    && /(?:delete\s+from|\.delete\s*\(|rmSync\s*\()/iu.test(text);
}

function hasQaMutationOptIn(text) {
  return /--allow-(?:submit|write|mutation)|QA_ALLOW_[A-Z_]*(?:SUBMIT|WRITE|MUTATION)/u.test(text);
}

function canExecuteMutation(text) {
  return /runLinkedDbQuery\s*\(|runQuery\s*\(|supabase\s+db\s+query|createClient\s*\(|\.from\s*\(|\binvoke\s*\(|\/functions\/v1\//u.test(text);
}

function severityFor(rel, text, rule) {
  if (rule.alwaysBlocking) return 'blocking';
  if (rule.privilegeOnly) return 'review';
  if (rel.startsWith('supabase/migrations/') || rel.startsWith('supabase/functions/')) return 'review';
  if (rel.startsWith('scripts/ops/')) return hasExplicitApplyGuard(text) ? 'review' : 'blocking';
  if (rel.startsWith('scripts/qa/')) {
    return hasExplicitApplyGuard(text) || hasQaMutationOptIn(text) || hasGuardedQaCleanup(text) ? 'review' : 'blocking';
  }
  if (rel.startsWith('scripts/integrations/') || rel.startsWith('scripts/ingest/')) return 'review';
  return 'blocking';
}

function analyzeText(rel, text, guardText = text) {
  const findings = [];
  const executable = canExecuteMutation(guardText);
  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    const match = rule.regex.exec(text);
    if (!match) continue;
    const severity = rule.privilegeOnly || rule.alwaysBlocking || executable
      ? severityFor(rel, guardText, rule)
      : 'review';
    findings.push({
      file: rel,
      line: lineNumber(text, match.index),
      pattern: rule.key,
      severity,
    });
  }
  const mutationDetected = findings.some((finding) => !['recursive-delete', 'service-role'].includes(finding.pattern));
  if (executable && mutationDetected && rel.startsWith('scripts/ops/') && !hasExplicitApplyGuard(guardText)) {
    findings.push({ file: rel, line: 1, pattern: 'default-apply-or-missing-apply-guard', severity: 'blocking' });
  }
  if (executable && mutationDetected && rel.startsWith('scripts/qa/')
    && !hasExplicitApplyGuard(guardText) && !hasQaMutationOptIn(guardText) && !hasGuardedQaCleanup(guardText)) {
    findings.push({ file: rel, line: 1, pattern: 'unguarded-qa-mutation', severity: 'blocking' });
  }
  return findings;
}

function auditBaseRef() {
  if (process.env.DANGEROUS_AUDIT_BASE) return process.env.DANGEROUS_AUDIT_BASE;
  if (process.env.GITHUB_ACTIONS === 'true') {
    const eventBefore = String(process.env.GITHUB_EVENT_BEFORE || '').trim();
    if (eventBefore && !/^0+$/u.test(eventBefore)) return eventBefore;
    return 'HEAD^';
  }
  return 'HEAD';
}

function changedAdditions(baseRef) {
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '--unified=0', '--no-color', baseRef, '--'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`Unable to read changed lines from ${baseRef}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const additions = new Map();
  let rel = '';
  for (const line of diff.split(/\r?\n/u)) {
    if (line.startsWith('+++ b/')) {
      rel = line.slice(6).replace(/\\/gu, '/');
      continue;
    }
    if (!rel || !line.startsWith('+') || line.startsWith('+++')) continue;
    additions.set(rel, `${additions.get(rel) || ''}${line.slice(1)}\n`);
  }
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
  for (const rel of untracked) {
    const full = path.resolve(ROOT, rel);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || !SCANNED_EXT.has(path.extname(full))) continue;
    additions.set(rel.replace(/\\/gu, '/'), fs.readFileSync(full, 'utf8'));
  }
  return additions;
}

function runSelfTest() {
  const fixtures = [
    {
      name: 'unguarded ops mutation blocks',
      rel: 'scripts/ops/unsafe.cjs',
      text: "invoke(url, key, token, 'records/cleanup', { dry_run: false });",
      expectBlocking: true,
    },
    {
      name: 'explicit apply defaults to dry run',
      rel: 'scripts/ops/safe.cjs',
      text: "function mode(args) { const apply = args.includes('--apply'); const dryRun = !apply; return { apply, dryRun }; } invoke(url, key, token, 'records/cleanup', { dry_run: mode(process.argv).dryRun });",
      expectBlocking: false,
    },
    {
      name: 'read-only qa invoke does not require mutation opt-in',
      rel: 'scripts/qa/readback.cjs',
      text: "invoke(url, key, token, 'records/list', {});",
      expectBlocking: false,
    },
    {
      name: 'qa finally cleanup is reviewed',
      rel: 'scripts/qa/probe.cjs',
      text: "try { runLinkedDbQuery('insert into public.t values (1)'); } finally { runLinkedDbQuery('delete from public.t where qa_probe = true', 'cleanup'); }",
      expectBlocking: false,
    },
    {
      name: 'drop cascade always blocks',
      rel: 'supabase/migrations/example.sql',
      text: 'drop table if exists public.example cascade;',
      expectBlocking: true,
    },
  ];
  const results = fixtures.map((fixture) => {
    const findings = analyzeText(fixture.rel, fixture.text);
    const blocking = findings.some((finding) => finding.severity === 'blocking');
    return { name: fixture.name, ok: blocking === fixture.expectBlocking, findings };
  });
  const ok = results.every((result) => result.ok);
  console.log(JSON.stringify({ ok, results }, null, 2));
  if (!ok) process.exitCode = 1;
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  const findings = [];
  const fullScan = process.argv.includes('--full');
  const baseRef = auditBaseRef();
  const additions = fullScan ? null : changedAdditions(baseRef);
  for (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file).replace(/\\/gu, '/');
    if (rel === SELF_PATH) continue;
    const fullText = fs.readFileSync(file, 'utf8');
    const auditText = fullScan ? fullText : additions.get(rel);
    if (!auditText) continue;
    findings.push(...analyzeText(rel, auditText, fullText));
  }
  const report = {
    ok: findings.every((finding) => finding.severity !== 'blocking'),
    generated_at: new Date().toISOString(),
    scope: fullScan ? 'full_repository' : 'changed_additions',
    base_ref: fullScan ? null : baseRef,
    blocking_count: findings.filter((finding) => finding.severity === 'blocking').length,
    review_count: findings.filter((finding) => finding.severity === 'review').length,
    findings,
  };
  let artifact = null;
  if (!process.argv.includes('--no-write-artifact')) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const latest = path.join(OUT_DIR, 'dangerous-script-audit-latest.json');
    fs.writeFileSync(latest, `${JSON.stringify(report, null, 2)}\n`);
    artifact = path.relative(ROOT, latest).replace(/\\/gu, '/');
  }
  console.log(JSON.stringify({ ok: report.ok, artifact, scope: report.scope, base_ref: report.base_ref, blocking: report.blocking_count, review: report.review_count, findings }, null, 2));
  if (!report.ok) process.exitCode = 1;
}
