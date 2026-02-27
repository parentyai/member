'use strict';

const {
  listNotificationDeliveriesBySentAtRange
} = require('../../repos/firestore/analyticsReadRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { listSnapshots } = require('../../repos/firestore/kpiSnapshotsReadRepo');
const faqAnswerLogsRepo = require('../../repos/firestore/faqAnswerLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveActor, resolveRequestId, resolveTraceId } = require('./osContext');
const {
  normalizeSnapshotMode,
  resolveSnapshotReadMode,
  isSnapshotRequired
} = require('../../domain/readModel/snapshotReadPolicy');
const {
  normalizeFallbackMode,
  resolveFallbackModeDefault
} = require('../../domain/readModel/fallbackPolicy');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_DELIVERIES_READ_LIMIT = 1000;
const MAX_DELIVERIES_READ_LIMIT = 5000;

function normalizeWindowDays(value) {
  if (String(value) === '30') return 30;
  return 7;
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 10;
  return Math.min(Math.floor(num), 100);
}

function normalizeReadLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_DELIVERIES_READ_LIMIT;
  return Math.min(Math.floor(num), MAX_DELIVERIES_READ_LIMIT);
}

function resolveFallbackMode(value) {
  if (value === null || value === undefined || value === '') return resolveFallbackModeDefault();
  const normalized = normalizeFallbackMode(value);
  if (normalized) return normalized;
  return null;
}

function parseFallbackOnEmpty(value) {
  if (value === null || value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function buildReadLimitWarning(sourceLength, payloadSummaryLength, readLimitUsed) {
  if (!Number.isFinite(sourceLength) || sourceLength < 0) return null;
  if (!Number.isFinite(readLimitUsed) || readLimitUsed <= 0) return null;
  const reached = Math.floor(sourceLength) >= Math.floor(readLimitUsed);
  if (!reached) return null;
  return {
    type: 'readLimitWarning',
    readLimitUsed,
    deliveredCount: Math.floor(sourceLength),
    matchedDeliveryCount: Math.max(0, Math.floor(payloadSummaryLength || 0))
  };
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function resolveHost(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    return new URL(url).host || null;
  } catch (_err) {
    return null;
  }
}

function pickVendor(link) {
  if (!link) return { vendorKey: 'unknown', vendorLabel: '未分類' };
  const host = resolveHost(link.url);
  const vendorKey = link.vendorKey || host || 'unknown';
  const vendorLabel = link.vendorLabel || host || vendorKey;
  return { vendorKey, vendorLabel };
}

function sortByCtr(a, b) {
  const ctrA = Number.isFinite(a.ctr) ? a.ctr : -1;
  const ctrB = Number.isFinite(b.ctr) ? b.ctr : -1;
  if (ctrA !== ctrB) return ctrB - ctrA;
  return (b.sent || 0) - (a.sent || 0);
}

async function handleMonitorInsights(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const windowDays = normalizeWindowDays(url.searchParams.get('windowDays'));
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const readLimit = normalizeReadLimit(url.searchParams.get('readLimit'));
  const snapshotModeRaw = url.searchParams.get('snapshotMode');
  const fallbackModeRaw = url.searchParams.get('fallbackMode');
  const fallbackOnEmptyRaw = url.searchParams.get('fallbackOnEmpty');
  const parsedSnapshotMode = normalizeSnapshotMode(snapshotModeRaw);
  if (snapshotModeRaw && !parsedSnapshotMode) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid snapshotMode' }));
    return;
  }
  const fallbackMode = resolveFallbackMode(fallbackModeRaw);
  if (fallbackModeRaw && !fallbackMode) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid fallbackMode' }));
    return;
  }
  const fallbackOnEmpty = parseFallbackOnEmpty(fallbackOnEmptyRaw);
  if (fallbackOnEmptyRaw && fallbackOnEmpty === null) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid fallbackOnEmpty' }));
    return;
  }
  const fallbackBlocked = fallbackMode === 'block';
  const snapshotMode = resolveSnapshotReadMode({ snapshotMode: parsedSnapshotMode || undefined });
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);
  const nowMs = Date.now();
  const sinceMs = nowMs - (windowDays * MS_PER_DAY);
  const windowStartDate = new Date(sinceMs);
  const windowEndDate = new Date(nowMs);

  try {
    const fallbackSources = [];
    const fallbackSourceTrace = [];
    let noteDiagnostics = null;
    let all = await listNotificationDeliveriesBySentAtRange({
      limit: readLimit,
      fromAt: windowStartDate,
      toAt: windowEndDate
    });
    let dataSource = 'range';
    let fallbackUsed = false;
    let fallbackBlockedFlag = false;
    if (!all.length && isSnapshotRequired(snapshotMode)) {
      dataSource = 'not_available';
      noteDiagnostics = 'NOT AVAILABLE';
      fallbackBlockedFlag = true;
    } else if (!all.length) {
      if (!fallbackBlocked && fallbackOnEmpty) {
        all = await listNotificationDeliveriesBySentAtRange({
          limit: readLimit
        });
        dataSource = 'fallback_bounded';
        fallbackUsed = true;
        fallbackSources.push('listNotificationDeliveriesBySentAtRange:fallback');
        fallbackSourceTrace.push('listNotificationDeliveriesBySentAtRange:fallback');
      } else {
        dataSource = 'not_available';
        noteDiagnostics = 'NOT AVAILABLE';
        fallbackBlockedFlag = true;
      }
    }
    const asOf = dataSource === 'not_available' ? null : windowEndDate.toISOString();
    const freshnessMinutes = asOf ? Math.max(0, (Date.now() - new Date(asOf).getTime()) / (60 * 1000)) : null;
    const readLimitUsed = readLimit;
    const deliveries = all
      .map((item) => Object.assign({ id: item.id }, item.data || {}))
      .filter((item) => {
        const sentMs = toMillis(item.sentAt || item.deliveredAt);
        return sentMs >= sinceMs;
      });
    const resultRows = deliveries.length;
    const matchedDeliveryCount = deliveries.length;
    const readLimitNote = buildReadLimitWarning(all.length, resultRows, readLimitUsed);
    const note = noteDiagnostics || readLimitNote;

    const notificationIds = Array.from(new Set(deliveries.map((item) => item.notificationId).filter(Boolean)));
    const notificationMap = new Map();
    for (const notificationId of notificationIds) {
      const notification = await notificationsRepo.getNotification(notificationId);
      if (notification) notificationMap.set(notificationId, notification);
    }

    const linkIds = Array.from(new Set(Array.from(notificationMap.values()).map((item) => item.linkRegistryId).filter(Boolean)));
    const linkMap = new Map();
    for (const linkId of linkIds) {
      const link = await linkRegistryRepo.getLink(linkId);
      if (link) linkMap.set(linkId, link);
    }

    const vendorAgg = new Map();
    const notificationAgg = new Map();
    for (const delivery of deliveries) {
      const notification = delivery.notificationId ? notificationMap.get(delivery.notificationId) || null : null;
      const link = notification && notification.linkRegistryId ? linkMap.get(notification.linkRegistryId) || null : null;
      const vendor = pickVendor(link);

      const vendorKey = `${vendor.vendorKey}::${vendor.vendorLabel}`;
      const vendorEntry = vendorAgg.get(vendorKey) || { vendorKey: vendor.vendorKey, vendorLabel: vendor.vendorLabel, sent: 0, clicked: 0, ctr: 0 };
      vendorEntry.sent += 1;
      if (delivery.clickAt) vendorEntry.clicked += 1;
      vendorAgg.set(vendorKey, vendorEntry);

      const notifKey = delivery.notificationId || 'unknown';
      const notifEntry = notificationAgg.get(notifKey) || {
        notificationId: delivery.notificationId || null,
        title: notification && notification.title ? notification.title : null,
        scenarioKey: notification && notification.scenarioKey ? notification.scenarioKey : null,
        stepKey: notification && notification.stepKey ? notification.stepKey : null,
        sent: 0,
        clicked: 0,
        ctr: 0
      };
      notifEntry.sent += 1;
      if (delivery.clickAt) notifEntry.clicked += 1;
      notificationAgg.set(notifKey, notifEntry);
    }

    const vendorCtrTop = Array.from(vendorAgg.values())
      .map((item) => Object.assign({}, item, { ctr: item.sent > 0 ? item.clicked / item.sent : 0 }))
      .sort(sortByCtr)
      .slice(0, limit);

    const ctrTop = Array.from(notificationAgg.values())
      .map((item) => Object.assign({}, item, { ctr: item.sent > 0 ? item.clicked / item.sent : 0 }))
      .sort(sortByCtr)
      .slice(0, limit);

    const snapshots = await listSnapshots({ order: 'desc', limit: 50 });
    const abSnapshotRaw = snapshots.find((row) => toMillis(row.createdAt) >= sinceMs) || null;
    const abSnapshot = abSnapshotRaw ? {
      ctaA: abSnapshotRaw.ctaA || null,
      ctaB: abSnapshotRaw.ctaB || null,
      sentA: Number.isFinite(abSnapshotRaw.sentA) ? abSnapshotRaw.sentA : 0,
      clickA: Number.isFinite(abSnapshotRaw.clickA) ? abSnapshotRaw.clickA : 0,
      ctrA: Number.isFinite(abSnapshotRaw.ctrA) ? abSnapshotRaw.ctrA : 0,
      sentB: Number.isFinite(abSnapshotRaw.sentB) ? abSnapshotRaw.sentB : 0,
      clickB: Number.isFinite(abSnapshotRaw.clickB) ? abSnapshotRaw.clickB : 0,
      ctrB: Number.isFinite(abSnapshotRaw.ctrB) ? abSnapshotRaw.ctrB : 0,
      deltaCTR: Number.isFinite(abSnapshotRaw.deltaCTR) ? abSnapshotRaw.deltaCTR : 0,
      createdAt: abSnapshotRaw.createdAt || null
    } : null;

    const faqLogs = await faqAnswerLogsRepo.listFaqAnswerLogs({ limit: 300, sinceAt: new Date(sinceMs).toISOString() });
    const faqCounts = new Map();
    faqLogs.forEach((item) => {
      const ids = Array.isArray(item && item.matchedArticleIds) ? item.matchedArticleIds : [];
      ids.forEach((articleId) => {
        if (!articleId) return;
        faqCounts.set(articleId, (faqCounts.get(articleId) || 0) + 1);
      });
    });
    const faqReferenceTop = Array.from(faqCounts.entries())
      .map(([articleId, count]) => ({ articleId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    try {
      await appendAuditLog({
        actor,
        action: 'monitor.insights.view',
        entityType: 'monitor',
        entityId: 'insights',
        traceId,
        requestId,
        payloadSummary: {
          windowDays,
          limit,
          snapshotMode,
          fallbackMode,
          fallbackOnEmpty,
          snapshotModeRaw: snapshotModeRaw || null,
          fallbackModeRaw: fallbackModeRaw || null,
          fallbackOnEmptyRaw: fallbackOnEmptyRaw || null,
          readLimitUsed,
          windowStart: windowStartDate.toISOString(),
          windowEnd: windowEndDate.toISOString(),
          resultRows,
          matchedDeliveryCount,
          readLimit,
          dataSource,
          deliveries: deliveries.length,
          vendorCount: vendorCtrTop.length,
          readLimitDiagnostics: readLimitNote
        }
      });
      if (fallbackUsed || fallbackBlockedFlag) {
        const fallbackPayloadSummary = {
          fallbackUsed,
          fallbackBlocked: fallbackBlockedFlag,
          fallbackSources,
          fallbackSourceTrace,
          snapshotMode,
          fallbackMode,
          fallbackOnEmpty,
          windowStart: windowStartDate.toISOString(),
          windowEnd: windowEndDate.toISOString(),
          readLimitUsed,
          resultRows,
          matchedDeliveryCount,
          dataSource,
          readLimit
        };
        await appendAuditLog({
          actor,
          action: 'read_path.fallback.monitor_insights',
          entityType: 'read_path',
          entityId: 'monitor_insights',
          traceId,
          requestId,
          payloadSummary: fallbackPayloadSummary
        });
        await appendAuditLog({
          actor,
          action: 'read_path_fallback',
          entityType: 'read_path',
          entityId: 'monitor_insights',
          traceId,
          requestId,
          payloadSummary: Object.assign({}, fallbackPayloadSummary, {
            readPathAction: 'read_path.fallback.monitor_insights'
          })
        });
      }
    } catch (_err) {
      // best effort only
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        serverTime: new Date().toISOString(),
        traceId,
        windowDays,
        windowStart: windowStartDate.toISOString(),
        windowEnd: windowEndDate.toISOString(),
        readLimitUsed,
        resultRows,
        matchedDeliveryCount,
        snapshotMode,
        snapshotModeRaw: snapshotModeRaw || null,
        fallbackMode,
        fallbackModeRaw: fallbackModeRaw || null,
        fallbackOnEmpty,
        fallbackOnEmptyRaw: fallbackOnEmptyRaw || null,
        fallbackSourceTrace,
        dataSource,
        source: dataSource,
        asOf,
        freshnessMinutes,
        note,
        fallbackUsed,
        fallbackBlocked: fallbackBlockedFlag,
        fallbackSources,
        diagnostics: {
          asOf,
          freshnessMinutes,
          windowStart: windowStartDate.toISOString(),
          windowEnd: windowEndDate.toISOString(),
          readLimitUsed,
          resultRows,
          matchedDeliveryCount,
          source: dataSource,
          note: readLimitNote,
          fallback: {
            used: fallbackUsed,
            blocked: fallbackBlockedFlag,
            sources: fallbackSourceTrace
          }
        },
        vendorCtrTop,
        ctrTop,
        abSnapshot,
        faqReferenceTop
      }));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}

module.exports = {
  handleMonitorInsights
};
