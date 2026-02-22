'use strict';

const analyticsReadRepo = require('../../repos/firestore/analyticsReadRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const {
  resolveSnapshotReadMode,
  isSnapshotReadEnabled,
  isSnapshotRequired,
  isFallbackAllowed
} = require('../../domain/readModel/snapshotReadPolicy');
const {
  FALLBACK_MODE_ALLOW,
  FALLBACK_MODE_BLOCK,
  normalizeFallbackMode,
  resolveFallbackModeDefault
} = require('../../domain/readModel/fallbackPolicy');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

const MONTHS_ALLOWED = new Set([1, 3, 6, 12]);
const MAX_SCAN_LIMIT = 3000;
const DEFAULT_SCAN_LIMIT = 2000;
const DEFAULT_SNAPSHOT_FRESHNESS_MINUTES = 60;

function parseWindowMonths(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('windowMonths') || 1);
  if (!Number.isFinite(raw)) return 1;
  const normalized = Math.max(1, Math.min(12, Math.floor(raw)));
  if (!MONTHS_ALLOWED.has(normalized)) return 1;
  return normalized;
}

function parseScanLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('scanLimit'));
  if (!Number.isFinite(raw)) return DEFAULT_SCAN_LIMIT;
  return Math.max(100, Math.min(MAX_SCAN_LIMIT, Math.floor(raw)));
}

