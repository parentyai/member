'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const phase2ReadRepo = require('../../repos/firestore/phase2ReadRepo');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

const MONTHS_ALLOWED = new Set([1, 3, 6, 12]);

function parseWindowMonths(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('windowMonths') || 1);
  if (!Number.isFinite(raw)) return 1;
  const normalized = Math.max(1, Math.min(12, Math.floor(raw)));
  if (!MONTHS_ALLOWED.has(normalized)) return 1;
  return normalized;
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
  }
  if (value && Number.isFinite(value._seconds)) return Number(value._seconds) * 1000;
  return null;
}

function startOfMonthUtc(baseDate, offset) {
  return Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + offset, 1, 0, 0, 0, 0);
}

function monthBuckets(months) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const start = startOfMonthUtc(now, -i);
    const end = startOfMonthUtc(now, -i + 1);
    buckets.push({ start, end, key: new Date(start).toISOString().slice(0, 7) });
  }
  return buckets;
}

function countByBuckets(rows, getTime, buckets) {
  const counts = buckets.map(() => 0);
  rows.forEach((row) => {
    const ms = getTime(row);
    if (!Number.isFinite(ms)) return;
    for (let i = 0; i < buckets.length; i += 1) {
      if (ms >= buckets[i].start && ms < buckets[i].end) {
        counts[i] += 1;
        break;
      }
    }
  });
  return counts;
}

function ratioLabel(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) return '0 / 0 (0%)';
  const percent = Math.round((numerator / denominator) * 1000) / 10;
  return `${numerator} / ${denominator} (${percent}%)`;
}

function simpleMetric(valueLabel, series, note) {
  return {
    available: true,
    valueLabel,
    series,
    note: note || '-'
  };
}

function notAvailable(note) {
  return {
    available: false,
    valueLabel: null,
    series: [],
    note: note || 'NOT AVAILABLE'
  };
}

async function handleDashboardKpi(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const windowMonths = parseWindowMonths(req);
  const buckets = monthBuckets(windowMonths);
  try {
    const [users, notifications, deliveries, events, links, killSwitch] = await Promise.all([
      usersRepo.listUsers({ limit: 5000 }),
      notificationsRepo.listNotifications({ limit: 5000 }),
      phase2ReadRepo.listAllNotificationDeliveries({ limit: 5000 }),
      phase2ReadRepo.listAllEvents({ limit: 5000 }),
      linkRegistryRepo.listLinks({ limit: 500 }),
      systemFlagsRepo.getKillSwitch()
    ]);

    const registrationsSeries = countByBuckets(users, (row) => toMillis(row && row.createdAt), buckets);
    const registrationTotal = registrationsSeries.reduce((sum, value) => sum + value, 0);

    const membershipSeries = buckets.map((bucket) => {
      let total = 0;
      let matched = 0;
      users.forEach((row) => {
        const createdAt = toMillis(row && row.createdAt);
        if (!Number.isFinite(createdAt) || createdAt < bucket.start || createdAt >= bucket.end) return;
        total += 1;
        if (row && typeof row.redacMembershipIdHash === 'string' && row.redacMembershipIdHash.trim()) matched += 1;
      });
      if (!total) return 0;
      return Math.round((matched / total) * 1000) / 10;
    });
    const membershipMatched = users.filter((row) => row && typeof row.redacMembershipIdHash === 'string' && row.redacMembershipIdHash.trim()).length;

    const notificationSeries = countByBuckets(notifications, (row) => toMillis(row && row.createdAt), buckets);
    const notificationTotal = notificationSeries.reduce((sum, value) => sum + value, 0);

    const reactionSeries = buckets.map((bucket) => {
      let delivered = 0;
      let clicked = 0;
      deliveries.forEach((row) => {
        const payload = row && row.data ? row.data : row;
        const sentAt = toMillis(payload && payload.sentAt);
        if (!Number.isFinite(sentAt) || sentAt < bucket.start || sentAt >= bucket.end) return;
        if (payload && payload.delivered === true) delivered += 1;
        if (payload && payload.clickAt) clicked += 1;
      });
      if (!delivered) return 0;
      return Math.round((clicked / delivered) * 1000) / 10;
    });

    const consultSeries = buckets.map((bucket) => {
      let count = 0;
      events.forEach((row) => {
        const payload = row && row.data ? row.data : row;
        const createdAt = toMillis(payload && payload.createdAt);
        if (!Number.isFinite(createdAt) || createdAt < bucket.start || createdAt >= bucket.end) return;
        const type = String(payload && payload.type ? payload.type : '').toUpperCase();
        if (type.includes('CONSULT') || type.includes('FAQ') || type.includes('CONTACT')) count += 1;
      });
      return count;
    });

    const warnCount = links.filter((row) => row && row.lastHealth && row.lastHealth.state === 'WARN').length;
    const killSwitchWarnSeries = buckets.map(() => warnCount + (killSwitch ? 1 : 0));

    const kpis = {
      registrations: simpleMetric(String(registrationTotal), registrationsSeries, `${windowMonths}ヶ月のLINE登録件数`),
      membership: simpleMetric(ratioLabel(membershipMatched, users.length), membershipSeries, 'リダックくらぶID一致率'),
      stepStates: simpleMetric(String(notificationTotal), notificationSeries, `${windowMonths}ヶ月の通知作成件数`),
      churnRate: simpleMetric(
        reactionSeries.length ? `${reactionSeries[reactionSeries.length - 1]}%` : '0%',
        reactionSeries,
        '通知反応率（クリック / 配信）'
      ),
      ctrTrend: simpleMetric(
        String(consultSeries.reduce((sum, value) => sum + value, 0)),
        consultSeries,
        '相談クリック件数（events集計）'
      ),
      cityPackUsage: links.length
        ? simpleMetric(`${warnCount}${killSwitch ? ' + KillSwitch ON' : ''}`, killSwitchWarnSeries, 'WARNリンク数 + KillSwitch状態')
        : notAvailable('link_registryが未設定のため取得できません')
    };

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      windowMonths,
      kpis
    }));
  } catch (err) {
    logRouteError('admin.os_dashboard_kpi', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleDashboardKpi
};
