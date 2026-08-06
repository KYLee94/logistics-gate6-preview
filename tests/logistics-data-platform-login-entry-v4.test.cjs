const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('루트와 로그인 완료의 기본 진입점은 데이터 플랫폼 홈이며 인증 중 기존 홈을 렌더링하지 않는다', () => {
  const app = read('src/App.jsx');
  assert.match(app, /LOGISTICS_DATA_PLATFORM_HOME/u);
  assert.match(app, /LOGISTICS_DEFAULT_PATH\s*=\s*LOGISTICS_DATA_PLATFORM_HOME/u);
  assert.match(app, /isAuthResolving/u);
  assert.match(app, /data-testid=["']logistics-auth-resolving["']/u);
  assert.doesNotMatch(app, /logisticsPostLoginPath['"]\)\s*\|\|\s*LOGISTICS_WORKSPACE_PATH/u);

  const routes = read('src/components/system/workspace/logisticsRoutes.js');
  assert.match(routes, /['"]work-platform['"]:\s*LOGISTICS_INTERNAL_BASE/u);
  assert.match(routes, /LOGISTICS_DATA_PLATFORM_HOME/u);
});

test('플랫폼 shell은 Auth 사용자와 서버 권한 프로필이 같은 활성 subject로 검증된 뒤에만 렌더링한다', () => {
  const app = read('src/App.jsx');

  assert.match(
    app,
    /const\s+\{\s*user,\s*memberInfo,\s*loading,\s*permissionsLoading,\s*recoveryMode\s*\}\s*=\s*useAuth\(\)/u,
  );
  assert.match(
    app,
    /const\s+hasVerifiedPlatformAccess\s*=\s*Boolean\([\s\S]*?user[\s\S]*?!permissionsLoading[\s\S]*?memberInfo\?\.account_status\s*===\s*['"]active['"][\s\S]*?memberInfo\?\.auth_subject\s*===\s*user\.id[\s\S]*?\)/u,
  );
  assert.match(
    app,
    /const\s+isAuthResolving\s*=\s*isPlatformRoute[\s\S]*?\(loading\s*\|\|\s*permissionsLoading\)/u,
  );
  assert.match(
    app,
    /const\s+shouldShowAuthSetup[\s\S]*?recoveryMode[\s\S]*?!hasVerifiedPlatformAccess/u,
  );
  assert.match(
    app,
    /const\s+renderedPage[\s\S]*?isPlatformRoute\s*&&\s*!hasVerifiedPlatformAccess[\s\S]*?['"]auth-setup['"]/u,
  );
  assert.match(
    app,
    /!loading\s*&&\s*!permissionsLoading\s*&&\s*!hasVerifiedPlatformAccess\s*&&\s*isPlatformRoute/u,
  );
  assert.match(
    app,
    /!loading\s*&&\s*!permissionsLoading\s*&&\s*hasVerifiedPlatformAccess\s*&&\s*currentPage\s*===\s*['"]auth-setup['"]/u,
  );
});

test('로그인 이력 버튼·모달·새로고침·저장 조회 계약은 그대로 유지한다', () => {
  const nav = read('src/components/system/IotaLeftNav.jsx');
  for (const token of [
    'logistics-login-history-button',
    'logistics-login-history-modal',
    'logistics-login-history-refresh',
    'logistics-login-history-close',
    'auth/login-history/list',
  ]) {
    assert.ok(nav.includes(token), `로그인 이력 계약이 누락됐습니다: ${token}`);
  }
  const dataPlatformBranch = nav.match(/if \(isDataPlatformActive\) \{([\s\S]*?)\n\s*if \(isLogisticsPath\)/u)?.[1] || '';
  assert.match(dataPlatformBranch, /logistics-login-history-button/u);
  assert.match(dataPlatformBranch, /logistics-login-history-modal/u);
  assert.match(dataPlatformBranch, /loadLoginHistory/u);
});

test('다른 브라우저에서 돌아와도 검증된 화면을 인증 로딩 화면으로 되돌리지 않는다', () => {
  const auth = read('src/context/AuthContext.jsx');
  assert.doesNotMatch(auth, /window\.addEventListener\(['"]focus['"],\s*handleWindowFocus\)/u);
  assert.doesNotMatch(auth, /window\.addEventListener\(['"]pageshow['"],\s*handleWindowFocus\)/u);
  assert.match(auth, /const\s+shouldBlockForPermissions\s*=\s*!hasVerifiedMemberForSession\(session\)/u);
  assert.match(auth, /if\s*\(shouldBlockForPermissions\)\s*setPermissionsLoading\(true\)/u);
  assert.match(auth, /if\s*\(isCurrent\(\)\s*&&\s*shouldBlockForPermissions\)\s*setPermissionsLoading\(false\)/u);
  assert.match(auth, /document\.addEventListener\(['"]visibilitychange['"],\s*handleVisibilityChange\)/u);
});
