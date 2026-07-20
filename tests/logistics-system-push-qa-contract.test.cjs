const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'qa', 'logistics-system-push-live-smoke.cjs');

function scriptSource() {
  return fs.readFileSync(SCRIPT_PATH, 'utf8');
}

test('system push live QA identifies and validates the requested browser executable through CDP', () => {
  const source = scriptSource();

  assert.match(source, /--browser(?:=|\s)/u);
  assert.match(source, /--executable(?:=|\s)/u);
  assert.match(source, /(?:chrome|whale)/u);
  assert.match(source, /\/json\/version/u);
  assert.match(source, /Browser/u);
  assert.match(source, /User-Agent/u);
  assert.match(source, /executable_path/u);
  assert.match(source, /permission_mode/u);
  assert.match(source, /target_browser_verified/u);
  assert.match(source, /naver_work\.exe/u);
});

test('system push live QA proves subscription persistence and notification identity with server readback', () => {
  const source = scriptSource();

  assert.match(source, /insert into public\.ll_notifications[\s\S]{0,1800}returning notification_id/u);
  assert.match(source, /ll_notification_subscriptions/u);
  assert.match(source, /subscription_saved/u);
  assert.match(source, /server_readback/u);
  assert.match(source, /waitForServerAcceptance/u);
  assert.match(source, /net\._http_response/u);
  assert.doesNotMatch(source, /server_accepted:\s*true/u);
  assert.doesNotMatch(source, /getNotifications\s*\(/u);
});

test('system push live QA waits for per-notification service-worker stages instead of fixed delivery delays', () => {
  const source = scriptSource();

  assert.match(source, /notification_id/u);
  assert.match(source, /'received'/u);
  assert.match(source, /'shown'/u);
  assert.match(source, /'failed'/u);
  assert.match(source, /sw_push_received/u);
  assert.match(source, /show_notification_called/u);
  assert.match(source, /serviceWorker\.addEventListener\('message'/u);
  assert.match(source, /waitFor.*Stage|waitForStage/u);
  assert.doesNotMatch(source, /waitForTimeout\s*\(/u);
  assert.doesNotMatch(source, /captureDesktop\s*\(/u);
});

test('system push live QA keeps server, service worker, and OS display verdicts separate', () => {
  const source = scriptSource();

  for (const key of ['server_accepted', 'sw_push_received', 'show_notification_called', 'os_display_confirmed']) {
    assert.match(source, new RegExp(key, 'u'));
  }
  assert.match(source, /cdp_override/u);
  assert.match(source, /os_display_confirmed[\s\S]{0,700}(?:false|'not_verified'|"not_verified")/u);
  assert.match(source, /process\.platform === 'darwin'/u);
  assert.match(source, /report\.ok\s*=\s*report\.actual_system_notification_success/u);
  assert.doesNotMatch(source, /desktop_screenshots_written/u);
});

test('system push live QA records the browser-side cause when a subscription endpoint is absent', () => {
  const source = scriptSource();

  for (const key of [
    'ui_push_state',
    'browser_push_diagnostics',
    'service_worker_controller',
    'ready_registration',
    'push_manager_supported',
    'vapid_key_shape',
    'direct_subscribe_probe',
    'directSubscribeProbe',
    'Push runtime config returned a public key',
  ]) {
    assert.match(source, new RegExp(key, 'u'));
  }
  assert.match(source, /finally\s*\{[\s\S]{0,2200}page\.screenshot/u);
});

test('system push live QA accepts the linked Supabase query boolean marker format', () => {
  const source = scriptSource();

  assert.match(source, /\[\|:=\]/u);
  assert.match(source, /qa_subscription_saved/u);
  assert.match(source, /qa_provider_accepted/u);
});

test('CDP live QA passes only the verifiable pipeline while retaining a separate OS-display verdict', () => {
  const source = scriptSource();

  assert.match(source, /actual_system_notification_success/u);
  assert.match(source, /options\.permissionMode === 'cdp_override' && report\.pipeline_ok/u);
  assert.match(source, /report\.ok\s*=\s*report\.actual_system_notification_success/u);
  assert.match(source, /PIPELINE PASS \(OS NOT VERIFIED\)/u);
});
