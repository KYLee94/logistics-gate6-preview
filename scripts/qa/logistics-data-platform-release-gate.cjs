#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const packagePath = path.join(root, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const requiredPackageScripts = Object.freeze({
  lint: null,
  'check:edge': null,
  'build:preview': null,
  'qa:v2:release-gate': 'node scripts/qa/logistics-data-platform-release-gate.cjs',
});

const requiredPredeployParts = Object.freeze([
  'npm run qa:release-env',
  'npm run build:preview',
  'node scripts/qa/logistics-data-platform-preview-env-contract.cjs',
]);

const releaseSteps = Object.freeze([
  { id: 'simple-schema-contract', kind: 'node', target: 'tests/logistics-core-simple-schema-contract.test.cjs' },
  { id: 'simple-router-contract', kind: 'node', target: 'tests/logistics-simple-document-router-contract.test.cjs' },
  {
    id: 'document-contract',
    kind: 'node',
    target: 'src/features/logistics-data-platform/documentContract.test.cjs',
  },
  {
    id: 'document-integrity-contract',
    kind: 'node',
    target: 'tests/logistics-data-platform-document-integrity.test.cjs',
  },
  {
    id: 'rent-roll-taxonomy-audit-unit',
    kind: 'node',
    target: 'tests/logistics-rent-roll-taxonomy-audit.test.cjs',
  },
  {
    id: 'rent-roll-document-taxonomy-contract',
    kind: 'node',
    target: 'tests/logistics-rent-roll-document-taxonomy-contract.test.cjs',
  },
  {
    id: 'rent-roll-floor-audit-unit',
    kind: 'node',
    target: 'tests/logistics-rent-roll-floor-audit.test.cjs',
  },
  {
    id: 'rent-roll-floor-backfill-contract',
    kind: 'node',
    target: 'tests/logistics-rent-roll-floor-backfill-contract.test.cjs',
  },
  {
    id: 'rent-roll-goods-escalation-ui',
    kind: 'node',
    target: 'tests/logistics-rent-roll-goods-escalation-ui.test.cjs',
  },
  {
    id: 'home-numeric-input-contract',
    kind: 'node',
    target: 'tests/logistics-home-numeric-input-normalization-contract.test.cjs',
  },
  {
    id: 'home-422-diagnostic-contract',
    kind: 'node',
    target: 'tests/logistics-home-422-readonly-diagnostic.test.cjs',
  },
  {
    id: 'occupancy-expired-rent-contract',
    kind: 'node',
    target: 'tests/logistics-occupancy-expired-rent-guard-contract.test.cjs',
  },
  {
    id: 'occupancy-rent-roll-basis-contract',
    kind: 'node',
    target: 'tests/logistics-occupancy-rent-roll-basis-contract.test.cjs',
  },
  {
    id: 'occupancy-live-audit-unit',
    kind: 'node',
    target: 'tests/logistics-occupancy-live-audit.test.cjs',
  },
  {
    id: 'maturity-revision-contract',
    kind: 'node',
    target: 'tests/logistics-maturity-revision-fix-contract.test.cjs',
  },
  {
    id: 'fund-aum-tranche-noi-contract',
    kind: 'node',
    target: 'tests/logistics-fund-aum-tranche-noi-contract.test.cjs',
  },
  {
    id: 'home-fund-investment-presentation',
    kind: 'node',
    target: 'tests/logistics-home-fund-investment-presentation.test.cjs',
  },
  {
    id: 'home-fund-aum-live-audit-unit',
    kind: 'node',
    target: 'tests/logistics-home-fund-aum-live-audit.test.cjs',
  },
  {
    id: 'rent-roll-cost-addable-multiselect',
    kind: 'node',
    target: 'tests/logistics-rent-roll-cost-addable-multiselect.test.cjs',
  },
  {
    id: 'finance-presentation-hierarchy',
    kind: 'node',
    target: 'tests/logistics-finance-presentation-hierarchy.test.cjs',
  },
  {
    id: 'finance-custom-accounts',
    kind: 'node',
    target: 'tests/logistics-data-platform-finance-custom-accounts.test.cjs',
  },
  { id: 'db-contract', kind: 'node', target: 'scripts/qa/logistics-data-platform-db-contract.cjs' },
  { id: 'cutover-contract', kind: 'node', target: 'scripts/qa/logistics-data-platform-cutover-contract.cjs' },
  { id: 'api-contract', kind: 'node', target: 'scripts/qa/logistics-data-platform-api-contract.cjs' },
  { id: 'formula-contract', kind: 'node', target: 'scripts/qa/logistics-data-platform-formula-contract.cjs' },
  { id: 'finance-manual-input-contract', kind: 'node', target: 'scripts/qa/logistics-finance-manual-input-contract.cjs' },
  { id: 'rent-roll-template-contract', kind: 'node', target: 'scripts/qa/logistics-rent-roll-template-contract.cjs' },
  { id: 'frontend-contract', kind: 'node', target: 'scripts/qa/logistics-data-platform-frontend-contract.cjs' },
  { id: 'ux-v4-regression', kind: 'node', target: 'tests/logistics-data-platform-ux-v4.test.cjs' },
  { id: 'login-entry-v4-regression', kind: 'node', target: 'tests/logistics-data-platform-login-entry-v4.test.cjs' },
  {
    id: 'deeplink-browser-self-test',
    kind: 'node',
    target: 'scripts/qa/logistics-data-platform-deeplink-browser.cjs',
    args: ['--self-test'],
  },
  { id: 'release-env-preflight', kind: 'node', target: 'scripts/qa/logistics-release-env-preflight.cjs' },
  { id: 'lint', kind: 'npm', target: 'lint' },
  { id: 'edge-type-check', kind: 'npm', target: 'check:edge' },
  { id: 'preview-build', kind: 'npm', target: 'build:preview', dependsOn: ['release-env-preflight'] },
  {
    id: 'preview-env-contract',
    kind: 'node',
    target: 'scripts/qa/logistics-data-platform-preview-env-contract.cjs',
    dependsOn: ['preview-build'],
  },
  {
    id: 'deeplink-browser-local',
    kind: 'node',
    target: 'scripts/qa/logistics-data-platform-deeplink-browser.cjs',
    args: [],
    dependsOn: ['preview-env-contract'],
  },
]);

