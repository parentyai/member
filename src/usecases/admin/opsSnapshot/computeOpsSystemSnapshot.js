'use strict';

const fs = require('fs');
const path = require('path');

const analyticsReadRepo = require('../../../repos/firestore/analyticsReadRepo');
const sendRetryQueueRepo = require('../../../repos/firestore/sendRetryQueueRepo');
const cityPacksRepo = require('../../../repos/firestore/cityPacksRepo');
const cityPackRequestsRepo = require('../../../repos/firestore/cityPackRequestsRepo');
const sourceRefsRepo = require('../../../repos/firestore/sourceRefsRepo');
const sourceAuditRunsRepo = require('../../../repos/firestore/sourceAuditRunsRepo');
const emergencyProvidersRepo = require('../../../repos/firestore/emergencyProvidersRepo');
const emergencyBulletinsRepo = require('../../../repos/firestore/emergencyBulletinsRepo');
const emergencyDiffsRepo = require('../../../repos/firestore/emergencyDiffsRepo');
const journeyKpiDailyRepo = require('../../../repos/firestore/journeyKpiDailyRepo');
const journeyTodoStatsRepo = require('../../../repos/firestore/journeyTodoStatsRepo');
const userSubscriptionsRepo = require('../../../repos/firestore/userSubscriptionsRepo');
const llmUsageLogsRepo = require('../../../repos/firestore/llmUsageLogsRepo');
const llmPolicyChangeLogsRepo = require('../../../repos/firestore/llmPolicyChangeLogsRepo');
const richMenuRolloutRunsRepo = require('../../../repos/firestore/richMenuRolloutRunsRepo');
const linkRegistryRepo = require('../../../repos/firestore/linkRegistryRepo');
const faqAnswerLogsRepo = require('../../../repos/firestore/faqAnswerLogsRepo');
const faqArticlesRepo = require('../../../repos/firestore/faqArticlesRepo');
const systemFlagsRepo = require('../../../repos/firestore/systemFlagsRepo');
const opsConfigRepo = require('../../../repos/firestore/opsConfigRepo');
const auditLogsRepo = require('../../../repos/firestore/auditLogsRepo');
const { computeOpsFeatureCatalogStatus } = require('./computeOpsFeatureCatalogStatus');
const {
  STATUS_OK,
  STATUS_WARN,
  STATUS_ALERT,
  STATUS_UNKNOWN,
  REASON_CODES,
  mergeStatus,
  thresholdStatus,
  evaluateRateStatus,
  evaluateAgeStatus,
  buildStatusEnvelope,
  resolveGlobalStatus,
  dedupeReasonCodes,
  toMillis,
  toIsoString
} = require('./statusRules');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..', '..');
const LOAD_RISK_PATH = path.join(ROOT_DIR, 'docs', 'REPO_AUDIT_INPUTS', 'load_risk.json');
const MISSING_INDEX_SURFACE_PATH = path.join(ROOT_DIR, 'docs', 'REPO_AUDIT_INPUTS', 'missing_index_surface.json');
const RETENTION_RISK_PATH = path.join(ROOT_DIR, 'docs', 'REPO_AUDIT_INPUTS', 'retention_risk.json');
const STRUCTURE_RISK_PATH = path.join(ROOT_DIR, 'docs', 'REPO_AUDIT_INPUTS', 'structure_risk.json');

const SECTION_KEYS = Object.freeze([
  'notifications',
  'emergency',
  'cityPack',
  'journeyTodo',
  'subscription',
  'llm',
  'safety',
  'systemHealth'
]);

function normalizeScanLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 2000;
  return Math.max(100, Math.min(3000, Math.floor(num)));
}

function subtractHours(nowMs, hours) {
  return new Date(nowMs - (hours * 60 * 60 * 1000));
}

function subtractDays(nowMs, days) {
  return new Date(nowMs - (days * 24 * 60 * 60 * 1000));
}

