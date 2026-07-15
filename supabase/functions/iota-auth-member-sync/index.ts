import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'https://kylee94.github.io',
]);

function isAllowedOrigin(origin: string | null) {
  return origin !== null && allowedOrigins.has(origin);
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAccountStatus(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function corsHeaders(origin: string | null) {
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'origin',
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(origin)) return json(403, { error: 'origin_not_allowed' }, origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(500, { error: 'server_not_configured' }, origin);

  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'missing_authorization' }, origin);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData.user?.id || !userData.user.email) return json(401, { error: 'invalid_jwt' }, origin);

  const jwtUserId = userData.user.id;
  const jwtEmail = normalizeEmail(userData.user.email);
  if (!jwtEmail) return json(401, { error: 'invalid_jwt' }, origin);

  const rawBody = await req.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return json(400, { error: 'invalid_payload' }, origin);
  }
  const body = rawBody as Record<string, unknown>;
  const action = String(body.action || '');
  const requestedEmail = normalizeEmail(body.email);
  const requestedAuthId = String(body.auth_id || '').trim();
  if (requestedEmail && requestedEmail !== jwtEmail) return json(403, { error: 'email_scope_denied' }, origin);
  if (requestedAuthId && requestedAuthId !== jwtUserId) return json(403, { error: 'auth_id_scope_denied' }, origin);
  if (action === 'first_login') {
    if (!requestedAuthId) return json(403, { error: 'auth_id_scope_denied' }, origin);
  } else if (action !== 'login') {
    return json(400, { error: 'unknown_action' }, origin);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: permissionData, error: readError } = await serviceClient
    .from('ll_user_permissions')
    .select('user_id,email,account_status')
    .not('email', 'is', null)
    .is('scope_type', null)
    .is('scope_id', null)
    .ilike('email', jwtEmail)
    .limit(3);
  if (readError) return json(500, { error: 'permission_read_failed' }, origin);

  const permissionRows = ((permissionData || []) as Array<Record<string, unknown>>)
    .filter((row) => normalizeEmail(row.email) === jwtEmail);
  if (permissionRows.length !== 1) {
    return json(403, { error: permissionRows.length ? 'ambiguous_permission_profile' : 'permission_profile_not_found' }, origin);
  }
  const permission = permissionRows[0];
  if (normalizeEmail(permission.email) !== jwtEmail) return json(403, { error: 'permission_profile_not_found' }, origin);
  if (normalizeAccountStatus(permission.account_status) !== 'active') {
    return json(403, { error: 'inactive_permission_profile' }, origin);
  }

  const { data: updatedRows, error: updateError } = await serviceClient
    .from('ll_user_permissions')
    .update({
      user_id: jwtUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('email', permission.email)
    .is('scope_type', null)
    .is('scope_id', null)
    .select('user_id');
  if (updateError || updatedRows?.length !== 1) return json(500, { error: 'permission_link_failed' }, origin);

  return json(200, { ok: true, mode: 'identity_linked' }, origin);
});
