import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type WebhookRecord = {
  notification_id?: unknown;
};

type DatabaseWebhook = {
  type?: unknown;
  table?: unknown;
  schema?: unknown;
  record?: unknown;
};

type NotificationRow = {
  notification_id: string;
  recipient_user_id: string | null;
  notification_type: string;
  title: string;
  body: string;
  payload: unknown;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  expires_at: string | null;
};

type PushRuntimeConfig = {
  public_key?: unknown;
  private_key?: unknown;
  subject?: unknown;
  webhook_secret?: unknown;
};

const encoder = new TextEncoder();
const BUSINESS_NOTIFICATION_TYPES = ['task_share', 'data_update', 'lease_maturity', 'loan_maturity', 'system'];
const WEB_PUSH_TTL_SECONDS = 24 * 60 * 60;
const MAX_DELIVERY_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 2_000;
const NETWORK_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function hasExpectedWebhookSecret(request: Request, expected: string) {
  const received = request.headers.get('x-webhook-secret');
  if (!received || !expected) return false;

  const [receivedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const receivedBytes = new Uint8Array(receivedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < receivedBytes.length; index += 1) {
    difference |= receivedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

function notificationPath(payload: unknown) {
  const candidate = isRecord(payload) ? text(payload.route ?? payload.path, 500) : '';
  return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/logistics-gate6-preview/work-platform';
}

function providerFailureStatus(error: unknown) {
  const statusCode = Number((error as { statusCode?: unknown }).statusCode);
  return Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 ? statusCode : null;
}

function isNetworkException(error: unknown) {
  if (!isRecord(error)) return false;
  const code = text(error.code, 100).toUpperCase();
  const name = text(error.name, 100);
  return NETWORK_ERROR_CODES.has(code) || name === 'AbortError';
}

function isRetryableProviderFailure(statusCode: number | null, error: unknown) {
  return statusCode === 429 || (statusCode !== null && statusCode >= 500 && statusCode <= 599) || isNetworkException(error);
}

function webPushTopic(notificationId: string) {
  return notificationId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
}

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'push_not_configured' });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: configRows, error: configError } = await serviceClient.rpc('ll_web_push_runtime_config');
  const config = (Array.isArray(configRows) ? configRows[0] : configRows) as PushRuntimeConfig | null;
  if (configError || !config) return json(500, { error: 'push_config_read_failed' });
  const publicKey = text(config.public_key, 500);
  const privateKey = text(config.private_key, 500);
  const vapidSubject = text(config.subject, 500);
  const webhookSecret = text(config.webhook_secret, 500);
  if (!publicKey || !privateKey || !vapidSubject || !webhookSecret) return json(500, { error: 'push_not_configured' });
  if (!(await hasExpectedWebhookSecret(request, webhookSecret))) return json(401, { error: 'invalid_webhook_secret' });

  const rawBody = await request.json().catch(() => null);
  if (!isRecord(rawBody)) return json(400, { error: 'invalid_payload' });
  const webhook = rawBody as DatabaseWebhook;
  if (webhook.type !== 'INSERT' || webhook.schema !== 'public' || webhook.table !== 'll_notifications' || !isRecord(webhook.record)) {
    return json(202, { ok: false, outcome: 'ignored', ignored: true });
  }

  const notificationId = text((webhook.record as WebhookRecord).notification_id, 100);
  if (!notificationId) return json(400, { error: 'notification_id_required' });

  const { data: notification, error: notificationError } = await serviceClient
    .from('ll_notifications')
    .select('notification_id,recipient_user_id,notification_type,title,body,payload,delivery_status')
    .eq('notification_id', notificationId)
    .in('notification_type', BUSINESS_NOTIFICATION_TYPES)
    .neq('delivery_status', 'dismissed')
    .maybeSingle();
  if (notificationError) return json(500, { error: 'notification_read_failed' });
  if (!notification) return json(202, { ok: false, outcome: 'ignored', ignored: true, notification_id: notificationId });

  const taskShare = notification as NotificationRow;
  if (!taskShare.recipient_user_id) return json(202, { ok: true, ignored: true });

  const { data: subscriptions, error: subscriptionsError } = await serviceClient
    .from('ll_notification_subscriptions')
    .select('id,endpoint,p256dh_key,auth_key,expires_at')
    .eq('user_id', taskShare.recipient_user_id)
    .eq('enabled', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  if (subscriptionsError) return json(500, { error: 'subscription_read_failed' });

  const payload = JSON.stringify({
    notification_id: taskShare.notification_id,
    title: text(taskShare.title, 200),
    body: text(taskShare.body, 1000),
    path: notificationPath(taskShare.payload),
  });
  const results = await Promise.all((subscriptions || []).map(async (subscription: SubscriptionRow) => {
    let retryCount = 0;
    while (true) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_key },
        }, payload, {
          vapidDetails: { subject: vapidSubject, publicKey, privateKey },
          TTL: WEB_PUSH_TTL_SECONDS,
          topic: webPushTopic(taskShare.notification_id),
          urgency: 'high',
        });
        return { providerAccepted: true, removedExpired: false, failureStatus: null };
      } catch (error) {
        const statusCode = providerFailureStatus(error);
        if (statusCode === 404 || statusCode === 410) {
          const { error: deletionError } = await serviceClient
            .from('ll_notification_subscriptions')
            .delete()
            .eq('id', subscription.id);
          return { providerAccepted: false, removedExpired: !deletionError, failureStatus: null };
        }
        if (!isRetryableProviderFailure(statusCode, error) || retryCount >= MAX_DELIVERY_RETRIES) {
          return { providerAccepted: false, removedExpired: false, failureStatus: statusCode === null ? 'unknown' : String(statusCode) };
        }
        const delayMs = Math.min(MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** retryCount);
        retryCount += 1;
        await sleep(delayMs);
      }
    }
  }));

  const attempted = results.length;
  const providerAccepted = results.filter((result) => result.providerAccepted).length;
  const failed = attempted - providerAccepted;
  const removedExpired = results.filter((result) => result.removedExpired).length;
  const failureStatusCounts = results.reduce<Record<string, number>>((counts, result) => {
    if (result.failureStatus) counts[result.failureStatus] = (counts[result.failureStatus] || 0) + 1;
    return counts;
  }, {});
  const pushOutcome = attempted === 0
    ? 'no_active_subscriptions'
    : providerAccepted === 0
      ? 'no_provider_acceptance'
      : failed > 0
        ? 'partial_provider_acceptance'
        : 'provider_accepted';

  if (Object.keys(failureStatusCounts).length > 0) {
    console.error('ll_push_notification_delivery_result', {
      outcome: pushOutcome,
      attempted,
      provider_accepted: providerAccepted,
      failed,
      removed_expired: removedExpired,
      failure_status_counts: failureStatusCounts,
    });
  }

  return json(200, {
    ok: providerAccepted > 0,
    notification_id: notificationId,
    outcome: pushOutcome,
    attempted: attempted,
    provider_accepted: providerAccepted,
    failed: failed,
    removed_expired: removedExpired,
    failure_status_counts: failureStatusCounts,
  });
});
