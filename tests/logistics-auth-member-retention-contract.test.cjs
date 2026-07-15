const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const AUTH_CONTEXT_PATH = path.join(ROOT, 'src', 'context', 'AuthContext.jsx');
const LEFT_NAV_PATH = path.join(ROOT, 'src', 'components', 'system', 'IotaLeftNav.jsx');
const WORKSPACE_PATH = path.join(ROOT, 'src', 'components', 'system', 'workspace', 'WorkspaceLogistics.jsx');

function sourceBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing marker: ${marker}`);
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `missing block: ${marker}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated block: ${marker}`);
}

test('same-subject revalidation retains verified feature access until auth/me resolves', () => {
  const source = fs.readFileSync(AUTH_CONTEXT_PATH, 'utf8');
  const authCallback = sourceBlock(source, 'supabase.auth.onAuthStateChange(');
  const signedIn = sourceBlock(authCallback, "if (event === 'SIGNED_IN')");
  const returnRevalidation = sourceBlock(source, 'const revalidateAfterReturn = async () =>');

  assert.match(source, /const tokenSubject = String\(JSON\.parse\(window\.atob\(paddedPayload\)\)\?\.sub \|\| ''\)\.trim\(\);[\s\S]*tokenSubject === userId/u);
  assert.match(source, /const hasVerifiedMemberForSession = useCallback\(/u);
  assert.match(source, /const fetchMemberInfo = useCallback\(/u);
  assert.match(source, /\}, \[clearVerifiedMemberInfo, fetchMemberInfo, handleSignOut, hasVerifiedMemberForSession, setRecoveryMode\]\);/u);
  assert.match(source, /const hasVerifiedMemberForSession = useCallback\(\(session\) =>[\s\S]*subject === verifiedMemberSubjectRef\.current/u);
  assert.match(authCallback, /if \(!hasVerifiedMemberForSession\(session\)\)[\s\S]*clearVerifiedMemberInfo\(\)[\s\S]*if \(event === 'SIGNED_IN'\)/u);
  assert.doesNotMatch(signedIn, /setMemberInfo\(null\)/u);
  assert.match(returnRevalidation, /if \(!hasVerifiedMemberForSession\(session\)\)[\s\S]*clearVerifiedMemberInfo\(\)/u);
  assert.doesNotMatch(returnRevalidation, /catch \(error\)[\s\S]*setMemberInfo\(null\)/u);
});

test('only verified auth/me denials clear retained member access', () => {
  const source = fs.readFileSync(AUTH_CONTEXT_PATH, 'utf8');
  const fetchMemberInfo = sourceBlock(source, 'const fetchMemberInfo = useCallback');

  assert.match(fetchMemberInfo, /const confirmedFailure = data\?\.ok === false[\s\S]*\[401, 403\]\.includes\(Number\(error\?\.status\)\)/u);
  assert.match(fetchMemberInfo, /if \(confirmedFailure && shouldCommit\(\)\)[\s\S]*clearVerifiedMemberInfo\(\)/u);
  assert.doesNotMatch(fetchMemberInfo, /catch \(error\)[\s\S]*clearVerifiedMemberInfo\(\)/u);
});

test('navigation derives menu visibility from verified memberInfo, not the loading flag', () => {
  const source = fs.readFileSync(LEFT_NAV_PATH, 'utf8');
  const logisticsNav = sourceBlock(source, 'if (isLogisticsPath)');

  assert.match(logisticsNav, /const canDisplayItem = \(item\) => !item\.requiredFeature \|\| memberHasFeatureAccess\(item\.requiredFeature, memberInfo\)/u);
  assert.doesNotMatch(logisticsNav, /permissionsLoading/u);
});

test('workspace retains a verified screen during permission refresh without reintroducing a static permission source', () => {
  const source = fs.readFileSync(WORKSPACE_PATH, 'utf8');
  const readBridge = sourceBlock(source, 'function useDashboardReadBridge');

  assert.match(source, /function hasVerifiedActiveMemberInfo\(memberInfo\)[\s\S]*account_status[\s\S]*auth_subject/u);
  assert.match(readBridge, /const \{ memberInfo, permissionsLoading \} = useAuth\(\);[\s\S]*const retainVerifiedPermissionRead = permissionsLoading && hasVerifiedActiveMemberInfo\(memberInfo\)/u);
  assert.match(readBridge, /if \(authFailure && retainVerifiedPermissionRead\) return;/u);
  assert.match(source, /export default function WorkspaceLogistics\(\{ currentPath = '' \}\) \{[\s\S]*const \{ memberInfo, permissionsLoading \} = useAuth\(\);[\s\S]*const canReadWorkspace = canUseAnyAssetPermission\(permission, 'read'\) \|\| retainVerifiedPermissionRead/u);
  assert.match(source, /function DashboardShell\(\{ activeModule \}\) \{[\s\S]*const \{ memberInfo, permissionsLoading \} = useAuth\(\);[\s\S]*const canOpenRequestedModule = \(canUseAnyAssetPermission\(permission, 'read'\) \|\| retainVerifiedPermissionRead\)/u);
  assert.doesNotMatch(source, /logisticsPermissionData\.json|import\.meta\.glob\('\.\/logistics(?:Asset|Company)Data/u);
});
