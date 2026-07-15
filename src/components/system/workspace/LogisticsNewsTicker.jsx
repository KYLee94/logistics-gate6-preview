import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useEdgeData } from './LogisticsSectorModules';

const NEWS_DATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

function kstDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function clean(value) {
  return String(value ?? '').replace(/<[^>]*>/gu, '').replace(/&quot;/gu, '"').replace(/&amp;/gu, '&').trim();
}

function shiftDate(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  date.setUTCDate(date.getUTCDate() + amount);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export default function LogisticsNewsTicker() {
  const [date, setDate] = useState(() => kstDateKey());
  const { data, loading, error } = useEdgeData('news/list', { limit: 10, date });
  const items = useMemo(() => (
    data?.selected_date === date && Array.isArray(data?.items) ? data.items.slice(0, 10) : []
  ), [data?.items, data?.selected_date, date]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const todayKey = kstDateKey();

  const synchronizeDate = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    const nextDate = kstDateKey();
    setDate((current) => (current === nextDate ? current : nextDate));
  }, []);

  useEffect(() => {
    let dateCheckTimer;
    const stopDateChecks = () => {
      if (dateCheckTimer) {
        window.clearInterval(dateCheckTimer);
        dateCheckTimer = undefined;
      }
    };
    const startDateChecks = () => {
      stopDateChecks();
      synchronizeDate();
      dateCheckTimer = window.setInterval(synchronizeDate, NEWS_DATE_CHECK_INTERVAL_MS);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        window.clearInterval(dateCheckTimer);
        dateCheckTimer = undefined;
        return;
      }
      startDateChecks();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', synchronizeDate);
    if (!document.hidden) startDateChecks();
    return () => {
      stopDateChecks();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', synchronizeDate);
    };
  }, [synchronizeDate]);

  useEffect(() => {
    setIndex((current) => (items.length ? current % items.length : 0));
  }, [date, items.length]);

  useEffect(() => {
    if (paused || items.length < 2 || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 5000);
    const onVisibilityChange = () => {
      if (document.hidden) window.clearInterval(timer);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [items.length, paused]);

  const current = items[index];
  const href = current?.canonical_url || current?.original_url || '';
  const selectDate = (nextDate) => setDate(nextDate && nextDate <= todayKey ? nextDate : todayKey);
  return (
    <div
      className="relative z-40 w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      data-testid="logistics-news-ticker"
    >
      <div className="flex min-h-10 w-full items-center overflow-hidden rounded-[10px] border border-[#333333] bg-[#1F1F1E] pl-4" aria-live="polite">
        <span className="mr-4 shrink-0 text-[12px] font-bold text-[#A1A1AA]">오늘의 물류 뉴스</span>
        {current ? (
          <a href={href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white hover:text-[#9AD7FF]">
            <span className="mr-2 text-[#86868B]">{index + 1}/{items.length}</span>
            {clean(current.title)}
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[13px] text-[#86868B]">
            {loading ? '선택한 날짜의 뉴스를 불러오는 중입니다.' : error ? '뉴스 상태를 확인하지 못했습니다.' : '선택한 날짜에 수집 완료된 뉴스가 없습니다.'}
          </span>
        )}
        <button
          type="button"
          data-testid="logistics-news-expand"
          aria-label={expanded ? '뉴스 목록 접기' : '뉴스 목록 펼치기'}
          aria-expanded={expanded}
          title={expanded ? '뉴스 목록 접기' : '뉴스 목록 펼치기'}
          onClick={() => setExpanded((currentValue) => !currentValue)}
          className="ml-3 grid h-10 w-10 shrink-0 place-items-center border-l border-[#333333] text-[18px] leading-none text-[#B8BBC1] hover:bg-white/[0.05] hover:text-white"
        >
          {expanded ? '▴' : '▾'}
        </button>
      </div>
      {expanded ? (
        <div data-testid="logistics-news-list" className="absolute right-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-[10px] border border-[#3A3A3C] bg-[#1F1F1E] shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#333333] px-3 py-2">
            <span className="text-[12px] font-semibold text-[#C7C7CC]">물류 뉴스 1~10</span>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="이전 날짜" title="이전 날짜" onClick={() => selectDate(shiftDate(date, -1))} className="grid h-7 w-7 place-items-center rounded-[6px] border border-[#3A3A3C] text-[16px] text-[#C7C7CC] hover:bg-white/[0.05]">‹</button>
              <input data-testid="logistics-news-date-input" type="date" max={todayKey} value={date} onChange={(event) => selectDate(event.target.value)} className="h-7 rounded-[6px] border border-[#3A3A3C] bg-[#171717] px-2 text-[12px] text-white outline-none [color-scheme:dark]" />
              <button type="button" aria-label="다음 날짜" title="다음 날짜" disabled={date >= todayKey} onClick={() => selectDate(shiftDate(date, 1))} className="grid h-7 w-7 place-items-center rounded-[6px] border border-[#3A3A3C] text-[16px] text-[#C7C7CC] hover:bg-white/[0.05] disabled:opacity-35">›</button>
            </div>
          </div>
          <ol className="py-1">
            {items.length ? items.map((item, itemIndex) => {
              const itemHref = item?.canonical_url || item?.original_url || '';
              return (
                <li key={item.id || itemHref || `${date}-${itemIndex}`} data-news-item="true" className="border-b border-[#2B2B2D] last:border-b-0">
                  <a href={itemHref} target="_blank" rel="noreferrer" className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 px-3 py-2.5 text-left hover:bg-white/[0.04]">
                    <span className="text-right text-[12px] font-semibold tabular-nums text-[#86868B]">{itemIndex + 1}</span>
                    <span className="truncate text-[13px] font-medium text-[#E5E5E5]">{clean(item.title)}</span>
                  </a>
                </li>
              );
            }) : <li className="px-4 py-8 text-center text-[13px] text-[#86868B]">{loading ? '뉴스를 불러오는 중입니다.' : '선택한 날짜에 수집 완료된 뉴스가 없습니다.'}</li>}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