const requiredLocalBrowserSteps = Object.freeze([
  {
    id: 'deeplink-browser-self-test',
    kind: 'node',
    target: 'scripts/qa/logistics-data-platform-deeplink-browser.cjs',
    args: ['--self-test'],
  },
  {
    id: 'deeplink-browser-local',
    kind: 'node',
    target: 'scripts/qa/logistics-data-platform-deeplink-browser.cjs',
    args: [],
    dependsOn: ['preview-env-contract'],
  },
]);

function normalizeCommand(command) {
  return String(command || '').trim().replace(/\s+/gu, ' ');
}

function normalizeArgs(args) {
  return Array.isArray(args) ? args.map((arg) => String(arg)) : [];
}

function validateReleaseContract() {
  const failures = [];
  const scripts = packageJson.scripts || {};

  for (const [scriptName, expectedCommand] of Object.entries(requiredPackageScripts)) {
    if (!normalizeCommand(scripts[scriptName])) {
      failures.push(`MISSING_PACKAGE_SCRIPT:${scriptName}`);
      continue;
    }
    if (expectedCommand && normalizeCommand(scripts[scriptName]) !== normalizeCommand(expectedCommand)) {
      failures.push(`INVALID_PACKAGE_SCRIPT:${scriptName}`);
    }
  }

  const predeploy = normalizeCommand(scripts.predeploy);
  for (const requiredPart of requiredPredeployParts) {
    if (!predeploy.includes(requiredPart)) failures.push(`INVALID_PREDEPLOY_MISSING:${requiredPart}`);
  }

  for (const step of releaseSteps) {
    if (step.kind !== 'node') continue;
    if (!fs.existsSync(path.join(root, step.target))) {
      failures.push(`MISSING_RELEASE_STEP:${step.id}:${step.target}`);
    }
  }

  for (const expectedStep of requiredLocalBrowserSteps) {
    const actualStep = releaseSteps.find((step) => step.id === expectedStep.id);
    if (!actualStep) {
      failures.push(`MISSING_LOCAL_BROWSER_STEP:${expectedStep.id}`);
      continue;
    }
    if (
      actualStep.kind !== expectedStep.kind
      || actualStep.target !== expectedStep.target
      || JSON.stringify(normalizeArgs(actualStep.args)) !== JSON.stringify(expectedStep.args)
      || JSON.stringify(normalizeArgs(actualStep.dependsOn)) !== JSON.stringify(normalizeArgs(expectedStep.dependsOn))
    ) {
      failures.push(`INVALID_LOCAL_BROWSER_STEP:${expectedStep.id}`);
    }
  }

  const previewBuildIndex = releaseSteps.findIndex((step) => step.id === 'preview-build');
  const previewEnvIndex = releaseSteps.findIndex((step) => step.id === 'preview-env-contract');
  const localBrowserIndex = releaseSteps.findIndex((step) => step.id === 'deeplink-browser-local');
  if (previewEnvIndex !== -1 && previewEnvIndex <= previewBuildIndex) {
    failures.push('INVALID_PREVIEW_ENV_ORDER:preview-env-contract');
  }
  if (localBrowserIndex !== -1 && localBrowserIndex <= previewEnvIndex) {
    failures.push('INVALID_LOCAL_BROWSER_ORDER:deeplink-browser-local');
  }

  const forbiddenPredeployArgs = new Set(['--base-url', '--require-authenticated']);
  for (const step of releaseSteps.filter((candidate) => (
    requiredLocalBrowserSteps.some((requiredStep) => requiredStep.id === candidate.id)
  ))) {
    for (const arg of normalizeArgs(step.args)) {
      if (forbiddenPredeployArgs.has(arg)) {
        failures.push(`FORBIDDEN_PREDEPLOY_BROWSER_ARG:${step.id}:${arg}`);
      }
    }
  }

  return failures;
}

