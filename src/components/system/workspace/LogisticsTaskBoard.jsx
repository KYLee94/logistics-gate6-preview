import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { invokeDashboardApi } from '../../../utils/supabaseSession';
import UserAvatar from '../UserAvatar';

const PAGE_SIZE = 10;
const MAX_TASK_SHARES = 5;
const PRIMARY_BLUE_BUTTON_CLASS = 'border-[#3b82f6]/30 bg-[#3b82f6]/20 text-[#60a5fa] hover:bg-[#3b82f6]/30';

const TASK_BOARD_COLUMNS = ['프로젝트', '업무 분류', '업무 요약', '담당자', '이해관계자', '진행 상황', '등록일'];

const TASK_BOARD_CATEGORIES = [
  '신규 투자 검토',
  '자산 매각',
  '파이낸싱',
  '개발·인허가',
  '임대·마케팅',
  '법률·세무 이슈',
  '기타 자산관리',
  '기타 리스크 관리',
];

const TASK_BOARD_STATUSES = ['예정', '진행 중', '중단', '보류', '완료'];

const STATUS_CLASS_NAMES = {
  예정: 'border-[#575b63] bg-[#2a2d31] text-[#c8cbd0]',
  '진행 중': 'border-[#355c48] bg-[#1e342a] text-[#a8d6b5]',
  중단: 'border-[#64543a] bg-[#372f21] text-[#e2ca93]',
  보류: 'border-[#65504a] bg-[#382a28] text-[#e1b4ab]',
  완료: 'border-[#3b5368] bg-[#22303b] text-[#a9c9dc]',
};

const EMPTY_DRAFT = {
  asset_id: '',
  asset_name: '',
  category: '',
  summary: '',
  stakeholders: '',
  detail: '',
  status: '예정',
  share: false,
  recipient_user_ids: [],
  suppress_notifications: false,
};

function text(value, fallback = '') {
  const output = String(value ?? '').trim();
  return output || fallback;
}

function firstValue(row, keys, fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return fallback;
}

function unwrapApiData(response) {
  if (response?.error) throw response.error;
  const body = response?.data;
  if (body?.ok === false) throw new Error(body.message || '요청을 처리하지 못했습니다.');
  return body?.data ?? body ?? {};
}

function normalizeAsset(asset = {}) {
  return {
    id: text(firstValue(asset, ['asset_id', 'assetId', 'id', 'value'])),
    name: text(firstValue(asset, ['asset_name', 'assetName', 'name', 'label'])),
  };
}

function normalizeRecipient(recipient = {}) {
  const userId = text(firstValue(recipient, ['user_id', 'userId', 'id', 'auth_subject', 'email']));
  return {
    ...recipient,
    user_id: userId,
    name: text(firstValue(recipient, ['staff_name', 'name', 'display_name', 'full_name', 'email']), '이름 미확인'),
    organization: text(firstValue(recipient, ['organization', 'department', 'team_name', 'company'])),
    email: text(firstValue(recipient, ['email', 'user_email'])),
  };
}

function normalizeTaskComment(comment = {}, parentCommentId = '') {
  const author = comment.author || comment.created_by || comment.user || comment.member || {};
  return {
    ...comment,
    id: text(firstValue(comment, ['comment_id', 'id', 'commentId'])),
    parent_comment_id: text(firstValue(comment, ['parent_comment_id', 'parentCommentId', 'parent_id']), parentCommentId),
    author_user_id: text(firstValue(comment, ['author_user_id', 'author_id', 'created_by_user_id', 'created_by', 'user_id']) || firstValue(author, ['user_id', 'auth_subject', 'auth_user_id', 'id'])),
    text: text(firstValue(comment, ['text', 'comment_text', 'content', 'body'])),
    author_name: text(firstValue(comment, ['author_name', 'created_by_name', 'staff_name', 'user_name', 'name']) || firstValue(author, ['staff_name', 'name', 'display_name', 'email']), '작성자 미확인'),
    author_member_info: author,
    created_at: text(firstValue(comment, ['created_at', 'createdAt', 'inserted_at'])),
  };
}

function normalizeTaskComments(comments) {
  const normalized = [];
  const collect = (entries, parentCommentId = '') => {
    if (!Array.isArray(entries)) return;
    entries.forEach((entry) => {
      const comment = normalizeTaskComment(entry, parentCommentId);
      if (!comment.id) return;
      normalized.push(comment);
      collect(entry?.replies ?? entry?.children ?? entry?.comments, comment.id);
    });
  };
  collect(comments);
  return normalized;
}

function normalizeStatus(value) {
  const status = text(value, '예정');
  return status === '진행중' ? '진행 중' : status;
}

function normalizeTask(row = {}) {
  const assignee = row.assignee || row.owner || row.created_by || {};
  const stakeholders = row.stakeholders ?? row.stakeholder_names ?? row.stakeholder_name ?? row.stakeholder ?? row.company_name ?? '';
  return {
    ...row,
    id: text(firstValue(row, ['task_code', 'task_id', 'id', 'taskId'])),
    asset_id: text(firstValue(row, ['project_id', 'asset_id', 'related_asset_id', 'assetId'])),
    asset_name: text(firstValue(row, ['project', 'asset_name', 'related_asset_name', 'project_name', 'assetName']), '-'),
    category: text(firstValue(row, ['category', 'task_category', 'classification']), '-'),
    summary: text(firstValue(row, ['summary', 'task_summary', 'title', 'task_name']), '-'),
    stakeholders: Array.isArray(stakeholders)
      ? stakeholders.map((item) => text(item?.name || item?.staff_name || item)).filter(Boolean).join(', ')
      : text(stakeholders),
    detail: text(firstValue(row, ['detail', 'task_detail', 'description', 'content', 'body', 'notes'])),
    status: normalizeStatus(firstValue(row, ['status', 'progress_status', 'issue_status'])),
    assignee_user_id: text(firstValue(row, ['assignee_user_id', 'owner_user_id', 'created_by_user_id']) || firstValue(assignee, ['user_id', 'id', 'email'])),
    assignee_name: text(firstValue(row, ['assignee_name', 'owner_name', 'created_by_name']) || firstValue(assignee, ['staff_name', 'name', 'display_name', 'email']), '담당자 미확인'),
    assignee_organization: text(firstValue(row, ['assignee_organization', 'owner_organization', 'created_by_organization']) || firstValue(assignee, ['organization', 'department', 'team_name'])),
    updated_at: text(firstValue(row, ['updated_at', 'updatedAt', 'created_at'])),
    created_at: text(firstValue(row, ['created_at', 'createdAt'])),
    task_comments: normalizeTaskComments(row.task_comments ?? row.comments ?? []),
  };
}