function startOfUtcDay(nowMs) {
  const now = new Date(nowMs);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function rowData(row) {
  if (!row || typeof row !== 'object') return {};
  if (row.data && typeof row.data === 'object') return row.data;
  return row;
}

function latestTimestamp(values) {
  const list = Array.isArray(values) ? values : [];
  let latestMs = null;
  list.forEach((value) => {
    const ms = toMillis(value);
    if (!Number.isFinite(ms)) return;
    if (!Number.isFinite(latestMs) || ms > latestMs) latestMs = ms;
  });
  return Number.isFinite(latestMs) ? new Date(latestMs).toISOString() : null;
}

function latestFromRows(rows, fieldNames) {
  const list = Array.isArray(rows) ? rows : [];
  const fields = Array.isArray(fieldNames) ? fieldNames : [];
  const values = [];
  list.forEach((row) => {
    const data = rowData(row);
    fields.forEach((fieldName) => {
      if (!fieldName) return;
      values.push(data[fieldName]);
    });
  });
  return latestTimestamp(values);
}

function safeDiv(numerator, denominator) {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return num / den;
}

async function safeQuery(label, fn) {
  try {
    const value = await fn();
    return { ok: true, label, value };
  } catch (err) {
    return {
      ok: false,
      label,
      error: err && err.message ? String(err.message) : 'error',
      value: null
    };
  }
}

function readJsonFileOrNull(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function evaluateNotificationDeliveryState(delivery) {
  const data = rowData(delivery);
  const state = typeof data.state === 'string' ? data.state.trim().toUpperCase() : '';
  const delivered = data.delivered === true;
  const failed = data.delivered === false
    || state.includes('FAIL')
    || state.includes('ERROR')
    || (typeof data.lastError === 'string' && data.lastError.trim().length > 0);
  const pending = state === 'PENDING' || state === 'QUEUED' || state === 'RETRY';
  const clicked = Boolean(toMillis(data.clickAt));

  return {
    success: delivered && !failed,
    failed,
    pending,
    clicked,
    sentAt: data.sentAt || data.createdAt || null,
    notificationId: typeof data.notificationId === 'string' ? data.notificationId.trim() : null
  };
}

function resolveNotificationType(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!normalized) return 'UNKNOWN';
  if (normalized === 'ANNOUNCEMENT') return 'ANNOUNCEMENT';
  if (normalized === 'GENERAL') return 'GENERAL';
  if (normalized === 'STEP') return 'STEP';
  if (normalized === 'VENDOR') return 'VENDOR';
  return normalized;
}

function buildNotificationTypeMetrics(deliveryRows, notificationRows) {
  const notifications = toArray(notificationRows).map((row) => rowData(row));
  const deliveries = toArray(deliveryRows);
  const byId = new Map();

  notifications.forEach((row) => {
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : null;
    if (!id) return;
    byId.set(id, row);
  });

  const byType = {
    ANNOUNCEMENT: { successCount: 0, failedCount: 0, pendingCount: 0, deliveryCount: 0, lastUpdatedAt: null },
    GENERAL: { successCount: 0, failedCount: 0, pendingCount: 0, deliveryCount: 0, lastUpdatedAt: null },
    STEP: { successCount: 0, failedCount: 0, pendingCount: 0, deliveryCount: 0, lastUpdatedAt: null },
    VENDOR: { successCount: 0, failedCount: 0, pendingCount: 0, deliveryCount: 0, lastUpdatedAt: null }
  };

  deliveries.forEach((delivery) => {
    const analyzed = evaluateNotificationDeliveryState(delivery);
    const notification = analyzed.notificationId ? byId.get(analyzed.notificationId) : null;
    const type = resolveNotificationType(notification && notification.notificationType ? notification.notificationType : notification && notification.type);
    if (!Object.prototype.hasOwnProperty.call(byType, type)) return;

    const slot = byType[type];
    slot.deliveryCount += 1;
    if (analyzed.success) slot.successCount += 1;
    if (analyzed.failed) slot.failedCount += 1;
    if (analyzed.pending) slot.pendingCount += 1;
    slot.lastUpdatedAt = latestTimestamp([slot.lastUpdatedAt, analyzed.sentAt, notification && notification.updatedAt, notification && notification.sentAt]);
  });

  Object.keys(byType).forEach((type) => {
    const slot = byType[type];
    const rate = safeDiv(slot.failedCount, Math.max(slot.successCount + slot.failedCount, 1));
    slot.failedRate = Number.isFinite(rate) ? rate : null;
  });

  return byType;
}

function buildSectionEnvelope(input) {
  const payload = input && typeof input === 'object' ? input : {};
  return Object.assign(
    buildStatusEnvelope({
      nowIso: payload.nowIso,
      updatedAt: payload.updatedAt,
      lastUpdatedAt: payload.lastUpdatedAt,
      status: payload.status,
      reasonCodes: payload.reasonCodes,
      computedWindow: payload.computedWindow
    }),
    {
      metrics: payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {}
    }
  );
}

function parseRetentionSummary(row) {
  const item = row && typeof row === 'object' ? row : {};
  const action = typeof item.action === 'string' ? item.action : null;
  const createdAt = toIsoString(item.createdAt);
  const summary = item.payloadSummary && typeof item.payloadSummary === 'object' ? item.payloadSummary : {};
  const deleted = summary.summary && Number.isFinite(Number(summary.summary.deletedCount))
    ? Number(summary.summary.deletedCount)
    : 0;
  return { action, createdAt, deleted };
}

function toSeconds(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 1000);
}

function resolveProductReadinessScore(systemHealthMetrics) {
  const metrics = systemHealthMetrics && typeof systemHealthMetrics === 'object' ? systemHealthMetrics : {};
  const hardFail = Number(metrics.missingIndexSurfaceCount || 0) > 0
    || Number(metrics.undefinedRetentionCount || 0) > 0
    || Number(metrics.fallbackSurfaceCount || 0) > 0;
  if (hardFail) return 'NO_GO';
  if (Number(metrics.namingDriftScenarioCount || 0) > 0) return 'WARN';
  return 'GO';
}

function evaluateSystemHealthStatus(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  let status = STATUS_OK;
  const reasons = [];

  if (Number(source.missingIndexSurfaceCount || 0) > 0) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.INDEX_CONTRACT_RISK, REASON_CODES.THRESHOLD_ALERT);
  }
  if (Number(source.undefinedRetentionCount || 0) > 0) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  if (Number(source.fallbackSurfaceCount || 0) > 0 || Number(source.hotspotsCount || 0) > 0) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  if (Number(source.namingDriftScenarioCount || 0) > 0) {
    status = mergeStatus(status, STATUS_WARN);
    reasons.push(REASON_CODES.DRIFT_RISK, REASON_CODES.AUTH_INTERPRETATION_NOISE, REASON_CODES.THRESHOLD_WARN);
  }

  const productReadiness = resolveProductReadinessScore(source);
  if (productReadiness === 'NO_GO') {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.PRODUCT_READINESS_NO_GO);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    productReadiness
  };
}

function buildComputedWindow(nowMs, scanLimit) {
  const nowIso = new Date(nowMs).toISOString();
  return {
    fromAt: subtractHours(nowMs, 24).toISOString(),
    toAt: nowIso,
    mode: 'bounded',
    scanLimit,
    cadenceMinutes: 5,
    windows: {
      highFrequencyHours: 24,
      stableDays: 7,
      policyDays: 30
    }
  };
}

