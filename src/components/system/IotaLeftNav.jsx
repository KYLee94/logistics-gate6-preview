import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import { LOGISTICS_INTERNAL_BASE, normalizeLogisticsPath, pathForLogisticsUrl } from './workspace/logisticsRoutes';
import UserAvatar from './UserAvatar';

const menuItems = [
    {
        id: 1,
        label: '홈',
        path: 'platform/iotaseoul/dashboard',
        
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        id: 7,
        label: '전체 업무 현황',
        path: 'platform/iotaseoul/workflow',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
    {
        id: 2,
        label: 'Vehicle 통합',
        path: 'platform/iotaseoul/vehicle-integrated',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
        subItems: [
            {
                id: 'integrated',
                label: 'Vehicle 통합구조',
                path: 'platform/iotaseoul/vehicle-integrated'
            },
            {
                id: 3,
                label: 'IOTA One 427',
                path: 'platform/iotaseoul/iota-one-427'
            },
            {
                id: 4,
                label: 'IOTA Two 816',
                path: 'platform/iotaseoul/iota-two-816'
            },
            {
                id: 5,
                label: '421 Fund',
                path: 'platform/iotaseoul/421-fund'
            },
            {
                id: 'vision-book',
                label: 'IOTA Seoul Vision Book',
                path: 'external/vision-book',
                externalUrl: 'https://iotaseoul.site/'
            }
        ]
    },
    {
        id: 6,
        label: 'Iota Project REITs',
        path: 'platform/iotaseoul/project-reits',
        icon: (
            <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
        ),
    },
];

const workspaceItems = [
    {
        label: '사업 PM',
        path: 'platform/iotaseoul/workspace/pm',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    },
    {
        label: '파이낸싱-LFC',
        path: 'platform/iotaseoul/workspace/financing',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
        label: '개발솔루션-DSC',
        path: 'platform/iotaseoul/workspace/development',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
    },
    {
        label: '기업마케팅-EMC',
        path: 'platform/iotaseoul/workspace/marketing',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
    },
    {
        label: '상품·디지털-SSC',
        path: 'platform/iotaseoul/workspace/digital',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    },
    {
        label: '펀드운용-KAM',
        path: 'platform/iotaseoul/workspace/fund',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    {
        label: 'IPR-WG',
        path: 'platform/iotaseoul/workspace/ipr',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
    },
    {
        label: '물류센터 워크 플랫폼',
        path: 'platform/iotaseoul/workspace/logistics',
        icon: <svg className="w-4.5 h-4.5 mr-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7M8 11h8M8 15h5M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" /></svg>
    }
];

const LOGISTICS_ADMIN_NAMES = new Set(['이시정', '전기영', '이관용', '\uC815\uD558\uC724']);
const LOGISTICS_FEATURE_ACCESS_CACHE_KEY = 'logisticsFeatureAccessConfig';
const LOGISTICS_FEATURES = [
    { key: 'ai_chat', label: 'AI 챗봇', description: '워크 플랫폼 우측 AI 챗봇 열기 및 질문' },
    { key: 'data_quality', label: 'Data Quality 탭', description: '무결성 점검 결과 조회 및 수정 요청' },
    { key: 'analysis_tools', label: 'Analysis Tools 탭', description: '자산·기업 비교 분석' },
    { key: 'data_playground', label: 'Pivot Table 탭', description: '권한 범위 데이터 피벗 분석' },
    { key: 'login_history', label: '로그인 이력', description: '권한자 로그인 이력 및 상태 조회' },
    { key: 'building_register_refresh', label: '건축물대장 새로고침', description: '건축물대장 API 재호출 및 Supabase 저장' },
    { key: 'opendart_refresh', label: 'OpenDART 새로고침', description: 'OpenDART API 재호출 및 Supabase 저장' },
];
const FEATURE_ACCESS_DEFAULT_USERS = []; /*
    { staff_name: '이관용', organization: '기획추진센터', email: 'kylee@igisam.com' },
    { staff_name: '전기영', organization: '기획추진센터', email: 'jk.jeon@igisam.com' },
    { staff_name: '이시정', organization: '기획추진센터', email: 'sjlee@igisam.com' },
    { staff_name: '\uC815\uD558\uC724', organization: '\uC790\uC0B0\uAD00\uB9AC1\uD30C\uD2B81', email: 'hayun.jeong@igisam.com' },
*/
const FEATURE_ACCESS_DEFAULT_EMAIL_BY_NAME = new Map(FEATURE_ACCESS_DEFAULT_USERS.map((row) => [row.staff_name, row.email]));
const LOGIN_CAPABILITY_SORT_COLUMNS = [
    { key: 'organization', label: '조직', type: 'text' },
    { key: 'staff_name', label: '이름', type: 'text' },
    { key: 'logistics_role', label: '권한', type: 'text' },
    { key: 'login_status', label: '상태', type: 'text' },
    { key: 'last_sign_in_at', label: '최근 로그인', type: 'date' },
];
const formatLoginHistoryTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};
const loginSortCellValue = (row, column) => {
    if (column.type === 'date') {
        const time = Date.parse(row?.[column.key] || '');
        return Number.isNaN(time) ? null : time;
    }
    return String(row?.[column.key] || '').trim().toLocaleLowerCase('ko-KR');
};
const compareLoginRows = (left, right, sortConfig) => {
    const column = LOGIN_CAPABILITY_SORT_COLUMNS.find((item) => item.key === sortConfig.key) || LOGIN_CAPABILITY_SORT_COLUMNS[0];
    const leftValue = loginSortCellValue(left, column);
    const rightValue = loginSortCellValue(right, column);
    if (leftValue == null || leftValue === '') return rightValue == null || rightValue === '' ? 0 : 1;
    if (rightValue == null || rightValue === '') return -1;
    const result = column.type === 'date'
        ? Number(leftValue) - Number(rightValue)
        : String(leftValue).localeCompare(String(rightValue), 'ko-KR', { numeric: true, sensitivity: 'base' });
    return sortConfig.direction === 'asc' ? result : -result;
};
const LoginSortableHeader = ({ column, sortConfig, onSort }) => {
    const active = sortConfig.key === column.key;
    return (
        <th className="px-4 py-3 font-semibold">
            <button
                type="button"
                aria-label={`${column.label} 정렬`}
                onClick={() => onSort(column.key)}
                className="flex items-center gap-1 rounded-[6px] text-left font-semibold transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-[#5E9EFF]"
            >
                <span>{column.label}</span>
                <span className={`text-[10px] leading-none ${active ? 'text-white' : 'text-[#5F5F64]'}`} aria-hidden="true">
                    {active ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </span>
            </button>
        </th>
    );
};
const NOTIFICATION_STATUS_LABELS = {
    written: '정규 DB 반영 완료',
    submitted: '승인 확인 필요',
    auto_write_running: '정규 DB 반영 중',
    rejected: '반려',
};
const NOTIFICATION_EVENT_TYPE_LABELS = {
    new_lease: '신규 계약',
    rent_change: '임대료/관리비 변경',
    archive: '만료/공실 전환',
    correction: '오입력 정정',
};
const parseNotificationPayload = (value) => {
    if (!value || typeof value !== 'string') return value && typeof value === 'object' ? value : {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};
const LOGISTICS_NOTIFICATION_CACHE_KEY = 'logistics-notifications-cache:v1';
const readCachedNotifications = () => {
    try {
        if (typeof localStorage === 'undefined') return [];
        const rows = JSON.parse(localStorage.getItem(LOGISTICS_NOTIFICATION_CACHE_KEY) || '[]');
        return Array.isArray(rows) ? rows : [];
    } catch {
        return [];
    }
};
const writeCachedNotifications = (rows = []) => {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(LOGISTICS_NOTIFICATION_CACHE_KEY, JSON.stringify(rows.slice(0, 80)));
    } catch {
        // Cache write failure should not block the notification panel.
    }
};
const compactFeatureAccessUserRow = (user = {}) => {
    const row = user || {};
    const staffName = String(row.staff_name || row.name || '').trim();
    return {
        email: String(row.email || FEATURE_ACCESS_DEFAULT_EMAIL_BY_NAME.get(staffName) || '').trim().toLowerCase(),
        staff_name: staffName,
        organization: String(row.organization || '').trim(),
        logistics_role: String(row.logistics_role || '').trim(),
    };
};
const featureUserKeys = (user = {}) => {
    const row = compactFeatureAccessUserRow(user);
    return [
        row.email,
        row.staff_name,
        row.organization && row.staff_name ? `${row.organization}|${row.staff_name}` : '',
    ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);
};
const featureUserKey = (user = {}) => featureUserKeys(user)[0] || '';
const mergeFeatureAccessUsers = (rows = []) => {
    const byKey = new Map();
    rows.map(compactFeatureAccessUserRow).forEach((row) => {
        const keys = featureUserKeys(row);
        if (!keys.length) return;
        const existingKey = keys.find((key) => byKey.has(key));
        const next = existingKey ? { ...byKey.get(existingKey), ...row, email: row.email || byKey.get(existingKey).email } : row;
        keys.forEach((key) => byKey.set(key, next));
    });
    return [...new Set([...byKey.values()])];
};
const featureUserLabel = (user = {}) => {
    const row = user || {};
    return [row.organization, row.staff_name || row.name, row.email].filter(Boolean).join(' · ') || '사용자';
};
const readFeatureAccessConfig = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(LOGISTICS_FEATURE_ACCESS_CACHE_KEY) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { features: {} };
    } catch {
        return { features: {} };
    }
};
const normalizeFeatureAccessConfig = (config = {}) => ({
    ...config,
    features: LOGISTICS_FEATURES.reduce((acc, feature) => {
        const row = config.features?.[feature.key] && typeof config.features[feature.key] === 'object' ? config.features[feature.key] : {};
        acc[feature.key] = {
            key: feature.key,
            label: feature.label,
            users: Array.isArray(row.users) ? row.users : [],
        };
        return acc;
    }, {}),
});
const featureAccessHasUser = (config, featureKey, user) => {
    const targetKeys = new Set(featureUserKeys(user));
    return Boolean(targetKeys.size && (config.features?.[featureKey]?.users || []).some((row) => (
        featureUserKeys(row).some((key) => targetKeys.has(key))
    )));
};
const isDefaultFeatureAccessUser = (user = {}) => {
    const keys = new Set(featureUserKeys(user));
    return FEATURE_ACCESS_DEFAULT_USERS.some((defaultUser) => featureUserKeys(defaultUser).some((key) => keys.has(key)));
};
const featureAccessHasEffectiveUser = (config, featureKey, user) => (
    isDefaultFeatureAccessUser(user) || featureAccessHasUser(config, featureKey, user)
);
const featureAccessGrantedUsers = (config, featureKey, users = []) => {
    const merged = [...FEATURE_ACCESS_DEFAULT_USERS, ...(config.features?.[featureKey]?.users || [])];
    return mergeFeatureAccessUsers([
        ...merged,
        ...users.filter((row) => featureAccessHasEffectiveUser(config, featureKey, row)),
    ]);
};
const memberHasFeatureAccess = (config, featureKey, memberInfo = {}) => {
    const member = memberInfo || {};
    const featurePermissions = member.feature_permissions || member.featurePermissions || member.logistics_permission?.feature_permissions || {};
    if (featurePermissions[featureKey] === true || featurePermissions[featureKey] === 'true') return true;
    return featureAccessHasUser(config, featureKey, {
    email: member.email,
    staff_name: member.staff_name || member.name,
    organization: member.organization || member.department,
});
};
const isSmokeNotificationSource = (row = {}) => {
    const payload = parseNotificationPayload(row.request_payload);
    const text = [
        row.status,
        row.summary,
        row.requested_value,
        row.reason_code,
        payload.summary,
        payload.reason,
    ].map((item) => String(item || '').toLowerCase()).join(' ');
    return text.includes('smoke_rolled_back')
        || text.includes('qa smoke')
        || String(row.status || '').toLowerCase().startsWith('smoke')
        || payload.rollback_after_write === true;
};
const buildLeaseEventNotification = (row = {}) => {
    if (isSmokeNotificationSource(row)) return null;
    const payload = parseNotificationPayload(row.request_payload);
    const eventType = row.event_type || payload.event_type || 'correction';
    const status = row.status || 'written';
    const title = `${NOTIFICATION_EVENT_TYPE_LABELS[eventType] || eventType} · ${NOTIFICATION_STATUS_LABELS[status] || status}`;
    const asset = row.asset_name || payload.asset_name || '-';
    const tenant = row.tenant_name || payload.tenant_name || '-';
    const summary = row.summary || payload.summary || '';
    return {
        id: `lease:${row.id || `${eventType}:${row.created_at || summary}`}`,
        tag: 'Data Update',
        title,
        body: [asset, tenant, summary].filter((item) => item && item !== '-').join(' · ') || '계약 변경 반영 이력이 있습니다.',
        createdAt: row.created_at || row.updated_at || '',
        tone: String(status).includes('failed') ? 'error' : status === 'submitted' ? 'warning' : 'success',
    };
};
const buildEditRequestNotification = (row = {}) => {
    const payload = parseNotificationPayload(row.request_payload);
    const notification = payload.notification || {};
    const target = notification.target_label || row.target_name || payload.finding?.target || '-';
    const field = notification.field_label || row.field_name || payload.finding?.field || '-';
    const reason = notification.reason_label || row.reason_code || payload.finding?.reason || '';
    return {
        id: `edit:${row.id || `${target}:${field}:${row.created_at}`}`,
        tag: '수정 요청',
        title: '담당자 수정 요청',
        body: [target, field, reason].filter(Boolean).join(' · '),
        createdAt: row.created_at || row.updated_at || '',
        tone: 'warning',
    };
};
const sortNotifications = (rows) => [...rows].sort((left, right) => Date.parse(right.createdAt || '') - Date.parse(left.createdAt || ''));
const invokeWithTimeout = async (action, payload = {}, timeoutMs = 12000) => {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.')), timeoutMs);
    });
    try {
        return await Promise.race([
            supabase.functions.invoke('ll-dashboard-api', {
                body: { action, payload },
            }),
            timeout,
        ]);
    } finally {
        window.clearTimeout(timeoutId);
    }
};
const logisticsNavIconClass = 'w-4.5 h-4.5 mr-[10px]';
const logisticsRootItem = {
    label: 'Work Platform',
    path: LOGISTICS_INTERNAL_BASE,
    icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7M8 11h8M8 15h5M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" /></svg>,
};
const logisticsDashboardItems = [
    {
        label: 'Home',
        path: `${LOGISTICS_INTERNAL_BASE}/dashboard/home`,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l9-9 9 9M5 10v10h14V10M9 20v-6h6v6" /></svg>,
    },
    {
        label: 'Asset',
        path: `${LOGISTICS_INTERNAL_BASE}/dashboard/asset`,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 21V7l8-4 8 4v14M8 21v-5h8v5M8 10h.01M12 10h.01M16 10h.01" /></svg>,
    },
    {
        label: 'Company',
        path: `${LOGISTICS_INTERNAL_BASE}/dashboard/company`,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 21h18M5 21V5a2 2 0 012-2h5v18M12 8h5a2 2 0 012 2v11M8 7h.01M8 11h.01M8 15h.01M16 12h.01M16 16h.01" /></svg>,
    },
    {
        label: 'Analysis Tools',
        path: `${LOGISTICS_INTERNAL_BASE}/dashboard/tools`,
        adminOnly: true,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 19V5m0 14h16M8 16V9m4 7V6m4 10v-4" /></svg>,
    },
    {
        label: 'Pivot Table',
        path: `${LOGISTICS_INTERNAL_BASE}/dashboard/playground`,
        adminOnly: true,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7c0 1.657 3.582 3 8 3s8-1.343 8-3M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3M4 7v10c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" /></svg>,
    },
    {
        label: 'Data Quality',
        path: `${LOGISTICS_INTERNAL_BASE}/dashboard/quality`,
        adminOnly: true,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M12 3l7 4v5c0 4.5-2.8 8.2-7 9-4.2-.8-7-4.5-7-9V7l7-4z" /></svg>,
    },
];
const LOGISTICS_DASHBOARD_FEATURE_BY_PATH = {
    [`${LOGISTICS_INTERNAL_BASE}/dashboard/tools`]: 'analysis_tools',
    [`${LOGISTICS_INTERNAL_BASE}/dashboard/playground`]: 'data_playground',
    [`${LOGISTICS_INTERNAL_BASE}/dashboard/quality`]: 'data_quality',
};
const logisticsStandaloneItems = [
    {
        label: 'Data Update',
        path: `${LOGISTICS_INTERNAL_BASE}/contract-data`,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 4h10a2 2 0 012 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 012-2zM9 8h6M9 12h6M9 16h4" /></svg>,
    },
    {
        label: 'PDF Report',
        path: `${LOGISTICS_INTERNAL_BASE}/pdf-report`,
        icon: <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14 3v6h5M9 14h6M9 17h6M9 11h2" /></svg>,
    },
];

