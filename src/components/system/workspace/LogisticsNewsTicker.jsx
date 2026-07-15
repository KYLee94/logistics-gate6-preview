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

export default function LogisticsNewsTicker() {
  const [date, setDate] = useState(() => kstDateKey());
  const { data, loading, error } = useEdgeData('news/list', { limit: 10, date });
  const items = useMemo(() => (
    data?.selected_date === date && Array.isArray(data?.items) ? data.items.slice(0, 10) : []
  ), [data?.items, data?.selected_date, date]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

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
  }, [items.length]);

  useEffect(() => {
    if (paused || items.length < 2 || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 8000);
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
  return (
    <div
      className="mb-5 flex min-h-12 w-full items-center overflow-hidden rounded-[10px] border border-[#333333] bg-[#1F1F1E] px-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-live="polite"
      data-testid="logistics-news-ticker"
    >
      <span className="mr-4 shrink-0 text-[12px] font-bold text-[#A1A1AA]">오늘의 물류 뉴스</span>
      {current ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white hover:text-[#9AD7FF]">
          <span className="mr-2 text-[#86868B]">{index + 1}/{items.length}</span>
          {clean(current.title)}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[13px] text-[#86868B]">
          {loading ? '오늘 뉴스를 불러오는 중입니다.' : error ? '오늘 뉴스 상태를 확인하지 못했습니다.' : '오늘 수집 완료된 뉴스가 없습니다.'}
        </span>
      )}
    </div>
  );
}