function taskToDraft(task = {}) {
  return {
    ...EMPTY_DRAFT,
    asset_id: task.asset_id || '',
    asset_name: task.asset_name === '-' ? '' : task.asset_name || '',
    category: task.category === '-' ? '' : task.category || '',
    summary: task.summary === '-' ? '' : task.summary || '',
    stakeholders: task.stakeholders || '',
    detail: task.detail || '',
    status: TASK_BOARD_STATUSES.includes(task.status) ? task.status : '예정',
  };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatCreatedDateWithAge(value) {
  if (!value) return '-';
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return value;
  const elapsedDays = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86400000));
  const dateLabel = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(createdAt);
  return `${dateLabel} · ${elapsedDays === 0 ? '오늘' : `${elapsedDays}일 경과`}`;
}

function requestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `task-board-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function statusClassName(status) {
  return STATUS_CLASS_NAMES[status] || STATUS_CLASS_NAMES.예정;
}

function HeaderFilterDropdown({ filterKey, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const normalizedOptions = useMemo(() => options.map((option) => (
    typeof option === 'string' ? { value: option, label: option } : option
  )), [options]);
  const selectedLabel = normalizedOptions.find((option) => option.value === value)?.label || label;
  const updateMenuRect = useCallback(() => {
    if (typeof window === 'undefined' || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const width = Math.max(rect.width, 180);
    const estimatedHeight = Math.min(280, (normalizedOptions.length + 1) * 36 + 16);
    const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
    const top = roomBelow >= estimatedHeight
      ? rect.bottom + 6
      : Math.max(viewportPadding, rect.top - estimatedHeight - 6);
    setMenuRect({
      left: Math.min(Math.max(viewportPadding, rect.left), Math.max(viewportPadding, window.innerWidth - width - viewportPadding)),
      top,
      width,
    });
  }, [normalizedOptions.length]);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuRect();
    const handlePointerDown = (event) => {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuRect);
    window.addEventListener('scroll', updateMenuRect, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuRect);
      window.removeEventListener('scroll', updateMenuRect, true);
    };
  }, [open, updateMenuRect]);

  const menu = open && menuRect ? (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={`${label} 선택`}
      data-testid={`task-board-filter-menu-${filterKey}`}
      className="custom-scrollbar fixed z-[10000] max-h-[280px] overflow-y-auto rounded-[10px] border border-[#3A3A3C] bg-[#151515] p-2 shadow-2xl"
      style={{ left: menuRect.left, top: menuRect.top, width: menuRect.width }}
    >
      <button
        type="button"
        role="option"
        aria-selected={!value}
        onClick={() => { onChange(''); setOpen(false); buttonRef.current?.focus(); }}
        className={`block w-full rounded-[7px] px-3 py-2 text-left text-[12px] transition-colors ${!value ? 'bg-[#2A3444] font-semibold text-white' : 'text-[#E5E5E5] hover:bg-white/5'}`}
      >
        전체
      </button>
      {normalizedOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={option.value === value}
          onClick={() => { onChange(option.value); setOpen(false); buttonRef.current?.focus(); }}
          className={`block w-full rounded-[7px] px-3 py-2 text-left text-[12px] transition-colors ${option.value === value ? 'bg-[#2A3444] font-semibold text-white' : 'text-[#E5E5E5] hover:bg-white/5'}`}
        >
          <span className="block truncate">{option.label}</span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${label} 필터`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => {
          if (!current) updateMenuRect();
          return !current;
        })}
        className={`flex w-full items-center justify-between gap-2 rounded-[8px] border border-transparent bg-white/5 px-2 py-1.5 text-left text-[12px] font-semibold outline-none transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white ${value ? 'text-white' : 'text-[#A1A1AA]'}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="shrink-0 text-[10px] text-[#A1A1AA]" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {typeof document === 'undefined' ? menu : createPortal(menu, document.body)}
    </>
  );
}

function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1.5 block text-[12px] font-medium text-[#b4b7bd]">
      {children}{required ? <span className="ml-1 text-[#d6a7a0]">*</span> : null}
    </label>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium ${statusClassName(status)}`}>
      {status}
    </span>
  );
}

