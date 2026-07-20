const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const PUSH_EDGE_PATH = path.join(ROOT, 'supabase', 'functions', 'll-push-notifications', 'index.ts');

test('push edge reports provider acceptance separately from browser display and handles expired subscriptions', () => {
  const source = fs.readFileSync(PUSH_EDGE_PATH, 'utf8');

  assert.match(source, /expires_at:\s*string\s*\|\s*null/u, 'subscription rows must expose their existing expiry timestamp');
  assert.match(source, /select\('id,endpoint,p256dh_key,auth_key,expires_at'\)/u, 'the subscription query must read expires_at');
  assert.match(source, /expires_at\.is\.null,expires_at\.gt\./u, 'expired subscriptions must be excluded before provider delivery');
  assert.match(source, /attempted:\s*attempted/u, 'the response must expose attempted deliveries');
  assert.match(source, /provider_accepted:\s*providerAccepted/u, 'the response must expose provider acceptance separately');
  assert.match(source, /failed:\s*failed/u, 'the response must expose failed delivery attempts');
  assert.match(source, /removed_expired:\s*removedExpired/u, 'the response must expose successful 404/410 subscription cleanup');
  assert.match(source, /outcome:\s*pushOutcome/u, 'the response must expose a machine-readable outcome');
  assert.match(source, /notification_id:\s*notificationId/u, 'the response must correlate provider acceptance to the source notification');
  assert.match(source, /ok:\s*providerAccepted\s*>\s*0/u, 'zero provider acceptances must not report success');
  assert.match(source, /statusCode === 404 \|\| statusCode === 410/u, '404/410 subscriptions must be treated as expired');
  assert.match(source, /\.delete\(\)[\s\S]{0,160}\.eq\('id', subscription\.id\)/u, '404/410 subscriptions must be deleted by id');
  assert.match(source, /failure_status_counts/u, 'non-expiry failures must be aggregated by HTTP status');
  assert.match(source, /console\.error\('ll_push_notification_delivery_result',/u, 'delivery failures must emit a structured, sanitized log event');
  assert.doesNotMatch(source, /\bsent\s*:/u, 'provider acceptance must not be reported as browser-display success');
  assert.match(source, /ok:\s*false,\s*outcome:\s*'ignored'/u, 'ignored webhooks must not be reported as successful delivery');
});

test('push edge keeps offline notifications deliverable and retries only transient delivery failures', () => {
  const source = fs.readFileSync(PUSH_EDGE_PATH, 'utf8');

  assert.match(source, /const WEB_PUSH_TTL_SECONDS = 24 \* 60 \* 60;/u, 'push TTL must retain notifications for at least 24 hours');
  assert.match(source, /TTL:\s*WEB_PUSH_TTL_SECONDS/u, 'provider delivery must use the 24-hour TTL constant');
  assert.match(source, /const MAX_DELIVERY_RETRIES = 3;/u, 'transient delivery retries must be capped at three');
  assert.match(source, /function isRetryableProviderFailure\(statusCode: number \| null, error: unknown\)/u, 'retry eligibility must be explicit and testable');
  assert.match(source, /statusCode === 429 \|\| \(statusCode !== null && statusCode >= 500 && statusCode <= 599\)/u, 'only rate limits and 5xx responses may be retried by HTTP status');
  assert.match(source, /isNetworkException\(error\)/u, 'network exceptions must be retried separately from non-HTTP provider failures');
  assert.match(source, /retryCount >= MAX_DELIVERY_RETRIES/u, 'delivery retries must stop at the configured bound');
  assert.match(source, /Math\.min\(MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS \* 2 \*\* retryCount\)/u, 'retry delays must use a bounded exponential backoff');
  assert.match(source, /function webPushTopic\(notificationId: string\)/u, 'the notification id must be normalized into a Web Push topic');
  assert.match(source, /notificationId\.replace\(\/\[\^A-Za-z0-9_-\]\/g, '_'\)\.slice\(0, 32\)/u, 'the Web Push topic must be URL-safe and at most 32 characters');
  assert.match(source, /topic:\s*webPushTopic\(taskShare\.notification_id\)/u, 'all attempts for one notification must use the same Web Push topic header');
});
