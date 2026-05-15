// supabase/functions/ll-dashboard-api/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
var DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "https://this8369.github.io",
  "https://kylee94.github.io"
];
var WRITE_TABLE_ALLOWLIST = /* @__PURE__ */ new Set([
  "public.ll_edit_requests",
  "public.ll_worklogs",
  "public.ll_api_audit_logs",
  "public.ll_data_change_audit_logs",
  "public.ll_external_api_cache"
]);
var EDIT_TARGET_TABLE_ALLOWLIST = /* @__PURE__ */ new Set([
  "public.ll_assets",
  "public.ll_companies",
  "public.ll_data_quality_findings",
  "public.ll_leases",
  "public.ll_leasing_contracts",
  "public.ll_rent_history",
  "public.ll_tenants",
  "public.ll_weekly_assets",
  "public.ll_weekly_projects",
  "public.ll_weekly_reports"
]);
var EDIT_FIELD_ALLOWLIST = {
  "public.ll_assets": /* @__PURE__ */ new Set([
    "assetName",
    "asset_name",
    "fundName",
    "fund_name",
    "standardizedAddress",
    "standardized_address",
    "grossFloorAreaSqm",
    "gross_floor_area_sqm",
    "leasedAreaSqm",
    "leased_area_sqm",
    "vacancyAreaSqm",
    "vacancy_area_sqm",
    "vacancyRate",
    "vacancy_rate",
    "monthlyCostTotal",
    "monthly_cost_total",
    "averageENoc",
    "average_e_noc",
    "coldStorageAreaSqm",
    "cold_storage_area_sqm",
    "dryStorageAreaSqm",
    "dry_storage_area_sqm"
  ]),
  "public.ll_companies": /* @__PURE__ */ new Set([
    "tenantMasterName",
    "tenant_master_name",
    "companyName",
    "company_name",
    "businessRegistrationNo",
    "business_registration_no",
    "dartCorpCode",
    "dart_corp_code",
    "dartConnected",
    "dart_connected",
    "latestRevenue",
    "latest_revenue",
    "exposureAvailable",
    "exposure_available"
  ]),
  "public.ll_leases": /* @__PURE__ */ new Set([
    "tenantMasterName",
    "tenant_master_name",
    "assetName",
    "asset_name",
    "spaceLabel",
    "space_label",
    "leasedAreaSqm",
    "leased_area_sqm",
    "exclusiveAreaSqm",
    "exclusive_area_sqm",
    "currentStartDate",
    "current_start_date",
    "currentEndDate",
    "current_end_date"
  ]),
  "public.ll_leasing_contracts": /* @__PURE__ */ new Set([
    "tenantMasterName",
    "tenant_master_name",
    "assetName",
    "asset_name",
    "fundName",
    "fund_name",
    "spaceLabel",
    "space_label",
    "floorLabel",
    "floor_label",
    "detailAreaLabel",
    "detail_area_label",
    "leasedAreaSqm",
    "leased_area_sqm",
    "exclusiveAreaSqm",
    "exclusive_area_sqm",
    "currentStartDate",
    "current_start_date",
    "currentEndDate",
    "current_end_date",
    "monthlyRentTotal",
    "monthly_rent_total",
    "monthlyMfTotal",
    "monthly_mf_total",
    "monthlyCombinedTotal",
    "monthly_combined_total",
    "currentRentPerPy",
    "current_rent_per_py",
    "currentMfPerPy",
    "current_mf_per_py"
  ]),
  "public.ll_rent_history": /* @__PURE__ */ new Set([
    "tenantMasterName",
    "tenant_master_name",
    "assetName",
    "asset_name",
    "spaceLabel",
    "space_label",
    "leasedAreaSqm",
    "leased_area_sqm",
    "exclusiveAreaSqm",
    "exclusive_area_sqm",
    "basisDate",
    "basis_date",
    "currentStartDate",
    "current_start_date",
    "currentEndDate",
    "current_end_date",
    "monthlyRentTotal",
    "monthly_rent_total",
    "monthlyMfTotal",
    "monthly_mf_total",
    "monthlyCombinedTotal",
    "monthly_combined_total",
    "currentRentPerPy",
    "current_rent_per_py",
    "currentMfPerPy",
    "current_mf_per_py",
    "rentChangeReason",
    "rent_change_reason",
    "reviewStatus",
    "review_status"
  ]),
  "public.ll_tenants": /* @__PURE__ */ new Set([
    "tenantMasterName",
    "tenant_master_name",
    "businessRegistrationNo",
    "business_registration_no",
    "dartCorpCode",
    "dart_corp_code",
    "companyName",
    "company_name"
  ]),
  "public.ll_weekly_assets": /* @__PURE__ */ new Set(["asset_name", "issue", "plan", "status", "owner_name", "stakeholder", "row_json"]),
  "public.ll_weekly_projects": /* @__PURE__ */ new Set(["project_type", "project_name", "issue", "plan", "status", "owner_name", "stakeholder", "row_json"]),
  "public.ll_weekly_reports": /* @__PURE__ */ new Set(["report_json", "summary_text", "key_issues", "current_status", "next_plan"])
};
var IMMUTABLE_FIELDS = /* @__PURE__ */ new Set([
  "id",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "approved_by",
  "requested_by",
  "service_role_key",
  "api_key",
  "secret"
]);
var PRIMARY_KEY_FIELDS = /* @__PURE__ */ new Set([
  "id",
  "row_id",
  "source_row_id",
  "source_cell_id",
  "cell_id",
  "asset_id",
  "tenant_id",
  "lease_id"
]);
var rateBuckets = /* @__PURE__ */ new Map();
var MAX_EDIT_CELLS_PER_REQUEST = 500;
var EXTERNAL_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
var SENSITIVE_KEY_PATTERN = /(authorization|password|secret|service[_-]?role|token|api[_-]?key|apikey|crtfc[_-]?key|client[_-]?secret|serviceKey|x-ncp)/iu;
var DATA_QUALITY_ALLOWED_NAMES = /* @__PURE__ */ new Set(["\uC774\uC2DC\uC815", "\uC804\uAE30\uC601", "\uC774\uAD00\uC6A9"]);
function allowedOrigins() {
  return (Deno.env.get("LL_ALLOWED_ORIGINS") || DEFAULT_ALLOWED_ORIGINS.join(",")).split(",").map((item) => item.trim()).filter(Boolean);
}
function isAllowedOrigin(origin) {
  return !origin || allowedOrigins().includes(origin);
}
function readEdgeSecret(name) {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (name === "SUPABASE_SERVICE_ROLE_KEY" && secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      const firstKey = Object.keys(parsed)[0];
      return parsed.default || parsed.service_role || (firstKey ? parsed[firstKey] : "");
    } catch {
      return "";
    }
  }
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (name === "SUPABASE_ANON_KEY" && publishableKeys) {
    try {
      const parsed = JSON.parse(publishableKeys);
      const firstKey = Object.keys(parsed)[0];
      return parsed.default || parsed.anon || (firstKey ? parsed[firstKey] : "");
    } catch {
      return "";
    }
  }
  return "";
}
function jsonResponse(body, status = 200, origin = "") {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-client-info",
    vary: "origin"
  });
  if (origin && isAllowedOrigin(origin)) headers.set("access-control-allow-origin", origin);
  return new Response(JSON.stringify(body), { status, headers });
}
function fail(status, message, origin, detail) {
  return jsonResponse({ ok: false, message, detail }, status, origin);
}
function roleRank(role) {
  const order = ["Reader", "Editor", "Manager", "Admin", "System Admin"];
  const index = order.indexOf(role || "Reader");
  return index < 0 ? 0 : index;
}
function hasRole(role, minimum) {
  return roleRank(role) >= roleRank(minimum);
}
function assertLlAllowlist() {
  return [...WRITE_TABLE_ALLOWLIST, ...EDIT_TARGET_TABLE_ALLOWLIST].every((table) => table.startsWith("public.ll_"));
}
function safeAction(value) {
  return String(value || "").replace(/^\/+/u, "").trim();
}
function firstDefined(...values) {
  return values.find((value) => value !== void 0 && value !== null && value !== "");
}
function normalizePublicLlTable(value) {
  const raw = String(value || "").trim();
  const table = raw.startsWith("public.") ? raw : `public.${raw}`;
  if (!/^public\.ll_[a-zA-Z0-9_]+$/u.test(table)) return "";
  return table;
}
function clientTableName(publicTable) {
  return publicTable.replace(/^public\./u, "");
}
function isSafeIdentifier(value) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(String(value || ""));
}
function normalizeText(value) {
  if (value === void 0 || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function valuesEqual(a, b) {
  const left = normalizeText(a).trim();
  const right = normalizeText(b).trim();
  if (left === right) return true;
  const leftNumber = Number(left.replace(/,/gu, ""));
  const rightNumber = Number(right.replace(/,/gu, ""));
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && Math.abs(leftNumber - rightNumber) < 1e-6;
}
function redactSensitivePayload(value, depth = 0) {
  if (depth > 8) return "[redacted-depth-limit]";
  if (Array.isArray(value)) return value.map((item) => redactSensitivePayload(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactSensitivePayload(child, depth + 1)
  ]));
}
async function sha256Text(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function coerceValue(nextValue, currentValue) {
  if (currentValue === null || currentValue === void 0) return nextValue;
  if (typeof currentValue === "number") {
    const numeric = Number(String(nextValue).replace(/,/gu, ""));
    return Number.isFinite(numeric) ? numeric : nextValue;
  }
  if (typeof currentValue === "boolean") {
    return ["true", "1", "y", "yes"].includes(String(nextValue).toLowerCase());
  }
  if (typeof currentValue === "object") {
    try {
      return typeof nextValue === "string" ? JSON.parse(nextValue) : nextValue;
    } catch {
      return nextValue;
    }
  }
  return nextValue;
}
function checkRateLimit(userId, action, limit = 30, windowMs = 6e4) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { resetAt: now + windowMs, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
async function getContext(request, origin) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = readEdgeSecret("SUPABASE_ANON_KEY");
  const serviceRoleKey = readEdgeSecret("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Response("Server is not configured", { status: 500 });
  const authHeader = request.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new Response("Missing Authorization token", { status: 401 });
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData.user) throw new Response("Invalid Authorization token", { status: 401 });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: permission } = await serviceClient.from("ll_user_permissions").select("*").eq("user_id", userData.user.id).maybeSingle();
  const role = permission?.logistics_role || "Reader";
  return { serviceClient, user: { id: userData.user.id }, permission: permission || null, role, origin };
}
async function audit(serviceClient, userId, action, status, payload) {
  await serviceClient.from("ll_api_audit_logs").insert({
    action,
    status_code: status,
    requested_by: userId,
    request_payload: redactSensitivePayload(payload)
  });
}
function managedAssetCodes(permission) {
  return Array.isArray(permission?.managed_asset_codes) ? permission.managed_asset_codes.map((item) => String(item)) : [];
}
function permissionFlag(permission, key, action) {
  const value = permission?.[key];
  return value?.[action] === true;
}
function canWriteRelatedAsset(ctx, relatedAssetId, relatedAssetName) {
  if (hasRole(ctx.role, "Admin")) return true;
  const assetId = String(relatedAssetId || "").trim();
  const assetName = String(relatedAssetName || "").trim();
  if (!assetId && !assetName) return false;
  return managedAssetCodes(ctx.permission).some((item) => item === assetId || !!assetName && item === assetName) ? permissionFlag(ctx.permission, "managed_asset_permissions", "update") : permissionFlag(ctx.permission, "other_asset_permissions", "update");
}
function canMutateWorklog(ctx, action, relatedAssetId) {
  if (hasRole(ctx.role, "Admin")) return true;
  const assetId = String(relatedAssetId || "").trim();
  const permissionKey = assetId && managedAssetCodes(ctx.permission).includes(assetId) ? "managed_asset_permissions" : "other_asset_permissions";
  return permissionFlag(ctx.permission, permissionKey, action);
}
function serverWorklogPayload(ctx, rawPayload, currentPayload = {}, extra = {}) {
  const incoming = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload : {};
  const {
    role: _role,
    user_id: _userId,
    userId: _userIdCamel,
    permission: _permission,
    permissions: _permissions,
    scope: _scope,
    organization: _organization,
    ownerOrganization: _ownerOrganization,
    author: _author,
    authorId: _authorId,
    createdBy: _createdBy,
    ...safeIncoming
  } = incoming;
  return {
    ...currentPayload,
    ...safeIncoming,
    ...extra,
    organization: currentPayload.organization || ctx.permission?.organization || null,
    server_actor_id: ctx.user.id
  };
}
function canReadRelatedAsset(ctx, relatedAssetId) {
  if (hasRole(ctx.role, "Manager")) return true;
  const assetId = String(relatedAssetId || "").trim();
  if (!assetId) return true;
  const otherPermissions = ctx.permission?.other_asset_permissions;
  return managedAssetCodes(ctx.permission).includes(assetId) || otherPermissions?.read === true;
}
function allowedDataQualityEmails() {
  return (Deno.env.get("LL_DATA_QUALITY_ALLOWED_EMAILS") || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}
function canUseDataQuality(ctx) {
  if (hasRole(ctx.role, "System Admin")) return true;
  const organization = String(ctx.permission?.organization || ctx.permission?.department || "").trim();
  const name = String(ctx.permission?.staff_name || ctx.permission?.name || ctx.permission?.display_name || "").trim();
  const email = String(ctx.permission?.email || "").trim().toLowerCase();
  return organization === "\uAE30\uD68D\uCD94\uC9C4\uC13C\uD130" || DATA_QUALITY_ALLOWED_NAMES.has(name) || allowedDataQualityEmails().includes(email);
}
function filterWorklogRows(ctx, rows) {
  const organization = String(ctx.permission?.organization || "");
  return rows.filter((row) => {
    const payload = row.payload || {};
    const scope = String(row.scope || "").toLowerCase();
    if (scope === "personal") return row.created_by === ctx.user.id;
    if (scope === "team") {
      return row.created_by === ctx.user.id || String(payload.organization || payload.ownerOrganization || "") === organization;
    }
    return canReadRelatedAsset(ctx, row.related_asset_id || payload.assetId || payload.assetName);
  });
}
function normalizeEditCells(record) {
  const requestPayload = record.request_payload || {};
  const rawCells = Array.isArray(requestPayload.cell_edits) && requestPayload.cell_edits.length ? requestPayload.cell_edits : [{
    target_table: record.source_table,
    target_row_id: record.target_row_id,
    target_cell_id: record.target_cell_id,
    field_name: record.field_name,
    before_value: record.before_value,
    after_value: record.requested_value
  }];
  return rawCells.map((cell) => {
    const targetTable = normalizePublicLlTable(firstDefined(cell.target_table, cell.source_table, record.source_table));
    const primaryKeyField = String(firstDefined(cell.primary_key_field, cell.pk_field, "id"));
    const targetRowId = String(firstDefined(cell.target_row_id, cell.row_id, record.target_row_id, cell.target_cell_id, record.target_cell_id, ""));
    const fieldName = String(firstDefined(cell.field_name, record.field_name, ""));
    return {
      targetTable,
      primaryKeyField,
      targetRowId,
      targetCellId: String(firstDefined(cell.target_cell_id, record.target_cell_id, "")),
      sourceRowId: String(firstDefined(cell.source_row_id, cell.target_row_id, record.target_row_id, "")),
      sourceCellId: String(firstDefined(cell.source_cell_id, cell.target_cell_id, record.target_cell_id, "")),
      fieldName,
      operation: String(firstDefined(cell.action, cell.operation, "\uC218\uC815")),
      beforeValue: firstDefined(cell.before_value, record.before_value),
      afterValue: firstDefined(cell.after_value, cell.requested_value, record.requested_value),
      assetId: String(firstDefined(cell.asset_id, cell.assetId, record.target_asset_id, "")),
      assetName: String(firstDefined(cell.asset_name, cell.assetName, record.target_name, ""))
    };
  });
}
function validateEditCell(ctx, cell) {
  if (!["\uC218\uC815", "update"].includes(cell.operation)) return "Only cell update is enabled for automatic write; add/delete must be submitted as a separate schema-specific request";
  if (!EDIT_TARGET_TABLE_ALLOWLIST.has(cell.targetTable)) return "Target table is not allowed";
  if (!cell.targetRowId) return "target_row_id is required";
  if (!isSafeIdentifier(cell.primaryKeyField) || !PRIMARY_KEY_FIELDS.has(cell.primaryKeyField)) return "Primary key field is not allowed";
  if (!isSafeIdentifier(cell.fieldName) || IMMUTABLE_FIELDS.has(cell.fieldName)) return "Field is not editable";
  if (!EDIT_FIELD_ALLOWLIST[cell.targetTable]?.has(cell.fieldName)) return "Field is not allowed for automatic write";
  return "";
}
async function readTargetRow(client, cell) {
  const tableName = clientTableName(cell.targetTable);
  const { data, error } = await client.from(tableName).select("*").eq(cell.primaryKeyField, cell.targetRowId).maybeSingle();
  if (error) throw new Error(`Readback failed: ${error.message}`);
  if (!data) throw new Error("Target row was not found");
  return data;
}
function rowRelatedAsset(row, cell) {
  return {
    assetId: firstDefined(row.asset_id, row.assetId, row.asset_code, row.assetCode, row.related_asset_id),
    assetName: firstDefined(row.asset_name, row.assetName, row.target_asset_name, row.related_asset_name, row.target_name)
  };
}
async function canWriteAnyLeaseAsset(ctx, tenantIds) {
  const normalizedTenantIds = [...new Set(tenantIds.map((item) => String(item || "").trim()).filter(Boolean))];
  if (!normalizedTenantIds.length) return false;
  const { data, error } = await ctx.serviceClient.from("ll_leases").select("asset_id").in("tenant_id", normalizedTenantIds).limit(200);
  if (error) throw new Error(`Related lease permission check failed: ${error.message}`);
  return (data || []).some((lease) => canWriteRelatedAsset(ctx, lease.asset_id));
}
async function canWriteTenantScopedRow(ctx, row, cell) {
  const tenantId = String(firstDefined(row.tenant_id, cell.primaryKeyField === "tenant_id" ? cell.targetRowId : "") || "").trim();
  return canWriteAnyLeaseAsset(ctx, tenantId ? [tenantId] : []);
}
async function canWriteCompanyScopedRow(ctx, row, cell) {
  const tenantId = String(firstDefined(row.tenant_id, cell.primaryKeyField === "tenant_id" ? cell.targetRowId : "") || "").trim();
  if (tenantId && await canWriteAnyLeaseAsset(ctx, [tenantId])) return true;
  const businessRegistrationNo = String(firstDefined(row.business_registration_no, row.bizr_no, row.registration_no) || "").replace(/[^0-9]/gu, "");
  const tenantName = String(firstDefined(row.tenant_master_name, row.company_name, row.corp_name, row.name) || "").trim();
  if (!businessRegistrationNo && !tenantName) return false;
  const tenantIds = /* @__PURE__ */ new Set();
  if (businessRegistrationNo) {
    const { data, error } = await ctx.serviceClient.from("ll_tenants").select("tenant_id").eq("business_registration_no", businessRegistrationNo).limit(100);
    if (error) throw new Error(`Related tenant permission check failed: ${error.message}`);
    (data || []).forEach((tenant) => tenantIds.add(String(tenant.tenant_id || "")));
  }
  if (tenantName) {
    const [{ data: byMaster, error: masterError }, { data: byRaw, error: rawError }] = await Promise.all([
      ctx.serviceClient.from("ll_tenants").select("tenant_id").eq("tenant_master_name", tenantName).limit(100),
      ctx.serviceClient.from("ll_tenants").select("tenant_id").eq("raw_tenant_name", tenantName).limit(100)
    ]);
    if (masterError || rawError) throw new Error(`Related tenant permission check failed: ${masterError?.message || rawError?.message}`);
    [...byMaster || [], ...byRaw || []].forEach((tenant) => tenantIds.add(String(tenant.tenant_id || "")));
  }
  return canWriteAnyLeaseAsset(ctx, [...tenantIds]);
}
async function assertTargetRowPermission(ctx, row, cell) {
  const related = rowRelatedAsset(row, cell);
  if (related.assetId || related.assetName) return canWriteRelatedAsset(ctx, related.assetId, related.assetName);
  if (cell.targetTable === "public.ll_tenants") return canWriteTenantScopedRow(ctx, row, cell);
  if (cell.targetTable === "public.ll_companies") return canWriteCompanyScopedRow(ctx, row, cell);
  return canWriteRelatedAsset(ctx, related.assetId, related.assetName);
}
async function readTargetCell(ctx, cell) {
  const row = await readTargetRow(ctx.serviceClient, cell);
  if (!await assertTargetRowPermission(ctx, row, cell)) throw new Error("Insufficient asset write permission for target row");
  return row[cell.fieldName];
}
async function writeTargetCell(client, cell, nextValue) {
  const tableName = clientTableName(cell.targetTable);
  const { error } = await client.from(tableName).update({
    [cell.fieldName]: nextValue
  }).eq(cell.primaryKeyField, cell.targetRowId);
  if (error) throw new Error(`Write failed: ${error.message}`);
}
async function rollbackAppliedEdits(client, applied) {
  for (const item of [...applied].reverse()) {
    await writeTargetCell(client, item.cell, item.previousValue);
  }
}
async function writeDataChangeAudit(ctx, editRequestId, cell, beforeValue, afterValue, readbackValue, status, actorId) {
  await ctx.serviceClient.from("ll_data_change_audit_logs").insert({
    edit_request_id: editRequestId,
    action: "data_quality_write",
    target_table: cell.targetTable,
    target_row_id: cell.targetRowId,
    target_cell_id: cell.targetCellId || null,
    field_name: cell.fieldName,
    before_value: normalizeText(beforeValue),
    after_value: normalizeText(afterValue),
    readback_value: normalizeText(readbackValue),
    actor_id: actorId || ctx.user.id,
    approver_id: ctx.user.id,
    source_row_id: cell.sourceRowId || null,
    source_cell_id: cell.sourceCellId || null,
    approval_status: status,
    metadata: redactSensitivePayload({ primary_key_field: cell.primaryKeyField, asset_id: cell.assetId || null, asset_name: cell.assetName || null })
  });
}
function canReadDataQualityRow(ctx, row) {
  if (hasRole(ctx.role, "Manager")) return true;
  const assetId = firstDefined(row.asset_id, row.target_asset_id, row.related_asset_id, row.asset_code, row.entity_id);
  const assetName = firstDefined(row.asset_name, row.target_asset_name, row.target_name);
  if (!assetId && !assetName) return true;
  return canReadRelatedAsset(ctx, assetId || assetName);
}
async function listQualityFindings(ctx, payload) {
  if (!hasRole(ctx.role, "Reader")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!canUseDataQuality(ctx)) return fail(403, "Data Quality permission is limited to Planning Center users", ctx.origin);
  if (!checkRateLimit(ctx.user.id, "quality/findings", 60)) return fail(429, "Rate limit exceeded", ctx.origin);
  const limit = Math.min(Math.max(Number(payload.limit || 200), 1), 500);
  let query = ctx.serviceClient.from("ll_data_quality_findings").select("*").limit(limit);
  if (payload.severity && String(payload.severity) !== "all") query = query.eq("severity", String(payload.severity));
  const { data, error } = await query;
  if (error) return fail(500, "Failed to list data quality findings", ctx.origin);
  const rows = (data || []).filter((row) => canReadDataQualityRow(ctx, row));
  await audit(ctx.serviceClient, ctx.user.id, "quality/findings", 200, { limit, returned: rows.length });
  return jsonResponse({ ok: true, data: rows }, 200, ctx.origin);
}
async function listEditRequests(ctx, payload) {
  if (!hasRole(ctx.role, "Reader")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!canUseDataQuality(ctx)) return fail(403, "Data Quality permission is limited to Planning Center users", ctx.origin);
  if (!checkRateLimit(ctx.user.id, "edits/list", 60)) return fail(429, "Rate limit exceeded", ctx.origin);
  const status = String(payload.status || "submitted");
  const limit = Math.min(Math.max(Number(payload.limit || 80), 1), 200);
  let query = ctx.serviceClient.from("ll_edit_requests").select("id, source_table, finding_id, target_type, target_name, target_row_id, target_cell_id, field_name, reason_code, before_value, requested_value, readback_value, request_payload, status, requested_by, approved_by, approved_at, approval_note, rejected_by, rejected_at, rejection_note, write_status, write_error, write_result, created_at, updated_at").order("created_at", { ascending: false }).limit(limit);
  if (status !== "all") query = query.eq("status", status);
  if (!hasRole(ctx.role, "Manager")) query = query.eq("requested_by", ctx.user.id);
  const { data, error } = await query;
  if (error) return fail(500, "Failed to list edit requests", ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, "edits/list", 200, { status, limit, returned: data?.length || 0 });
  return jsonResponse({ ok: true, data: data || [] }, 200, ctx.origin);
}
async function readbackEdit(ctx, payload) {
  if (!hasRole(ctx.role, "Manager")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!canUseDataQuality(ctx)) return fail(403, "Data Quality permission is limited to Planning Center users", ctx.origin);
  if (!checkRateLimit(ctx.user.id, "edits/readback", 60)) return fail(429, "Rate limit exceeded", ctx.origin);
  const id = String(payload.id || "");
  if (!id) return fail(400, "id is required", ctx.origin);
  const { data, error } = await ctx.serviceClient.from("ll_edit_requests").select("*").eq("id", id).single();
  if (error || !data) return fail(404, "Edit request not found", ctx.origin);
  const cells = normalizeEditCells(data);
  const validationError = cells.map((cell) => validateEditCell(ctx, cell)).find(Boolean);
  if (validationError) return fail(400, validationError, ctx.origin);
  const readbacks = [];
  for (const cell of cells) {
    const currentValue = await readTargetCell(ctx, cell);
    readbacks.push({
      target_table: cell.targetTable,
      target_row_id: cell.targetRowId,
      target_cell_id: cell.targetCellId || null,
      field_name: cell.fieldName,
      before_value: cell.beforeValue,
      requested_value: cell.afterValue,
      current_value: currentValue,
      stale: !valuesEqual(currentValue, cell.beforeValue),
      source_row_id: cell.sourceRowId || null,
      source_cell_id: cell.sourceCellId || null
    });
  }
  await audit(ctx.serviceClient, ctx.user.id, "edits/readback", 200, { id, stale_count: readbacks.filter((item) => item.stale).length });
  return jsonResponse({ ok: true, data: { id, status: data.status, requested_by: data.requested_by, readbacks } }, 200, ctx.origin);
}
async function submitEdit(ctx, payload) {
  if (!hasRole(ctx.role, "Editor")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!canUseDataQuality(ctx)) return fail(403, "Data Quality permission is limited to Planning Center users", ctx.origin);
  if (!checkRateLimit(ctx.user.id, "edits/submit", 60)) return fail(429, "Rate limit exceeded", ctx.origin);
  const sourceTable = normalizePublicLlTable(payload.source_table || "public.ll_data_quality_findings");
  if (!EDIT_TARGET_TABLE_ALLOWLIST.has(sourceTable)) return fail(403, "Source table is not allowed", ctx.origin);
  const rawRequestPayload = payload.request_payload && typeof payload.request_payload === "object" && !Array.isArray(payload.request_payload) ? payload.request_payload : {};
  const sanitizedRequestPayload = redactSensitivePayload(rawRequestPayload);
  const draftRecord = {
    ...payload,
    source_table: sourceTable,
    request_payload: sanitizedRequestPayload
  };
  const cells = normalizeEditCells(draftRecord);
  if (!cells.length || cells.length > MAX_EDIT_CELLS_PER_REQUEST) return fail(400, "Edit cell count is invalid", ctx.origin);
  const submissionReadbacks = [];
  for (const cell of cells) {
    const validationError = validateEditCell(ctx, cell);
    if (validationError) return fail(400, validationError, ctx.origin);
    try {
      const row = await readTargetRow(ctx.serviceClient, cell);
      if (!await assertTargetRowPermission(ctx, row, cell)) return fail(403, "Insufficient asset write permission for target row", ctx.origin);
      const currentValue = row[cell.fieldName];
      submissionReadbacks.push({
        target_table: cell.targetTable,
        target_row_id: cell.targetRowId,
        field_name: cell.fieldName,
        request_before_value: cell.beforeValue,
        submit_readback_value: currentValue,
        stale_at_submit: !valuesEqual(currentValue, cell.beforeValue)
      });
    } catch (error2) {
      return fail(400, error2 instanceof Error ? error2.message : "Target row validation failed", ctx.origin);
    }
  }
  const requestPayloadWithReadback = {
    ...sanitizedRequestPayload,
    submit_readbacks: redactSensitivePayload(submissionReadbacks)
  };
  const { data, error } = await ctx.serviceClient.from("ll_edit_requests").insert({
    source_table: sourceTable,
    finding_id: payload.finding_id || null,
    target_type: payload.target_type || null,
    target_name: payload.target_name || null,
    target_row_id: payload.target_row_id || null,
    target_cell_id: payload.target_cell_id || null,
    field_name: payload.field_name || null,
    reason_code: payload.reason_code || null,
    before_value: payload.before_value || null,
    requested_value: payload.requested_value || null,
    request_payload: requestPayloadWithReadback,
    requested_by: ctx.user.id,
    status: "submitted"
  }).select("id, status").single();
  if (error) return fail(500, "Failed to submit edit request", ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, "edits/submit", 200, { id: data.id });
  return jsonResponse({ ok: true, message: "Edit request submitted", data }, 200, ctx.origin);
}
async function approveEdit(ctx, payload) {
  if (!hasRole(ctx.role, "Manager")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!canUseDataQuality(ctx)) return fail(403, "Data Quality permission is limited to Planning Center users", ctx.origin);
  if (!checkRateLimit(ctx.user.id, "edits/approve", 30)) return fail(429, "Rate limit exceeded", ctx.origin);
  const id = String(payload.id || "");
  if (!id) return fail(400, "id is required", ctx.origin);
  const { data, error } = await ctx.serviceClient.from("ll_edit_requests").select("*").eq("id", id).single();
  if (error || !data) return fail(404, "Edit request not found", ctx.origin);
  if (data.requested_by === ctx.user.id) return fail(403, "Self approval is not allowed", ctx.origin);
  if (data.status !== "submitted") return fail(409, "Edit request is not in submitted status", ctx.origin);
  const cells = normalizeEditCells(data);
  const validationError = cells.map((cell) => validateEditCell(ctx, cell)).find(Boolean);
  if (validationError) return fail(400, validationError, ctx.origin);
  const requesterId = String(data.requested_by || "");
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  await ctx.serviceClient.from("ll_edit_requests").update({
    status: "approved_write_running",
    approved_by: ctx.user.id,
    approved_at: startedAt,
    approval_note: payload.approval_note || null,
    write_started_at: startedAt,
    updated_at: startedAt
  }).eq("id", id);
  const applied = [];
  const readbacks = [];
  try {
    for (const cell of cells) {
      const beforeReadback = await readTargetCell(ctx, cell);
      if (!valuesEqual(beforeReadback, cell.beforeValue)) {
        await rollbackAppliedEdits(ctx.serviceClient, applied);
        await ctx.serviceClient.from("ll_edit_requests").update({
          status: "stale_blocked",
          readback_value: normalizeText(beforeReadback),
          write_error: "stale value",
          write_result: redactSensitivePayload({ stale_cell: cell, before_readback: beforeReadback }),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", id);
        await writeDataChangeAudit(ctx, id, cell, beforeReadback, cell.afterValue, beforeReadback, "stale_blocked", requesterId);
        await audit(ctx.serviceClient, ctx.user.id, "edits/approve/stale_blocked", 409, { id, cell });
        return fail(409, "Stale value blocked before write", ctx.origin, { cell, readback: beforeReadback });
      }
      const coerced = coerceValue(cell.afterValue, beforeReadback);
      await writeTargetCell(ctx.serviceClient, cell, coerced);
      applied.push({ cell, previousValue: beforeReadback });
      const afterReadback = await readTargetCell(ctx, cell);
      if (!valuesEqual(afterReadback, cell.afterValue) && !valuesEqual(afterReadback, coerced)) {
        await rollbackAppliedEdits(ctx.serviceClient, applied);
        await ctx.serviceClient.from("ll_edit_requests").update({
          status: "readback_failed",
          readback_value: normalizeText(afterReadback),
          write_error: "readback mismatch after write",
          write_result: redactSensitivePayload({ failed_cell: cell, after_readback: afterReadback }),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", id);
        await writeDataChangeAudit(ctx, id, cell, beforeReadback, cell.afterValue, afterReadback, "readback_failed", requesterId);
        return fail(500, "Write readback failed and rollback was attempted", ctx.origin, { cell, readback: afterReadback });
      }
      await writeDataChangeAudit(ctx, id, cell, beforeReadback, cell.afterValue, afterReadback, "written", requesterId);
      readbacks.push({
        target_table: cell.targetTable,
        target_row_id: cell.targetRowId,
        field_name: cell.fieldName,
        readback_value: afterReadback
      });
    }
  } catch (writeError) {
    await rollbackAppliedEdits(ctx.serviceClient, applied);
    await ctx.serviceClient.from("ll_edit_requests").update({
      status: "write_failed_rolled_back",
      write_error: writeError instanceof Error ? writeError.message : "unknown write error",
      write_result: redactSensitivePayload({ applied_count_before_rollback: applied.length }),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id);
    await audit(ctx.serviceClient, ctx.user.id, "edits/approve/write_failed_rolled_back", 500, { id });
    return fail(500, "Write failed and rollback was attempted", ctx.origin);
  }
  const writtenAt = (/* @__PURE__ */ new Date()).toISOString();
  const { data: written, error: updateError } = await ctx.serviceClient.from("ll_edit_requests").update({
    status: "written",
    readback_value: JSON.stringify(readbacks),
    write_status: "readback_confirmed",
    write_result: redactSensitivePayload({ readbacks }),
    written_at: writtenAt,
    updated_at: writtenAt
  }).eq("id", id).select("id, status, readback_value, write_result").single();
  if (updateError) return fail(500, "Failed to finalize edit request", ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, "edits/approve/write", 200, { id, readbacks });
  return jsonResponse({ ok: true, message: "Edit request approved, written, read back, and audited", data: written }, 200, ctx.origin);
}
async function rejectEdit(ctx, payload) {
  if (!hasRole(ctx.role, "Manager")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!canUseDataQuality(ctx)) return fail(403, "Data Quality permission is limited to Planning Center users", ctx.origin);
  if (!checkRateLimit(ctx.user.id, "edits/reject", 30)) return fail(429, "Rate limit exceeded", ctx.origin);
  const id = String(payload.id || "");
  if (!id) return fail(400, "id is required", ctx.origin);
  const { data: current, error: currentError } = await ctx.serviceClient.from("ll_edit_requests").select("id, status, requested_by").eq("id", id).single();
  if (currentError || !current) return fail(404, "Edit request not found", ctx.origin);
  if (current.requested_by === ctx.user.id) return fail(403, "Self rejection is not allowed", ctx.origin);
  if (current.status !== "submitted") return fail(409, "Only submitted edit requests can be rejected", ctx.origin);
  const { data, error } = await ctx.serviceClient.from("ll_edit_requests").update({
    status: "rejected",
    rejected_by: ctx.user.id,
    rejected_at: (/* @__PURE__ */ new Date()).toISOString(),
    rejection_note: payload.rejection_note || null,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", id).eq("status", "submitted").select("id, status").single();
  if (error) return fail(500, "Failed to reject edit request", ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, "edits/reject", 200, { id });
  return jsonResponse({ ok: true, message: "Edit request rejected", data }, 200, ctx.origin);
}
async function saveWorklog(ctx, payload) {
  if (!hasRole(ctx.role, "Reader")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!canMutateWorklog(ctx, "create", payload.related_asset_id)) return fail(403, "Insufficient create permission for this task scope", ctx.origin);
  const { data, error } = await ctx.serviceClient.from("ll_worklogs").insert({
    scope: payload.scope || "personal",
    title: payload.title || "",
    body: payload.body || "",
    related_asset_id: payload.related_asset_id || null,
    related_tenant_id: payload.related_tenant_id || null,
    priority: payload.priority || null,
    status: payload.status || "new",
    created_by: ctx.user.id,
    payload: serverWorklogPayload(ctx, payload.payload)
  }).select("id, status").single();
  if (error) return fail(500, "Failed to save worklog", ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, "worklogs/create", 200, { id: data.id });
  return jsonResponse({ ok: true, message: "Worklog saved", data }, 200, ctx.origin);
}
async function listWorklogs(ctx, payload) {
  if (!hasRole(ctx.role, "Reader")) return fail(403, "Insufficient logistics permission", ctx.origin);
  const limit = Math.min(Number(payload.limit || 120), 300);
  const { data, error } = await ctx.serviceClient.from("ll_worklogs").select("id, scope, title, body, related_asset_id, related_tenant_id, priority, status, created_by, created_at, updated_at, payload").neq("status", "deleted").order("created_at", { ascending: false }).limit(limit);
  if (error) return fail(500, "Failed to list worklogs", ctx.origin);
  return jsonResponse({ ok: true, data: filterWorklogRows(ctx, data || []) }, 200, ctx.origin);
}
async function readWorklogForWrite(ctx, id) {
  const { data, error } = await ctx.serviceClient.from("ll_worklogs").select("id, created_by, status, related_asset_id, related_tenant_id, scope, payload").eq("id", id).single();
  if (error || !data) return { data: null, response: fail(404, "Worklog not found", ctx.origin) };
  if (data.created_by !== ctx.user.id && !hasRole(ctx.role, "Manager")) {
    return { data: null, response: fail(403, "Only author or manager can modify this task", ctx.origin) };
  }
  return { data, response: null };
}
async function updateWorklog(ctx, payload) {
  if (!hasRole(ctx.role, "Reader")) return fail(403, "Insufficient logistics permission", ctx.origin);
  const id = String(payload.id || "");
  if (!id) return fail(400, "id is required", ctx.origin);
  const current = await readWorklogForWrite(ctx, id);
  if (current.response) return current.response;
  const currentRow = current.data;
  const currentAssetId = currentRow.related_asset_id || "";
  const nextAssetId = firstDefined(payload.related_asset_id, currentAssetId);
  if (!canMutateWorklog(ctx, "update", currentAssetId)) return fail(403, "Insufficient update permission for existing task scope", ctx.origin);
  if (String(nextAssetId || "") !== String(currentAssetId || "") && !canMutateWorklog(ctx, "update", nextAssetId)) {
    return fail(403, "Insufficient update permission for new task scope", ctx.origin);
  }
  const { data, error } = await ctx.serviceClient.from("ll_worklogs").update({
    scope: payload.scope || void 0,
    title: payload.title || void 0,
    body: payload.body || void 0,
    priority: payload.priority || void 0,
    status: payload.status || void 0,
    related_asset_id: nextAssetId || void 0,
    related_tenant_id: payload.related_tenant_id || void 0,
    payload: serverWorklogPayload(ctx, payload.payload, currentRow.payload || {}),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", id).select("id, status").single();
  if (error) return fail(500, "Failed to update worklog", ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, "worklogs/update", 200, { id });
  return jsonResponse({ ok: true, message: "Worklog updated", data }, 200, ctx.origin);
}
async function completeWorklog(ctx, payload) {
  return updateWorklog(ctx, { ...payload, status: "completed", payload: { ...payload.payload || {}, completed_at: (/* @__PURE__ */ new Date()).toISOString() } });
}
async function deleteWorklog(ctx, payload) {
  if (!hasRole(ctx.role, "Reader")) return fail(403, "Insufficient logistics permission", ctx.origin);
  const id = String(payload.id || "");
  if (!id) return fail(400, "id is required", ctx.origin);
  const current = await readWorklogForWrite(ctx, id);
  if (current.response) return current.response;
  const currentRow = current.data;
  if (!canMutateWorklog(ctx, "delete", currentRow.related_asset_id)) return fail(403, "Insufficient delete permission for existing task scope", ctx.origin);
  const { data, error } = await ctx.serviceClient.from("ll_worklogs").update({
    status: "deleted",
    payload: serverWorklogPayload(ctx, payload.payload, currentRow.payload || {}, { deleted_at: (/* @__PURE__ */ new Date()).toISOString() }),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", id).select("id, status").single();
  if (error) return fail(500, "Failed to delete worklog", ctx.origin);
  await audit(ctx.serviceClient, ctx.user.id, "worklogs/delete", 200, { id });
  return jsonResponse({ ok: true, message: "Worklog deleted", data }, 200, ctx.origin);
}
async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 1e4, retries = 1) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      const body = await response.json().catch(() => ({}));
      return { response, body };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt >= retries) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Provider request failed");
}
function isMissingCacheTable(error) {
  if (!error) return false;
  return error.code === "42P01" || /ll_external_api_cache|relation .* does not exist|schema cache/i.test(error.message || "");
}
async function readExternalApiCache(ctx, provider, cacheKey, allowExpired = false) {
  const { data, error } = await ctx.serviceClient.from("ll_external_api_cache").select("provider_status, response_payload, expires_at, fetched_at").eq("provider", provider).eq("cache_key", cacheKey).maybeSingle();
  if (error) {
    if (isMissingCacheTable(error)) return null;
    throw new Error(`External API cache read failed: ${error.message}`);
  }
  if (!data) return null;
  const expiresAt = new Date(String(data.expires_at || 0)).getTime();
  const isExpired = Number.isFinite(expiresAt) && expiresAt <= Date.now();
  if (isExpired && !allowExpired) return null;
  return {
    providerStatus: Number(data.provider_status || 200),
    responsePayload: data.response_payload,
    fetchedAt: data.fetched_at,
    stale: isExpired
  };
}
async function writeExternalApiCache(ctx, provider, cacheKey, requestPayload, responsePayload, providerStatus) {
  const expiresAt = new Date(Date.now() + EXTERNAL_CACHE_TTL_MS).toISOString();
  const { error } = await ctx.serviceClient.from("ll_external_api_cache").upsert({
    provider,
    cache_key: cacheKey,
    request_payload: redactSensitivePayload(requestPayload),
    response_payload: redactSensitivePayload(responsePayload),
    provider_status: providerStatus,
    fetched_at: (/* @__PURE__ */ new Date()).toISOString(),
    expires_at: expiresAt,
    created_by: ctx.user.id,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }, { onConflict: "provider,cache_key" });
  if (error && !isMissingCacheTable(error)) throw new Error(`External API cache write failed: ${error.message}`);
}
async function cacheKeyFor(provider, payload) {
  return sha256Text(JSON.stringify({ provider, payload: redactSensitivePayload(payload) }));
}
function externalApiCacheResponse(ctx, providerStatus, data, cache) {
  return jsonResponse({ ok: true, provider_status: providerStatus, data, cache }, 200, ctx.origin);
}
async function callOpenDart(ctx, payload) {
  if (!hasRole(ctx.role, "Admin")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!checkRateLimit(ctx.user.id, "opendart/company", 20)) return fail(429, "Rate limit exceeded", ctx.origin);
  const apiKey = Deno.env.get("OPENDART_API_KEY");
  if (!apiKey) return fail(503, "OpenDART API key is not configured", ctx.origin);
  const corpCode = String(payload.corp_code || "").trim();
  if (!corpCode) return fail(400, "corp_code is required", ctx.origin);
  const cacheKey = await cacheKeyFor("opendart/company", { corp_code: corpCode });
  const cached = await readExternalApiCache(ctx, "opendart/company", cacheKey);
  if (cached) return externalApiCacheResponse(ctx, cached.providerStatus, cached.responsePayload, { hit: true, stale: false, fetched_at: cached.fetchedAt });
  const query = new URLSearchParams({ crtfc_key: apiKey, corp_code: corpCode });
  try {
    const { response, body } = await fetchJsonWithTimeout(`https://opendart.fss.or.kr/api/company.json?${query.toString()}`, {}, 1e4, 1);
    const company = {
      status: body.status,
      message: body.message,
      corp_code: body.corp_code,
      corp_name: body.corp_name,
      corp_name_eng: body.corp_name_eng,
      stock_name: body.stock_name,
      stock_code: body.stock_code,
      ceo_nm: body.ceo_nm,
      corp_cls: body.corp_cls,
      jurir_no: body.jurir_no,
      bizr_no: body.bizr_no,
      adres: body.adres,
      hm_url: body.hm_url,
      ir_url: body.ir_url,
      phn_no: body.phn_no,
      est_dt: body.est_dt,
      acc_mt: body.acc_mt
    };
    if (response.ok) await writeExternalApiCache(ctx, "opendart/company", cacheKey, { corp_code: corpCode }, company, response.status);
    await audit(ctx.serviceClient, ctx.user.id, "opendart/company", response.status, { corp_code: corpCode, cache_hit: false });
    if (!response.ok) {
      const stale = await readExternalApiCache(ctx, "opendart/company", cacheKey, true);
      if (stale) return externalApiCacheResponse(ctx, stale.providerStatus, stale.responsePayload, { hit: true, stale: true, fetched_at: stale.fetchedAt });
    }
    return jsonResponse({ ok: response.ok, provider_status: response.status, data: company, cache: { hit: false, stale: false } }, response.ok ? 200 : 502, ctx.origin);
  } catch (error) {
    const stale = await readExternalApiCache(ctx, "opendart/company", cacheKey, true);
    if (stale) return externalApiCacheResponse(ctx, stale.providerStatus, stale.responsePayload, { hit: true, stale: true, fetched_at: stale.fetchedAt, provider_error: error instanceof Error ? error.message : "provider error" });
    return fail(502, "OpenDART provider request failed", ctx.origin);
  }
}
async function callBuildingRegister(ctx, payload) {
  if (!hasRole(ctx.role, "Admin")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!checkRateLimit(ctx.user.id, "building-register/summary", 20)) return fail(429, "Rate limit exceeded", ctx.origin);
  const apiKey = Deno.env.get("BUILDING_REGISTER_API_KEY");
  if (!apiKey) return fail(503, "Building-register API key is not configured", ctx.origin);
  const cachePayload = {
    sigungu_cd: String(payload.sigungu_cd || ""),
    bjdong_cd: String(payload.bjdong_cd || ""),
    plat_gb_cd: String(payload.plat_gb_cd || "0"),
    bun: String(payload.bun || ""),
    ji: String(payload.ji || "")
  };
  const cacheKey = await cacheKeyFor("building-register/summary", cachePayload);
  const cached = await readExternalApiCache(ctx, "building-register/summary", cacheKey);
  if (cached) return externalApiCacheResponse(ctx, cached.providerStatus, cached.responsePayload, { hit: true, stale: false, fetched_at: cached.fetchedAt });
  const query = new URLSearchParams({
    serviceKey: apiKey,
    sigunguCd: cachePayload.sigungu_cd,
    bjdongCd: cachePayload.bjdong_cd,
    platGbCd: cachePayload.plat_gb_cd,
    bun: cachePayload.bun,
    ji: cachePayload.ji,
    _type: "json"
  });
  try {
    const { response, body } = await fetchJsonWithTimeout(`https://apis.data.go.kr/1613000/BldRgstService_v2/getBrTitleInfo?${query.toString()}`, {}, 12e3, 1);
    const item = body?.response?.body?.items?.item;
    const first = Array.isArray(item) ? item[0] : item;
    const summary = first ? {
      plat_plc: first.platPlc,
      new_plat_plc: first.newPlatPlc,
      bld_nm: first.bldNm,
      main_purps_cd_nm: first.mainPurpsCdNm,
      grnd_flr_cnt: first.grndFlrCnt,
      ugrnd_flr_cnt: first.ugrndFlrCnt,
      arch_area: first.archArea,
      tot_area: first.totArea,
      use_apr_day: first.useAprDay
    } : null;
    if (response.ok) await writeExternalApiCache(ctx, "building-register/summary", cacheKey, cachePayload, summary, response.status);
    await audit(ctx.serviceClient, ctx.user.id, "building-register/summary", response.status, { ...cachePayload, cache_hit: false });
    if (!response.ok) {
      const stale = await readExternalApiCache(ctx, "building-register/summary", cacheKey, true);
      if (stale) return externalApiCacheResponse(ctx, stale.providerStatus, stale.responsePayload, { hit: true, stale: true, fetched_at: stale.fetchedAt });
    }
    return jsonResponse({ ok: response.ok, provider_status: response.status, data: summary, cache: { hit: false, stale: false } }, response.ok ? 200 : 502, ctx.origin);
  } catch (error) {
    const stale = await readExternalApiCache(ctx, "building-register/summary", cacheKey, true);
    if (stale) return externalApiCacheResponse(ctx, stale.providerStatus, stale.responsePayload, { hit: true, stale: true, fetched_at: stale.fetchedAt, provider_error: error instanceof Error ? error.message : "provider error" });
    return fail(502, "Building-register provider request failed", ctx.origin);
  }
}
async function callNaverGeocode(ctx, payload) {
  if (!hasRole(ctx.role, "Admin")) return fail(403, "Insufficient logistics permission", ctx.origin);
  if (!checkRateLimit(ctx.user.id, "naver/geocode", 30)) return fail(429, "Rate limit exceeded", ctx.origin);
  const clientId = Deno.env.get("NAVER_CLOUD_CLIENT_ID") || Deno.env.get("NAVER_MAPS_CLIENT_ID");
  const clientSecret = Deno.env.get("NAVER_CLOUD_CLIENT_SECRET") || Deno.env.get("NAVER_MAPS_CLIENT_SECRET");
  if (!clientId || !clientSecret) return fail(503, "Naver geocoding key is not configured", ctx.origin);
  const queryText = String(payload.query || payload.address || "").trim();
  if (!queryText) return fail(400, "query is required", ctx.origin);
  const cacheKey = await cacheKeyFor("naver/geocode", { query: queryText });
  const cached = await readExternalApiCache(ctx, "naver/geocode", cacheKey);
  if (cached) return externalApiCacheResponse(ctx, cached.providerStatus, cached.responsePayload, { hit: true, stale: false, fetched_at: cached.fetchedAt });
  const query = new URLSearchParams({ query: queryText });
  try {
    const { response, body } = await fetchJsonWithTimeout(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?${query.toString()}`, {
      headers: {
        "x-ncp-apigw-api-key-id": clientId,
        "x-ncp-apigw-api-key": clientSecret
      }
    }, 1e4, 1);
    const addresses = Array.isArray(body.addresses) ? body.addresses.slice(0, 5).map((item) => ({
      road_address: item.roadAddress,
      jibun_address: item.jibunAddress,
      x: item.x,
      y: item.y,
      distance: item.distance
    })) : [];
    if (response.ok) await writeExternalApiCache(ctx, "naver/geocode", cacheKey, { query: queryText }, addresses, response.status);
    await audit(ctx.serviceClient, ctx.user.id, "naver/geocode", response.status, { query: queryText, cache_hit: false });
    if (!response.ok) {
      const stale = await readExternalApiCache(ctx, "naver/geocode", cacheKey, true);
      if (stale) return externalApiCacheResponse(ctx, stale.providerStatus, stale.responsePayload, { hit: true, stale: true, fetched_at: stale.fetchedAt });
    }
    return jsonResponse({ ok: response.ok, provider_status: response.status, data: addresses, cache: { hit: false, stale: false } }, response.ok ? 200 : 502, ctx.origin);
  } catch (error) {
    const stale = await readExternalApiCache(ctx, "naver/geocode", cacheKey, true);
    if (stale) return externalApiCacheResponse(ctx, stale.providerStatus, stale.responsePayload, { hit: true, stale: true, fetched_at: stale.fetchedAt, provider_error: error instanceof Error ? error.message : "provider error" });
    return fail(502, "Naver geocoding provider request failed", ctx.origin);
  }
}
Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (!isAllowedOrigin(origin)) return fail(403, "Origin not allowed", origin);
  if (request.method === "OPTIONS") return jsonResponse({ ok: true }, 200, origin);
  if (request.method !== "POST") return fail(405, "Method not allowed", origin);
  if (!assertLlAllowlist()) return fail(500, "Write allowlist is invalid", origin);
  let body = {};
  try {
    body = await request.json();
  } catch {
    return fail(400, "JSON body is required", origin);
  }
  const action = safeAction(body.action);
  const payload = body.payload || {};
  let ctx;
  try {
    ctx = await getContext(request, origin);
  } catch (error) {
    if (error instanceof Response) return fail(error.status, await error.text(), origin);
    return fail(500, "Authorization failed closed", origin);
  }
  if (action === "health") return jsonResponse({ ok: true, role: ctx.role }, 200, origin);
  if (action === "quality/findings") return listQualityFindings(ctx, payload);
  if (action === "edits/submit") return submitEdit(ctx, payload);
  if (action === "edits/list") return listEditRequests(ctx, payload);
  if (action === "edits/readback") return readbackEdit(ctx, payload);
  if (action === "edits/approve") return approveEdit(ctx, payload);
  if (action === "edits/reject") return rejectEdit(ctx, payload);
  if (action === "worklogs/list") return listWorklogs(ctx, payload);
  if (action === "worklogs") return saveWorklog(ctx, payload);
  if (action === "worklogs/update") return updateWorklog(ctx, payload);
  if (action === "worklogs/complete") return completeWorklog(ctx, payload);
  if (action === "worklogs/delete") return deleteWorklog(ctx, payload);
  if (action === "opendart/company") return callOpenDart(ctx, payload);
  if (action === "building-register/summary") return callBuildingRegister(ctx, payload);
  if (action === "naver/geocode") return callNaverGeocode(ctx, payload);
  if (action === "snapshot-refresh" || action === "cache-clear") {
    if (!hasRole(ctx.role, "Admin")) return fail(403, "Insufficient logistics permission", origin);
    await audit(ctx.serviceClient, ctx.user.id, action, 202, payload);
    return jsonResponse({ ok: true, message: `${action} accepted for server-side worker` }, 202, origin);
  }
  return fail(404, "Unknown action", origin);
});