export default function IotaLeftNav({ currentPath = '' }) {
    
    
    const handleNavigation = (path) => {
        const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
        const nextUrl = normalizeLogisticsPath(path).startsWith(LOGISTICS_INTERNAL_BASE)
            ? pathForLogisticsUrl(import.meta.env.BASE_URL, path)
            : `${base}/${path}`;
        window.history.pushState(null, '', nextUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };
    const { user, memberInfo, signOut } = useAuth();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showLoginHistoryModal, setShowLoginHistoryModal] = useState(false);
    const [showFeatureAccessModal, setShowFeatureAccessModal] = useState(false);
    const [featureAccessLoading, setFeatureAccessLoading] = useState(false);
    const [featureAccessError, setFeatureAccessError] = useState('');
    const [featureAccessData, setFeatureAccessData] = useState(() => normalizeFeatureAccessConfig(readFeatureAccessConfig()));
    const [featureAccessUsers, setFeatureAccessUsers] = useState([]);
    const [featureAccessSaving, setFeatureAccessSaving] = useState(false);
    const [featureAccessSavedAt, setFeatureAccessSavedAt] = useState('');
    const [openFeatureAccessKeys, setOpenFeatureAccessKeys] = useState(() => [LOGISTICS_FEATURES[0]?.key].filter(Boolean));
    const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
    const [loginHistoryError, setLoginHistoryError] = useState('');
    const [loginHistoryData, setLoginHistoryData] = useState({ rows: [], users: [], summary: null });
    const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsError, setNotificationsError] = useState('');
    const [notifications, setNotifications] = useState(() => readCachedNotifications());
    const [readNotificationIds, setReadNotificationIds] = useState([]);
    const [newPassword, setNewPassword] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = sessionStorage.getItem('iotaLeftNavCollapsed');
        return saved !== null ? saved === 'true' : false;
    });
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(() => {
        const saved = sessionStorage.getItem('isWorkspaceOpen');
        return saved !== null ? saved === 'true' : true;
    });

    const handlePasswordChange = async () => {
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            alert('비밀번호가 성공적으로 변경되었습니다.');
            setShowPasswordModal(false);
            setNewPassword('');
        } catch (error) {
            alert('비밀번호 변경 실패: ' + error.message);
        }
    };
    const [isStakeholderOpen, setIsStakeholderOpen] = useState(() => {
        const saved = sessionStorage.getItem('isStakeholderOpen');
        return saved !== null ? saved === 'true' : true;
    });
    const [isGovOpen, setIsGovOpen] = useState(() => {
        const saved = sessionStorage.getItem('isGovOpen');
        return saved !== null ? saved === 'true' : true;
    });
    const [isVehicleOpen, setIsVehicleOpen] = useState(() => {
        const isVehiclePath = currentPath === 'platform/iotaseoul/vehicle-integrated' ||
                              currentPath === 'platform/iotaseoul/iota-one-427' ||
                              currentPath === 'platform/iotaseoul/iota-two-816' ||
                              currentPath === 'platform/iotaseoul/421-fund';
        if (isVehiclePath) return true;
        const saved = sessionStorage.getItem('isVehicleOpen');
        return saved !== null ? saved === 'true' : false;
    });
    const [isLogisticsDashboardOpen, setIsLogisticsDashboardOpen] = useState(() => {
        const saved = sessionStorage.getItem('isLogisticsDashboardOpen');
        return saved !== null ? saved === 'true' : true;
    });

    useEffect(() => { sessionStorage.setItem('iotaLeftNavCollapsed', isCollapsed); }, [isCollapsed]);
    useEffect(() => { sessionStorage.setItem('isWorkspaceOpen', isWorkspaceOpen); }, [isWorkspaceOpen]);
    useEffect(() => { sessionStorage.setItem('isStakeholderOpen', isStakeholderOpen); }, [isStakeholderOpen]);
    useEffect(() => { sessionStorage.setItem('isGovOpen', isGovOpen); }, [isGovOpen]);
    useEffect(() => { sessionStorage.setItem('isVehicleOpen', isVehicleOpen); }, [isVehicleOpen]);
    useEffect(() => { sessionStorage.setItem('isLogisticsDashboardOpen', isLogisticsDashboardOpen); }, [isLogisticsDashboardOpen]);

    useEffect(() => {
        if (
            currentPath === 'platform/iotaseoul/vehicle-integrated' ||
            currentPath === 'platform/iotaseoul/iota-one-427' ||
            currentPath === 'platform/iotaseoul/iota-two-816' ||
            currentPath === 'platform/iotaseoul/421-fund'
        ) {
            setIsVehicleOpen(true);
        }
    }, [currentPath]);

    const normalizedCurrentPath = normalizeLogisticsPath(currentPath);
    const isLogisticsPath = normalizedCurrentPath.startsWith(LOGISTICS_INTERNAL_BASE);
    const memberFeaturePermissions = memberInfo?.feature_permissions || memberInfo?.featurePermissions || memberInfo?.logistics_permission?.feature_permissions || {};
    const memberRole = memberInfo?.logistics_role || memberInfo?.logisticsRole || memberInfo?.role || memberInfo?.logistics_permission?.logistics_role;
    const isLogisticsAdmin = memberRole === 'System Admin'
        || memberFeaturePermissions.login_history === true
        || memberFeaturePermissions.data_quality === true
        || LOGISTICS_ADMIN_NAMES.has(memberInfo?.staff_name || memberInfo?.name);
    const loginHistoryRows = Array.isArray(loginHistoryData?.rows) ? loginHistoryData.rows : [];
    const recentLoginHistoryRows = loginHistoryRows.slice(0, 5);
    const loginCapabilityUsers = Array.isArray(loginHistoryData?.users) ? loginHistoryData.users : [];
    const [loginCapabilitySort, setLoginCapabilitySort] = useState({ key: 'last_sign_in_at', direction: 'desc' });
    const sortedLoginCapabilityUsers = useMemo(() => (
        [...loginCapabilityUsers].sort((left, right) => compareLoginRows(left, right, loginCapabilitySort))
    ), [loginCapabilityUsers, loginCapabilitySort]);
    const selectableFeatureUsers = useMemo(() => {
        const configuredUsers = Object.values(featureAccessData.features || {}).flatMap((feature) => feature.users || []);
        const rows = [
            ...FEATURE_ACCESS_DEFAULT_USERS,
            ...(featureAccessUsers.length ? featureAccessUsers : loginCapabilityUsers),
            ...configuredUsers,
        ];
        return mergeFeatureAccessUsers(rows)
            .sort((left, right) => String(left.organization || '').localeCompare(String(right.organization || ''), 'ko-KR')
                || String(left.staff_name || '').localeCompare(String(right.staff_name || ''), 'ko-KR'));
    }, [featureAccessData.features, featureAccessUsers, loginCapabilityUsers]);
    const notificationStorageKey = useMemo(() => {
        const owner = user?.id || user?.email || memberInfo?.email || memberInfo?.staff_name || 'anonymous';
        return `logistics-notifications-read:${owner}`;
    }, [memberInfo?.email, memberInfo?.staff_name, user?.email, user?.id]);
    const unreadNotificationCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;
    const toggleLoginCapabilitySort = (key) => {
        setLoginCapabilitySort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };
    const markNotificationsRead = (rows = notifications) => {
        const ids = rows.map((item) => item.id).filter(Boolean);
        if (!ids.length) return;
        setReadNotificationIds((current) => {
            const next = [...new Set([...current, ...ids])].slice(-300);
            localStorage.setItem(notificationStorageKey, JSON.stringify(next));
            return next;
        });
    };
    const loadNotifications = async ({ markRead = false, silent = false } = {}) => {
        const cachedRows = notifications;
        if (!silent || !cachedRows.length) setNotificationsLoading(true);
        setNotificationsError('');
        try {
            const rows = [];
            const [leaseResult, approvalResult] = await Promise.allSettled([
                invokeWithTimeout('lease-events/list', { limit: 40, include_smoke: false }, 18000),
                invokeWithTimeout('edits/list', { status: 'submitted', limit: 20 }, 18000),
            ]);
            const leaseValue = leaseResult.status === 'fulfilled' ? leaseResult.value : null;
            const approvalValue = approvalResult.status === 'fulfilled' ? approvalResult.value : null;
            let successCount = 0;
            if (leaseValue && !leaseValue.error && leaseValue.data?.ok !== false) {
                successCount += 1;
                (Array.isArray(leaseValue.data?.data) ? leaseValue.data.data : [])
                    .map(buildLeaseEventNotification)
                    .filter(Boolean)
                    .forEach((item) => rows.push(item));
            }
            if (approvalValue && !approvalValue.error && approvalValue.data?.ok !== false) {
                successCount += 1;
                (Array.isArray(approvalValue.data?.data) ? approvalValue.data.data : [])
                    .filter((row) => !isSmokeNotificationSource(row))
                    .map(buildEditRequestNotification)
                    .filter(Boolean)
                    .forEach((item) => rows.push(item));
            }
            if (!successCount) {
                throw new Error('notification timeout');
            }

            const next = sortNotifications(rows).slice(0, 80);
            setNotifications(next);
            writeCachedNotifications(next);
            if (markRead) markNotificationsRead(next);
            return next;
        } catch (error) {
            const fallbackRows = cachedRows.length ? cachedRows : readCachedNotifications();
            if (fallbackRows.length) {
                setNotifications(fallbackRows);
                setNotificationsError('새 알림 조회가 늦어져 기존 알림을 표시하고 있습니다. 잠시 후 새로고침을 눌러 주세요.');
                return fallbackRows;
            }
            setNotificationsError('알림 조회가 늦어지고 있습니다. 잠시 후 새로고침을 눌러 주세요.');
            return fallbackRows;
        } finally {
            setNotificationsLoading(false);
        }
    };
    const openNotificationsPanel = async (event) => {
        event?.stopPropagation();
        setShowProfileMenu(false);
        const willOpen = !showNotificationsPanel;
        setShowNotificationsPanel(willOpen);
        if (willOpen) {
            if (notifications.length) {
                markNotificationsRead(notifications);
                loadNotifications({ markRead: true, silent: true });
            } else {
                const rows = await loadNotifications({ markRead: false });
                markNotificationsRead(rows);
            }
        }
    };
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(notificationStorageKey) || '[]');
            setReadNotificationIds(Array.isArray(saved) ? saved : []);
        } catch {
            setReadNotificationIds([]);
        }
    }, [notificationStorageKey]);
    useEffect(() => {
        if (!isLogisticsPath) return;
        loadNotifications({ silent: true });
    }, [isLogisticsPath]);
    useEffect(() => {
        if (!isLogisticsPath) return;
        let cancelled = false;
        invokeWithTimeout('feature-access/get', {}, 10000).then(({ data, error }) => {
            if (cancelled || error || data?.ok === false) return;
            const next = normalizeFeatureAccessConfig(data?.data || {});
            setFeatureAccessData(next);
            localStorage.setItem(LOGISTICS_FEATURE_ACCESS_CACHE_KEY, JSON.stringify(next));
            window.dispatchEvent(new CustomEvent('logistics-feature-access-updated', { detail: next }));
        }).catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isLogisticsPath]);
    const loadFeatureAccess = async () => {
        setFeatureAccessLoading(true);
        setFeatureAccessError('');
        try {
            const [configResult, usersResult] = await Promise.all([
                invokeWithTimeout('feature-access/get', {}, 12000),
                invokeWithTimeout('auth/login-capability/list', {}, 14000),
            ]);
            if (configResult.error || configResult.data?.ok === false) {
                throw new Error(configResult.data?.message || configResult.error?.message || '기능 권한 목록을 불러오지 못했습니다.');
            }
            const nextConfig = normalizeFeatureAccessConfig(configResult.data?.data || {});
            setFeatureAccessData(nextConfig);
            localStorage.setItem(LOGISTICS_FEATURE_ACCESS_CACHE_KEY, JSON.stringify(nextConfig));
            const users = Array.isArray(usersResult.data?.data?.users) ? usersResult.data.data.users : [];
            setFeatureAccessUsers(users);
        } catch (error) {
            setFeatureAccessError(error?.message || '기능 권한 목록을 불러오지 못했습니다.');
        } finally {
            setFeatureAccessLoading(false);
        }
    };
    const openFeatureAccessModal = async (event) => {
        event?.stopPropagation();
        setShowProfileMenu(false);
        setShowFeatureAccessModal(true);
        await loadFeatureAccess();
    };
    const persistFeatureAccessConfig = async (nextConfig, rollbackConfig = null) => {
        setFeatureAccessSaving(true);
        setFeatureAccessError('');
        try {
            const normalized = normalizeFeatureAccessConfig({ ...nextConfig, updatedAt: new Date().toISOString() });
            const { data, error } = await invokeWithTimeout('feature-access/update', { config: normalized }, 14000);
            if (error || data?.ok === false) throw new Error(data?.message || error?.message || '기능 권한 저장 실패');
            const saved = normalizeFeatureAccessConfig(data?.data || normalized);
            setFeatureAccessData(saved);
            localStorage.setItem(LOGISTICS_FEATURE_ACCESS_CACHE_KEY, JSON.stringify(saved));
            window.dispatchEvent(new CustomEvent('logistics-feature-access-updated', { detail: saved }));
            setFeatureAccessSavedAt(new Date().toISOString());
        } catch (error) {
            if (rollbackConfig) {
                setFeatureAccessData(rollbackConfig);
                localStorage.setItem(LOGISTICS_FEATURE_ACCESS_CACHE_KEY, JSON.stringify(rollbackConfig));
            }
            setFeatureAccessError(error?.message || '기능 권한 저장 실패');
        } finally {
            setFeatureAccessSaving(false);
        }
    };
    const toggleFeatureAccessUser = (featureKey, userRow) => {
        if (featureAccessSaving) return;
        if (isDefaultFeatureAccessUser(userRow)) return;
        const current = normalizeFeatureAccessConfig(featureAccessData);
        const users = current.features[featureKey]?.users || [];
        const userKeys = new Set(featureUserKeys(userRow));
        const enabled = users.some((row) => featureUserKeys(row).some((key) => userKeys.has(key)));
        const compactUser = compactFeatureAccessUserRow(userRow);
        const next = {
            ...current,
            features: {
                ...current.features,
                [featureKey]: {
                    ...(current.features[featureKey] || {}),
                    users: enabled
                        ? users.filter((row) => !featureUserKeys(row).some((key) => userKeys.has(key)))
                        : mergeFeatureAccessUsers([...users, compactUser]),
                },
            },
        };
        setFeatureAccessData(next);
        persistFeatureAccessConfig(next, current);
    };
    const toggleFeatureAccessSection = (featureKey) => {
        setOpenFeatureAccessKeys((current) => (
            current.includes(featureKey)
                ? current.filter((key) => key !== featureKey)
                : [...current, featureKey]
        ));
    };
    const loadLoginHistory = async () => {
        setLoginHistoryLoading(true);
        setLoginHistoryError('');
        try {
            const { data, error } = await invokeWithTimeout('auth/login-history/list', { limit: 5 }, 15000);
            if (error || data?.ok === false) {
                throw new Error(data?.message || error?.message || '로그인 이력을 불러오지 못했습니다.');
            }
            setLoginHistoryData(data?.data || { rows: [], users: [], summary: null });
        } catch (error) {
            setLoginHistoryError(error?.message || '로그인 이력을 불러오지 못했습니다.');
        } finally {
            setLoginHistoryLoading(false);
        }
    };
    const openLoginHistoryModal = async (event) => {
        event?.stopPropagation();
        setShowProfileMenu(false);
        setShowLoginHistoryModal(true);
        await loadLoginHistory();
    };
    const renderCollapsedTooltip = (label) => (
        isCollapsed ? (
            <span className="pointer-events-none absolute left-[58px] top-1/2 z-[9999] -translate-y-1/2 whitespace-nowrap rounded-[8px] border border-[#3A3A3C] bg-[#242424] px-2.5 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                {label}
            </span>
        ) : null
    );

    if (isLogisticsPath) {
        const visibleDashboardItems = logisticsDashboardItems.filter((item) => {
            if (!item.adminOnly) return true;
            if (isLogisticsAdmin) return true;
            const featureKey = LOGISTICS_DASHBOARD_FEATURE_BY_PATH[item.path];
            return featureKey ? memberHasFeatureAccess(featureAccessData, featureKey, memberInfo) : false;
        });
        const visibleStandaloneItems = logisticsStandaloneItems;
        const isWorkPlatformActive = normalizedCurrentPath === logisticsRootItem.path;
        const isDashboardActive = normalizedCurrentPath.startsWith(`${LOGISTICS_INTERNAL_BASE}/dashboard`);
        return (
            <div className={`${isCollapsed ? 'w-[72px]' : 'w-[275px]'} h-full overflow-hidden bg-transparent border-r border-[#2C2C2E] flex flex-col flex-shrink-0 text-[14px] font-sans text-white transition-[width,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] print:hidden`}>
                <div className={`w-full flex items-center ${isCollapsed ? 'justify-center px-[10px]' : 'justify-between px-[15px]'} pt-[14px] pb-4`}>
                    <span className={`overflow-hidden whitespace-nowrap font-bold text-[20px] tracking-tight font-inter ml-[5px] text-white transition-[opacity,max-width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCollapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-[170px] translate-x-0 opacity-100'}`}>Logistics</span>
                    <button type="button" onClick={() => setIsCollapsed((value) => !value)} title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'} className="text-[#86868B] hover:text-white pb-1 transition-colors cursor-pointer mt-[4px]">
                        <svg className={`w-[22px] h-[18px] transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                            <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
                            <line x1="8" y1="4" x2="8" y2="20" />
                        </svg>
                    </button>
                </div>

                <div className={`flex-1 overflow-y-auto pb-5 hide-scrollbar flex flex-col ${isCollapsed ? 'px-[9px]' : 'px-[11px]'}`}>
                    <div className={`mb-3 overflow-hidden px-[7px] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868B] transition-[opacity,max-height,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCollapsed ? 'max-h-0 -translate-x-2 opacity-0' : 'max-h-[24px] translate-x-0 opacity-100'}`}>
                            Logistics Platform
                    </div>
                    <div className="flex flex-col gap-0">
                        <div title={isCollapsed ? logisticsRootItem.label : undefined} onClick={() => handleNavigation(logisticsRootItem.path)} className={`group relative flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isWorkPlatformActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                            <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                <span className={`text-white ${isCollapsed ? '[&>svg]:mr-0' : ''}`}>{logisticsRootItem.icon}</span>
                                <span className={`overflow-hidden whitespace-nowrap text-[14px] text-white font-light transition-[opacity,max-width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCollapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-[180px] translate-x-0 opacity-100'}`}>{logisticsRootItem.label}</span>
                            </div>
                            {renderCollapsedTooltip(logisticsRootItem.label)}
                        </div>

                        <div className="mt-1">
                            <button
                                type="button"
                                title={isCollapsed ? 'Dashboard' : undefined}
                                onClick={() => {
                                    if (isCollapsed) {
                                        handleNavigation(`${LOGISTICS_INTERNAL_BASE}/dashboard/home`);
                                    } else {
                                        setIsLogisticsDashboardOpen((value) => !value);
                                    }
                                }}
                                className={`group relative flex w-full items-center ${isCollapsed ? 'justify-center' : 'justify-between'} py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isDashboardActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}
                            >
                                <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                    <span className={`text-white ${isCollapsed ? '[&>svg]:mr-0' : ''}`}>
                                        <svg className={logisticsNavIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 19V5m0 14h16M8 16V9m4 7V6m4 10v-4" /></svg>
                                    </span>
                                    <span className={`overflow-hidden whitespace-nowrap text-[14px] text-white font-light transition-[opacity,max-width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCollapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-[180px] translate-x-0 opacity-100'}`}>Dashboard</span>
                                </div>
                                {!isCollapsed ? (
                                    <svg className={`h-4 w-4 text-[#86868B] transition-transform ${isLogisticsDashboardOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                ) : null}
                                {renderCollapsedTooltip('Dashboard')}
                            </button>
                            <div className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${!isCollapsed && isLogisticsDashboardOpen ? 'max-h-[320px] translate-y-0 opacity-100' : 'max-h-0 -translate-y-1 opacity-0'}`}>
                                <div className="mt-1 flex flex-col gap-0 pl-4">
                                    {visibleDashboardItems.map((item) => {
                                        const isActive = normalizedCurrentPath === item.path || normalizedCurrentPath.startsWith(`${item.path}/`);
                                        return (
                                            <div key={item.path} title={isCollapsed ? item.label : undefined} onClick={() => handleNavigation(item.path)} className={`group relative flex items-center justify-between rounded-xl py-[6px] transition-colors duration-200 outline-none select-none cursor-pointer ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                                <div className="flex min-w-0 items-center">
                                                    <span className="text-white">{item.icon}</span>
                                                    <span className="overflow-hidden whitespace-nowrap text-[13px] font-light text-white">{item.label}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="mt-1">
                            {visibleStandaloneItems.map((item) => {
                                const isActive = normalizedCurrentPath === item.path || normalizedCurrentPath.startsWith(`${item.path}/`);
                                return (
                                    <div key={item.path} title={isCollapsed ? item.label : undefined} onClick={() => handleNavigation(item.path)} className={`group relative flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                        <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                            <span className={`text-white ${isCollapsed ? '[&>svg]:mr-0' : ''}`}>{item.icon}</span>
                                            <span className={`overflow-hidden whitespace-nowrap text-[14px] text-white font-light transition-[opacity,max-width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCollapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-[180px] translate-x-0 opacity-100'}`}>{item.label}</span>
                                        </div>
                                        {renderCollapsedTooltip(item.label)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className={`relative border-t border-[#2C2C2E] ${isCollapsed ? 'flex flex-col items-center px-0 py-2' : 'p-3'}`}>
                    {isLogisticsAdmin ? (
                        <div className={isCollapsed ? 'mb-2 flex w-full flex-col items-center gap-2' : 'mb-2 space-y-2'}>
                            <button
                                type="button"
                                data-testid="logistics-feature-access-button"
                                onClick={openFeatureAccessModal}
                                title="기능 권한 관리"
                                className={`flex h-9 items-center ${isCollapsed ? 'mx-auto w-9 justify-center px-0' : 'w-full justify-start gap-2 px-3'} rounded-xl border border-[#333333] bg-[#151515] text-[12px] font-semibold text-[#E5E5E5] transition-colors hover:border-[#4A4A4A] hover:bg-[#1F1F1F]`}
                            >
                                <svg className="h-4 w-4 shrink-0 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.7">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 16v-2m8-6h-2M6 12H4m12.95-4.95l-1.42 1.42M8.47 15.53l-1.42 1.42m9.9 0l-1.42-1.42M8.47 8.47 7.05 7.05M12 15a3 3 0 100-6 3 3 0 000 6z" />
                                </svg>
                                {!isCollapsed ? <span>기능 권한 관리</span> : null}
                            </button>
                            <button
                                type="button"
                                data-testid="logistics-login-history-button"
                                onClick={openLoginHistoryModal}
                                title="로그인 이력"
                                className={`flex h-9 items-center ${isCollapsed ? 'mx-auto w-9 justify-center px-0' : 'w-full justify-start gap-2 px-3'} rounded-xl border border-[#333333] bg-[#151515] text-[12px] font-semibold text-[#E5E5E5] transition-colors hover:border-[#4A4A4A] hover:bg-[#1F1F1F]`}
                            >
                                <svg className="h-4 w-4 shrink-0 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.7">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {!isCollapsed ? <span>로그인 이력</span> : null}
                            </button>
                        </div>
                    ) : null}
                    {showNotificationsPanel ? (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowNotificationsPanel(false)} />
                            <div data-testid="logistics-notification-panel" className={`fixed bottom-[86px] z-50 max-w-[calc(100vw-96px)] rounded-[16px] border border-[#3A3A3C] bg-[#202020] shadow-2xl ${isCollapsed ? 'left-[78px] w-[360px]' : 'left-[18px] w-[380px]'}`}>
                                <div className="flex items-center justify-between gap-3 border-b border-[#303033] px-4 py-3">
                                    <div>
                                        <div className="text-[14px] font-bold text-white">알림</div>
                                        <div className="mt-0.5 text-[11px] text-[#8E8E93]">Data Update · 승인 요청 연동</div>
                                    </div>
                                    <button type="button" onClick={() => loadNotifications({ markRead: true })} className="rounded-[8px] border border-[#3A3A3C] px-2.5 py-1.5 text-[11px] font-semibold text-[#E5E5E5] hover:bg-white/5">
                                        새로고침
                                    </button>
                                </div>
                                <div className="custom-scrollbar max-h-[360px] overflow-auto p-3">
                                    {notificationsError ? (
                                        <div className="mb-2 rounded-[12px] border border-[#5A2A2A] bg-[#2A1717] px-3 py-3 text-[12px] text-[#FFB4A9]">{notificationsError}</div>
                                    ) : null}
                                    {notificationsLoading && !notifications.length ? (
                                        <div className="rounded-[12px] border border-[#303033] bg-[#171717] px-3 py-5 text-center text-[12px] text-[#A1A1AA]">알림을 확인하고 있습니다.</div>
                                    ) : notifications.length ? (
                                        <div className="space-y-2">
                                            {notifications.map((item) => (
                                                <div key={item.id} className="rounded-[12px] border border-[#303033] bg-[#171717] px-3 py-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`h-1.5 w-1.5 rounded-full ${item.tone === 'warning' ? 'bg-[#FF9F0A]' : item.tone === 'error' ? 'bg-[#FF453A]' : 'bg-[#34C759]'}`} />
                                                                <span className="text-[11px] font-semibold text-[#8E8E93]">{item.tag}</span>
                                                            </div>
                                                            <div className="mt-1 text-[13px] font-semibold text-white">{item.title}</div>
                                                            <div className="mt-1 text-[12px] leading-5 text-[#A1A1AA]">{item.body}</div>
                                                        </div>
                                                        <div className="shrink-0 text-[11px] text-[#6E6E73]">{formatLoginHistoryTime(item.createdAt)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : !notificationsError ? (
                                        <div className="rounded-[12px] border border-[#303033] bg-[#171717] px-3 py-5 text-center text-[12px] text-[#8E8E93]">새 알림이 없습니다.</div>
                                    ) : null}
                                </div>
                            </div>
                        </>
                    ) : null}
                    <div className={isCollapsed ? 'relative flex w-full justify-center' : 'relative'}>
                        <div className={`flex items-center ${isCollapsed ? 'w-full flex-col gap-2' : 'gap-2'}`}>
                            <button type="button" data-testid="logistics-profile-button" onClick={() => setShowProfileMenu((value) => !value)} className={`min-w-0 flex items-center ${isCollapsed ? 'order-2 mx-auto h-10 w-10 justify-center px-0 py-0' : 'flex-1 justify-start px-2 py-2'} rounded-xl hover:bg-[#151515]`}>
                                <UserAvatar memberInfo={memberInfo} name={memberInfo?.staff_name || memberInfo?.name} sizeClass="h-8 w-8" textClass="text-[11px]" className="bg-[#3c3c3c]" />
                                <div className={`ml-3 min-w-0 overflow-hidden text-left transition-[opacity,max-width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCollapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-[156px] translate-x-0 opacity-100'}`}>
                                        <div className="truncate text-[13px] font-semibold text-white">{memberInfo?.staff_name || '로그인 사용자'}</div>
                                        <div className="truncate text-[11px] text-[#86868B]">{memberInfo?.organization || memberInfo?.department || '조직 미확인'}</div>
                                </div>
                            </button>
                            <button
                                type="button"
                                data-testid="logistics-notification-button"
                                onClick={openNotificationsPanel}
                                title="알림"
                                aria-label={unreadNotificationCount ? `알림, 안 읽은 알림 ${unreadNotificationCount}건` : '알림'}
                                className={`relative flex h-9 ${isCollapsed ? 'order-1 mx-auto w-9' : 'w-9'} shrink-0 items-center justify-center rounded-xl border border-[#333333] bg-[#151515] text-[#E5E5E5] transition-colors hover:border-[#4A4A4A] hover:bg-[#1F1F1F]`}
                            >
                                <svg className="h-4 w-4 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.7">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 01-6 0m6 0H9" />
                                </svg>
                                {unreadNotificationCount ? (
                                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border border-[#151515] bg-[#FF9F0A]">
                                        <span className="sr-only">안 읽은 알림 {unreadNotificationCount}건</span>
                                    </span>
                                ) : null}
                            </button>
                        </div>
                    {showProfileMenu ? (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                            <div className="absolute bottom-full left-3 right-3 z-50 mb-2 rounded-[16px] border border-[#3A3A3C] bg-[#2C2C2E] py-2 shadow-lg">
                                <button onClick={async () => { setShowProfileMenu(false); await signOut(); }} className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[14px] font-medium text-[#FF453A] transition-colors hover:bg-red-500/10">
                                    로그아웃
                                </button>
                            </div>
                        </>
                    ) : null}
                    </div>
                </div>
                {showLoginHistoryModal ? (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
                        <div className="flex h-[82vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-[18px] border border-[#333333] bg-[#171717] shadow-2xl">
                            <div className="flex items-center justify-between border-b border-[#2C2C2E] px-6 py-4">
                                <div>
                                    <div className="text-[18px] font-bold text-white">로그인 이력</div>
                                    <div className="mt-1 text-[12px] text-[#8E8E93]">기획추진센터 전용 조회 화면</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={loadLoginHistory} className="rounded-[10px] border border-[#3A3A3C] px-3 py-2 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">
                                        새로고침
                                    </button>
                                    <button type="button" onClick={() => setShowLoginHistoryModal(false)} className="rounded-[10px] border border-[#3A3A3C] px-3 py-2 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">
                                        닫기
                                    </button>
                                </div>
                            </div>
                            <div className="custom-scrollbar flex-1 overflow-auto px-6 py-5">
                                {loginHistoryLoading && !loginHistoryRows.length && !loginCapabilityUsers.length ? (
                                    <div className="flex h-full items-center justify-center text-[14px] text-[#A1A1AA]">불러오는 중...</div>
                                ) : loginHistoryError ? (
                                    <div className="rounded-[14px] border border-[#5A2A2A] bg-[#2A1717] p-4 text-[13px] text-[#FFB4A9]">{loginHistoryError}</div>
                                ) : (
                                    <div className="grid gap-5">
                                        {loginHistoryLoading ? (
                                            <div className="rounded-[12px] border border-[#3A3A3C] bg-[#1F1F1E] px-4 py-3 text-[12px] font-semibold text-[#FFD166]">
                                                최신 로그인 이력을 다시 불러오는 중입니다. 기존 조회값은 그대로 표시합니다.
                                            </div>
                                        ) : null}
                                        <section>
                                            <div className="mb-3 flex items-end justify-between gap-4">
                                                <div>
                                                    <h3 className="text-[14px] font-bold text-white">최근 로그인</h3>
                                                    <p className="mt-1 text-[12px] text-[#8E8E93]">테스트 및 smoke 기록은 제외했습니다.</p>
                                                </div>
                                                <div className="text-[12px] text-[#A1A1AA]">최근 {recentLoginHistoryRows.length.toLocaleString('ko-KR')}건</div>
                                            </div>
                                            <div className="overflow-hidden rounded-[12px] border border-[#303033]">
                                                <table className="w-full min-w-[760px] border-collapse text-left text-[12px]">
                                                    <thead className="bg-[#202020] text-[#A1A1AA]">
                                                        <tr>
                                                            <th className="px-4 py-3 font-semibold">일시</th>
                                                            <th className="px-4 py-3 font-semibold">조직</th>
                                                            <th className="px-4 py-3 font-semibold">이름</th>
                                                            <th className="px-4 py-3 font-semibold">이메일</th>
                                                            <th className="px-4 py-3 font-semibold">상태</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#2C2C2E] text-[#E5E5E5]">
                                                        {recentLoginHistoryRows.length ? recentLoginHistoryRows.map((row, index) => (
                                                            <tr key={`${row.email || 'login'}-${row.logged_at || index}`} className="hover:bg-white/[0.03]">
                                                                <td className="whitespace-nowrap px-4 py-3 text-[#C7C7CC]">{formatLoginHistoryTime(row.logged_at)}</td>
                                                                <td className="px-4 py-3">{row.organization || '-'}</td>
                                                                <td className="px-4 py-3 font-semibold">
                                                                    <div className="flex items-center gap-2">
                                                                        <UserAvatar memberInfo={row} name={row.staff_name} sizeClass="h-7 w-7" textClass="text-[10px]" />
                                                                        <span>{row.staff_name || '-'}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-[#C7C7CC]">{row.email || '-'}</td>
                                                                <td className="px-4 py-3"><span className="rounded-full bg-[#203524] px-2 py-1 text-[11px] font-semibold text-[#8EE59A]">성공</span></td>
                                                            </tr>
                                                        )) : (
                                                            <tr>
                                                                <td className="px-4 py-8 text-center text-[#8E8E93]" colSpan={5}>저장된 실제 로그인 이력이 아직 없습니다. 다음 로그인부터 자동으로 기록됩니다.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>

                                        <section>
                                            <div className="mb-3 flex items-end justify-between gap-4">
                                                <div>
                                                    <h3 className="text-[14px] font-bold text-white">권한자 로그인 상태</h3>
                                                    <p className="mt-1 text-[12px] text-[#8E8E93]">비밀번호를 새로 만들지 않고 Auth 사용자와 권한 테이블 매칭만 확인합니다.</p>
                                                </div>
                                                <div className="text-[12px] text-[#A1A1AA]">총 {loginCapabilityUsers.length.toLocaleString('ko-KR')}명</div>
                                            </div>
                                            <div className="overflow-hidden rounded-[12px] border border-[#303033]">
                                                <table className="w-full min-w-[860px] border-collapse text-left text-[12px]">
                                                    <thead className="bg-[#202020] text-[#A1A1AA]">
                                                        <tr>
                                                            <LoginSortableHeader column={LOGIN_CAPABILITY_SORT_COLUMNS[0]} sortConfig={loginCapabilitySort} onSort={toggleLoginCapabilitySort} />
                                                            <LoginSortableHeader column={LOGIN_CAPABILITY_SORT_COLUMNS[1]} sortConfig={loginCapabilitySort} onSort={toggleLoginCapabilitySort} />
                                                            <th className="px-4 py-3 font-semibold">이메일</th>
                                                            <LoginSortableHeader column={LOGIN_CAPABILITY_SORT_COLUMNS[2]} sortConfig={loginCapabilitySort} onSort={toggleLoginCapabilitySort} />
                                                            <LoginSortableHeader column={LOGIN_CAPABILITY_SORT_COLUMNS[3]} sortConfig={loginCapabilitySort} onSort={toggleLoginCapabilitySort} />
                                                            <LoginSortableHeader column={LOGIN_CAPABILITY_SORT_COLUMNS[4]} sortConfig={loginCapabilitySort} onSort={toggleLoginCapabilitySort} />
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#2C2C2E] text-[#E5E5E5]">
                                                        {sortedLoginCapabilityUsers.map((row, index) => {
                                                            const ok = row.login_status === '로그인 가능';
                                                            return (
                                                                <tr key={`${row.email || 'user'}-${index}`} className="hover:bg-white/[0.03]">
                                                                    <td className="px-4 py-3">{row.organization || '-'}</td>
                                                                    <td className="px-4 py-3 font-semibold">
                                                                        <div className="flex items-center gap-2">
                                                                            <UserAvatar memberInfo={row} name={row.staff_name} sizeClass="h-7 w-7" textClass="text-[10px]" />
                                                                            <span>{row.staff_name || '-'}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-[#C7C7CC]">{row.email || '-'}</td>
                                                                    <td className="px-4 py-3 text-[#C7C7CC]">{row.logistics_role || '-'}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${ok ? 'bg-[#203524] text-[#8EE59A]' : 'bg-[#3A2E18] text-[#FFD479]'}`}>
                                                                            {row.login_status || '-'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="whitespace-nowrap px-4 py-3 text-[#C7C7CC]">{formatLoginHistoryTime(row.last_sign_in_at)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
                {showFeatureAccessModal ? (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
                        <div data-testid="logistics-feature-access-modal" className="flex h-[84vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[18px] border border-[#333333] bg-[#171717] shadow-2xl">
                            <div className="flex items-center justify-between border-b border-[#2C2C2E] px-6 py-4">
                                <div>
                                    <div className="text-[18px] font-bold text-white">기능 권한 관리</div>
                                    <div className="mt-1 text-[12px] text-[#8E8E93]">AI 챗봇, Data Quality, 로그인 이력, 외부 API 새로고침 등 기획추진센터 전용 기능의 이용자를 지정합니다.</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={loadFeatureAccess} className="rounded-[10px] border border-[#3A3A3C] px-3 py-2 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">
                                        새로고침
                                    </button>
                                    <button type="button" onClick={() => setShowFeatureAccessModal(false)} className="rounded-[10px] border border-[#3A3A3C] px-3 py-2 text-[12px] font-semibold text-[#E5E5E5] hover:bg-white/5">
                                        닫기
                                    </button>
                                </div>
                            </div>
                            <div className="custom-scrollbar flex-1 overflow-auto px-6 py-5">
                                {featureAccessLoading ? (
                                    <div className="flex h-full items-center justify-center text-[14px] text-[#A1A1AA]">불러오는 중...</div>
                                ) : featureAccessError ? (
                                    <div className="rounded-[14px] border border-[#5A2A2A] bg-[#2A1717] p-4 text-[13px] text-[#FFB4A9]">{featureAccessError}</div>
                                ) : (
                                    <div className="space-y-4">
                                        {featureAccessSaving ? (
                                            <div className="rounded-[12px] border border-[#34537A] bg-[#202C3D] px-4 py-3 text-[12px] font-semibold text-[#9AD7FF]">기능 권한을 저장하는 중입니다.</div>
                                        ) : null}
                                        {!featureAccessSaving && featureAccessSavedAt ? (
                                            <div className="rounded-[12px] border border-[#2E6B45] bg-[#173522] px-4 py-3 text-[12px] font-semibold text-[#B5E48C]">
                                                선택 즉시 Supabase에 저장됐습니다. 마지막 저장 {formatLoginHistoryTime(featureAccessSavedAt)}
                                            </div>
                                        ) : null}
                                        <div className="grid gap-3">
                                            {LOGISTICS_FEATURES.map((feature) => {
                                                const isOpen = openFeatureAccessKeys.includes(feature.key);
                                                const grantedUsers = featureAccessGrantedUsers(featureAccessData, feature.key, selectableFeatureUsers);
                                                return (
                                                    <section key={feature.key} className="overflow-hidden rounded-[14px] border border-[#303033] bg-[#1F1F1E]">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleFeatureAccessSection(feature.key)}
                                                            className="flex w-full flex-col gap-2 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] md:flex-row md:items-start md:justify-between"
                                                            aria-expanded={isOpen}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="text-[14px] font-bold text-white">{feature.label}</div>
                                                                <div className="mt-1 text-[12px] text-[#8E8E93]">{feature.description}</div>
                                                            </div>
                                                            <div className="flex shrink-0 items-center gap-3 text-[12px] font-semibold text-[#A1A1AA]">
                                                                <span>허용 {grantedUsers.length.toLocaleString('ko-KR')}명</span>
                                                                <span className="text-[#C7C7CC]">{isOpen ? '접기' : '펼치기'}</span>
                                                            </div>
                                                        </button>
                                                        {isOpen ? <div className="custom-scrollbar grid max-h-[360px] grid-cols-1 gap-2 overflow-auto border-t border-[#303033] p-4 md:grid-cols-2 xl:grid-cols-3">
                                                            {selectableFeatureUsers.map((userRow) => {
                                                                const checked = featureAccessHasEffectiveUser(featureAccessData, feature.key, userRow);
                                                                const locked = isDefaultFeatureAccessUser(userRow);
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={`${feature.key}-${featureUserKey(userRow)}`}
                                                                        onClick={() => toggleFeatureAccessUser(feature.key, userRow)}
                                                                        disabled={locked || featureAccessSaving}
                                                                        className={`flex min-h-11 items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-left transition-colors ${checked ? 'border-[#2E6B45] bg-[#173522] text-[#B5E48C]' : 'border-[#303033] bg-[#151515] text-[#C7C7CC] hover:border-[#4A4A4A]'} ${locked ? 'cursor-default opacity-90' : ''}`}
                                                                    >
                                                                        <span className="flex min-w-0 items-center gap-2">
                                                                            <UserAvatar memberInfo={userRow} name={userRow.staff_name} sizeClass="h-7 w-7" textClass="text-[10px]" />
                                                                            <span className="min-w-0">
                                                                                <span className="block truncate text-[12px] font-bold">{userRow.staff_name || '-'}</span>
                                                                                <span className="block truncate text-[11px] opacity-75">{userRow.organization || '-'} · {locked ? '기본 허용' : (userRow.logistics_role || '-')}</span>
                                                                            </span>
                                                                        </span>
                                                                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${checked ? 'border-[#B5E48C] bg-[#B5E48C]' : 'border-[#5F5F64]'}`}>
                                                                            {checked ? <span className="h-1.5 w-1.5 rounded-full bg-[#173522]" /> : null}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div> : null}
                                                    </section>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className={`${isCollapsed ? 'w-[72px]' : 'w-[275px]'} h-full bg-transparent border-r border-[#2C2C2E] flex flex-col flex-shrink-0 text-[14px] font-sans text-white transition-[width,background-color,border-color] duration-300`}>

            {/* Header */}
            <div className={`w-full flex items-center ${isCollapsed ? 'justify-center px-[10px]' : 'justify-between px-[15px]'} pt-[14px] pb-4`}>
                {!isCollapsed ? <span className="font-bold text-[20px] tracking-tight font-inter ml-[5px] text-white">
                    IOTA Seoul
                </span> : null}
                <button type="button" onClick={() => setIsCollapsed((value) => !value)} title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'} className="text-[#86868B] hover:text-white pb-1 transition-colors cursor-pointer mt-[4px]">
                    <svg className={`w-[22px] h-[18px] transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                        <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
                        <line x1="8" y1="4" x2="8" y2="20" />
                    </svg>
                </button>
            </div>

            {/* Main Menu */}
            <div className={`flex-1 overflow-y-auto pb-5 hide-scrollbar flex flex-col ${isCollapsed ? 'px-[9px]' : 'px-[11px]'}`}>

                <div className="flex flex-col gap-0">
                    {menuItems.map((item) => {
                        const isActive = currentPath === item.path;
                        const hasSubItems = item.subItems && item.subItems.length > 0;
                        const isExpanded = item.id === 2 ? isVehicleOpen : false;

                        return (
                            <div key={item.id} className="flex flex-col">
                                <div
                                    onClick={() => {
                                        if (item.id === 2) {
                                            setIsVehicleOpen(!isVehicleOpen);
                                        } else {
                                            handleNavigation(item.path);
                                        }
                                    }}
                                    title={isCollapsed ? item.label : undefined}
                                    className={`group relative flex items-center ${isCollapsed ? 'justify-center px-[7px]' : 'justify-between'} py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}
                                >
                                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                        <span className={`text-white ${isCollapsed ? '[&>svg]:mr-0' : ''}`}>
                                            {item.icon}
                                        </span>
                                        {!isCollapsed ? <span className="text-[14px] text-white font-light">
                                            {item.label}
                                        </span> : null}
                                    </div>
                                    {renderCollapsedTooltip(item.label)}
                                    {!isCollapsed ? <div className="flex items-center gap-2">
                                        {item.badge && (
                                            <div className="bg-[#f87171]/20 text-[#f87171] text-[10px] px-2 py-0.5 rounded-full">
                                                {item.badge}
                                            </div>
                                        )}
                                        {hasSubItems ? (
                                            <div 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.id === 2) {
                                                        setIsVehicleOpen(!isVehicleOpen);
                                                    }
                                                }}
                                                className="p-1 -mr-1 hover:bg-white/10 rounded-md transition-colors flex items-center justify-center cursor-pointer"
                                            >
                                                <svg className={`w-3.5 h-3.5 text-[#86868B] transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        ) : (
                                            <svg className="w-3.5 h-3.5 text-white translate-x-[2px] hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7-7" /></svg>
                                        )}
                                    </div> : null}
                                </div>
                                {hasSubItems && isExpanded && !isCollapsed && (
                                    <div className="flex flex-col gap-0 mt-[2px] mb-[2px] pl-[28px]">
                                        {item.subItems.map(sub => {
                                            const isSubActive = currentPath === sub.path;
                                            return (
                                                <div
                                                    key={sub.id}
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if (sub.externalUrl) {
                                                            window.open(sub.externalUrl, '_blank');
                                                        } else {
                                                            handleNavigation(sub.path); 
                                                        }
                                                    }}
                                                    className={`group flex items-center justify-between py-[4px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isSubActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}
                                                >
                                                    <div className="flex items-center gap-[6px]">
                                                        <span className={`text-[14px] font-light transition-colors ${isSubActive ? 'text-white' : 'text-[#A1A1AA] group-hover:text-white'}`}>
                                                            {sub.label}
                                                        </span>
                                                        {sub.externalUrl && (
                                                            <svg className={`w-3.5 h-3.5 transition-colors ${isSubActive ? 'text-[#888]' : 'text-[#666] group-hover:text-[#888]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 워크스페이스 영역 */}
                <div className={`${isCollapsed ? 'mt-3 mb-2' : 'mt-6 mb-2'}`}>
                    <div 
                        className={`flex items-center justify-between font-semibold mb-[7px] text-[13px] text-[#86868B] hover:text-white cursor-pointer transition-colors duration-300 px-[7px] ${isCollapsed ? 'hidden' : ''}`}
                        onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
                    >
                        <span>워크스페이스</span>
                        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isWorkspaceOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    {isWorkspaceOpen && (
                        <div className="flex flex-col gap-0">
                            {workspaceItems.map((item, idx) => {
                                const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
                                return (
                                <div key={idx} title={isCollapsed ? item.label : undefined} onClick={() => handleNavigation(item.path)} className={`group relative flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                                        <span className={`text-white ${isCollapsed ? '[&>svg]:mr-0' : ''}`}>
                                            {item.icon}
                                        </span>
                                        {!isCollapsed ? <span className="text-[14px] text-white font-light">
                                            {item.label}
                                        </span> : null}
                                    </div>
                                    {renderCollapsedTooltip(item.label)}
                                </div>
                            );
                            })}
                        </div>
                    )}
                </div>

                {/* 이해관계자 영역 */}
                <div className={`${isCollapsed ? 'hidden' : 'mt-6 mb-2'}`}>
                    <div 
                        className="flex items-center justify-between font-semibold mb-[7px] text-[13px] text-[#86868B] hover:text-white cursor-pointer transition-colors duration-300 px-[7px]"
                        onClick={() => setIsStakeholderOpen(!isStakeholderOpen)}
                    >
                        <span>이해관계자</span>
                        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isStakeholderOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    {isStakeholderOpen && (
                        <div className="flex flex-col gap-0">
                            {[{ label: 'IGIS 내부인력', path: 'platform/iotaseoul/stakeholder/internal' },
                                { label: 'LP / 대주 / SI', path: 'platform/iotaseoul/stakeholder/lp' },
                                { label: '잠재 임차사 (TBD)', path: 'platform/iotaseoul/stakeholder/tenant' },
                                { label: '운영 파트너 (TBD)', path: 'platform/iotaseoul/stakeholder/partner' }].map((item, idx) => {
                                const isActive = currentPath === item.path;
                                return (
                                <div key={idx} onClick={() => handleNavigation(item.path)} className={`flex items-center justify-between py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className="flex items-center">
                                        {/* 아이콘 제거, 텍스트 왼쪽 정렬 */}
                                        <span className={`text-[14px] font-light ${item.label.includes('TBD') ? 'text-[#666]' : 'text-white'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                </div>
                            );
                            })}
                        </div>
                    )}
                </div>

                {/* IOTA CFT 거번넌스 영역 */}
                <div className={`${isCollapsed ? 'hidden' : 'mt-6 mb-2'}`}>
                    <div 
                        className="flex items-center justify-between font-semibold mb-[7px] text-[13px] text-[#86868B] hover:text-white cursor-pointer transition-colors duration-300 px-[7px]"
                        onClick={() => setIsGovOpen(!isGovOpen)}
                    >
                        <span>IOTA CFT 거번넌스</span>
                        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isGovOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    {isGovOpen && (
                        <div className="flex flex-col gap-0">
                            {[{ label: '통합 수행체계', path: 'platform/iotaseoul/governance/system' },
                                { label: '의사결정 및 평가 체계', path: 'platform/iotaseoul/governance/principles' },
                                { label: '90 Day Roadmap', path: 'platform/iotaseoul/governance/roadmap' },
                                { label: 'RACI', path: 'platform/iotaseoul/governance/raci' },
                                { label: '회의체 운영 방침', path: 'platform/iotaseoul/governance/meetings' },
                                { label: '펀드 운용 R&R', path: 'platform/iotaseoul/governance/fund-rnr' },
                                { label: '프로젝트리츠 워킹그룹', path: 'platform/iotaseoul/governance/working-group' },
                                { label: '대외 소통 정책', path: 'platform/iotaseoul/governance/external-comm' },
                                { label: 'Top 10 리스크 대응 방향', path: 'platform/iotaseoul/governance/risk-top10' }].map((item, idx) => {
                                const isActive = currentPath === item.path;
                                return (
                                <div key={idx} onClick={() => handleNavigation(item.path)} className={`flex items-center justify-between py-[7px] rounded-xl cursor-pointer transition-colors duration-200 outline-none select-none ${isActive ? 'bg-[#151515] px-[9px] -mx-[2px]' : 'px-[7px] hover:bg-[#151515]'}`}>
                                    <div className="flex items-center">
                                        {/* 아이콘 제거, 텍스트 왼쪽 정렬 */}
                                        <span className="text-[14px] text-white font-light">
                                            {item.label}
                                        </span>
                                    </div>
                                </div>
                            );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Profile */}
            <div className="relative">
                {/* Popover Menu */}
                {showProfileMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[258px] bg-[#2C2C2E] border border-[#3A3A3C] rounded-[16px] shadow-lg py-2 z-50">
                            <button onClick={() => { setShowProfileMenu(false); setShowPasswordModal(true); }} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-[#E5E5E5] hover:bg-[#3A3A3C] transition-colors flex items-center gap-3 cursor-pointer">
                                <svg className="w-4 h-4 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                비밀번호 변경
                            </button>
                            <button onClick={() => { setShowProfileMenu(false); setShowContactModal(true); }} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-[#E5E5E5] hover:bg-[#3A3A3C] transition-colors flex items-center gap-3 cursor-pointer">
                                <svg className="w-4 h-4 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                플랫폼 이용 문의
                            </button>
                            <div className="my-1 border-t border-white/5"></div>
                            <button onClick={async () => { setShowProfileMenu(false); await signOut(); }} className="w-full text-left px-4 py-2.5 text-[14px] font-medium text-[#FF453A] hover:bg-red-500/10 transition-colors flex items-center gap-3 cursor-pointer">
                                <svg className="w-4 h-4 text-[#FF453A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                로그아웃
                            </button>
                        </div>
                    </>
                )}

                <div 
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className={`${isCollapsed ? 'justify-center px-[10px]' : 'justify-between pl-[15px] pr-[17px]'} pt-[10px] pb-3 border-t border-[#3A3A3C] w-full flex items-center transition-colors duration-300 cursor-pointer hover:bg-white/5`}
                >
                    <div className={`flex items-center gap-3 p-1.5 rounded-lg transition-colors duration-300 ${isCollapsed ? '' : '-ml-1.5'}`}>
                        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-[#2C2C2E] -ml-[2px] border border-white/10">
                            {memberInfo?.staff_name ? (
                                <img 
                                    src={`${import.meta.env.BASE_URL}${memberInfo.staff_name}.webp`} 
                                    alt={`${memberInfo.staff_name} 프로필`} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => { 
                                        const target = e.currentTarget;
                                        const avatar = target.parentElement;
                                        target.style.display = 'none';
                                        if (!avatar) return;
                                        avatar.textContent = memberInfo.staff_name.substring(0, 2);
                                        avatar.className = 'w-10 h-10 rounded-full bg-[#c3c2b7] text-[#1F1F1E] flex items-center justify-center text-[15px] font-bold tracking-tighter -ml-[2px]';
                                    }}
                                />
                            ) : (
                                <span className="text-[#1F1F1E] font-bold">U</span>
                            )}
                        </div>
                        {!isCollapsed ? <div className="flex flex-col max-w-[130px]">
                            <span className="font-semibold text-[14px] leading-tight mb-0.5 text-white tracking-tight truncate">
                                {memberInfo?.staff_name ? `${memberInfo.staff_name} ${memberInfo.role_code === 'master' ? '마스터' : memberInfo.role_code === 'director' ? '책임' : '매니저'}` : '로그인 필요'}
                            </span>
                            <span className="text-[#86868B] text-[12px] leading-none font-normal truncate">
                                {user?.email || '권한 없음'}
                            </span>
                        </div> : null}
                    </div>

                    {!isCollapsed ? <div className="flex items-center">
                        <button 
                            type="button"
                            className="text-[#86868B] transition-colors p-1 pointer-events-none"
                        >
                            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div> : null}
                </div>
            </div>

            {/* Modals */}
            {showContactModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-[#2C2C2E] flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-white" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-[22px] font-bold text-white mb-2 tracking-tight">플랫폼 이용 문의</h3>
                        <p className="text-[15px] font-medium text-[#A1A1AA] text-center leading-relaxed mb-8">
                            ***@igisam.com<br/>010-****-****<br/>전기영 매니저에게 연락해주세요.
                        </p>
                        <button onClick={() => setShowContactModal(false)} className="w-full py-3.5 rounded-[16px] bg-[#2C2C2E] text-white font-semibold text-[16px] hover:bg-[#3A3A3C] transition-colors cursor-pointer">
                            닫기
                        </button>
                    </div>
                </div>
            )}

            {showPasswordModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                    <div className="bg-[#1C1C1E] w-[400px] rounded-[24px] p-8 shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-[#2C2C2E] flex items-center justify-center mb-5">
                            <svg className="w-6 h-6 text-white" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-[22px] font-bold text-white mb-2 tracking-tight">비밀번호 변경</h3>
                        <p className="text-[15px] font-medium text-[#A1A1AA] text-center leading-relaxed mb-6">
                            새로운 비밀번호를 입력해주세요.
                        </p>
                        <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="새 비밀번호"
                            className="w-full h-[52px] bg-[#1C1C1E] border border-[#333333] rounded-[16px] px-5 text-[17px] text-white placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] transition-all mb-4"
                        />
                        <div className="flex w-full gap-3">
                            <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-3.5 rounded-[16px] bg-[#2C2C2E] text-white font-semibold text-[16px] hover:bg-[#3A3A3C] transition-colors cursor-pointer">
                                취소
                            </button>
                            <button onClick={handlePasswordChange} disabled={!newPassword} className="flex-1 py-3.5 rounded-[16px] bg-[#0071E3] text-white font-semibold text-[16px] hover:bg-[#0077ED] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                변경하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
