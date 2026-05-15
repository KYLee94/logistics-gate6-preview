const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const uiPath = path.join(repoRoot, 'src/components/system/workspace/WorkspaceLogistics.jsx');
const edgePath = path.join(repoRoot, 'supabase/functions/ll-weekly-doc-ingest/index.ts');
const ui = fs.readFileSync(uiPath, 'utf8');
const edge = fs.readFileSync(edgePath, 'utf8');

const pad2 = (value) => String(value).padStart(2, '0');
const ymd = (date) => `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
const startOfMonday = (date) => {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = next.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setUTCDate(next.getUTCDate() + diff);
  return next;
};
const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
const buildRanges = (year, month) => {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lastLimit = new Date(Date.UTC(year, month, 6));
  const ranges = [];
  for (let start = startOfMonday(first); start <= lastLimit; start = addDays(start, 7)) {
    const ownership = addDays(start, 3);
    if (ownership.getUTCFullYear() !== year || ownership.getUTCMonth() !== month - 1) continue;
    ranges.push({
      week: ranges.length + 1,
      start: ymd(start),
      end: ymd(addDays(start, 6)),
    });
  }
  return ranges;
};

const april = buildRanges(2026, 4);
const may = buildRanges(2026, 5);
const aprilWeek5 = april.find((item) => item.week === 5);
const mayWeek1 = may.find((item) => item.week === 1);

const checks = [
  {
    id: 'frontend_week_algorithm_uses_thursday_ownership',
    pass: ui.includes('ownershipDate = addCalendarDays(startDate, 3)') && ui.includes('ownershipDate.getMonth() !== monthIndex'),
  },
  {
    id: 'edge_week_algorithm_uses_same_thursday_ownership',
    pass: edge.includes('ownershipDate.setUTCDate(start.getUTCDate() + 3)') && edge.includes('ownershipDate.getUTCMonth() === month - 1'),
  },
  {
    id: 'april_2026_week5_is_apr27_to_may03',
    pass: aprilWeek5?.start === '2026-04-27' && aprilWeek5?.end === '2026-05-03',
  },
  {
    id: 'may_2026_week1_is_may04_to_may10',
    pass: mayWeek1?.start === '2026-05-04' && mayWeek1?.end === '2026-05-10',
  },
  {
    id: 'april_week5_and_may_week1_do_not_overlap',
    pass: new Date(`${aprilWeek5?.end}T00:00:00Z`) < new Date(`${mayWeek1?.start}T00:00:00Z`),
  },
];

const result = {
  generatedAt: new Date().toISOString(),
  uiPath,
  edgePath,
  april,
  may,
  allPass: checks.every((check) => check.pass),
  checks,
};

const outDir = path.join(__dirname, 'weekly-week-mece-static-qa-20260515');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
if (!result.allPass) process.exit(1);
