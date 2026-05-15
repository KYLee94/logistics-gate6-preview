import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://kylee94.github.io',
  'https://this8369.github.io',
]);

function isAllowedOrigin(origin: string | null) {
  return !origin || allowedOrigins.has(origin);
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
  if (!supabaseUrl || !anonKey) return json(500, { error: 'server_not_configured' }, origin);

  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'missing_authorization' }, origin);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData.user?.email) return json(401, { error: 'invalid_jwt' }, origin);

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const action = String(body.action || '');
  const authId = body.auth_id ? String(body.auth_id) : undefined;
  if (!email || email !== userData.user.email.toLowerCase()) return json(403, { error: 'email_scope_denied' }, origin);
  if (action === 'first_login') {
    if (!authId || authId !== userData.user.id) return json(403, { error: 'auth_id_scope_denied' }, origin);
  } else if (action !== 'login') {
    return json(400, { error: 'unknown_action' }, origin);
  }

  return json(202, {
    ok: true,
    mode: 'read_only_noop',
    message: 'IOTA member sync is disabled for the logistics gate because non-ll_* writes are not allowed.',
  }, origin);
});
