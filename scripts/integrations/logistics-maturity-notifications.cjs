#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(filePath) {
  const fs = require('fs');
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  });
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const ALWAYS_RECIPIENT_NAMES = ['이관용', '전기영', '이시정', '이승훈', '우형석', '김지현', '이현호'];
const ALERT_RULES = [
  { label: '1개월 전', months: 1, leadDays: 30 },
  { label: '2주 전', days: 14, leadDays: 14 },
  { label: '1주 전', days: 7, leadDays: 7 },
  { label: '1일 전', days: 1, leadDays: 1 },
];

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    date: (argv.find((arg) => arg.startsWith('--date=')) || '').split('=').slice(1).join('=') || '',
  };
}

function requiredEnv(name) {
  const value = process.env[name] || (name === 'SUPABASE_URL' ? process.env.VITE_SUPABASE_URL : '');
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function kstTodayOverride(value = '') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function dateOnly(value) {
  const source = String(value || '');
  if (!source) return '';
  const date = new Date(source);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  const match = source.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function addMonths(dateText, diff) {
  const [year, month, day] = dateText.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(Date.UTC(year, month - 1 + diff, day));
  const expectedMonth = month - 1 + diff;
  if (date.getUTCMonth() !== ((expectedMonth % 12) + 12) % 12) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function addDays(dateText, diff) {
  const [year, month, day] = dateText.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(Date.UTC(year, month - 1, day + diff));
  return date.toISOString().slice(0, 10);
}

function triggerDateForRule(dueDate, rule) {
  if (Number.isFinite(rule.months)) return addMonths(dueDate, -rule.months);
  if (Number.isFinite(rule.days)) return addDays(dueDate, -rule.days);
  return '';
}

function compact(value) {
  return String(value || '').trim();
}

function lower(value) {
  return compact(value).toLowerCase();
}

function formatKrw(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  if (parsed >= 100000000) return `${(parsed / 100000000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억원`;
  return `${parsed.toLocaleString('ko-KR')}원`;
}

function formatRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return `${normalized.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`;
}

function recipientFrom(row = {}) {
  const email = lower(row.email || row.permission_email || row.user_email || row.current_manager_email);
  if (!email) return null;
  return {
    recipient_email: email,
    recipient_name: compact(row.staff_name || row.name || row.current_manager_name || row.email || email),
  };
}

function dedupeRecipients(rows = []) {
  const map = new Map();
  rows.filter(Boolean).forEach((row) => {
    if (!row.recipient_email) return;
    if (!map.has(row.recipient_email)) map.set(row.recipient_email, row);
  });
  return [...map.values()];
}

async function readAll(client, table, select = '*', limit = 5000) {
  const { data, error } = await client.from(table).select(select).limit(limit);
  if (error) {
    if (error.code === '42P01' || /does not exist|not found/i.test(error.message || '')) return [];
    throw new Error(`${table} read failed: ${error.message}`);
  }
  return data || [];
}

function recipientsForAsset(assetId, assetById, permissionRows) {
  const asset = assetById.get(assetId) || {};
  const fixedRecipients = permissionRows
    .filter((row) => ALWAYS_RECIPIENT_NAMES.includes(compact(row.staff_name || row.name)))
    .map(recipientFrom);
  const managerRecipient = recipientFrom({
    email: asset.current_manager_email || asset.manager_email || asset.asset_manager_email,
    staff_name: asset.current_manager_name || asset.manager_name || asset.asset_manager_name,
  });
  return dedupeRecipients([managerRecipient, ...fixedRecipients]);
}

function dueRulesForToday(dueDate, today) {
  return ALERT_RULES.filter((rule) => triggerDateForRule(dueDate, rule) === today);
}

function pushNotificationTask(tasks, {
  notificationType,
  dedupePrefix,
  targetId,
  dueDate,
  rules,
  assetId,
  fundId = null,
  leaseId = null,
  leaseSpaceId = null,
  fundTrancheId = null,
  titlePrefix,
  body,
  payload = {},
  recipients,
}) {
  if (!dueDate || !rules.length || !recipients.length) return;
  for (const rule of rules) {
    tasks.push({
      notification: {
        notification_type: notificationType,
        dedupe_key: `${dedupePrefix}:${compact(targetId)}:${dueDate}:${rule.leadDays}`,
        asset_id: assetId || null,
        fund_id: fundId || null,
        lease_id: leaseId || null,
        lease_space_id: leaseSpaceId || null,
        fund_tranche_id: fundTrancheId || null,
        title: `${titlePrefix} ${rule.label}`,
        body,
        due_date: dueDate,
        lead_days: rule.leadDays,
        payload: { ...payload, alert_label: rule.label },
      },
      recipients,
    });
  }
}

async function upsertNotification(client, notification, recipients, dryRun) {
  const inboxRows = recipients.map((recipient) => ({
    ...notification,
    dedupe_key: `${notification.dedupe_key}:${lower(recipient.recipient_email)}`,
    recipient_email: lower(recipient.recipient_email),
    recipient_name: recipient.recipient_name || null,
    delivery_status: 'unread',
    read_at: null,
    dismissed_at: null,
    notified_at: new Date().toISOString(),
    payload: undefined,
  }));
  if (dryRun) return { notifications: inboxRows };
  const { data, error } = await client
    .from('ll_notifications')
    .upsert(inboxRows, { onConflict: 'dedupe_key' })
    .select('notification_id,recipient_email');
  if (error) throw new Error(`notification upsert failed: ${error.message}`);
  return { notification_ids: (data || []).map((row) => row.notification_id), deliveries: inboxRows.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const today = kstTodayOverride(args.date);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (args.dryRun && (!supabaseUrl || !serviceRoleKey)) {
    console.log(JSON.stringify({
      ok: true,
      dry_run: true,
      skipped: true,
      reason: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured locally.',
      today,
      generated_notifications: 0,
    }, null, 2));
    return;
  }
  const supabase = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  const [assets, leases, leaseSpaces, rentHistory, tranches, funds, fundLinks, operatingCosts, permissions] = await Promise.all([
    readAll(supabase, 'll_assets'),
    readAll(supabase, 'll_leases'),
    readAll(supabase, 'll_lease_spaces'),
    readAll(supabase, 'll_rent_history'),
    readAll(supabase, 'll_fund_capital_tranches'),
    readAll(supabase, 'll_funds'),
    readAll(supabase, 'll_fund_asset_links'),
    readAll(supabase, 'll_asset_operating_costs'),
    readAll(supabase, 'll_user_permissions'),
  ]);

  const assetById = new Map(assets.map((asset) => [compact(asset.asset_id), asset]));
  const leaseSpaceById = new Map(leaseSpaces.map((space) => [compact(space.lease_space_id), space]));
  const leaseSpacesByLease = new Map();
  leaseSpaces.forEach((space) => {
    const leaseId = compact(space.lease_id);
    if (!leaseId) return;
    if (!leaseSpacesByLease.has(leaseId)) leaseSpacesByLease.set(leaseId, []);
    leaseSpacesByLease.get(leaseId).push(space);
  });
  const fundLinksByFund = new Map();
  fundLinks.forEach((link) => {
    const fundId = compact(link.fund_id);
    if (!fundId) return;
    if (!fundLinksByFund.has(fundId)) fundLinksByFund.set(fundId, []);
    fundLinksByFund.get(fundId).push(link);
  });
  const latestRentHistoryBySpace = new Map();
  rentHistory.forEach((row) => {
    const spaceId = compact(row.lease_space_id);
    if (!spaceId) return;
    const dueDate = dateOnly(row.period_end || row.effective_end_date || row.end_date || row.current_end_date);
    if (!dueDate) return;
    const previous = latestRentHistoryBySpace.get(spaceId);
    const previousDate = previous ? dateOnly(previous.period_end || previous.effective_end_date || previous.end_date || previous.current_end_date) : '';
    if (!previous || dueDate > previousDate) latestRentHistoryBySpace.set(spaceId, row);
  });

  const tasks = [];
  for (const lease of leases) {
    const spaces = leaseSpacesByLease.get(compact(lease.lease_id)) || [];
    const assetId = compact(lease.asset_id || spaces[0]?.asset_id);
    const asset = assetById.get(assetId) || {};
    const recipients = recipientsForAsset(assetId, assetById, permissions);
    if (!recipients.length) continue;
    const assetName = compact(asset.asset_name || lease.asset_name || spaces[0]?.asset_name || '자산');
    const tenantName = compact(lease.tenant_name || lease.tenant_master_name || lease.company_name || '임차인');
    const leaseId = compact(lease.lease_id);
    const firstEndDate = dateOnly(lease.first_end_date);
    const currentEndDate = dateOnly(lease.current_end_date || lease.end_date || lease.lease_end_date || lease.expiry_date || spaces[0]?.current_end_date);
    const nextEscalationDate = dateOnly(lease.next_escalation_date);
    pushNotificationTask(tasks, {
      notificationType: 'lease_maturity',
      dedupePrefix: 'lease_first_maturity',
      targetId: leaseId,
      dueDate: firstEndDate,
      rules: dueRulesForToday(firstEndDate, today),
      assetId,
      leaseId,
      leaseSpaceId: compact(spaces[0]?.lease_space_id),
      titlePrefix: '최초 계약만기',
      body: `${assetName}의 ${tenantName} 최초 계약만기일이 ${firstEndDate}입니다. Data Management에서 계약 상태와 최신 계약 조건을 확인해 주세요.`,
      payload: { asset_name: assetName, tenant_name: tenantName, date_field: 'first_end_date', date_label: '최초 계약만기일' },
      recipients,
    });
    pushNotificationTask(tasks, {
      notificationType: 'lease_maturity',
      dedupePrefix: 'lease_current_maturity',
      targetId: leaseId,
      dueDate: currentEndDate,
      rules: dueRulesForToday(currentEndDate, today),
      assetId,
      leaseId,
      leaseSpaceId: compact(spaces[0]?.lease_space_id),
      titlePrefix: '현재 계약만기',
      body: `${assetName}의 ${tenantName} 현재 계약만기일이 ${currentEndDate}입니다. 만기 전에 계약 연장, 종료, 임대조건 수정 여부를 확인해 주세요.`,
      payload: { asset_name: assetName, tenant_name: tenantName, date_field: 'current_end_date', date_label: '현재 계약만기일' },
      recipients,
    });
    pushNotificationTask(tasks, {
      notificationType: 'data_update',
      dedupePrefix: 'lease_next_escalation',
      targetId: leaseId,
      dueDate: nextEscalationDate,
      rules: dueRulesForToday(nextEscalationDate, today),
      assetId,
      leaseId,
      leaseSpaceId: compact(spaces[0]?.lease_space_id),
      titlePrefix: '임대료·관리비 인상일',
      body: `${assetName}의 ${tenantName} 차기 인상일이 ${nextEscalationDate}입니다. 임대료·관리비와 인상률을 Data Management에서 확인해 주세요.`,
      payload: { asset_name: assetName, tenant_name: tenantName, date_field: 'next_escalation_date', date_label: '차기 인상일' },
      recipients,
    });
  }

  for (const [spaceId, row] of latestRentHistoryBySpace.entries()) {
    const dueDate = dateOnly(row.period_end || row.effective_end_date || row.end_date || row.current_end_date);
    const rules = dueRulesForToday(dueDate, today);
    if (!rules.length) continue;
    const space = leaseSpaceById.get(spaceId) || {};
    const assetId = compact(row.asset_id || space.asset_id);
    const asset = assetById.get(assetId) || {};
    const recipients = recipientsForAsset(assetId, assetById, permissions);
    if (!recipients.length) continue;
    const assetName = compact(asset.asset_name || row.asset_name || space.asset_name || '자산');
    const tenantName = compact(row.tenant_master_name || space.tenant_master_name || row.tenant_name || '임차인');
    pushNotificationTask(tasks, {
      notificationType: 'data_update',
      dedupePrefix: 'rent_history_period_end',
      targetId: row.rent_history_id || row.id || spaceId,
      dueDate,
      rules,
      assetId,
      leaseId: compact(row.lease_id || space.lease_id),
      leaseSpaceId: spaceId,
      titlePrefix: '임대료·관리비 기준 만기',
      body: `${assetName}의 ${tenantName} 임대료·관리비 기준 만기일이 ${dueDate}입니다. 최신 임대료와 관리비 이력을 확인해 주세요.`,
      payload: { asset_name: assetName, tenant_name: tenantName, date_field: 'rent_history_period_end', date_label: '임대료·관리비 기준 만기일' },
      recipients,
    });
  }

  for (const fund of funds) {
    const dueDate = dateOnly(fund.maturity_date || fund.fund_maturity_date);
    const rules = dueRulesForToday(dueDate, today);
    if (!rules.length) continue;
    const fundId = compact(fund.fund_id || fund.id);
    const links = fundLinksByFund.get(fundId) || [];
    const recipients = dedupeRecipients(
      (links.length ? links : [{ asset_id: '' }]).flatMap((link) => recipientsForAsset(compact(link.asset_id), assetById, permissions)),
    );
    if (!recipients.length) continue;
    const primaryAssetId = compact(links[0]?.asset_id);
    const assetNames = links.map((link) => compact(assetById.get(compact(link.asset_id))?.asset_name || link.asset_name)).filter(Boolean);
    pushNotificationTask(tasks, {
      notificationType: 'data_update',
      dedupePrefix: 'fund_maturity',
      targetId: fundId,
      dueDate,
      rules,
      assetId: primaryAssetId,
      fundId,
      titlePrefix: '펀드 만기',
      body: `${compact(fund.fund_name || fund.short_name || fund.fund_code || '펀드')} 만기일이 ${dueDate}입니다.${assetNames.length ? ` 관련 자산: ${assetNames.slice(0, 3).join(', ')}${assetNames.length > 3 ? ' 외' : ''}.` : ''}`,
      payload: {
        fund_name: compact(fund.fund_name || fund.short_name || fund.fund_code),
        asset_names: assetNames,
        date_field: 'maturity_date',
        date_label: '펀드 만기일',
      },
      recipients,
    });
  }

  for (const cost of operatingCosts) {
    const dueDate = dateOnly(cost.period_end || cost.effective_end_date || cost.end_date);
    const rules = dueRulesForToday(dueDate, today);
    if (!rules.length) continue;
    const assetId = compact(cost.asset_id);
    const asset = assetById.get(assetId) || {};
    const recipients = recipientsForAsset(assetId, assetById, permissions);
    if (!recipients.length) continue;
    const assetName = compact(asset.asset_name || cost.asset_name || '자산');
    pushNotificationTask(tasks, {
      notificationType: 'data_update',
      dedupePrefix: 'asset_operating_cost_period_end',
      targetId: cost.operating_cost_id || cost.id || `${assetId}:${dueDate}`,
      dueDate,
      rules,
      assetId,
      titlePrefix: '운영비용 기준 만기',
      body: `${assetName} 운영비용 기준기간 종료일이 ${dueDate}입니다. PM/FM, 보험료, Utility 등 최신 비용 값을 확인해 주세요.`,
      payload: {
        asset_name: assetName,
        date_field: 'period_end',
        date_label: '운영비용 기준기간 종료일',
        cost_type: compact(cost.cost_type || cost.category),
      },
      recipients,
    });
  }

  for (const tranche of tranches) {
    if (compact(tranche.tranche_type) !== 'loan') continue;
    const dueDate = dateOnly(tranche.maturity_date || tranche.loan_maturity_date);
    if (!dueDate) continue;
    const rules = dueRulesForToday(dueDate, today);
    if (!rules.length) continue;
    const links = fundLinksByFund.get(compact(tranche.fund_id)) || [];
    const assetId = compact(tranche.asset_id || links[0]?.asset_id);
    const asset = assetById.get(assetId) || {};
    const recipients = recipientsForAsset(assetId, assetById, permissions);
    if (!recipients.length) continue;
    for (const rule of rules) {
      const assetName = compact(asset.asset_name || links[0]?.asset_name || '자산');
      const amount = formatKrw(tranche.committed_amount_krw || tranche.drawn_amount_krw);
      const rate = formatRate(tranche.interest_rate || tranche.loan_rate || tranche.all_in_rate);
      tasks.push({
        notification: {
          notification_type: 'loan_maturity',
          dedupe_key: `loan_maturity:${compact(tranche.id)}:${dueDate}:${rule.leadDays}`,
          asset_id: assetId || null,
          fund_id: compact(tranche.fund_id) || null,
          fund_tranche_id: compact(tranche.id) || null,
          title: `대출 만기 ${rule.label}`,
          body: `${assetName} 대출 만기일이 ${dueDate}입니다.${amount ? ` 약정금액 ${amount}.` : ''}${rate ? ` 금리 ${rate}.` : ''}`,
          due_date: dueDate,
          lead_days: rule.leadDays,
          payload: {
            asset_name: assetName,
            fund_id: compact(tranche.fund_id),
            alert_label: rule.label,
            amount_krw: tranche.committed_amount_krw || tranche.drawn_amount_krw || null,
            interest_rate: tranche.interest_rate || tranche.loan_rate || tranche.all_in_rate || null,
          },
        },
        recipients,
      });
    }
  }

  const results = [];
  for (const task of tasks) {
    results.push(await upsertNotification(supabase, task.notification, task.recipients, args.dryRun));
  }

  console.log(JSON.stringify({
    ok: true,
    dry_run: args.dryRun,
    today,
    candidate_notifications: tasks.length,
    written_notifications: args.dryRun ? 0 : results.length,
    recipient_deliveries: tasks.reduce((sum, task) => sum + task.recipients.length, 0),
    preview: tasks.slice(0, 10),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
