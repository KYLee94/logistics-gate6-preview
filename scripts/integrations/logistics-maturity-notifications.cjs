#!/usr/bin/env node
/* eslint-disable no-console */

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
  { label: '6개월 전', months: 6, leadDays: 180 },
  { label: '3개월 전', months: 3, leadDays: 90 },
  { label: '1개월 전', months: 1, leadDays: 30 },
  { label: '만기일', months: 0, leadDays: 0 },
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
  return ALERT_RULES.filter((rule) => addMonths(dueDate, -rule.months) === today);
}

async function upsertNotification(client, notification, recipients, dryRun) {
  if (dryRun) return { notification, recipients };
  const { data, error } = await client
    .from('ll_notifications')
    .upsert(notification, { onConflict: 'dedupe_key' })
    .select('notification_id')
    .single();
  if (error) throw new Error(`notification upsert failed: ${error.message}`);
  const notificationId = data.notification_id;
  const deliveries = recipients.map((recipient) => ({
    notification_id: notificationId,
    recipient_email: recipient.recipient_email,
    recipient_name: recipient.recipient_name,
    delivery_status: 'unread',
    dismissed_at: null,
    read_at: null,
  }));
  if (deliveries.length) {
    const deliveryResult = await client
      .from('ll_notification_deliveries')
      .upsert(deliveries, { onConflict: 'notification_id,recipient_email' });
    if (deliveryResult.error) throw new Error(`notification delivery upsert failed: ${deliveryResult.error.message}`);
  }
  return { notification_id: notificationId, deliveries: deliveries.length };
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

  const [assets, leases, leaseSpaces, tranches, fundLinks, permissions] = await Promise.all([
    readAll(supabase, 'll_assets'),
    readAll(supabase, 'll_leases'),
    readAll(supabase, 'll_lease_spaces'),
    readAll(supabase, 'll_fund_capital_tranches'),
    readAll(supabase, 'll_fund_asset_links'),
    readAll(supabase, 'll_user_permissions'),
  ]);

  const assetById = new Map(assets.map((asset) => [compact(asset.asset_id), asset]));
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

  const tasks = [];
  for (const lease of leases) {
    const dueDate = dateOnly(lease.current_end_date || lease.end_date || lease.lease_end_date || lease.expiry_date);
    if (!dueDate) continue;
    const rules = dueRulesForToday(dueDate, today);
    if (!rules.length) continue;
    const spaces = leaseSpacesByLease.get(compact(lease.lease_id)) || [];
    const assetId = compact(lease.asset_id || spaces[0]?.asset_id);
    const asset = assetById.get(assetId) || {};
    const recipients = recipientsForAsset(assetId, assetById, permissions);
    if (!recipients.length) continue;
    for (const rule of rules) {
      const assetName = compact(asset.asset_name || lease.asset_name || spaces[0]?.asset_name || '자산');
      const tenantName = compact(lease.tenant_name || lease.tenant_master_name || lease.company_name || '임차인');
      tasks.push({
        notification: {
          notification_type: 'lease_maturity',
          dedupe_key: `lease_maturity:${compact(lease.lease_id)}:${dueDate}:${rule.leadDays}`,
          asset_id: assetId || null,
          lease_id: compact(lease.lease_id) || null,
          lease_space_id: compact(spaces[0]?.lease_space_id) || null,
          title: `임대차 만기 ${rule.label}`,
          body: `${assetName}의 ${tenantName} 임대차 만기일이 ${dueDate}입니다.`,
          due_date: dueDate,
          lead_days: rule.leadDays,
          payload: { asset_name: assetName, tenant_name: tenantName, alert_label: rule.label },
        },
        recipients,
      });
    }
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