function emit(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const contractFailures = validateReleaseContract();
if (contractFailures.length) {
  emit({
    ok: false,
    mode: 'release-gate-contract',
    operating_network_used: false,
    database_write_used: false,
    failures: contractFailures,
  });
  process.exit(1);
}

if (process.argv.includes('--contract-only')) {
  emit({
    ok: true,
    mode: 'release-gate-contract',
    operating_network_used: false,
    database_write_used: false,
    required_package_scripts: Object.keys(requiredPackageScripts),
    release_steps: releaseSteps.map((step) => step.id),
  });
  process.exit(0);
}

const results = [];

for (const step of releaseSteps) {
  const failedDependencies = normalizeArgs(step.dependsOn).filter((dependencyId) => (
    !results.some((result) => result.id === dependencyId && result.ok)
  ));
  if (failedDependencies.length) {
    results.push({
      id: step.id,
      ok: false,
      exit_code: null,
      elapsed_ms: 0,
      skipped: true,
      blocked_by: failedDependencies,
    });
    process.stdout.write(`\n[qa:v2:release-gate] BLOCKED ${step.id} (dependency failed: ${failedDependencies.join(', ')})\n`);
    continue;
  }

  const npmExecPath = process.env.npm_execpath;
  const useNpmCli = step.kind === 'npm' && npmExecPath && fs.existsSync(npmExecPath);
  const command = step.kind === 'node' || useNpmCli
    ? process.execPath
    : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const args = step.kind === 'node'
    ? [step.target, ...normalizeArgs(step.args)]
    : (useNpmCli ? [npmExecPath, 'run', step.target] : ['run', step.target]);
  const startedAt = Date.now();

  process.stdout.write(`\n[qa:v2:release-gate] START ${step.id}\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      CI: process.env.CI || '1',
      NO_UPDATE_NOTIFIER: '1',
    },
    stdio: 'inherit',
    shell: false,
  });

  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  const elapsedMs = Date.now() - startedAt;
  results.push({ id: step.id, ok: exitCode === 0, exit_code: exitCode, elapsed_ms: elapsedMs });
  process.stdout.write(`[qa:v2:release-gate] ${exitCode === 0 ? 'PASS' : 'FAIL'} ${step.id} (${elapsedMs}ms)\n`);

  if (result.error) {
    process.stderr.write(`[qa:v2:release-gate] ${step.id}: ${result.error.message}\n`);
  }
}

const failedSteps = results.filter((result) => !result.ok);
emit({
  ok: failedSteps.length === 0,
  mode: 'local-release-gate',
  operating_network_used: false,
  database_write_used: false,
  results,
  failed_steps: failedSteps.map((result) => result.id),
});

process.exit(failedSteps.length === 0 ? 0 : 1);
