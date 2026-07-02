const { spawnSync } = require('child_process');

const BASE_URL = process.env.LOGISTICS_LIVE_URL || 'https://kylee94.github.io/logistics-gate6-preview/';

const commands = [
  ['npm', ['run', 'qa:full-app:loading-stability', '--', '--base-url', BASE_URL]],
  ['npm', ['run', 'qa:market-data:browser', '--', '--base-url', BASE_URL]],
  ['npm', ['run', 'qa:data-management:live-browser', '--', '--base-url', BASE_URL]],
  ['npm', ['run', 'qa:logout:browser', '--', '--base-url', BASE_URL]],
];

const results = [];
for (const [cmd, args] of commands) {
  const startedAt = Date.now();
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  results.push({
    command: `${cmd} ${args.join(' ')}`,
    status: result.status,
    elapsed_ms: Date.now() - startedAt,
  });
  if (result.status !== 0) break;
}

const ok = results.length === commands.length && results.every((row) => row.status === 0);
console.log(JSON.stringify({ ok, base_url: BASE_URL, results }, null, 2));
if (!ok) process.exitCode = 1;
