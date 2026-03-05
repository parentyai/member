'use strict';

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function formatDateLabel(value) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return '-';
  return new Date(parsed).toISOString().slice(0, 10);
}

function truncate(value, max) {
  const text = normalizeText(value, '');
  if (!text) return '-';
  const limit = Number.isFinite(Number(max)) ? Math.max(4, Math.floor(Number(max))) : 36;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function formatLineDeliveryHistory(result, options) {
  const payload = result && typeof result === 'object' ? result : {};
  const opts = options && typeof options === 'object' ? options : {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const limit = Number.isFinite(Number(opts.limit)) ? Math.max(1, Math.floor(Number(opts.limit))) : 5;
  const rows = items.slice(0, limit);
  if (!rows.length) {
    return '通知履歴はまだありません。';
  }

  const lines = ['通知履歴（直近）'];
  rows.forEach((item, index) => {
    const row = item && typeof item === 'object' ? item : {};
    const date = formatDateLabel(row.sentAt || row.deliveredAt);
    const title = truncate(row.title, 32);
    const status = normalizeText(row.statusLabel || row.status, '-');
    lines.push(`${index + 1}. ${date} / ${status} / ${title}`);
  });

  const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
  const total = Number.isFinite(Number(summary.total)) ? Number(summary.total) : items.length;
  const ok = Number.isFinite(Number(summary.ok)) ? Number(summary.ok) : 0;
  const warn = Number.isFinite(Number(summary.warn)) ? Number(summary.warn) : 0;
  const danger = Number.isFinite(Number(summary.danger)) ? Number(summary.danger) : 0;
  lines.push(`合計:${total} / OK:${ok} / WARN:${warn} / DANGER:${danger}`);
  lines.push('詳細確認は管理画面の monitor > ユーザー配信履歴 を利用してください。');
  return lines.join('\n');
}

module.exports = {
  formatLineDeliveryHistory
};