function AssigneeCell({ task }) {
  const tooltip = [task.assignee_name, task.assignee_organization].filter(Boolean).join(' / ');
  return (
    <span className="group relative inline-flex max-w-full">
      <span className="truncate text-[#dedfe2]">{task.assignee_name}</span>
      {tooltip ? (
        <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-max max-w-[220px] rounded border border-[#4a4d52] bg-[#202124] px-2 py-1 text-[11px] text-[#e7e8ea] shadow-lg group-hover:block group-focus-within:block">
          {tooltip}
        </span>
      ) : null}
    </span>
  );
}

function TaskForm({ assets, draft, setDraft, recipients, memberInfo, mode, saving, errorMessage, onClose, onSubmit }) {
  const [recipientQuery, setRecipientQuery] = useState('');
  const assigneeName = text(firstValue(memberInfo, ['staff_name', 'name', 'display_name', 'email']), '로그인 사용자');
  const assigneeOrganization = text(firstValue(memberInfo, ['organization', 'department', 'team_name']));
  const matchingRecipients = useMemo(() => {
    const needle = recipientQuery.trim().toLowerCase();
    return recipients.filter((recipient) => {
      if (!needle) return true;
      return [recipient.name, recipient.organization, recipient.email].some((value) => value.toLowerCase().includes(needle));
    }).slice(0, 8);
  }, [recipientQuery, recipients]);
  const selectedRecipients = useMemo(() => new Set(draft.recipient_user_ids), [draft.recipient_user_ids]);

  const updateField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const updateAsset = (assetId) => {
    const asset = assets.find((item) => item.id === assetId);
    setDraft((current) => ({ ...current, asset_id: asset?.id || '', asset_name: asset?.name || '' }));
  };
  const toggleRecipient = (recipientId) => {
    setDraft((current) => {
      const hasRecipient = current.recipient_user_ids.includes(recipientId);
      if (!hasRecipient && current.recipient_user_ids.length >= MAX_TASK_SHARES) return current;
      return {
        ...current,
        recipient_user_ids: hasRecipient
          ? current.recipient_user_ids.filter((id) => id !== recipientId)
          : [...current.recipient_user_ids, recipientId],
      };
    });
  };

  return (
    <form data-testid="logistics-task-board-form" onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
        <div>
          <FieldLabel required>프로젝트</FieldLabel>
          <select value={draft.asset_id} onChange={(event) => updateAsset(event.target.value)} required disabled={saving} className="w-full rounded border border-[#4a4d52] bg-[#26272a] px-3 py-2 text-[13px] text-[#f2f2f3] outline-none focus:border-[#90949b] disabled:opacity-60">
            <option value="">접근 가능한 프로젝트 선택</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel required>업무 분류</FieldLabel>
          <select value={draft.category} onChange={(event) => updateField('category', event.target.value)} required disabled={saving} className="w-full rounded border border-[#4a4d52] bg-[#26272a] px-3 py-2 text-[13px] text-[#f2f2f3] outline-none focus:border-[#90949b] disabled:opacity-60">
            <option value="">업무 분류 선택</option>
            {TASK_BOARD_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel required>업무 요약</FieldLabel>
          <input value={draft.summary} onChange={(event) => updateField('summary', event.target.value)} required maxLength={200} disabled={saving} placeholder="업무의 핵심 내용을 입력하세요" className="w-full rounded border border-[#4a4d52] bg-[#26272a] px-3 py-2 text-[13px] text-[#f2f2f3] outline-none placeholder:text-[#81848a] focus:border-[#90949b] disabled:opacity-60" />
        </div>
        <div>
          <FieldLabel>담당자</FieldLabel>
          <div className="rounded border border-[#414348] bg-[#212225] px-3 py-2 text-[13px] text-[#c9cbd0]" aria-readonly="true">
            {assigneeName}{assigneeOrganization ? ` / ${assigneeOrganization}` : ''}
          </div>
        </div>
        <div>
          <FieldLabel required>진행 상황</FieldLabel>
          <select value={draft.status} onChange={(event) => updateField('status', event.target.value)} required disabled={saving} className="w-full rounded border border-[#4a4d52] bg-[#26272a] px-3 py-2 text-[13px] text-[#f2f2f3] outline-none focus:border-[#90949b] disabled:opacity-60">
            {TASK_BOARD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>이해관계자</FieldLabel>
          <input value={draft.stakeholders} onChange={(event) => updateField('stakeholders', event.target.value)} maxLength={300} disabled={saving} placeholder="이름 또는 소속을 쉼표로 구분해 입력" className="w-full rounded border border-[#4a4d52] bg-[#26272a] px-3 py-2 text-[13px] text-[#f2f2f3] outline-none placeholder:text-[#81848a] focus:border-[#90949b] disabled:opacity-60" />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>업무 내용 상세</FieldLabel>
          <textarea value={draft.detail} onChange={(event) => updateField('detail', event.target.value)} maxLength={4000} rows={5} disabled={saving} placeholder="업무 배경, 다음 조치, 참고사항 등을 입력하세요" className="w-full resize-y rounded border border-[#4a4d52] bg-[#26272a] px-3 py-2 text-[13px] leading-5 text-[#f2f2f3] outline-none placeholder:text-[#81848a] focus:border-[#90949b] disabled:opacity-60" />
        </div>
        {mode === 'create' ? (
          <div className="sm:col-span-2 border-t border-[#3c3e43] pt-4">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#e3e4e7]">
              <input type="radio" name="task-notification-mode" checked={draft.share && !draft.suppress_notifications} onChange={() => setDraft((current) => ({ ...current, share: true, suppress_notifications: false }))} disabled={saving} className="h-4 w-4 accent-[#8b929b]" />
              수신자를 선택해 알림 보내기
            </label>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-[#e3e4e7]">
              <input type="radio" name="task-notification-mode" checked={!draft.share || draft.suppress_notifications} onChange={() => setDraft((current) => ({ ...current, share: false, suppress_notifications: true, recipient_user_ids: [] }))} disabled={saving} className="h-4 w-4 accent-[#8b929b]" />
              알림 없이 저장
            </label>
            {draft.share ? (
              <div className="mt-3 rounded border border-[#3f4247] bg-[#202124] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <FieldLabel>수신자</FieldLabel>
                  <span className="text-[11px] text-[#9699a0]">최대 5명, 0명 선택 가능</span>
                </div>
                <input value={recipientQuery} onChange={(event) => setRecipientQuery(event.target.value)} disabled={saving} placeholder="이름 또는 소속 검색" className="mb-2 w-full rounded border border-[#4a4d52] bg-[#292a2e] px-3 py-2 text-[13px] text-[#f2f2f3] outline-none placeholder:text-[#81848a] focus:border-[#90949b] disabled:opacity-60" />
                <div className="custom-scrollbar max-h-36 overflow-y-auto border-t border-[#3f4247] pt-1">
                  {matchingRecipients.length ? matchingRecipients.map((recipient) => {
                    const checked = selectedRecipients.has(recipient.user_id);
                    const disabled = saving || (!checked && draft.recipient_user_ids.length >= 5);
                    return (
                      <label key={recipient.user_id} className={`flex items-center gap-2 px-1 py-2 text-[12px] ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-[#2d2f33]'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleRecipient(recipient.user_id)} disabled={disabled} className="h-4 w-4 accent-[#8b929b]" />
                        <span className="min-w-0 truncate text-[#e1e2e5]">{recipient.name}</span>
                        <span className="min-w-0 truncate text-[#9598a0]">{recipient.organization || recipient.email || '-'}</span>
                      </label>
                    );
                  }) : <p className="px-1 py-3 text-[12px] text-[#92959c]">검색 조건에 맞는 수신자가 없습니다.</p>}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {errorMessage ? <p className="sm:col-span-2 rounded border border-[#67413d] bg-[#352523] px-3 py-2 text-[12px] text-[#e4b4ad]" role="alert">{errorMessage}</p> : null}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-[#3b3d42] px-5 py-4">
        <button type="button" onClick={onClose} disabled={saving} className="rounded border border-[#52555b] px-3 py-2 text-[13px] text-[#d5d7da] hover:bg-[#303135] disabled:opacity-50">취소</button>
        <button type="submit" disabled={saving} className="rounded border border-[#777c84] bg-[#e1e2e4] px-3 py-2 text-[13px] font-semibold text-[#1d1e20] hover:bg-white disabled:cursor-wait disabled:opacity-55">{saving ? '저장 중...' : '저장'}</button>
      </div>
    </form>
  );
}

export default function LogisticsTaskBoard({ eligibleAssets = [], memberInfo, onDataChanged }) {
  const assets = useMemo(() => eligibleAssets.map(normalizeAsset).filter((asset) => asset.id && asset.name), [eligibleAssets]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ asset_id: '', category: '', assignee_user_id: '', status: '' });
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState({ open: false, task: null, loading: false, error: '' });
  const [formMode, setFormMode] = useState('');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [reply, setReply] = useState({ parentCommentId: '', text: '' });
  const [editingComment, setEditingComment] = useState({ commentId: '', text: '' });
  const [collapsedReplyIds, setCollapsedReplyIds] = useState(() => new Set());
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadTasks = useCallback(async ({ requestedPage = page, silent = false } = {}) => {
    if (!assets.length) {
      setItems([]);
      setTotal(0);
      setRecipients([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setErrorMessage('');
    try {
      const response = await invokeDashboardApi('work-platform/task-board/list', {
        page: requestedPage,
        page_size: PAGE_SIZE,
        search: search || undefined,
        project_id: filters.asset_id || undefined,
        task_category: filters.category || undefined,
        created_by_user_id: filters.assignee_user_id || undefined,
        status: filters.status || undefined,
        sort_by: 'updated_at',
        sort_direction: 'desc',
      });
      const data = unwrapApiData(response);
      const nextItems = Array.isArray(data.items) ? data.items.map(normalizeTask) : [];
      const nextTotal = Number(data.total ?? nextItems.length) || 0;
      const maxPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
      if (requestedPage > maxPage && nextTotal > 0) {
        setPage(maxPage);
        return loadTasks({ requestedPage: maxPage, silent });
      }
      setItems(nextItems);
      setTotal(nextTotal);
      setRecipients(Array.isArray(data.recipients) ? data.recipients.map(normalizeRecipient).filter((recipient) => recipient.user_id) : []);
    } catch (error) {
      setErrorMessage(text(error?.message, '업무 목록을 불러오지 못했습니다.'));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [assets.length, filters, page, search]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const assigneeOptions = useMemo(() => {
    const unique = new Map();
    recipients.forEach((recipient) => unique.set(recipient.user_id, recipient));
    items.forEach((task) => {
      if (task.assignee_user_id && !unique.has(task.assignee_user_id)) {
        unique.set(task.assignee_user_id, {
          user_id: task.assignee_user_id,
          name: task.assignee_name,
          organization: task.assignee_organization,
        });
      }
    });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
  }, [items, recipients]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, totalPages]);
  const changeFilter = (field, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setDraft({ ...EMPTY_DRAFT, asset_id: assets[0]?.id || '', asset_name: assets[0]?.name || '' });
    setFormError('');
    setFormMode('create');
  };

  const openEdit = (task = drawer.task) => {
    if (!task) return;
    setDraft(taskToDraft(task));
    setFormError('');
    setFormMode('edit');
  };

  const closeForm = () => {
    if (saving) return;
    setFormMode('');
    setFormError('');
  };

  const openDrawer = async (task) => {
    setCommentText('');
    setReply({ parentCommentId: '', text: '' });
    setEditingComment({ commentId: '', text: '' });
    setCollapsedReplyIds(new Set());
    setCommentError('');
    setDrawer({ open: true, task, loading: true, error: '' });
    try {
      const response = await invokeDashboardApi('work-platform/task-board/get', {
        task_code: task.id,
      });
      const data = unwrapApiData(response);
      const taskData = data.item ?? data.task ?? data;
      setDrawer({
        open: true,
        task: normalizeTask({ ...taskData, task_comments: data.task_comments ?? taskData?.task_comments ?? taskData?.comments ?? [] }),
        loading: false,
        error: '',
      });
    } catch (error) {
      setDrawer((current) => ({ ...current, loading: false, error: text(error?.message, '업무 상세를 불러오지 못했습니다.') }));
    }
  };

  const notifyDataChanged = useCallback(async () => {
    if (typeof onDataChanged === 'function') await onDataChanged();
  }, [onDataChanged]);

  const submitForm = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.asset_id || !draft.category || !draft.summary.trim() || !draft.status) {
      setFormError('프로젝트, 업무 분류, 업무 요약, 진행 상황은 필수입니다.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const isCreate = formMode === 'create';
      const payload = {
        project_id: draft.asset_id,
        task_category: draft.category,
        task_name: draft.summary.trim(),
        stakeholder_name: draft.stakeholders.trim(),
        description: draft.detail.trim(),
        status: draft.status,
        client_request_id: requestId(),
      };
      if (isCreate) {
        payload.recipient_user_ids = draft.share ? draft.recipient_user_ids : [];
        payload.suppress_notifications = !draft.share || draft.suppress_notifications;
      } else {
        payload.task_code = drawer.task?.id;
      }
      const response = await invokeDashboardApi(`work-platform/task-board/${isCreate ? 'create' : 'update'}`, payload, { retryTimeout: false });
      const data = unwrapApiData(response);
      const savedTask = data.item ?? data.task ?? data;
      await loadTasks({ requestedPage: page, silent: true });
      await notifyDataChanged();
      setFormMode('');
      if (!isCreate && savedTask && typeof savedTask === 'object') {
        setDrawer((current) => ({
          open: true,
          task: normalizeTask({ ...savedTask, task_comments: savedTask.task_comments ?? current.task?.task_comments ?? [] }),
          loading: false,
          error: '',
        }));
      }
    } catch (error) {
      setFormError(text(error?.message, '업무를 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    const task = drawer.task;
    if (!task || deleting || !window.confirm(`"${text(task.summary, '선택한 업무')}"을(를) 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      const response = await invokeDashboardApi('work-platform/task-board/delete', {
        task_code: task.id,
        client_request_id: requestId(),
      }, { retryTimeout: false });
      unwrapApiData(response);
      setDrawer({ open: false, task: null, loading: false, error: '' });
      const nextPage = items.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      await loadTasks({ requestedPage: nextPage, silent: true });
      await notifyDataChanged();
    } catch (error) {
      setDrawer((current) => ({ ...current, error: text(error?.message, '업무를 삭제하지 못했습니다.') }));
    } finally {
      setDeleting(false);
    }
  };

  const submitComment = async (event, parentCommentId = '') => {
    event.preventDefault();
    const value = parentCommentId ? reply.text : commentText;
    const taskCode = drawer.task?.id;
    if (!taskCode || commentSubmitting || !value.trim()) return;
    setCommentSubmitting(true);
    setCommentError('');
    try {
      const response = await invokeDashboardApi('work-platform/task-board/comments/create', {
        task_code: taskCode,
        parent_comment_id: parentCommentId || null,
        text: value.trim(),
        client_request_id: requestId(),
      }, { retryTimeout: false });
      const data = unwrapApiData(response);
      const nextComments = data.comments ?? data.task_comments;
      setDrawer((current) => current.task ? {
        ...current,
        task: { ...current.task, task_comments: normalizeTaskComments(nextComments ?? current.task.task_comments) },
      } : current);
      if (parentCommentId) {
        setReply({ parentCommentId: '', text: '' });
      } else {
        setCommentText('');
      }
    } catch (error) {
      setCommentError(text(error?.message, '댓글을 저장하지 못했습니다.'));
    } finally {
      setCommentSubmitting(false);
    }
  };

  const submitCommentUpdate = async (event, comment) => {
    event.preventDefault();
    const taskCode = drawer.task?.id;
    const value = editingComment.text.trim();
    if (!taskCode || !comment?.id || commentSubmitting || !value || comment.author_user_id !== currentUserId) return;
    setCommentSubmitting(true);
    setCommentError('');
    try {
      const response = await invokeDashboardApi('work-platform/task-board/comments/update', {
        task_code: taskCode,
        comment_id: comment.id,
        text: value,
        client_request_id: requestId(),
      }, { retryTimeout: false });
      const data = unwrapApiData(response);
      const nextComments = data.comments ?? data.task_comments;
      setDrawer((current) => current.task ? {
        ...current,
        task: {
          ...current.task,
          task_comments: normalizeTaskComments(nextComments ?? current.task.task_comments.map((item) => (
            item.id === comment.id ? { ...item, text: value } : item
          ))),
        },
      } : current);
      setEditingComment({ commentId: '', text: '' });
    } catch (error) {
      setCommentError(text(error?.message, '댓글을 수정하지 못했습니다.'));
    } finally {
      setCommentSubmitting(false);
    }
  };

  const taskComments = useMemo(() => normalizeTaskComments(drawer.task?.task_comments ?? []), [drawer.task?.task_comments]);
  const currentUserId = useMemo(() => text(
    firstValue(memberInfo, ['auth_subject', 'user_id', 'userId', 'id'])
      || memberInfo?.user?.id
      || memberInfo?.user?.user_id,
  ), [memberInfo]);
  const rootTaskComments = useMemo(() => {
    const commentIds = new Set(taskComments.map((comment) => comment.id));
    return taskComments.filter((comment) => !comment.parent_comment_id || !commentIds.has(comment.parent_comment_id));
  }, [taskComments]);
  const repliesByParent = useMemo(() => taskComments.reduce((result, comment) => {
    if (comment.parent_comment_id) {
      result[comment.parent_comment_id] = [...(result[comment.parent_comment_id] || []), comment];
    }
    return result;
  }, {}), [taskComments]);
  const toggleCollapsedReplies = (commentId) => {
    setCollapsedReplyIds((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };
  const renderCommentTree = (comment, level = 0, ancestorIds = new Set()) => {
    if (ancestorIds.has(comment.id)) return null;
    const childComments = repliesByParent[comment.id] || [];
    const nextAncestorIds = new Set(ancestorIds);
    nextAncestorIds.add(comment.id);
    const isReply = level >= 1;
    const canToggleChildren = childComments.length > 0;
    const childrenCollapsed = collapsedReplyIds.has(comment.id);
    const isEditing = editingComment.commentId === comment.id;
    const isOwnComment = Boolean(currentUserId && comment.author_user_id && comment.author_user_id === currentUserId);
    return (
      <div key={comment.id} className={isReply ? 'ml-9 mt-3 border-l border-[#4a4d52] pl-3' : 'border-b border-[#34363b] py-4 last:border-b-0'}>
        <div className="flex gap-2.5">
          <UserAvatar memberInfo={{ ...comment.author_member_info, staff_name: comment.author_name }} name={comment.author_name} sizeClass={isReply ? 'h-6 w-6' : 'h-7 w-7'} textClass={isReply ? 'text-[9px]' : 'text-[10px]'} className="bg-[#3c3c3c]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[12px] font-semibold text-[#e7e8ea]">{comment.author_name}</span>
              <time className="text-[11px] text-[#878b92]">{formatDateTime(comment.created_at)}</time>
            </div>
            {isEditing ? (
              <form className="mt-2" onSubmit={(event) => void submitCommentUpdate(event, comment)}>
                <label className="sr-only" htmlFor={`task-comment-edit-${comment.id}`}>댓글 수정</label>
                <textarea id={`task-comment-edit-${comment.id}`} value={editingComment.text} onChange={(event) => setEditingComment((current) => ({ ...current, text: event.target.value }))} maxLength={2000} rows={2} disabled={commentSubmitting} className="w-full resize-y rounded border border-[#4a4d52] bg-[#242529] px-3 py-2 text-[12px] text-[#f2f2f3] outline-none focus:border-[#90949b] disabled:opacity-60" />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingComment({ commentId: '', text: '' })} disabled={commentSubmitting} className="rounded border border-[#52555b] px-2.5 py-1.5 text-[11px] text-[#d9dade] hover:bg-[#303135] disabled:opacity-50">취소</button>
                  <button type="submit" disabled={commentSubmitting || !editingComment.text.trim()} className={`rounded border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${PRIMARY_BLUE_BUTTON_CLASS}`}>{commentSubmitting ? '저장 중...' : '저장'}</button>
                </div>
              </form>
            ) : <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-[#d7d9dd]">{comment.text || '-'}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" onClick={() => {
                setEditingComment({ commentId: '', text: '' });
                setReply((current) => current.parentCommentId === comment.id ? { parentCommentId: '', text: '' } : { parentCommentId: comment.id, text: '' });
              }} disabled={commentSubmitting} className="text-[11px] font-medium text-[#aab8c8] hover:text-white disabled:opacity-50">답글</button>
              {isOwnComment ? <button type="button" onClick={() => {
                setReply({ parentCommentId: '', text: '' });
                setEditingComment((current) => current.commentId === comment.id ? { commentId: '', text: '' } : { commentId: comment.id, text: comment.text });
              }} disabled={commentSubmitting} className="text-[11px] font-medium text-[#aab8c8] hover:text-white disabled:opacity-50">수정</button> : null}
              {canToggleChildren ? <button type="button" onClick={() => toggleCollapsedReplies(comment.id)} aria-expanded={!childrenCollapsed} className="text-[11px] font-medium text-[#aab8c8] hover:text-white">{childrenCollapsed ? `답글 ${childComments.length}개 펼치기` : `답글 ${childComments.length}개 접기`}</button> : null}
            </div>
          </div>
        </div>
        {!childrenCollapsed ? childComments.map((childComment) => renderCommentTree(childComment, level + 1, nextAncestorIds)) : null}
        {reply.parentCommentId === comment.id ? (
          <form className={isReply ? 'ml-9 mt-3' : 'ml-9 mt-3'} onSubmit={(event) => void submitComment(event, comment.id)}>
            <label className="sr-only" htmlFor={`task-comment-reply-${comment.id}`}>답글 작성</label>
            <textarea data-testid="logistics-task-board-reply-input" id={`task-comment-reply-${comment.id}`} value={reply.text} onChange={(event) => setReply((current) => ({ ...current, text: event.target.value }))} maxLength={2000} rows={2} disabled={commentSubmitting} placeholder="답글을 입력하세요" className="w-full resize-y rounded border border-[#4a4d52] bg-[#242529] px-3 py-2 text-[12px] text-[#f2f2f3] outline-none placeholder:text-[#81848a] focus:border-[#90949b] disabled:opacity-60" />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setReply({ parentCommentId: '', text: '' })} disabled={commentSubmitting} className="rounded border border-[#52555b] px-2.5 py-1.5 text-[11px] text-[#d9dade] hover:bg-[#303135] disabled:opacity-50">취소</button>
              <button type="submit" disabled={commentSubmitting || !reply.text.trim()} className={`rounded border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${PRIMARY_BLUE_BUTTON_CLASS}`}>{commentSubmitting ? '등록 중...' : '답글 등록'}</button>
            </div>
          </form>
        ) : null}
      </div>
    );
  };

  return (
    <section data-testid="logistics-task-board" className="min-w-0 text-[#f0f0f1]">
      <div className="mb-[12px] flex w-full flex-wrap items-center gap-3 xl:flex-nowrap xl:gap-[16px]">
        <h2 className="shrink-0 text-[20px] font-semibold leading-none tracking-normal text-white">통합 업무 보드</h2>
        <label className="relative min-w-[220px] flex-1 xl:ml-[10px] xl:w-[280px] xl:max-w-[280px] xl:flex-none">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-[#86868B]" aria-hidden="true">⌕</span>
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="업무 요약, 담당자, 이해관계자 검색..." className="h-[34px] w-full rounded-[10px] border border-[#3c3c3c] bg-[#1c1c1e]/60 py-1.5 pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-[#86868B] focus:border-[#2997ff] focus:ring-1 focus:ring-[#2997ff]" />
        </label>
        <button data-testid="logistics-task-board-create" type="button" onClick={openCreate} disabled={!assets.length} className={`ml-auto shrink-0 rounded-[10px] border px-4 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${PRIMARY_BLUE_BUTTON_CLASS}`}>+ 새 업무 추가</button>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[#333333] bg-[#252524] shadow-sm">
        {!assets.length ? (
          <div className="px-5 py-16 text-center">
            <p className="text-[14px] font-medium text-[#e2e3e5]">접근 가능한 프로젝트가 없습니다.</p>
            <p className="mt-2 text-[12px] text-[#9699a0]">권한이 부여된 프로젝트가 있어야 업무를 조회하거나 등록할 수 있습니다.</p>
          </div>
        ) : (
          <>
          {errorMessage ? (
            <div className="m-5 flex flex-wrap items-center justify-between gap-3 rounded border border-[#67413d] bg-[#352523] px-4 py-3" role="alert">
              <span className="text-[13px] text-[#e4b4ad]">{errorMessage}</span>
              <button type="button" onClick={() => void loadTasks()} className="rounded border border-[#80605b] px-2 py-1 text-[12px] text-[#f0c6c0] hover:bg-[#47302d]">재시도</button>
            </div>
          ) : null}

          <div className="overflow-x-auto" data-testid="logistics-task-board-table">
            <table className="w-full min-w-[1120px] table-fixed border-collapse bg-[#252524] text-left">
              <thead className="text-[12px] font-semibold text-[#A1A1AA]">
                <tr className="h-[46px] border-b border-[#3c3c3c]">
                  <th className="w-[16%] px-4"><HeaderFilterDropdown filterKey="project" label="프로젝트" value={filters.asset_id} options={assets.map((asset) => ({ value: asset.id, label: asset.name }))} onChange={(value) => changeFilter('asset_id', value)} /></th>
                  <th className="w-[14%] px-4"><HeaderFilterDropdown filterKey="category" label="업무 분류" value={filters.category} options={TASK_BOARD_CATEGORIES} onChange={(value) => changeFilter('category', value)} /></th>
                  <th className="w-[23%] px-4 font-semibold">업무 요약</th>
                  <th className="w-[12%] px-4"><HeaderFilterDropdown filterKey="assignee" label="담당자" value={filters.assignee_user_id} options={assigneeOptions.map((assignee) => ({ value: assignee.user_id, label: assignee.name }))} onChange={(value) => changeFilter('assignee_user_id', value)} /></th>
                  <th className="w-[14%] px-4 font-semibold">이해관계자</th>
                  <th className="w-[10%] px-2"><HeaderFilterDropdown filterKey="status" label="진행 상황" value={filters.status} options={TASK_BOARD_STATUSES} onChange={(value) => changeFilter('status', value)} /></th>
                  <th className="w-[11%] px-4 text-left font-semibold">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3c3c3c] text-[13px] text-white">
                {loading ? (
                  <tr><td colSpan="7" className="px-4 py-20 text-center text-[13px] text-[#86868B]">업무 목록을 불러오는 중입니다.</td></tr>
                ) : items.length ? items.map((task) => (
                  <tr key={task.id} onClick={() => void openDrawer(task)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openDrawer(task); } }} className="h-[50px] cursor-pointer bg-[#252524] hover:bg-[#30302f] focus-visible:bg-[#30302f] focus-visible:outline-none">
                    <td className="max-w-0 truncate px-4 font-bold text-[#d7d9dd]">{task.asset_name}</td>
                    <td className="max-w-0 truncate px-4 font-bold text-[#d1d3d7]">{task.category}</td>
                    <td className="max-w-0 px-4 font-bold text-white"><span className="block truncate">{task.summary}</span></td>
                    <td className="max-w-0 px-4"><AssigneeCell task={task} /></td>
                    <td className="max-w-0 truncate px-4 text-[#b9bcc2]">{task.stakeholders || '-'}</td>
                    <td className="px-4 text-center"><StatusPill status={task.status} /></td>
                    <td className="px-4 text-[11px] font-medium text-[#A1A1AA]">{formatCreatedDateWithAge(task.created_at)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="px-4 py-20 text-center text-[13px] text-[#86868B]">등록된 통합 업무 보드 정보가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex h-[46px] items-center justify-center border-t border-[#3c3c3c]/50 px-5">
            <nav className="flex items-center gap-1" aria-label="업무 목록 페이지">
              <button type="button" aria-label="이전 페이지" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="grid h-7 w-7 place-items-center rounded-[6px] border border-[#3c3c3c] text-[16px] leading-none text-[#86868B] hover:bg-white/5 hover:text-white disabled:opacity-30">‹</button>
              {pageNumbers.map((pageNumber) => <button key={pageNumber} type="button" aria-current={pageNumber === page ? 'page' : undefined} disabled={loading} onClick={() => setPage(pageNumber)} className={`grid h-7 w-7 place-items-center rounded-[6px] text-[12px] font-bold ${pageNumber === page ? 'bg-[#bdbba7] text-black shadow-sm' : 'border border-transparent text-[#86868B] hover:border-[#3c3c3c] hover:bg-white/5 hover:text-white'}`}>{pageNumber}</button>)}
              <button type="button" aria-label="다음 페이지" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="grid h-7 w-7 place-items-center rounded-[6px] border border-[#3c3c3c] text-[16px] leading-none text-[#86868B] hover:bg-white/5 hover:text-white disabled:opacity-30">›</button>
            </nav>
            <span className="sr-only">총 {total.toLocaleString('ko-KR')}건</span>
          </div>
          </>
        )}
      </div>

      {drawer.open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/45" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawer({ open: false, task: null, loading: false, error: '' }); }}>
          <aside data-testid="logistics-task-board-drawer" role="dialog" aria-modal="true" aria-label="업무 상세" className="flex h-full w-full max-w-[560px] flex-col border-l border-[#484b51] bg-[#202124] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#3b3d42] px-5 py-4">
              <div className="min-w-0 flex-1 pr-3"><h3 className="truncate text-[17px] font-semibold text-[#f2f2f3]" title={drawer.task?.summary || '업무 상세'}>{drawer.task?.summary || '업무 상세'}</h3></div>
              <div className="flex shrink-0 flex-nowrap gap-2">
                <button type="button" onClick={() => openEdit()} disabled={drawer.loading || deleting} className="inline-flex h-8 min-w-[48px] shrink-0 items-center justify-center whitespace-nowrap rounded border border-[#52555b] px-3 text-[12px] text-[#d9dade] hover:bg-[#303135] disabled:opacity-50">수정</button>
                <button type="button" onClick={() => void deleteTask()} disabled={drawer.loading || deleting} className="inline-flex h-8 min-w-[48px] shrink-0 items-center justify-center whitespace-nowrap rounded border border-[#76504b] px-3 text-[12px] text-[#e5b8b1] hover:bg-[#382a28] disabled:opacity-50">{deleting ? '삭제 중...' : '삭제'}</button>
                <button type="button" aria-label="업무 상세 닫기" onClick={() => setDrawer({ open: false, task: null, loading: false, error: '' })} className="inline-flex h-8 min-w-[48px] shrink-0 items-center justify-center whitespace-nowrap rounded border border-[#52555b] px-3 text-[12px] text-[#d9dade] hover:bg-[#303135]">닫기</button>
              </div>
            </div>
            {drawer.loading ? <div className="flex flex-1 items-center justify-center text-[13px] text-[#9ca0a6]">업무 상세를 불러오는 중입니다.</div> : (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {drawer.error ? <p role="alert" className="mb-4 rounded border border-[#67413d] bg-[#352523] px-3 py-2 text-[12px] text-[#e4b4ad]">{drawer.error}</p> : null}
                <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-4 gap-y-4 text-[13px]">
                  <dt className="text-[#94979e]">프로젝트</dt><dd className="min-w-0 break-words text-[#e7e8ea]">{drawer.task?.asset_name || '-'}</dd>
                  <dt className="text-[#94979e]">업무 분류</dt><dd className="min-w-0 break-words text-[#e7e8ea]">{drawer.task?.category || '-'}</dd>
                  <dt className="text-[#94979e]">업무 요약</dt><dd className="min-w-0 break-words font-medium text-[#f2f2f3]">{drawer.task?.summary || '-'}</dd>
                  <dt className="text-[#94979e]">담당자</dt><dd className="min-w-0 break-words text-[#e7e8ea]">{drawer.task?.assignee_name || '-'}{drawer.task?.assignee_organization ? ` / ${drawer.task.assignee_organization}` : ''}</dd>
                  <dt className="text-[#94979e]">이해관계자</dt><dd className="min-w-0 break-words text-[#e7e8ea]">{drawer.task?.stakeholders || '-'}</dd>
                  <dt className="text-[#94979e]">진행 상황</dt><dd><StatusPill status={drawer.task?.status || '예정'} /></dd>
                  <dt className="text-[#94979e]">등록일</dt><dd className="text-[#c4c6cb]">{formatCreatedDateWithAge(drawer.task?.created_at)}</dd>
                  <dt className="text-[#94979e]">최근 수정</dt><dd className="text-[#c4c6cb]">{formatDateTime(drawer.task?.updated_at)}</dd>
                  <dt className="text-[#94979e]">업무 내용 상세</dt><dd className="whitespace-pre-wrap break-words rounded border border-[#3d4045] bg-[#242529] px-3 py-3 leading-6 text-[#e2e3e6]">{drawer.task?.detail || '등록된 상세 내용이 없습니다.'}</dd>
                </dl>
                <section data-testid="logistics-task-board-comments" className="mt-6 border-t border-[#3d4045] pt-5" aria-label="댓글">
                  <h4 className="text-[14px] font-semibold text-[#f2f2f3]">댓글</h4>
                  <div className="mt-3 space-y-1">
                    {rootTaskComments.length ? rootTaskComments.map((comment) => renderCommentTree(comment)) : <p className="py-4 text-[12px] text-[#92959c]">등록된 댓글이 없습니다.</p>}
                  </div>
                  {commentError ? <p role="alert" className="mt-3 rounded border border-[#67413d] bg-[#352523] px-3 py-2 text-[12px] text-[#e4b4ad]">{commentError}</p> : null}
                  <form className="mt-4" onSubmit={(event) => void submitComment(event)}>
                    <label className="sr-only" htmlFor="task-comment-create">댓글 작성</label>
                    <textarea data-testid="logistics-task-board-comment-input" id="task-comment-create" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={2000} rows={3} disabled={commentSubmitting} placeholder="댓글을 입력하세요" className="w-full resize-y rounded border border-[#4a4d52] bg-[#242529] px-3 py-2 text-[13px] text-[#f2f2f3] outline-none placeholder:text-[#81848a] focus:border-[#90949b] disabled:opacity-60" />
                    <div className="mt-2 flex justify-end">
                      <button type="submit" disabled={commentSubmitting || !commentText.trim()} className={`rounded border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${PRIMARY_BLUE_BUTTON_CLASS}`}>{commentSubmitting ? '등록 중...' : '댓글 등록'}</button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {formMode ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <div role="dialog" aria-modal="true" aria-label={formMode === 'create' ? '새 업무 등록' : '업무 수정'} className="flex max-h-[calc(100vh-32px)] w-full max-w-[760px] flex-col overflow-hidden rounded border border-[#4a4d52] bg-[#202124] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#3b3d42] px-5 py-4">
              <h3 className="text-[17px] font-semibold text-[#f2f2f3]">{formMode === 'create' ? '새 업무' : '업무 수정'}</h3>
              <button type="button" onClick={closeForm} disabled={saving} className="rounded border border-[#52555b] px-2.5 py-1.5 text-[12px] text-[#d9dade] hover:bg-[#303135] disabled:opacity-50">닫기</button>
            </div>
            <TaskForm assets={assets} draft={draft} setDraft={setDraft} recipients={recipients} memberInfo={memberInfo} mode={formMode} saving={saving} errorMessage={formError} onClose={closeForm} onSubmit={(event) => void submitForm(event)} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
