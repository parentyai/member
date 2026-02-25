'use strict';

const analyticsReadRepo = require('../../repos/firestore/analyticsReadRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const opsSnapshotsRepo = require('../../repos/firestore/opsSnapshotsRepo');
const userSubscriptionsRepo = require('../../repos/firestore/userSubscriptionsRepo');
const llmUsageLogsRepo = require('../../repos/firestore/llmUsageLogsRepo');
const journeyKpiDailyRepo = require('../../repos/firestore/journeyKpiDailyRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
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

const MONTHS_ALLOWED = new Set([1, 3, 6, 12, 36]);
const MAX_SCAN_LIMIT = 3000;
const DEFAULT_SCAN_LIMIT = 2000;
const DEFAULT_SNAPSHOT_FRESHNESS_MINUTES = 60;

function parseWindowMonths(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('windowMonths') || 1);
  if (!Number.isFinite(raw)) return 1;
  const normalized = Math.max(1, Math.min(36, Math.floor(raw)));
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

function parseFallbackOnEmpty(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = url.searchParams.get('fallbackOnEmpty');
  if (raw === null || raw === undefined || raw === '') return true;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error('invalid fallbackOnEmpty');
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

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 10) / 10}%`;
}

function ratioToPercent(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.round(Number(value) * 1000) / 10;
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
  const fallbackOnEmpty = opts.fallbackOnEmpty !== false;
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
    if (!fallbackBlocked && fallbackOnEmpty) {
      users = await analyticsReadRepo.listUsersByCreatedAtRange({
        limit: scanLimit
      });
      fallbackSources.push('listUsersByCreatedAtRange:fallback');
    } else {
      fallbackBlockedNotAvailable = true;
    }
  }
  if (notifications.length === 0) {
    if (!fallbackBlocked && fallbackOnEmpty) {
      notifications = await analyticsReadRepo.listNotificationsByCreatedAtRange({
        limit: scanLimit
      });
      fallbackSources.push('listNotificationsByCreatedAtRange:fallback');
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
  const lineUserIds = normalizedUsers
    .map((row) => (row && row.id ? String(row.id).trim() : ''))
    .filter(Boolean);
  const [subscriptions, llmUsageLogs, latestJourneyKpi] = await Promise.all([
    userSubscriptionsRepo.listUserSubscriptionsByLineUserIds({ lineUserIds }).catch(() => []),
    llmUsageLogsRepo.listLlmUsageLogsByCreatedAtRange({
      fromAt: queryRange.fromAt,
      toAt: queryRange.toAt,
      limit: Math.max(200, Math.min(scanLimit * 4, 5000))
    }).catch(() => []),
    journeyKpiDailyRepo.getLatestJourneyKpiDaily().catch(() => null)
  ]);
  const proActiveCount = (subscriptions || []).filter((item) => {
    const status = String(item && item.status ? item.status : 'unknown').toLowerCase();
    return status === 'active' || status === 'trialing';
  }).length;
  const totalUsers = normalizedUsers.length;
  const proRatioPercent = totalUsers > 0 ? (proActiveCount / totalUsers) * 100 : 0;
  const proActiveSeries = buckets.map(() => proActiveCount);
  const totalUsersSeries = buckets.map(() => totalUsers);
  const proRatioSeries = buckets.map(() => Math.round(proRatioPercent * 10) / 10);

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

  const engagementSeries = buckets.map((bucket) => {
    let delivered = 0;
    let read = 0;
    deliveries.forEach((row) => {
      const payload = row && row.data ? row.data : row;
      const sentAt = toMillis(payload && payload.sentAt);
      if (!Number.isFinite(sentAt) || sentAt < bucket.start || sentAt >= bucket.end) return;
      if (payload && payload.delivered === true) delivered += 1;
      if (payload && payload.readAt) read += 1;
    });
    if (!delivered) return 0;
    return Math.round((read / delivered) * 1000) / 10;
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

  const faqSeries = buckets.map((bucket) => {
    let count = 0;
    events.forEach((row) => {
      const payload = row && row.data ? row.data : row;
      const createdAt = toMillis(payload && payload.createdAt);
      if (!Number.isFinite(createdAt) || createdAt < bucket.start || createdAt >= bucket.end) return;
      const type = String(payload && payload.type ? payload.type : '').toUpperCase();
      if (type.includes('FAQ')) count += 1;
    });
    return count;
  });

  const warnCount = links.filter((row) => row && row.lastHealth && row.lastHealth.state === 'WARN').length;
  const killSwitchWarnSeries = buckets.map(() => warnCount + (killSwitch ? 1 : 0));
  const llmUsageSeries = buckets.map((bucket) => {
    let count = 0;
    llmUsageLogs.forEach((row) => {
      const createdAt = toMillis(row && row.createdAt);
      if (!Number.isFinite(createdAt) || createdAt < bucket.start || createdAt >= bucket.end) return;
      count += 1;
    });
    return count;
  });
  const llmBlockedSeries = buckets.map((bucket) => {
    let count = 0;
    llmUsageLogs.forEach((row) => {
      const createdAt = toMillis(row && row.createdAt);
      if (!Number.isFinite(createdAt) || createdAt < bucket.start || createdAt >= bucket.end) return;
      const decision = String(row && row.decision ? row.decision : '').toLowerCase();
      if (decision !== 'allow') count += 1;
    });
    return count;
  });
  const llmBlockRateSeries = buckets.map((_, index) => {
    const total = llmUsageSeries[index];
    const blocked = llmBlockedSeries[index];
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.round((blocked / total) * 1000) / 10;
  });
  const llmAvgPerProSeries = buckets.map((_, index) => {
    const total = llmUsageSeries[index];
    if (!Number.isFinite(total) || total <= 0 || proActiveCount <= 0) return 0;
    return Math.round((total / proActiveCount) * 100) / 100;
  });
  const llmUsageTotal = llmUsageSeries.reduce((sum, value) => sum + value, 0);
  const journeyRetentionD30Ratio = latestJourneyKpi && latestJourneyKpi.retention
    ? Number(latestJourneyKpi.retention.d30)
    : NaN;
  const journeyNextActionExecutionRatio = latestJourneyKpi
    ? Number(latestJourneyKpi.nextActionExecutionRate)
    : NaN;
  const journeyProConversionRatio = latestJourneyKpi
    ? Number(latestJourneyKpi.proConversionRate)
    : NaN;
  const journeyTaskCompletionRatio = latestJourneyKpi
    ? Number(latestJourneyKpi.taskCompletionRate)
    : NaN;
  const journeyDependencyBlockRatio = latestJourneyKpi
    ? Number(latestJourneyKpi.dependencyBlockRate)
    : NaN;
  const journeyChurnBlockedRatio = latestJourneyKpi && latestJourneyKpi.churnReasonRatio
    ? Number(latestJourneyKpi.churnReasonRatio.blocked)
    : NaN;
  const journeyRetentionD30Percent = ratioToPercent(journeyRetentionD30Ratio);
  const journeyNextActionExecutionPercent = ratioToPercent(journeyNextActionExecutionRatio);
  const journeyProConversionPercent = ratioToPercent(journeyProConversionRatio);
  const journeyTaskCompletionPercent = ratioToPercent(journeyTaskCompletionRatio);
  const journeyDependencyBlockPercent = ratioToPercent(journeyDependencyBlockRatio);
  const journeyChurnBlockedPercent = ratioToPercent(journeyChurnBlockedRatio);
  const hasJourneyKpi = Boolean(latestJourneyKpi);
  const journeyRetentionD30Series = buckets.map(() => journeyRetentionD30Percent);
  const journeyNextActionExecutionSeries = buckets.map(() => journeyNextActionExecutionPercent);
  const journeyProConversionSeries = buckets.map(() => journeyProConversionPercent);
  const journeyTaskCompletionSeries = buckets.map(() => journeyTaskCompletionPercent);
  const journeyDependencyBlockSeries = buckets.map(() => journeyDependencyBlockPercent);
  const journeyChurnBlockedSeries = buckets.map(() => journeyChurnBlockedPercent);

  const notificationsMetric = simpleMetric(String(notificationTotal), notificationSeries, `${windowMonths}ヶ月の通知作成件数`);
  const reactionMetric = simpleMetric(
    reactionSeries.length ? `${reactionSeries[reactionSeries.length - 1]}%` : '0%',
    reactionSeries,
    '通知反応率（クリック / 配信）'
  );
  const consultMetric = simpleMetric(
    String(consultSeries.reduce((sum, value) => sum + value, 0)),
    consultSeries,
    '相談クリック件数（events集計）'
  );
  const faqMetric = simpleMetric(
    String(faqSeries.reduce((sum, value) => sum + value, 0)),
    faqSeries,
    'FAQ利用件数（events集計）'
  );
  const engagementMetric = simpleMetric(
    engagementSeries.length ? `${engagementSeries[engagementSeries.length - 1]}%` : '0%',
    engagementSeries,
    'エンゲージメント（既読 / 配信）'
  );

  const kpis = {
    registrations: simpleMetric(String(registrationTotal), registrationsSeries, `${windowMonths}ヶ月の登録件数`),
    membership: simpleMetric(ratioLabel(membershipMatched, normalizedUsers.length), membershipSeries, 'メンバーID登録率'),
    engagement: engagementMetric,
    notifications: notificationsMetric,
    reaction: reactionMetric,
    faqUsage: faqMetric,
    stepStates: notificationsMetric,
    churnRate: reactionMetric,
    ctrTrend: consultMetric,
    pro_active_count: simpleMetric(String(proActiveCount), proActiveSeries, 'active/trialingのProユーザー数'),
    total_users: simpleMetric(String(totalUsers), totalUsersSeries, '対象ユーザー総数'),
    pro_ratio: simpleMetric(formatPercent(proRatioPercent), proRatioSeries, 'Proユーザー比率'),
    llm_daily_usage_count: simpleMetric(String(llmUsageTotal), llmUsageSeries, 'LLM利用件数（window集計）'),
    llm_avg_per_pro_user: simpleMetric(
      proActiveCount > 0 ? String(llmAvgPerProSeries[llmAvgPerProSeries.length - 1] || 0) : '0',
      llmAvgPerProSeries,
      'Proユーザーあたり平均LLM利用件数'
    ),
    llm_block_rate: simpleMetric(
      formatPercent(llmBlockRateSeries[llmBlockRateSeries.length - 1] || 0),
      llmBlockRateSeries,
      'LLMブロック率'
    ),
    journey_retention_d30: hasJourneyKpi
      ? simpleMetric(formatPercent(journeyRetentionD30Percent), journeyRetentionD30Series, 'Journey D30継続率')
      : notAvailable('journey_kpi_dailyが未設定のため取得できません'),
    journey_next_action_execution_rate: hasJourneyKpi
      ? simpleMetric(formatPercent(journeyNextActionExecutionPercent), journeyNextActionExecutionSeries, 'Journey NextAction実行率')
      : notAvailable('journey_kpi_dailyが未設定のため取得できません'),
    journey_pro_conversion_rate: hasJourneyKpi
      ? simpleMetric(formatPercent(journeyProConversionPercent), journeyProConversionSeries, 'Journey Pro転換率')
      : notAvailable('journey_kpi_dailyが未設定のため取得できません'),
    journey_task_completion_rate: hasJourneyKpi
      ? simpleMetric(formatPercent(journeyTaskCompletionPercent), journeyTaskCompletionSeries, 'Journey タスク完了率')
      : notAvailable('journey_kpi_dailyが未設定のため取得できません'),
    journey_dependency_block_rate: hasJourneyKpi
      ? simpleMetric(formatPercent(journeyDependencyBlockPercent), journeyDependencyBlockSeries, 'Journey 依存ブロック率')
      : notAvailable('journey_kpi_dailyが未設定のため取得できません'),
    journey_churn_blocked_ratio: hasJourneyKpi
      ? simpleMetric(formatPercent(journeyChurnBlockedPercent), journeyChurnBlockedSeries, 'Journey Churn(ブロック起因)比率')
      : notAvailable('journey_kpi_dailyが未設定のため取得できません'),
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
    engagement: notAvailable(message),
    notifications: notAvailable(message),
    reaction: notAvailable(message),
    faqUsage: notAvailable(message),
    stepStates: notAvailable(message),
    churnRate: notAvailable(message),
    ctrTrend: notAvailable(message),
    pro_active_count: notAvailable(message),
    total_users: notAvailable(message),
    pro_ratio: notAvailable(message),
    llm_daily_usage_count: notAvailable(message),
    llm_avg_per_pro_user: notAvailable(message),
    llm_block_rate: notAvailable(message),
    journey_retention_d30: notAvailable(message),
    journey_next_action_execution_rate: notAvailable(message),
    journey_pro_conversion_rate: notAvailable(message),
    journey_task_completion_rate: notAvailable(message),
    journey_dependency_block_rate: notAvailable(message),
    journey_churn_blocked_ratio: notAvailable(message),
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
  let fallbackOnEmpty;
  try {
    fallbackMode = parseFallbackMode(req);
    fallbackOnEmpty = parseFallbackOnEmpty(req);
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
          fallbackUsed: false,
          fallbackBlocked: false,
          fallbackSources: [],
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
          note: 'NOT AVAILABLE',
          fallbackUsed: false,
          fallbackBlocked: true,
          fallbackSources: [],
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
        note: 'NOT AVAILABLE',
        fallbackUsed: false,
        fallbackBlocked: true,
        fallbackSources: [],
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
        note: 'NOT AVAILABLE',
        fallbackUsed: false,
        fallbackBlocked: true,
        fallbackSources: [],
        kpis
      }));
      return;
    }

    const computed = await computeDashboardKpis(windowMonths, scanLimit, { fallbackMode, fallbackOnEmpty });
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
    if (computed.fallbackUsed === true || computed.fallbackBlocked === true) {
      try {
        await appendAuditLog({
          actor,
          action: 'read_path.fallback.dashboard_kpi',
          entityType: 'read_path',
          entityId: 'dashboard_kpi',
          traceId: traceId || undefined,
          requestId: requestId || undefined,
          payloadSummary: {
            fallbackUsed: computed.fallbackUsed === true,
            fallbackBlocked: computed.fallbackBlocked === true,
            fallbackSources: Array.isArray(computed.fallbackSources) ? computed.fallbackSources : [],
            snapshotMode,
            fallbackMode,
            fallbackOnEmpty,
            windowMonths,
            scanLimit
          }
        });
      } catch (_auditErr) {
        // best effort only
      }
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
      fallbackOnEmpty,
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
