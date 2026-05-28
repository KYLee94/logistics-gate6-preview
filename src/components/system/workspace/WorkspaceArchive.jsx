import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';

const WORKSPACES = [
  { id: 'logistics', name: '물류센터 워크 플랫폼', table: 'll_work_items' },
  { id: 'pm', name: '사업 PM', table: 'iota_pm_tasks' },
  { id: 'financing', name: '파이낸싱-LFC', table: 'iota_financing_tasks' },
  { id: 'development', name: '개발솔루션-DSC', table: 'iota_development_tasks' },
  { id: 'marketing', name: '기업마케팅-EMC', table: 'iota_marketing_tasks' },
  { id: 'digital', name: '상품·디지털-SSC', table: 'iota_digital_tasks' },
  { id: 'fund', name: '펀드운용-KAM', table: 'iota_fund_tasks' },
  { id: 'ipr', name: 'IPR-WG', table: 'iota_ipr_tasks' },
];

const ARCHIVE_WORKSPACES = WORKSPACES.filter((workspace) => workspace.id === 'logistics');

function WorkspaceIcon() {
  return (
    <svg className="mr-3 h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 19V8.5L12 4l8 4.5V19M7 19v-7h10v7M9 14h2m2 0h2" />
    </svg>
  );
}

function safeText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function startOfMondayWeek(date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatShortDate(date) {
  return `${String(date.getFullYear()).slice(2)}.${date.getMonth() + 1}.${date.getDate()}`;
}

function weekMeta(value) {
  const parsed = value ? new Date(value) : new Date();
  const source = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const monday = startOfMondayWeek(source);
  const sunday = addDays(monday, 6);
  const monthStart = new Date(monday.getFullYear(), monday.getMonth(), 1);
  const firstMonday = startOfMondayWeek(monthStart);
  const weekNo = Math.floor((monday - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return {
    key: `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`,
    group: `${monday.getFullYear()}년 ${monday.getMonth() + 1}월`,
    label: `${String(monday.getFullYear()).slice(2)}년 ${monday.getMonth() + 1}월 ${weekNo}주`,
    range: `${formatShortDate(monday)}~${formatShortDate(sunday)}`,
  };
}

function normalizeTask(row = {}) {
  const status = safeText(row.status || row.issue_status || row.progress_status, 'new');
  const basisDate = row.completed_at || row.deleted_at || row.updated_at || row.created_at;
  const createdByName = safeText(row.created_by_name || row.owner_name || row.owner, '');
  const createdByEmail = safeText(row.created_by_email || row.owner_email, '');
  return {
    id: row.id || `${safeText(row.task_name || row.title)}-${basisDate || ''}`,
    related_asset: safeText(row.related_asset_name || row.related_asset || row.asset_name, ''),
    task_name: safeText(row.task_name || row.title || row.issue || row.next_action, 'Task'),
    company_name: safeText(row.company_name || row.stakeholder_name || row.stakeholder || row.created_by_name, ''),
    status,
    due_date: row.due_date || row.target_date || '',
    next_action: safeText(row.next_action || row.body || row.issue || row.content, ''),
    notes: safeText(row.notes || row.payload?.notes || row.payload?.source_text || '', ''),
    created_by_name: createdByName,
    created_by_email: createdByEmail,
    created_by_display: safeText(row.created_by_display, createdByEmail ? `${createdByName || createdByEmail}(${createdByEmail})` : createdByName),
    created_at: row.created_at || basisDate || new Date().toISOString(),
    updated_at: row.updated_at || basisDate || row.created_at || new Date().toISOString(),
  };
}

function snapshotsFromTasks(rows, workspace = 'logistics') {
  const groups = new Map();
  (rows || []).map(normalizeTask).forEach((task) => {
    const meta = weekMeta(task.updated_at || task.created_at);
    const group = groups.get(meta.key) || {
      id: `${workspace}-${meta.key}`,
      workspace,
      week_label: meta.label,
      week_range: meta.range,
      group_label: meta.group,
      created_at: task.updated_at || task.created_at,
      snapshot_data: [],
    };
    group.snapshot_data.push(task);
    if (new Date(task.updated_at) > new Date(group.created_at)) group.created_at = task.updated_at;
    groups.set(meta.key, group);
  });
  return [...groups.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function groupSnapshots(snapshots) {
  return (snapshots || []).reduce((acc, snap) => {
    const group = snap.group_label || safeText(snap.week_label).replace(/\s+\d+주.*/u, '') || '기타';
    if (!acc[group]) acc[group] = [];
    acc[group].push(snap);
    return acc;
  }, {});
}

function snapshotGroupKey(snapshot = {}) {
  return [
    snapshot.workspace || 'logistics',
    snapshot.week_key || snapshot.week_label || '',
    snapshot.week_range || '',
  ].join('|');
}

function snapshotTaskKey(task = {}) {
  const payload = task.payload || {};
  return safeText(
    task.seed_id
      || task.seedId
      || payload.seedId
      || payload.seed_id
      || task.id
      || `${task.task_name}|${task.related_asset}|${task.company_name}|${task.due_date}`,
    '',
  );
}

function coalesceLogisticsTaskSnapshots(snapshots = []) {
  const groups = new Map();
  (snapshots || []).forEach((snapshot) => {
    const key = snapshotGroupKey(snapshot);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        ...snapshot,
        id: snapshot.week_key ? `logistics-${snapshot.week_key}` : snapshot.id,
        snapshot_data: [...(snapshot.snapshot_data || [])],
      });
      return;
    }

    const currentUpdated = new Date(current.created_at || 0).getTime();
    const nextUpdated = new Date(snapshot.created_at || 0).getTime();
    const mergedTasks = new Map();
    [...(current.snapshot_data || []), ...(snapshot.snapshot_data || [])].forEach((task) => {
      const taskKey = snapshotTaskKey(task);
      if (!taskKey) return;
      const existing = mergedTasks.get(taskKey);
      const existingTime = existing ? new Date(existing.updated_at || existing.created_at || 0).getTime() : -Infinity;
      const taskTime = new Date(task.updated_at || task.created_at || 0).getTime();
      if (!existing || taskTime >= existingTime) mergedTasks.set(taskKey, task);
    });

    groups.set(key, {
      ...current,
      id: current.id || snapshot.id,
      created_at: nextUpdated > currentUpdated ? snapshot.created_at : current.created_at,
      snapshot_data: [...mergedTasks.values()],
      task_count: mergedTasks.size,
    });
  });

  return [...groups.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

async function fetchLogisticsTaskSnapshots() {
  const { data, error } = await supabase.functions.invoke('ll-dashboard-api', {
    body: { action: 'work-platform/tasks/snapshots/list', payload: { limit: 500 } },
  });
  if (error || data?.ok === false) throw error || new Error(data?.message || 'Edge Function returned false');
  return coalesceLogisticsTaskSnapshots((data?.data || []).map((snapshot) => ({
    id: snapshot.id,
    workspace: snapshot.workspace || 'logistics',
    week_key: snapshot.week_key,
    week_label: snapshot.week_label,
    week_range: snapshot.week_range,
    group_label: snapshot.group_label,
    basis_date: snapshot.basis_date,
    created_at: snapshot.updated_at || snapshot.created_at,
    task_count: snapshot.task_count,
    snapshot_data: (snapshot.snapshot_data || []).map(normalizeTask).filter((task) => task.status !== 'deleted'),
  })));
}

export default function WorkspaceArchive() {
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState('logistics');

  const selectedWorkspace = ARCHIVE_WORKSPACES.find((item) => item.id === workspaceFilter) || ARCHIVE_WORKSPACES[0];

  useEffect(() => {
    const fetchSnapshots = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        let fetchedData = [];
        if (workspaceFilter === 'logistics') {
          fetchedData = await fetchLogisticsTaskSnapshots();
        } else {
          const [snapshotRes, liveRes] = await Promise.all([
            supabase
              .from('iota_weekly_snapshots')
              .select('*')
              .eq('workspace', workspaceFilter)
              .order('created_at', { ascending: false }),
            selectedWorkspace.table
              ? supabase.from(selectedWorkspace.table).select('*').order('created_at', { ascending: false })
              : Promise.resolve({ data: null, error: null }),
          ]);
          if (snapshotRes.error) throw snapshotRes.error;
          fetchedData = snapshotRes.data || [];
          if (!fetchedData.length && liveRes.data?.length) {
            fetchedData = snapshotsFromTasks(liveRes.data, workspaceFilter);
          }
        }
        setSnapshots(fetchedData);
        setSelectedSnapshotIds(fetchedData.length ? [fetchedData[0].id] : []);
      } catch (error) {
        console.error(error);
        setErrorMessage(error?.message || '지난 Task 데이터를 불러오지 못했습니다.');
        setSnapshots([]);
        setSelectedSnapshotIds([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSnapshots();
  }, [selectedWorkspace.table, workspaceFilter]);

  const grouped = useMemo(() => groupSnapshots(snapshots), [snapshots]);

  const selectedSnapshots = useMemo(() => (
    snapshots
      .filter((snapshot) => selectedSnapshotIds.includes(snapshot.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  ), [selectedSnapshotIds, snapshots]);

  const filteredSnapshots = useMemo(() => {
    const text = searchQuery.trim().toLowerCase();
    if (!text) return selectedSnapshots;
    return selectedSnapshots.map((snapshot) => ({
      ...snapshot,
      snapshot_data: (snapshot.snapshot_data || []).filter((task) => [
        task.task_name,
        task.related_asset,
        task.company_name,
        task.status,
        task.next_action,
        task.notes,
        task.created_by_name,
      ].join(' ').toLowerCase().includes(text)),
    })).filter((snapshot) => snapshot.snapshot_data.length);
  }, [searchQuery, selectedSnapshots]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#111] font-sans text-white">
      <aside className="print:hidden flex h-full w-[280px] shrink-0 flex-col border-r border-[#333] bg-[#202020]">
        <div className="border-b border-[#333] p-6">
          <h1 className="mb-2 text-[20px] font-bold tracking-tight text-white">지난 TASK 관리</h1>
          <p className="text-[12px] leading-5 text-[#86868B]">주차별로 자동 저장된 TASK 스냅샷만 확인합니다.</p>
        </div>
        <div className="border-b border-[#333] p-4">
          <div className="flex flex-col gap-1">
            {ARCHIVE_WORKSPACES.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => setWorkspaceFilter(workspace.id)}
                className={`flex items-center rounded-[10px] px-[14px] py-[10px] text-left text-[14px] transition-colors ${workspaceFilter === workspace.id ? 'bg-[#3c3c3c] font-bold text-white' : 'text-[#D1D1D6] hover:bg-[#333]'}`}
              >
                <WorkspaceIcon />
                {workspace.name}
              </button>
            ))}
          </div>
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="text-[13px] text-[#86868B]">불러오는 중입니다.</div>
          ) : errorMessage ? (
            <div className="rounded-[10px] border border-[#7A6425] bg-[#2B2613] p-3 text-[12px] leading-5 text-[#FFD166]">{errorMessage}</div>
          ) : snapshots.length === 0 ? (
            <div className="text-[13px] text-[#86868B]">저장된 Task 이력이 없습니다.</div>
          ) : (
            Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map((groupKey) => {
              const groupIds = grouped[groupKey].map((snapshot) => snapshot.id);
              const allSelected = groupIds.every((id) => selectedSnapshotIds.includes(id));
              return (
                <div key={groupKey} className="mb-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[12px] font-bold uppercase text-[#86868B]">{groupKey}</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedSnapshotIds((current) => (
                        allSelected
                          ? current.filter((id) => !groupIds.includes(id))
                          : [...new Set([...current, ...groupIds])]
                      ))}
                      className="w-[76px] rounded-[4px] bg-[#333] py-1 text-center text-[11px] font-bold text-[#A1A1AA] transition-colors hover:bg-[#444] hover:text-white"
                    >
                      {allSelected ? '선택 해제' : '전체 선택'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {grouped[groupKey].map((snapshot) => (
                      <button
                        key={snapshot.id}
                        type="button"
                        onClick={() => setSelectedSnapshotIds((current) => (
                          current.includes(snapshot.id)
                            ? current.filter((id) => id !== snapshot.id)
                            : [...current, snapshot.id]
                        ))}
                        className={`flex w-full items-center justify-between rounded-[8px] border px-4 py-[8px] text-left transition-all ${selectedSnapshotIds.includes(snapshot.id) ? 'border-[#3b82f6]/30 bg-[#3b82f6]/20 font-bold text-[#60a5fa]' : 'border-transparent text-[#D1D1D6] hover:bg-[#333]'}`}
                      >
                        <span className="text-[13px]">{snapshot.week_label} <span className="text-[#86868B]">{snapshot.week_range}</span></span>
                        <span className="text-[11px] text-[#86868B]">{snapshot.snapshot_data?.length || 0}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-[#111] print:block print:w-full">
        <div className="relative z-10 border-b border-[#333] bg-[#1A1A1A]/90 px-10 py-6 backdrop-blur-md print:hidden">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#86868B]">ARCHIVE</div>
              <h2 className="mt-1 text-[28px] font-bold tracking-tight text-white">{selectedWorkspace.name} · 지난 Task 관리</h2>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Task, 자산, 이해관계자, 다음 액션 검색"
                  className="h-11 w-full rounded-[12px] border border-[#333] bg-[#222] px-4 pl-10 text-[14px] text-white outline-none transition-colors placeholder:text-[#6E6E73] focus:border-[#555]"
                />
                <svg className="absolute left-3.5 top-3.5 h-4 w-4 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex h-11 shrink-0 items-center gap-2 rounded-[12px] border border-[#444] bg-[#1A1A1A] px-5 text-[13px] font-bold text-[#A1A1AA] shadow-sm transition-colors hover:bg-[#333] hover:text-white"
              >
                PDF 저장
              </button>
            </div>
          </div>
        </div>

        <div className="custom-scrollbar relative z-10 flex-1 overflow-y-auto px-10 py-8">
          <div className="mx-auto max-w-[1240px]">
            {!filteredSnapshots.length ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-[20px] border border-[#333] bg-[#202020] text-[14px] text-[#86868B]">
                좌측에서 주차를 선택하거나 검색 조건을 조정해주세요.
              </div>
            ) : (
              filteredSnapshots.map((snapshot) => (
                <section key={snapshot.id} className="mb-12">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <h3 className="flex flex-wrap items-center gap-3 text-[30px] font-bold tracking-tight text-white">
                        <span className="text-[#B3B0A6]">{snapshot.week_label}</span>
                        <span className="text-[22px] text-[#A1A1AA]">|</span>
                        <span>{snapshot.week_range}</span>
                      </h3>
                      <div className="mt-1 text-[13px] text-[#86868B]">저장 일시: {new Date(snapshot.created_at).toLocaleString('ko-KR')}</div>
                    </div>
                    <div className="text-[13px] font-semibold text-[#86868B]">{snapshot.snapshot_data.length}건</div>
                  </div>
                  <div className="space-y-4">
                    {snapshot.snapshot_data.map((row) => (
                      <article key={row.id} className="rounded-[24px] border border-[#3C3C3C] bg-[#272726] px-6 pb-[14px] pt-[22px]">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
                          <div className="min-w-0 flex-1 xl:border-r xl:border-[#444]/50 xl:pr-8">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              {row.related_asset ? <span className="rounded-[4px] border border-[#444] bg-[#333] px-[6px] py-[2px] text-[11px] font-bold text-[#A1A1AA]">{row.related_asset}</span> : null}
                              <span className="rounded-[4px] border border-[#444] bg-[#222] px-[6px] py-[2px] text-[11px] font-bold text-[#D1D1D6]">{row.status}</span>
                              {row.due_date ? <span className="rounded-[4px] border border-[#444] bg-[#222] px-[6px] py-[2px] text-[11px] font-bold text-[#D1D1D6]">목표 {row.due_date}</span> : null}
                            </div>
                            <h4 className="mb-2 text-[20px] font-bold leading-tight tracking-tight text-white">{row.task_name}</h4>
                            <div className="flex flex-wrap gap-3 text-[13px] text-[#A1A1AA]">
                              {row.company_name ? <span>이해관계자: <b className="text-[#E5E5E5]">{row.company_name}</b></span> : null}
                              {row.created_by_display || row.created_by_name ? <span>작성자: <b className="text-[#E5E5E5]">{row.created_by_display || row.created_by_name}</b></span> : null}
                            </div>
                          </div>
                          <div className="w-full xl:w-[38%]">
                            <span className="mb-[6px] block text-[13px] font-bold text-[#86868B]">Next Action</span>
                            <p className="whitespace-pre-wrap break-keep text-[15px] leading-relaxed text-[#E5E5E5]">{row.next_action || '-'}</p>
                          </div>
                        </div>
                        {row.notes ? (
                          <div className="mt-4 border-t border-[#3C3C3C] pt-4">
                            <span className="mb-[6px] block text-[13px] font-bold text-[#86868B]">상세 메모</span>
                            <p className="whitespace-pre-wrap break-keep text-[14px] leading-relaxed text-[#A1A1AA]">{row.notes}</p>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
