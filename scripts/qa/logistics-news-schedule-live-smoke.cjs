#!/usr/bin/env node
/* eslint-disable no-console */

const REPOSITORY = 'KYLee94/logistics-gate6-preview';
const WORKFLOW_PATH = '.github/workflows/logistics-news-daily.yml';

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

async function github(path) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'logistics-gate6-news-schedule-qa',
    'x-github-api-version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}${path}`, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GitHub API ${path} failed (${response.status}): ${body.message || 'unknown error'}`);
  return body;
}

async function main() {
  const maxAgeHours = Math.max(1, Number(argValue('--max-age-hours', '48')));
  const repository = await github('');
  const workflowList = await github('/actions/workflows?per_page=100');
  const workflow = (workflowList.workflows || []).find((item) => item.path === WORKFLOW_PATH) || null;
  const runList = workflow ? await github(`/actions/workflows/${workflow.id}/runs?per_page=10`) : { workflow_runs: [] };
  const latestRun = (runList.workflow_runs || [])[0] || null;
  const latestCompletedAt = latestRun?.updated_at ? Date.parse(latestRun.updated_at) : Number.NaN;
  const latestAgeHours = Number.isFinite(latestCompletedAt) ? (Date.now() - latestCompletedAt) / 3_600_000 : null;
  const checks = {
    default_branch_is_main: repository.default_branch === 'main',
    workflow_is_registered: Boolean(workflow),
    workflow_is_active: workflow?.state === 'active',
    latest_run_is_success: latestRun?.status === 'completed' && latestRun?.conclusion === 'success',
    latest_run_is_recent: latestAgeHours !== null && latestAgeHours >= 0 && latestAgeHours <= maxAgeHours,
  };
  const report = {
    ok: Object.values(checks).every(Boolean),
    repository: REPOSITORY,
    workflow_path: WORKFLOW_PATH,
    default_branch: repository.default_branch || null,
    workflow: workflow ? { id: workflow.id, name: workflow.name, state: workflow.state } : null,
    latest_run: latestRun ? {
      id: latestRun.id,
      event: latestRun.event,
      status: latestRun.status,
      conclusion: latestRun.conclusion,
      created_at: latestRun.created_at,
      updated_at: latestRun.updated_at,
      html_url: latestRun.html_url,
      age_hours: Math.round(latestAgeHours * 100) / 100,
    } : null,
    max_age_hours: maxAgeHours,
    checks,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
