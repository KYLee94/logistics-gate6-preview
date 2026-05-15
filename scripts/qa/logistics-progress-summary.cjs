const fs = require('fs');
const path = require('path');

const trackerPath = path.resolve(
  process.cwd(),
  'qa-artifacts',
  'logistics-gate6',
  'gate6-progress-tracker-20260515.json',
);

const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));

const stageRows = tracker.stages.map((stage) => {
  const completed = stage.items.filter((item) => item.status === 'done').length;
  const total = stage.items.length;
  return {
    stage: stage.stage,
    area: stage.area,
    completed,
    total,
    rate: total ? (completed / total) * 100 : 0,
  };
});

const completed = stageRows.reduce((sum, row) => sum + row.completed, 0);
const total = stageRows.reduce((sum, row) => sum + row.total, 0);
const rate = total ? (completed / total) * 100 : 0;

console.log(`# Gate 6 progress summary`);
console.log(`Overall: ${completed} / ${total} (${rate.toFixed(1)}%)`);
console.log('');
console.log('| Stage | Area | Done/Total | Rate |');
console.log('|---:|---|---:|---:|');
for (const row of stageRows) {
  console.log(`| ${row.stage} | ${row.area} | ${row.completed} / ${row.total} | ${row.rate.toFixed(1)}% |`);
}
