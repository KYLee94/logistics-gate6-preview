export const LOGIN_HISTORY_DUPLICATE_WINDOW_MS = 2000;

const normalizedLoginHistoryIdentity = (row = {}) => [
    String(row.email || '').trim().toLowerCase(),
    String(row.status || row.outcome || '').trim().toLowerCase(),
    String(row.source_label || row.event_type || '').trim().toLowerCase(),
].join('|');

export const deduplicateLoginHistoryRows = (rows = [], windowMs = LOGIN_HISTORY_DUPLICATE_WINDOW_MS) => {
    const latestTimestampByIdentity = new Map();
    return (Array.isArray(rows) ? rows : []).filter((row) => {
        const identity = normalizedLoginHistoryIdentity(row);
        const timestamp = Date.parse(row?.logged_at || row?.updated_at || '');
        if (!identity || !Number.isFinite(timestamp)) return true;
        const latestTimestamp = latestTimestampByIdentity.get(identity);
        if (Number.isFinite(latestTimestamp) && Math.abs(latestTimestamp - timestamp) <= windowMs) return false;
        latestTimestampByIdentity.set(identity, timestamp);
        return true;
    });
};