async function computeOpsSystemSnapshot(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const scanLimit = normalizeScanLimit(payload.scanLimit);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const computedWindow = buildComputedWindow(nowMs, scanLimit);
  const dayFrom = subtractHours(nowMs, 24);
  const weekFrom = subtractDays(nowMs, 7);
  const policyFrom = subtractDays(nowMs, 30);
  const todayFrom = startOfUtcDay(nowMs);

  const queryDiagnostics = [];
  const sourceFailures = [];
  const truncationReasons = [];

  const results = await Promise.all([
    safeQuery('deliveries24h', () => analyticsReadRepo.listNotificationDeliveriesBySentAtRange({ fromAt: dayFrom, toAt: new Date(nowMs), limit: scanLimit })),
    safeQuery('notifications24h', () => analyticsReadRepo.listNotificationsByCreatedAtRange({ fromAt: dayFrom, toAt: new Date(nowMs), limit: scanLimit })),
    safeQuery('events24h', () => analyticsReadRepo.listEventsByCreatedAtRange({ fromAt: dayFrom, toAt: new Date(nowMs), limit: scanLimit })),
    safeQuery('usersRecent', () => analyticsReadRepo.listUsersByCreatedAtRange({ limit: Math.min(scanLimit, 2000) })),
    safeQuery('retryPending', () => sendRetryQueueRepo.listPending(Math.min(scanLimit, 500))),
    safeQuery('cityPacks', () => cityPacksRepo.listCityPacks({ limit: Math.min(scanLimit, 300) })),
    safeQuery('cityPackRequests', () => cityPackRequestsRepo.listRequests({ limit: Math.min(scanLimit, 300) })),
    safeQuery('sourceRefsAudit', () => sourceRefsRepo.listSourceRefsForAudit({ limit: Math.min(scanLimit, 500), horizonDays: 14 })),
    safeQuery('sourceAuditRuns', () => sourceAuditRunsRepo.listRuns(100)),
    safeQuery('emergencyProviders', () => emergencyProvidersRepo.listProviders(100)),
    safeQuery('emergencyBulletins', () => emergencyBulletinsRepo.listBulletins({ limit: 300 })),
    safeQuery('journeyKpiDaily', () => journeyKpiDailyRepo.getLatestJourneyKpiDaily()),
    safeQuery('llmUsage24h', () => llmUsageLogsRepo.listLlmUsageLogsByCreatedAtRange({ fromAt: dayFrom, toAt: new Date(nowMs), limit: Math.min(scanLimit * 2, 5000) })),
    safeQuery('llmPolicyChanges', () => llmPolicyChangeLogsRepo.listLlmPolicyChangeLogs(100)),
    safeQuery('richMenuRuns', () => richMenuRolloutRunsRepo.listRichMenuRolloutRuns(100)),
    safeQuery('linkRegistry', () => linkRegistryRepo.listLinks({ limit: Math.min(scanLimit, 500) })),
    safeQuery('faqAnswerLogs', () => faqAnswerLogsRepo.listFaqAnswerLogs({ sinceAt: dayFrom, limit: Math.min(scanLimit, 500) })),
    safeQuery('faqArticles', () => faqArticlesRepo.listArticles({ limit: 500 })),
    safeQuery('killSwitch', () => systemFlagsRepo.getKillSwitch()),
    safeQuery('llmPolicy', () => opsConfigRepo.getLlmPolicy()),
    safeQuery('retentionApplyLogs', () => auditLogsRepo.listAuditLogs({ action: 'retention.apply.execute', limit: 20 })),
    safeQuery('retentionBlockedLogs', () => auditLogsRepo.listAuditLogs({ action: 'retention.apply.blocked', limit: 20 })),
    safeQuery('retentionDryRunLogs', () => auditLogsRepo.listAuditLogs({ action: 'retention.dry_run.execute', limit: 20 }))
  ]);

  const byLabel = new Map();
  results.forEach((row) => {
    byLabel.set(row.label, row);
    if (!row.ok) {
      sourceFailures.push(`${row.label}:${row.error}`);
      queryDiagnostics.push({ label: row.label, ok: false, error: row.error, count: 0 });
      return;
    }
    const value = row.value;
    const count = Array.isArray(value) ? value.length : (value ? 1 : 0);
    queryDiagnostics.push({ label: row.label, ok: true, count });
    if (Array.isArray(value) && count >= scanLimit && (row.label === 'deliveries24h' || row.label === 'notifications24h' || row.label === 'events24h')) {
      truncationReasons.push(REASON_CODES.COUNT_TRUNCATED_LIMIT);
    }
  });

  const deliveries = toArray(byLabel.get('deliveries24h') && byLabel.get('deliveries24h').value);
  const notifications = toArray(byLabel.get('notifications24h') && byLabel.get('notifications24h').value);
  const events = toArray(byLabel.get('events24h') && byLabel.get('events24h').value);
  const usersRecent = toArray(byLabel.get('usersRecent') && byLabel.get('usersRecent').value);
  const retryPending = toArray(byLabel.get('retryPending') && byLabel.get('retryPending').value);
  const cityPacks = toArray(byLabel.get('cityPacks') && byLabel.get('cityPacks').value);
  const cityPackRequests = toArray(byLabel.get('cityPackRequests') && byLabel.get('cityPackRequests').value);
  const sourceRefsAudit = toArray(byLabel.get('sourceRefsAudit') && byLabel.get('sourceRefsAudit').value);
  const sourceAuditRuns = toArray(byLabel.get('sourceAuditRuns') && byLabel.get('sourceAuditRuns').value);
  const emergencyProviders = toArray(byLabel.get('emergencyProviders') && byLabel.get('emergencyProviders').value);
  const emergencyBulletins = toArray(byLabel.get('emergencyBulletins') && byLabel.get('emergencyBulletins').value);
  const llmUsage = toArray(byLabel.get('llmUsage24h') && byLabel.get('llmUsage24h').value);
  const llmPolicyChanges = toArray(byLabel.get('llmPolicyChanges') && byLabel.get('llmPolicyChanges').value);
  const richMenuRuns = toArray(byLabel.get('richMenuRuns') && byLabel.get('richMenuRuns').value);
  const linkRows = toArray(byLabel.get('linkRegistry') && byLabel.get('linkRegistry').value);
  const faqAnswerLogs = toArray(byLabel.get('faqAnswerLogs') && byLabel.get('faqAnswerLogs').value);
  const faqArticles = toArray(byLabel.get('faqArticles') && byLabel.get('faqArticles').value);

  const journeyKpiDaily = byLabel.get('journeyKpiDaily') && byLabel.get('journeyKpiDaily').value
    ? byLabel.get('journeyKpiDaily').value
    : null;

  const killSwitch = typeof (byLabel.get('killSwitch') && byLabel.get('killSwitch').value) === 'boolean'
    ? byLabel.get('killSwitch').value
    : null;
  const llmPolicy = byLabel.get('llmPolicy') && byLabel.get('llmPolicy').value
    ? byLabel.get('llmPolicy').value
    : null;

  const retentionLogs = []
    .concat(toArray(byLabel.get('retentionApplyLogs') && byLabel.get('retentionApplyLogs').value))
    .concat(toArray(byLabel.get('retentionBlockedLogs') && byLabel.get('retentionBlockedLogs').value))
    .concat(toArray(byLabel.get('retentionDryRunLogs') && byLabel.get('retentionDryRunLogs').value))
    .map(parseRetentionSummary)
    .filter((row) => row.createdAt)
    .sort((a, b) => (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0));

  const lineUserIds = usersRecent
    .map((row) => {
      const id = row && typeof row.id === 'string' ? row.id.trim() : '';
      return id;
    })
    .filter(Boolean)
    .slice(0, Math.min(scanLimit, 1000));

  const [subscriptionsRes, todoStatsRes, emergencyDiffsRes] = await Promise.all([
    safeQuery('subscriptionsByUsers', () => userSubscriptionsRepo.listUserSubscriptionsByLineUserIds({ lineUserIds })),
    safeQuery('todoStatsByUsers', () => journeyTodoStatsRepo.listUserJourneyTodoStatsByLineUserIds({ lineUserIds })),
    safeQuery('emergencyDiffsByProvider', async () => {
      const rows = [];
      for (const provider of emergencyProviders) {
        const key = provider && typeof provider.providerKey === 'string' ? provider.providerKey : null;
        if (!key) continue;
        const diffs = await emergencyDiffsRepo.listDiffsByProvider(key, 200);
        rows.push({ providerKey: key, count: Array.isArray(diffs) ? diffs.length : 0, latestAt: latestFromRows(diffs, ['updatedAt', 'createdAt']) });
      }
      return rows;
    })
  ]);

  const subscriptions = toArray(subscriptionsRes.value);
  const todoStats = toArray(todoStatsRes.value);
  const emergencyDiffs = toArray(emergencyDiffsRes.value);

  if (!subscriptionsRes.ok) sourceFailures.push(`subscriptionsByUsers:${subscriptionsRes.error}`);
  if (!todoStatsRes.ok) sourceFailures.push(`todoStatsByUsers:${todoStatsRes.error}`);
  if (!emergencyDiffsRes.ok) sourceFailures.push(`emergencyDiffsByProvider:${emergencyDiffsRes.error}`);

  const loadRisk = readJsonFileOrNull(LOAD_RISK_PATH) || {};
  const missingIndexSurface = readJsonFileOrNull(MISSING_INDEX_SURFACE_PATH) || {};
  const retentionRisk = readJsonFileOrNull(RETENTION_RISK_PATH) || {};
  const structureRisk = readJsonFileOrNull(STRUCTURE_RISK_PATH) || {};

  const deliveryStats = deliveries.map((delivery) => evaluateNotificationDeliveryState(delivery));
  const successCount = deliveryStats.filter((item) => item.success).length;
  const failedCount = deliveryStats.filter((item) => item.failed).length;
  const pendingInDeliveries = deliveryStats.filter((item) => item.pending).length;
  const clickCount = deliveryStats.filter((item) => item.clicked).length;
  const todaySentCount = deliveryStats.filter((item) => {
    const sentMs = toMillis(item.sentAt);
    return Number.isFinite(sentMs) && sentMs >= toMillis(todayFrom);
  }).length;

  const notificationDraftCount = notifications.filter((row) => {
    const data = rowData(row);
    const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
    return status === 'draft' || status === 'approved';
  }).length;

  const notificationFailedRate = safeDiv(failedCount, Math.max(successCount + failedCount, 1));
  const notificationReasons = [];
  const notificationRateState = evaluateRateStatus(notificationFailedRate, 1, 5);
  let notificationStatus = notificationRateState.status;
  notificationReasons.push(...notificationRateState.reasonCodes);
  if (failedCount >= 20) {
    notificationStatus = STATUS_ALERT;
    notificationReasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  if (failedCount > 0 && failedCount < 20) {
    notificationStatus = mergeStatus(notificationStatus, STATUS_WARN);
    notificationReasons.push(REASON_CODES.THRESHOLD_WARN);
  }
  const notificationPendingCount = retryPending.length + pendingInDeliveries;
  if (notificationPendingCount > 0) {
    notificationStatus = mergeStatus(notificationStatus, STATUS_WARN);
    notificationReasons.push(REASON_CODES.THRESHOLD_WARN);
  }
  if (deliveries.length === 0 && notifications.length === 0) {
    notificationStatus = STATUS_UNKNOWN;
    notificationReasons.push(REASON_CODES.DATA_MISSING);
  }
  if (!byLabel.get('deliveries24h') || byLabel.get('deliveries24h').ok === false) {
    notificationStatus = STATUS_UNKNOWN;
    notificationReasons.push(REASON_CODES.SOURCE_QUERY_FAILED);
  }

  const notificationTypeMetrics = buildNotificationTypeMetrics(deliveries, notifications);
  const notificationsLastUpdatedAt = latestTimestamp([
    latestFromRows(deliveries, ['sentAt', 'deliveredAt', 'updatedAt', 'createdAt']),
    latestFromRows(notifications, ['updatedAt', 'sentAt', 'createdAt']),
    latestFromRows(retryPending, ['updatedAt', 'createdAt'])
  ]) || nowIso;

  const notificationsSection = buildSectionEnvelope({
    nowIso,
    updatedAt: nowIso,
    lastUpdatedAt: notificationsLastUpdatedAt,
    status: notificationStatus,
    reasonCodes: dedupeReasonCodes(notificationReasons.concat(truncationReasons)),
    computedWindow,
    metrics: {
      successCount,
      failedCount,
      pendingCount: notificationPendingCount,
      todaySentCount,
      approvalPendingCount: notificationDraftCount,
      failedRate: Number.isFinite(notificationFailedRate) ? notificationFailedRate : null
    }
  });

  const emergencyLastSyncAt = latestTimestamp(emergencyProviders.map((provider) => {
    return latestTimestamp([provider && provider.lastSuccessAt, provider && provider.lastRunAt]);
  })) || null;
  const emergencyLastSyncAgeSeconds = Number.isFinite(toMillis(emergencyLastSyncAt))
    ? toSeconds(nowMs - toMillis(emergencyLastSyncAt))
    : null;
  const emergencyErrorCount = emergencyProviders.reduce((sum, provider) => {
    const hasError = provider && typeof provider.lastError === 'string' && provider.lastError.trim().length > 0;
    return sum + (hasError ? 1 : 0);
  }, 0);
  const emergencyUnapprovedCount = emergencyBulletins.filter((bulletin) => {
    const status = typeof bulletin.status === 'string' ? bulletin.status.trim().toLowerCase() : '';
    return status === 'draft';
  }).length;
  const emergencyDiffCount = emergencyDiffs.reduce((sum, row) => {
    const data = rowData(row);
    const count = Number(data.count);
    return sum + (Number.isFinite(count) ? count : 0);
  }, 0);

  const emergencyAgeState = evaluateAgeStatus(emergencyLastSyncAgeSeconds, 30 * 60, 90 * 60);
  let emergencyStatus = emergencyAgeState.status;
  const emergencyReasons = emergencyAgeState.reasonCodes.slice();
  if (emergencyErrorCount > 0) {
    emergencyStatus = STATUS_ALERT;
    emergencyReasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  if (emergencyUnapprovedCount > 0) {
    emergencyStatus = mergeStatus(emergencyStatus, STATUS_WARN);
    emergencyReasons.push(REASON_CODES.THRESHOLD_WARN);
  }
  if (emergencyProviders.length === 0) {
    emergencyStatus = STATUS_UNKNOWN;
    emergencyReasons.push(REASON_CODES.DATA_MISSING);
  }
  if (!emergencyDiffsRes.ok || !byLabel.get('emergencyProviders') || byLabel.get('emergencyProviders').ok === false) {
    emergencyStatus = mergeStatus(emergencyStatus, STATUS_UNKNOWN);
    emergencyReasons.push(REASON_CODES.SOURCE_QUERY_FAILED);
  }

  const emergencyLastUpdatedAt = latestTimestamp([
    emergencyLastSyncAt,
    latestFromRows(emergencyBulletins, ['updatedAt', 'approvedAt', 'sentAt', 'createdAt']),
    latestTimestamp(emergencyDiffs.map((row) => row && row.latestAt))
  ]) || nowIso;

  const emergencySection = buildSectionEnvelope({
    nowIso,
    updatedAt: nowIso,
    lastUpdatedAt: emergencyLastUpdatedAt,
    status: emergencyStatus,
    reasonCodes: dedupeReasonCodes(emergencyReasons),
    computedWindow,
    metrics: {
      lastSyncAt: emergencyLastSyncAt,
      lastSyncAgeSeconds: emergencyLastSyncAgeSeconds,
      diffCount: emergencyDiffCount,
      unapprovedCount: emergencyUnapprovedCount,
      errorCount: emergencyErrorCount
    }
  });

  const cityPackPendingCount = cityPackRequests.filter((request) => {
    const status = typeof request.status === 'string' ? request.status.trim().toLowerCase() : '';
    return status === 'queued' || status === 'collecting' || status === 'drafted' || status === 'needs_review';
  }).length;
  const sourceAuditBacklog = sourceRefsAudit.length;
  const oldestAuditMs = sourceRefsAudit.reduce((minMs, row) => {
    const updatedMs = toMillis(row && row.updatedAt);
    if (!Number.isFinite(updatedMs)) return minMs;
    if (!Number.isFinite(minMs) || updatedMs < minMs) return updatedMs;
    return minMs;
  }, null);
  const inboxLagHours = Number.isFinite(oldestAuditMs) ? (nowMs - oldestAuditMs) / (60 * 60 * 1000) : null;

  let cityPackStatus = STATUS_OK;
  const cityPackReasons = [];
  if (cityPackPendingCount > 20 || (Number.isFinite(inboxLagHours) && inboxLagHours > 72)) {
    cityPackStatus = STATUS_ALERT;
    cityPackReasons.push(REASON_CODES.THRESHOLD_ALERT);
  } else if (cityPackPendingCount > 0 || (Number.isFinite(inboxLagHours) && inboxLagHours > 24)) {
    cityPackStatus = STATUS_WARN;
    cityPackReasons.push(REASON_CODES.THRESHOLD_WARN);
  }
  if (cityPacks.length === 0 && cityPackRequests.length === 0) {
    cityPackStatus = STATUS_UNKNOWN;
    cityPackReasons.push(REASON_CODES.DATA_MISSING);
  }
  if ((byLabel.get('cityPacks') && byLabel.get('cityPacks').ok === false)
    || (byLabel.get('cityPackRequests') && byLabel.get('cityPackRequests').ok === false)
    || (byLabel.get('sourceRefsAudit') && byLabel.get('sourceRefsAudit').ok === false)) {
    cityPackStatus = STATUS_UNKNOWN;
    cityPackReasons.push(REASON_CODES.SOURCE_QUERY_FAILED);
  }

  const cityPackLastUpdatedAt = latestTimestamp([
    latestFromRows(cityPacks, ['updatedAt', 'createdAt']),
    latestFromRows(cityPackRequests, ['updatedAt', 'requestedAt', 'lastReviewAt', 'createdAt']),
    latestFromRows(sourceAuditRuns, ['startedAt', 'finishedAt', 'updatedAt'])
  ]) || nowIso;

  const cityPackSection = buildSectionEnvelope({
    nowIso,
    updatedAt: nowIso,
    lastUpdatedAt: cityPackLastUpdatedAt,
    status: cityPackStatus,
    reasonCodes: dedupeReasonCodes(cityPackReasons),
    computedWindow,
    metrics: {
      updatedAt: cityPackLastUpdatedAt,
      pendingApprovalCount: cityPackPendingCount,
      reviewInboxBacklog: sourceAuditBacklog,
      inboxLagHours: Number.isFinite(inboxLagHours) ? Math.round(inboxLagHours * 10) / 10 : null
    }
  });

  const todoOverdueCount = todoStats.reduce((sum, row) => {
    const data = rowData(row);
    const count = Number(data.overdueCount);
    return sum + (Number.isFinite(count) ? count : 0);
  }, 0);
  const todoOpenCount = todoStats.reduce((sum, row) => {
    const data = rowData(row);
    const count = Number(data.openCount);
    return sum + (Number.isFinite(count) ? count : 0);
  }, 0);
  const journeyTotalUsers = Number(journeyKpiDaily && typeof journeyKpiDaily === 'object' ? journeyKpiDaily.totalUsers : null);
  const activeUsers = Number.isFinite(journeyTotalUsers)
    ? journeyTotalUsers
    : lineUserIds.length;
  const journeyDependencyBlockRate = Number(
    journeyKpiDaily && typeof journeyKpiDaily === 'object'
      ? journeyKpiDaily.dependencyBlockRate
      : null
  );
  const stalledRate = Number.isFinite(journeyDependencyBlockRate)
    ? journeyDependencyBlockRate
    : null;
  const stalledUsers = Number.isFinite(stalledRate) && activeUsers > 0
    ? Math.round(activeUsers * stalledRate)
    : null;

  const stalledRateStatus = evaluateRateStatus(stalledRate, 20, 40);
  let journeyStatus = stalledRateStatus.status;
  const journeyReasons = stalledRateStatus.reasonCodes.slice();
  if (todoOverdueCount > 0) {
    journeyStatus = mergeStatus(journeyStatus, STATUS_WARN);
    journeyReasons.push(REASON_CODES.THRESHOLD_WARN);
  }
  if (todoOverdueCount > 300) {
    journeyStatus = STATUS_ALERT;
    journeyReasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  if (!journeyKpiDaily && todoStats.length === 0) {
    journeyStatus = STATUS_UNKNOWN;
    journeyReasons.push(REASON_CODES.DATA_MISSING);
  }

  const journeyLastUpdatedAt = latestTimestamp([
    journeyKpiDaily && journeyKpiDaily.generatedAt,
    journeyKpiDaily && journeyKpiDaily.updatedAt,
    latestFromRows(todoStats, ['updatedAt', 'nextDueAt', 'lastReminderAt'])
  ]) || nowIso;

  const journeySection = buildSectionEnvelope({
    nowIso,
    updatedAt: nowIso,
    lastUpdatedAt: journeyLastUpdatedAt,
    status: journeyStatus,
    reasonCodes: dedupeReasonCodes(journeyReasons),
    computedWindow,
    metrics: {
      activeUsers,
      stalledUsers,
      stalledRate,
      unprocessedCount: todoOpenCount,
      overdueCount: todoOverdueCount
    }
  });

  const subscriptionActiveCount = subscriptions.filter((row) => {
    const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
    return status === 'active' || status === 'trialing';
  }).length;
  const subscriptionFailedCount = subscriptions.filter((row) => {
    const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
    return status === 'past_due' || status === 'unpaid' || status === 'incomplete';
  }).length;
  const subscriptionExpiredCount = subscriptions.filter((row) => {
    const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
    return status === 'canceled' || status === 'incomplete_expired';
  }).length;

  const subscriptionTotal = subscriptions.length;
  const failedOrPastDueRate = safeDiv(
    subscriptionFailedCount + subscriptionExpiredCount,
    Math.max(subscriptionTotal, 1)
  );
  const subscriptionRate = evaluateRateStatus(failedOrPastDueRate, 2, 5);

  let subscriptionStatus = subscriptionRate.status;
  const subscriptionReasons = subscriptionRate.reasonCodes.slice();
  if (subscriptionTotal === 0) {
    subscriptionStatus = STATUS_UNKNOWN;
    subscriptionReasons.push(REASON_CODES.DATA_MISSING);
  }
  if (lineUserIds.length >= Math.min(scanLimit, 1000)) {
    subscriptionReasons.push(REASON_CODES.COUNT_TRUNCATED_LIMIT);
  }

  const subscriptionLastUpdatedAt = latestTimestamp([
    latestFromRows(subscriptions, ['updatedAt', 'currentPeriodEnd', 'lastEventCreatedAt'])
  ]) || nowIso;

  const subscriptionSection = buildSectionEnvelope({
    nowIso,
    updatedAt: nowIso,
    lastUpdatedAt: subscriptionLastUpdatedAt,
    status: subscriptionStatus,
    reasonCodes: dedupeReasonCodes(subscriptionReasons),
    computedWindow,
    metrics: {
      activeCount: subscriptionActiveCount,
      failedCount: subscriptionFailedCount,
      expiredCount: subscriptionExpiredCount,
      failedOrPastDueRate
    }
  });

  const llmUsageCount = llmUsage.length;
  const llmFailedCount = llmUsage.filter((row) => {
    const decision = typeof row.decision === 'string' ? row.decision.trim().toLowerCase() : '';
    return decision === 'blocked'
      || decision === 'error'
      || decision === 'failed'
      || (typeof row.blockedReason === 'string' && row.blockedReason.trim().length > 0);
  }).length;
  const llmErrorRate = safeDiv(llmFailedCount, Math.max(llmUsageCount, 1));
  const llmRate = evaluateRateStatus(llmErrorRate, 2, 5);
  const lastPolicyChangeAt = latestFromRows(llmPolicyChanges, ['createdAt', 'updatedAt']);
  const policyChangeDetected = Number.isFinite(toMillis(lastPolicyChangeAt))
    && (nowMs - toMillis(lastPolicyChangeAt)) <= (24 * 60 * 60 * 1000);

  let llmStatus = llmRate.status;
  const llmReasons = llmRate.reasonCodes.slice();
  if (llmUsageCount === 0) {
    llmStatus = STATUS_UNKNOWN;
    llmReasons.push(REASON_CODES.DATA_MISSING);
  }
  if (policyChangeDetected) {
    llmReasons.push(REASON_CODES.POLICY_CHANGE_DETECTED);
  }
  if (!llmPolicy) {
    llmStatus = mergeStatus(llmStatus, STATUS_UNKNOWN);
    llmReasons.push(REASON_CODES.SOURCE_QUERY_FAILED);
  }

  const llmLastUpdatedAt = latestTimestamp([
    latestFromRows(llmUsage, ['createdAt']),
    lastPolicyChangeAt
  ]) || nowIso;

  const llmSection = buildSectionEnvelope({
    nowIso,
    updatedAt: nowIso,
    lastUpdatedAt: llmLastUpdatedAt,
    status: llmStatus,
    reasonCodes: dedupeReasonCodes(llmReasons),
    computedWindow,
    metrics: {
      usageCount: llmUsageCount,
      failedCount: llmFailedCount,
      errorRate: llmErrorRate,
      policyChangeAt: lastPolicyChangeAt,
      policyChangeDetected,
      policyEnabled: llmPolicy ? llmPolicy.enabled === true : null
    }
  });

  const latestRetention = retentionLogs.length > 0 ? retentionLogs[0] : null;
  const retentionLastRunAt = latestRetention && latestRetention.createdAt ? latestRetention.createdAt : null;
  const retentionAgeSeconds = Number.isFinite(toMillis(retentionLastRunAt))
    ? toSeconds(nowMs - toMillis(retentionLastRunAt))
    : null;
  const retentionFailed = latestRetention && latestRetention.action === 'retention.apply.blocked';

  const safetyAge = evaluateAgeStatus(retentionAgeSeconds, 24 * 60 * 60, 48 * 60 * 60);
  let safetyStatus = safetyAge.status;
  const safetyReasons = safetyAge.reasonCodes.slice();
  if (killSwitch === true) {
    safetyStatus = STATUS_ALERT;
    safetyReasons.push(REASON_CODES.KILLSWITCH_ON);
  }
  if (retentionFailed) {
    safetyStatus = STATUS_ALERT;
    safetyReasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  if (killSwitch === null && !latestRetention) {
    safetyStatus = STATUS_UNKNOWN;
    safetyReasons.push(REASON_CODES.DATA_MISSING);
  }

  const safetyLastUpdatedAt = latestTimestamp([
    retentionLastRunAt,
    nowIso
  ]) || nowIso;

  const safetySection = buildSectionEnvelope({
    nowIso,
    updatedAt: nowIso,
    lastUpdatedAt: safetyLastUpdatedAt,
    status: safetyStatus,
    reasonCodes: dedupeReasonCodes(safetyReasons),
    computedWindow,
    metrics: {
      killSwitch,
      retentionLastRunAt,
      retentionAgeSeconds,
      retentionFailed
    }
  });

  const systemHealthMetrics = {
    generatedAt: nowIso,
    fallbackSurfaceCount: Number.isFinite(Number(loadRisk.fallback_surface_count)) ? Number(loadRisk.fallback_surface_count) : 0,
    hotspotsCount: Number.isFinite(Number(loadRisk.hotspots_count)) ? Number(loadRisk.hotspots_count) : 0,
    missingIndexSurfaceCount: Number.isFinite(Number(missingIndexSurface.surface_count))
      ? Number(missingIndexSurface.surface_count)
      : (Array.isArray(missingIndexSurface.items) ? missingIndexSurface.items.length : 0),
    undefinedRetentionCount: Number.isFinite(Number(retentionRisk.undefined_retention_count))
      ? Number(retentionRisk.undefined_retention_count)
      : 0,
    namingDriftScenarioCount: Number.isFinite(Number(structureRisk.naming_drift_scenario_count))
      ? Number(structureRisk.naming_drift_scenario_count)
      : 0
  };

  const systemHealthEval = evaluateSystemHealthStatus(systemHealthMetrics);
  const systemHealthSection = buildSectionEnvelope({
    nowIso,
    updatedAt: nowIso,
    lastUpdatedAt: latestTimestamp([
      loadRisk.generatedAt,
      missingIndexSurface.generatedAt,
      retentionRisk.generatedAt,
      structureRisk.generatedAt
    ]) || nowIso,
    status: systemHealthEval.status,
    reasonCodes: systemHealthEval.reasonCodes,
    computedWindow,
    metrics: Object.assign({}, systemHealthMetrics, {
      indexContractStatus: systemHealthMetrics.missingIndexSurfaceCount > 0 ? 'RISK' : 'OK',
      driftStatus: systemHealthMetrics.namingDriftScenarioCount > 0 ? 'WARN' : 'OK',
      authInterpretationNoiseCount: systemHealthMetrics.namingDriftScenarioCount,
      productReadiness: systemHealthEval.productReadiness
    })
  });

  const sections = {
    notifications: notificationsSection,
    emergency: emergencySection,
    cityPack: cityPackSection,
    journeyTodo: journeySection,
    subscription: subscriptionSection,
    llm: llmSection,
    safety: safetySection,
    systemHealth: systemHealthSection
  };

  const featureCatalog = await computeOpsFeatureCatalogStatus({
    nowIso,
    computedWindow,
    sections,
    metrics: {
      notificationsByType: notificationTypeMetrics,
      linkHealth: {
        totalCount: linkRows.length,
        warnCount: linkRows.filter((row) => {
          const state = row && row.lastHealth && typeof row.lastHealth.state === 'string'
            ? row.lastHealth.state.trim().toUpperCase()
            : '';
          return state === 'WARN';
        }).length,
        criticalCount: linkRows.filter((row) => {
          const state = row && row.lastHealth && typeof row.lastHealth.state === 'string'
            ? row.lastHealth.state.trim().toUpperCase()
            : '';
          return state === 'ERROR' || state === 'DEAD' || state === 'BLOCKED';
        }).length,
        vendorLinkCount: linkRows.filter((row) => {
          const category = typeof row.category === 'string' ? row.category.toLowerCase() : '';
          const tagText = Array.isArray(row.tags) ? row.tags.join(',').toLowerCase() : '';
          return category.includes('vendor') || tagText.includes('vendor');
        }).length,
        vendorWarnCount: linkRows.filter((row) => {
          const category = typeof row.category === 'string' ? row.category.toLowerCase() : '';
          const tagText = Array.isArray(row.tags) ? row.tags.join(',').toLowerCase() : '';
          const state = row && row.lastHealth && typeof row.lastHealth.state === 'string'
            ? row.lastHealth.state.trim().toUpperCase()
            : '';
          return (category.includes('vendor') || tagText.includes('vendor')) && state === 'WARN';
        }).length,
        vendorCriticalCount: linkRows.filter((row) => {
          const category = typeof row.category === 'string' ? row.category.toLowerCase() : '';
          const tagText = Array.isArray(row.tags) ? row.tags.join(',').toLowerCase() : '';
          const state = row && row.lastHealth && typeof row.lastHealth.state === 'string'
            ? row.lastHealth.state.trim().toUpperCase()
            : '';
          return (category.includes('vendor') || tagText.includes('vendor')) && (state === 'ERROR' || state === 'DEAD' || state === 'BLOCKED');
        }).length,
        lastUpdatedAt: latestTimestamp([
          latestFromRows(linkRows, ['updatedAt', 'createdAt']),
          latestTimestamp(linkRows.map((row) => row && row.lastHealth && row.lastHealth.checkedAt))
        ])
      },
      clickTracking: {
        deliveryCount: deliveries.length,
        clickCount,
        ctr: safeDiv(clickCount, Math.max(deliveries.length, 1)),
        lastUpdatedAt: latestFromRows(deliveries, ['sentAt', 'updatedAt'])
      },
      faq: {
        articleDraftCount: faqArticles.filter((row) => {
          const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
          return status === 'draft';
        }).length,
        answerFailedCount: faqAnswerLogs.filter((row) => {
          if (row && row.ok === false) return true;
          if (row && row.blocked === true) return true;
          if (typeof row.error === 'string' && row.error.trim()) return true;
          if (typeof row.decision === 'string' && row.decision.trim().toLowerCase() === 'blocked') return true;
          return false;
        }).length,
        answerErrorRate: safeDiv(
          faqAnswerLogs.filter((row) => {
            if (row && row.ok === false) return true;
            if (row && row.blocked === true) return true;
            if (typeof row.error === 'string' && row.error.trim()) return true;
            if (typeof row.decision === 'string' && row.decision.trim().toLowerCase() === 'blocked') return true;
            return false;
          }).length,
          Math.max(faqAnswerLogs.length, 1)
        ),
        lastUpdatedAt: latestTimestamp([
          latestFromRows(faqAnswerLogs, ['createdAt']),
          latestFromRows(faqArticles, ['updatedAt', 'createdAt'])
        ])
      },
      richMenu: {
        totalRuns: richMenuRuns.length,
        failedRuns: richMenuRuns.filter((run) => {
          const summaryFailed = run && run.summary && Number.isFinite(Number(run.summary.failedCount)) && Number(run.summary.failedCount) > 0;
          const resultFailed = Array.isArray(run && run.results) && run.results.some((item) => {
            const status = typeof (item && item.status) === 'string' ? item.status.trim().toLowerCase() : '';
            return status === 'failed';
          });
          return summaryFailed || resultFailed;
        }).length,
        rollbackRuns: richMenuRuns.filter((run) => {
          const action = typeof run.action === 'string' ? run.action.toLowerCase() : '';
          const mode = typeof run.mode === 'string' ? run.mode.toLowerCase() : '';
          return action.includes('rollback') || mode.includes('rollback');
        }).length,
        lastUpdatedAt: latestFromRows(richMenuRuns, ['createdAt', 'updatedAt'])
      },
      journeyTodo: {
        activeUsers,
        stalledUsers,
        stalledRate,
        overdueCount: todoOverdueCount,
        lastUpdatedAt: journeyLastUpdatedAt
      },
      subscription: {
        activeCount: subscriptionActiveCount,
        failedCount: subscriptionFailedCount,
        expiredCount: subscriptionExpiredCount,
        failedOrPastDueRate,
        lastUpdatedAt: subscriptionLastUpdatedAt
      },
      analytics: {
        snapshotAgeSeconds: 0,
        lastUpdatedAt: nowIso
      },
      systemHealth: {
        productReadiness: systemHealthEval.productReadiness,
        lastUpdatedAt: systemHealthSection.lastUpdatedAt
      },
      llm: {
        usageCount: llmUsageCount,
        errorRate: llmErrorRate,
        policyChangeDetected,
        lastUpdatedAt: llmLastUpdatedAt
      },
      safety: {
        retentionAgeSeconds,
        retentionFailed,
        lastUpdatedAt: safetyLastUpdatedAt
      }
    }
  });

  const sectionStatuses = SECTION_KEYS.map((key) => sections[key]).filter(Boolean);
  const globalStatus = resolveGlobalStatus(sectionStatuses);
  const globalReasonCodes = dedupeReasonCodes(sectionStatuses.flatMap((section) => {
    if (!section || section.status === STATUS_OK) return [];
    return Array.isArray(section.reasonCodes) ? section.reasonCodes : [];
  }).concat(
    sourceFailures.length ? [REASON_CODES.SOURCE_QUERY_FAILED] : [],
    truncationReasons
  ));

  const globalLastUpdatedAt = latestTimestamp(sectionStatuses.map((section) => section.lastUpdatedAt)) || nowIso;
  const maxDocsReadApprox = queryDiagnostics.reduce((sum, row) => sum + (Number.isFinite(Number(row.count)) ? Number(row.count) : 0), 0);

  const global = Object.assign(
    buildStatusEnvelope({
      nowIso,
      updatedAt: nowIso,
      lastUpdatedAt: globalLastUpdatedAt,
      status: globalStatus,
      reasonCodes: globalReasonCodes,
      computedWindow,
      stalenessSeconds: 0
    }),
    {
      sections,
      featureSummary: featureCatalog.catalog.counts,
      meta: {
        featureCount: featureCatalog.rows.length,
        queryDiagnostics,
        sourceFailures,
        maxDocsReadApprox,
        productReadiness: systemHealthEval.productReadiness,
        policyVersionId: llmPolicy && llmPolicy.policy_version_id ? llmPolicy.policy_version_id : null
      }
    }
  );

  return {
    nowIso,
    computedWindow,
    global,
    catalog: featureCatalog.catalog,
    rows: featureCatalog.rows
  };
}

module.exports = {
  computeOpsSystemSnapshot
};