function parseFallbackMode(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = url.searchParams.get('fallbackMode');
  if (raw === null || raw === undefined || raw === '') return resolveFallbackModeDefault();
  const normalized = normalizeFallbackMode(raw);
  if (normalized) return normalized;
  throw new Error('invalid fallbackMode');
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

function resolveBucketQueryRange(buckets) {
  if (!Array.isArray(buckets) || buckets.length === 0) {
    return { fromAt: null, toAt: null };
  }
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const fromMs = Number.isFinite(first && first.start) ? first.start : null;
  const toMs = Number.isFinite(last && last.end) ? Math.max(last.end - 1, last.start || 0) : null;
  return {
    fromAt: Number.isFinite(fromMs) ? new Date(fromMs) : null,
    toAt: Number.isFinite(toMs) ? new Date(toMs) : null
  };
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

function resolveSnapshotFreshnessMinutes() {
  const value = Number(process.env.OPS_SNAPSHOT_FRESHNESS_MINUTES);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SNAPSHOT_FRESHNESS_MINUTES;
  return Math.min(Math.floor(value), 1440);
}

function isSnapshotFresh(snapshot, freshnessMinutes) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const asOf = snapshot.asOf;
  const asOfMs = typeof asOf === 'string' ? Date.parse(asOf) : NaN;
  if (!Number.isFinite(asOfMs)) return false;
  const nowMs = Date.now();
  return nowMs - asOfMs <= freshnessMinutes * 60 * 1000;
}

async function computeDashboardKpis(windowMonths, scanLimit, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const fallbackMode = opts.fallbackMode === FALLBACK_MODE_BLOCK
    ? FALLBACK_MODE_BLOCK
    : FALLBACK_MODE_ALLOW;
  const fallbackBlocked = fallbackMode === FALLBACK_MODE_BLOCK;
  const buckets = monthBuckets(windowMonths);
  const queryRange = resolveBucketQueryRange(buckets);
  let [users, notifications, deliveries, events, links, killSwitch] = await Promise.all([
    analyticsReadRepo.listUsersByCreatedAtRange({
      limit: scanLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    }),
    analyticsReadRepo.listNotificationsByCreatedAtRange({
      limit: scanLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    }),
    analyticsReadRepo.listNotificationDeliveriesBySentAtRange({
      limit: scanLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    }),
    analyticsReadRepo.listEventsByCreatedAtRange({
      limit: scanLimit,
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt
    }),
    linkRegistryRepo.listLinks({ limit: 500 }),
    systemFlagsRepo.getKillSwitch()
  ]);
  let fallbackBlockedNotAvailable = false;
  const fallbackSources = [];

  if (users.length === 0) {
    if (!fallbackBlocked) {
      users = await analyticsReadRepo.listAllUsers({ limit: scanLimit });
      fallbackSources.push('listAllUsers');
    } else {
      fallbackBlockedNotAvailable = true;
    }
  }
  if (notifications.length === 0) {
    if (!fallbackBlocked) {
      notifications = await analyticsReadRepo.listAllNotifications({ limit: scanLimit });
      fallbackSources.push('listAllNotifications');
    } else {
      fallbackBlockedNotAvailable = true;
    }
  }

  if (fallbackBlockedNotAvailable) {
    return {
      kpis: buildNotAvailableKpis('NOT AVAILABLE'),
      asOf: null,
      fallbackUsed: false,
      fallbackBlocked: true,
      fallbackSources
    };
  }

  const normalizedUsers = users.map((row) => Object.assign({ id: row && row.id }, row && row.data ? row.data : row));
  const normalizedNotifications = notifications.map((row) => Object.assign({ id: row && row.id }, row && row.data ? row.data : row));

  const registrationsSeries = countByBuckets(normalizedUsers, (row) => toMillis(row && row.createdAt), buckets);
  const registrationTotal = registrationsSeries.reduce((sum, value) => sum + value, 0);

  const membershipSeries = buckets.map((bucket) => {
    let total = 0;
    let matched = 0;
    normalizedUsers.forEach((row) => {
      const createdAt = toMillis(row && row.createdAt);
      if (!Number.isFinite(createdAt) || createdAt < bucket.start || createdAt >= bucket.end) return;
      total += 1;
      if (row && typeof row.redacMembershipIdHash === 'string' && row.redacMembershipIdHash.trim()) matched += 1;
    });
    if (!total) return 0;
    return Math.round((matched / total) * 1000) / 10;
  });
  const membershipMatched = normalizedUsers.filter((row) => row && typeof row.redacMembershipIdHash === 'string' && row.redacMembershipIdHash.trim()).length;

  const notificationSeries = countByBuckets(normalizedNotifications, (row) => toMillis(row && row.createdAt), buckets);
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
    membership: simpleMetric(ratioLabel(membershipMatched, normalizedUsers.length), membershipSeries, 'リダックくらぶID一致率'),
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

  return {
    kpis,
    asOf: new Date().toISOString(),
    fallbackUsed: fallbackSources.length > 0,
    fallbackBlocked: false,
    fallbackSources
  };
}

function buildNotAvailableKpis(note) {
  const message = note || 'NOT AVAILABLE';
  return {
    registrations: notAvailable(message),
    membership: notAvailable(message),
    stepStates: notAvailable(message),
    churnRate: notAvailable(message),
    ctrTrend: notAvailable(message),
    cityPackUsage: notAvailable(message)
  };
}

async function handleDashboardKpi(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const windowMonths = parseWindowMonths(req);
  const scanLimit = parseScanLimit(req);
  let fallbackMode;
  try {
    fallbackMode = parseFallbackMode(req);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message, traceId, requestId }));
    return;
  }
  const freshnessMinutes = resolveSnapshotFreshnessMinutes();
  const snapshotMode = resolveSnapshotReadMode();
  const snapshotReadEnabled = isSnapshotReadEnabled(snapshotMode);
  const snapshotKey = String(windowMonths);
  try {
    if (snapshotReadEnabled) {
      const snapshot = await opsSnapshotsRepo.getSnapshot('dashboard_kpi', snapshotKey);
      if (isSnapshotFresh(snapshot, freshnessMinutes) && snapshot && snapshot.data && snapshot.data.kpis) {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          traceId,
          requestId,
          windowMonths,
          scanLimit,
          dataSource: 'snapshot',
          source: 'snapshot',
          asOf: snapshot.asOf || null,
          freshnessMinutes: snapshot.freshnessMinutes || freshnessMinutes,
          kpis: snapshot.data.kpis
        }));
        return;
      }

      if (isSnapshotRequired(snapshotMode)) {
        const kpis = buildNotAvailableKpis('NOT AVAILABLE');
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          traceId,
          requestId,
          windowMonths,
          scanLimit,
          dataSource: 'not_available',
          source: 'not_available',
          asOf: null,
          freshnessMinutes,
          kpis
        }));
        return;
      }
    } else if (isSnapshotRequired(snapshotMode)) {
      const kpis = buildNotAvailableKpis('NOT AVAILABLE');
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        traceId,
        requestId,
        windowMonths,
        scanLimit,
        dataSource: 'not_available',
        source: 'not_available',
        asOf: null,
        freshnessMinutes,
        kpis
      }));
      return;
    }

    if (!isFallbackAllowed(snapshotMode)) {
      const kpis = buildNotAvailableKpis('NOT AVAILABLE');
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        traceId,
        requestId,
        windowMonths,
        scanLimit,
        dataSource: 'not_available',
        source: 'not_available',
        asOf: null,
        freshnessMinutes,
        kpis
      }));
      return;
    }

    const computed = await computeDashboardKpis(windowMonths, scanLimit, { fallbackMode });
    const kpis = computed.kpis;
    if (snapshotReadEnabled && computed.fallbackBlocked !== true) {
      await opsSnapshotsRepo.saveSnapshot({
        snapshotType: 'dashboard_kpi',
        snapshotKey,
        asOf: computed.asOf,
        freshnessMinutes,
        sourceTraceId: traceId,
        data: { kpis, windowMonths, scanLimit }
      });
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      windowMonths,
      scanLimit,
      dataSource: computed.fallbackBlocked ? 'not_available' : 'computed',
      source: computed.fallbackBlocked ? 'not_available' : 'computed',
      asOf: computed.asOf,
      freshnessMinutes,
      note: computed.fallbackBlocked ? 'NOT AVAILABLE' : null,
      fallbackUsed: computed.fallbackUsed === true,
      fallbackBlocked: computed.fallbackBlocked === true,
      fallbackSources: Array.isArray(computed.fallbackSources) ? computed.fallbackSources : [],
      kpis
    }));
  } catch (err) {
    logRouteError('admin.os_dashboard_kpi', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleDashboardKpi,
  computeDashboardKpis
};
