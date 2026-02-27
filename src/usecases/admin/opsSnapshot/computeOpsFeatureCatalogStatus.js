'use strict';

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

const FEATURE_ROWS = Object.freeze([
  { featureId: 'notice_notification', featureLabelJa: 'お知らせ通知', group: 'Run', pane: 'composer', apiPath: '/api/admin/os/notifications/list', type: 'ANNOUNCEMENT' },
  { featureId: 'helpful_notification', featureLabelJa: 'お役立ち通知', group: 'Run', pane: 'composer', apiPath: '/api/admin/os/notifications/list', type: 'GENERAL' },
  { featureId: 'scenario_notification', featureLabelJa: 'シナリオ通知', group: 'Run', pane: 'composer', apiPath: '/api/admin/os/notifications/list', type: 'STEP' },
  { featureId: 'vendor_notification', featureLabelJa: 'ベンダー通知', group: 'Run', pane: 'composer', apiPath: '/api/admin/os/notifications/list', type: 'VENDOR' },
  { featureId: 'vendor_hub', featureLabelJa: 'ベンダー管理（Vendor Hub）', group: 'Run', pane: 'vendors', apiPath: '/api/admin/vendors' },
  { featureId: 'link_management', featureLabelJa: 'リンク管理', group: 'Run', pane: 'errors', apiPath: '/api/admin/os/link-registry/lookup' },
  { featureId: 'click_tracking', featureLabelJa: 'クリック追跡', group: 'Run', pane: 'monitor', apiPath: '/api/admin/notification-deliveries' },
  { featureId: 'kill_switch', featureLabelJa: 'Kill Switch', group: 'Control', pane: 'settings', apiPath: '/api/admin/os/kill-switch/status' },
  { featureId: 'city_pack_core', featureLabelJa: 'City Pack本体', group: 'Run', pane: 'city-pack', apiPath: '/api/admin/city-packs' },
  { featureId: 'city_pack_request_approval', featureLabelJa: 'City Pack申請承認', group: 'Run', pane: 'city-pack', apiPath: '/api/admin/city-pack-requests' },
  { featureId: 'city_pack_review_inbox', featureLabelJa: 'Review Inbox', group: 'Run', pane: 'city-pack', apiPath: '/api/admin/review-inbox' },
  { featureId: 'city_pack_evidence', featureLabelJa: 'Evidence表示', group: 'Run', pane: 'city-pack', apiPath: '/api/admin/city-pack-source-audit/runs' },
  { featureId: 'emergency_sync', featureLabelJa: 'Emergency同期', group: 'Run', pane: 'emergency-layer', apiPath: '/api/admin/emergency/providers' },
  { featureId: 'emergency_approval_send', featureLabelJa: 'Emergency承認送信', group: 'Run', pane: 'emergency-layer', apiPath: '/api/admin/emergency/bulletins' },
  { featureId: 'kb_article_management', featureLabelJa: 'KB記事管理', group: 'Run', pane: 'llm', apiPath: '/api/admin/kb/articles' },
  { featureId: 'faq_answer_generation', featureLabelJa: 'FAQ回答生成', group: 'Run', pane: 'llm', apiPath: '/api/admin/llm/faq/answer' },
  { featureId: 'line_rich_menu', featureLabelJa: 'LINEリッチメニュー', group: 'Run', pane: 'monitor', apiPath: '/api/admin/os/rich-menu/status' },
  { featureId: 'line_todo_view', featureLabelJa: 'LINE ToDo表示', group: 'Run', pane: 'monitor', apiPath: '/api/admin/os/journey-kpi' },
  { featureId: 'journey_engine', featureLabelJa: 'Journeyエンジン', group: 'Run', pane: 'monitor', apiPath: '/api/admin/os/journey-kpi' },
  { featureId: 'subscription_management', featureLabelJa: 'サブスクリプション管理', group: 'Run', pane: 'read-model', apiPath: '/api/admin/os/users-summary/analyze' },
  { featureId: 'delivery_results', featureLabelJa: '配信結果参照', group: 'Run', pane: 'monitor', apiPath: '/api/admin/notification-deliveries' },
  { featureId: 'analytics_kpi', featureLabelJa: 'Analytics/KPI', group: 'Control', pane: 'home', apiPath: '/api/admin/os/dashboard/kpi' },
  { featureId: 'ops_console', featureLabelJa: 'Ops Console', group: 'Control', pane: 'alerts', apiPath: '/api/admin/os/view' },
  { featureId: 'llm_guard', featureLabelJa: 'LLM Guard', group: 'Control', pane: 'llm', apiPath: '/api/admin/llm/policy/status' },
  { featureId: 'retention_policy', featureLabelJa: 'Retention/Policy', group: 'Control', pane: 'maintenance', apiPath: '/api/admin/retention-runs' }
]);

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

function evaluateNotificationTypeMetric(metric) {
  const source = metric && typeof metric === 'object' ? metric : null;
  if (!source) {
    return {
      status: STATUS_UNKNOWN,
      reasonCodes: [REASON_CODES.DATA_MISSING],
      lastUpdatedAt: null,
      metrics: {}
    };
  }

  const failedRate = Number.isFinite(Number(source.failedRate)) ? Number(source.failedRate) : null;
  const failedCount = Number.isFinite(Number(source.failedCount)) ? Number(source.failedCount) : 0;
  const pendingCount = Number.isFinite(Number(source.pendingCount)) ? Number(source.pendingCount) : 0;
  const deliveryCount = Number.isFinite(Number(source.deliveryCount)) ? Number(source.deliveryCount) : 0;

  let status = STATUS_OK;
  const reasons = [];

  const byRate = evaluateRateStatus(failedRate, 1, 5);
  status = mergeStatus(status, byRate.status);
  reasons.push(...byRate.reasonCodes);

  const byCount = thresholdStatus(failedCount, 1, 20);
  if (byCount === STATUS_WARN) reasons.push(REASON_CODES.THRESHOLD_WARN);
  if (byCount === STATUS_ALERT) reasons.push(REASON_CODES.THRESHOLD_ALERT);
  status = mergeStatus(status, byCount);

  if (pendingCount > 0) {
    status = mergeStatus(status, STATUS_WARN);
    reasons.push(REASON_CODES.THRESHOLD_WARN);
  }

  if (deliveryCount === 0 && pendingCount === 0 && failedCount === 0) {
    status = STATUS_UNKNOWN;
    reasons.push(REASON_CODES.DATA_MISSING);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt) || null,
    metrics: {
      failedRatePercent: Number.isFinite(failedRate) ? Math.round(failedRate * 10000) / 100 : null,
      failedCount,
      pendingCount,
      deliveryCount
    }
  };
}

function evaluateVendorHub(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const vendorWarnCount = Number.isFinite(Number(source.vendorWarnCount)) ? Number(source.vendorWarnCount) : 0;
  const vendorCriticalCount = Number.isFinite(Number(source.vendorCriticalCount)) ? Number(source.vendorCriticalCount) : 0;
  const totalVendorLinks = Number.isFinite(Number(source.vendorLinkCount)) ? Number(source.vendorLinkCount) : 0;
  let status = STATUS_OK;
  const reasons = [];

  if (vendorWarnCount > 0) {
    status = STATUS_WARN;
    reasons.push(REASON_CODES.THRESHOLD_WARN);
  }
  if (vendorCriticalCount > 0) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  if (totalVendorLinks === 0) {
    status = STATUS_UNKNOWN;
    reasons.push(REASON_CODES.DATA_MISSING);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: { vendorWarnCount, vendorCriticalCount, totalVendorLinks }
  };
}

function evaluateLinkManagement(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const warnCount = Number.isFinite(Number(source.warnCount)) ? Number(source.warnCount) : 0;
  const criticalCount = Number.isFinite(Number(source.criticalCount)) ? Number(source.criticalCount) : 0;
  const totalCount = Number.isFinite(Number(source.totalCount)) ? Number(source.totalCount) : 0;
  let status = STATUS_OK;
  const reasons = [];

  if (warnCount > 0) {
    status = STATUS_WARN;
    reasons.push(REASON_CODES.THRESHOLD_WARN);
  }
  if (criticalCount > 0) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  if (totalCount === 0) {
    status = STATUS_UNKNOWN;
    reasons.push(REASON_CODES.DATA_MISSING);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: { warnCount, criticalCount, totalCount }
  };
}

function evaluateClickTracking(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const deliveryCount = Number.isFinite(Number(source.deliveryCount)) ? Number(source.deliveryCount) : 0;
  const clickCount = Number.isFinite(Number(source.clickCount)) ? Number(source.clickCount) : 0;
  const ctr = Number.isFinite(Number(source.ctr)) ? Number(source.ctr) : null;
  let status = STATUS_OK;
  const reasons = [];

  if (deliveryCount === 0) {
    status = STATUS_UNKNOWN;
    reasons.push(REASON_CODES.DATA_MISSING);
  } else if (clickCount === 0 && deliveryCount > 20) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.THRESHOLD_ALERT);
  } else if (clickCount === 0 || (Number.isFinite(ctr) && ctr < 0.01)) {
    status = STATUS_WARN;
    reasons.push(REASON_CODES.THRESHOLD_WARN);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: { deliveryCount, clickCount, ctr }
  };
}

function evaluateKillSwitch(section) {
  const source = section && typeof section === 'object' ? section : {};
  const killSwitch = source.metrics && typeof source.metrics === 'object'
    ? source.metrics.killSwitch
    : null;
  let status = STATUS_UNKNOWN;
  const reasons = [];
  if (typeof killSwitch === 'boolean') {
    if (killSwitch) {
      status = STATUS_ALERT;
      reasons.push(REASON_CODES.KILLSWITCH_ON);
    } else {
      status = STATUS_OK;
    }
  } else {
    reasons.push(REASON_CODES.DATA_MISSING);
  }
  return {
    status,
    reasonCodes: reasons,
    lastUpdatedAt: source.lastUpdatedAt || null,
    metrics: { killSwitch }
  };
}

function evaluateFromSection(section, fallbackReason) {
  const source = section && typeof section === 'object' ? section : null;
  if (!source) {
    return {
      status: STATUS_UNKNOWN,
      reasonCodes: [fallbackReason || REASON_CODES.DATA_MISSING],
      lastUpdatedAt: null,
      metrics: {}
    };
  }
  return {
    status: source.status || STATUS_UNKNOWN,
    reasonCodes: Array.isArray(source.reasonCodes) ? source.reasonCodes : [],
    lastUpdatedAt: source.lastUpdatedAt || null,
    metrics: source.metrics && typeof source.metrics === 'object' ? source.metrics : {}
  };
}

function evaluateFaq(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const answerErrorRate = Number.isFinite(Number(source.answerErrorRate)) ? Number(source.answerErrorRate) : null;
  const answerFailedCount = Number.isFinite(Number(source.answerFailedCount)) ? Number(source.answerFailedCount) : 0;
  const draftArticles = Number.isFinite(Number(source.articleDraftCount)) ? Number(source.articleDraftCount) : 0;
  const byRate = evaluateRateStatus(answerErrorRate, 2, 5);
  let status = mergeStatus(byRate.status, draftArticles > 0 ? STATUS_WARN : STATUS_OK);
  const reasons = byRate.reasonCodes.slice();

  if (draftArticles > 0) reasons.push(REASON_CODES.THRESHOLD_WARN);
  if (answerFailedCount > 10) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.THRESHOLD_ALERT);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: {
      answerErrorRatePercent: byRate.percent,
      answerFailedCount,
      articleDraftCount: draftArticles
    }
  };
}

function evaluateRichMenu(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const failedRuns = Number.isFinite(Number(source.failedRuns)) ? Number(source.failedRuns) : 0;
  const rollbackRuns = Number.isFinite(Number(source.rollbackRuns)) ? Number(source.rollbackRuns) : 0;
  const totalRuns = Number.isFinite(Number(source.totalRuns)) ? Number(source.totalRuns) : 0;
  let status = STATUS_OK;
  const reasons = [];

  if (failedRuns > 0) {
    status = STATUS_WARN;
    reasons.push(REASON_CODES.THRESHOLD_WARN);
  }
  if (rollbackRuns > 0) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  if (totalRuns === 0) {
    status = STATUS_UNKNOWN;
    reasons.push(REASON_CODES.DATA_MISSING);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: { failedRuns, rollbackRuns, totalRuns }
  };
}

function evaluateJourney(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const stalledRate = Number.isFinite(Number(source.stalledRate)) ? Number(source.stalledRate) : null;
  const overdueCount = Number.isFinite(Number(source.overdueCount)) ? Number(source.overdueCount) : 0;
  const activeUsers = Number.isFinite(Number(source.activeUsers)) ? Number(source.activeUsers) : 0;
  const rateStatus = evaluateRateStatus(stalledRate, 20, 40);
  let status = rateStatus.status;
  const reasons = rateStatus.reasonCodes.slice();

  if (activeUsers === 0) {
    status = STATUS_UNKNOWN;
    reasons.push(REASON_CODES.DATA_MISSING);
  }
  if (overdueCount > 0) {
    status = mergeStatus(status, STATUS_WARN);
    reasons.push(REASON_CODES.THRESHOLD_WARN);
  }
  if (overdueCount > 100) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.THRESHOLD_ALERT);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: {
      stalledRatePercent: rateStatus.percent,
      overdueCount,
      activeUsers
    }
  };
}

function evaluateSubscription(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const failedRate = Number.isFinite(Number(source.failedOrPastDueRate)) ? Number(source.failedOrPastDueRate) : null;
  const rateStatus = evaluateRateStatus(failedRate, 2, 5);
  return {
    status: rateStatus.status,
    reasonCodes: rateStatus.reasonCodes,
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: {
      failedOrPastDueRatePercent: rateStatus.percent,
      activeCount: Number.isFinite(Number(source.activeCount)) ? Number(source.activeCount) : 0,
      failedCount: Number.isFinite(Number(source.failedCount)) ? Number(source.failedCount) : 0,
      expiredCount: Number.isFinite(Number(source.expiredCount)) ? Number(source.expiredCount) : 0
    }
  };
}

function evaluateAnalytics(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const snapshotAgeSeconds = Number.isFinite(Number(source.snapshotAgeSeconds)) ? Number(source.snapshotAgeSeconds) : null;
  let status = STATUS_OK;
  const reasons = [];

  if (!Number.isFinite(snapshotAgeSeconds)) {
    status = STATUS_UNKNOWN;
    reasons.push(REASON_CODES.DATA_MISSING);
  } else {
    const age = evaluateAgeStatus(snapshotAgeSeconds, 600, 1800);
    status = age.status;
    reasons.push(...age.reasonCodes);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: {
      snapshotAgeSeconds
    }
  };
}

function evaluateOpsConsole(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const readiness = typeof source.productReadiness === 'string' ? source.productReadiness : null;
  let status = STATUS_UNKNOWN;
  const reasons = [];

  if (!readiness) {
    reasons.push(REASON_CODES.DATA_MISSING);
  } else if (readiness === 'GO') {
    status = STATUS_OK;
  } else {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.PRODUCT_READINESS_NO_GO);
  }

  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: { productReadiness: readiness }
  };
}

function evaluateLlmGuard(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const errorRate = Number.isFinite(Number(source.errorRate)) ? Number(source.errorRate) : null;
  const rateStatus = evaluateRateStatus(errorRate, 2, 5);
  const reasons = rateStatus.reasonCodes.slice();
  if (source.policyChangeDetected) reasons.push(REASON_CODES.POLICY_CHANGE_DETECTED);
  return {
    status: rateStatus.status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: {
      errorRatePercent: rateStatus.percent,
      usageCount: Number.isFinite(Number(source.usageCount)) ? Number(source.usageCount) : 0,
      policyChangeDetected: source.policyChangeDetected === true
    }
  };
}

function evaluateRetentionPolicy(metrics) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const retentionAgeSeconds = Number.isFinite(Number(source.retentionAgeSeconds)) ? Number(source.retentionAgeSeconds) : null;
  const retentionFailed = source.retentionFailed === true;
  const age = evaluateAgeStatus(retentionAgeSeconds, 24 * 60 * 60, 48 * 60 * 60);
  let status = age.status;
  const reasons = age.reasonCodes.slice();
  if (retentionFailed) {
    status = STATUS_ALERT;
    reasons.push(REASON_CODES.THRESHOLD_ALERT);
  }
  return {
    status,
    reasonCodes: dedupeReasonCodes(reasons),
    lastUpdatedAt: toIsoString(source.lastUpdatedAt),
    metrics: {
      retentionAgeSeconds,
      retentionFailed
    }
  };
}

function buildFeatureRows(context) {
  const ctx = context && typeof context === 'object' ? context : {};
  const nowIso = toIsoString(ctx.nowIso) || new Date().toISOString();
  const computedWindow = ctx.computedWindow && typeof ctx.computedWindow === 'object' ? ctx.computedWindow : null;
  const sections = ctx.sections && typeof ctx.sections === 'object' ? ctx.sections : {};
  const metrics = ctx.metrics && typeof ctx.metrics === 'object' ? ctx.metrics : {};

  return FEATURE_ROWS.map((feature, index) => {
    let evaluated;

    if (feature.type) {
      const rowMetric = metrics.notificationsByType && typeof metrics.notificationsByType === 'object'
        ? metrics.notificationsByType[feature.type]
        : null;
      evaluated = evaluateNotificationTypeMetric(rowMetric);
    } else if (feature.featureId === 'vendor_hub') {
      evaluated = evaluateVendorHub(metrics.linkHealth);
    } else if (feature.featureId === 'link_management') {
      evaluated = evaluateLinkManagement(metrics.linkHealth);
    } else if (feature.featureId === 'click_tracking') {
      evaluated = evaluateClickTracking(metrics.clickTracking);
    } else if (feature.featureId === 'kill_switch') {
      evaluated = evaluateKillSwitch(sections.safety);
    } else if (feature.featureId === 'kb_article_management' || feature.featureId === 'faq_answer_generation') {
      evaluated = evaluateFaq(metrics.faq);
    } else if (feature.featureId === 'line_rich_menu') {
      evaluated = evaluateRichMenu(metrics.richMenu);
    } else if (feature.featureId === 'line_todo_view' || feature.featureId === 'journey_engine') {
      evaluated = evaluateJourney(metrics.journeyTodo);
    } else if (feature.featureId === 'subscription_management') {
      evaluated = evaluateSubscription(metrics.subscription);
    } else if (feature.featureId === 'analytics_kpi') {
      evaluated = evaluateAnalytics(metrics.analytics);
    } else if (feature.featureId === 'ops_console') {
      evaluated = evaluateOpsConsole(metrics.systemHealth);
    } else if (feature.featureId === 'llm_guard') {
      evaluated = evaluateLlmGuard(metrics.llm);
    } else if (feature.featureId === 'retention_policy') {
      evaluated = evaluateRetentionPolicy(metrics.safety);
    } else if (feature.featureId.startsWith('city_pack_')) {
      evaluated = evaluateFromSection(sections.cityPack);
    } else if (feature.featureId.startsWith('emergency_')) {
      evaluated = evaluateFromSection(sections.emergency);
    } else if (feature.featureId === 'delivery_results') {
      evaluated = evaluateFromSection(sections.notifications);
    } else {
      evaluated = evaluateFromSection(sections.systemHealth);
    }

    const envelope = buildStatusEnvelope({
      nowIso,
      updatedAt: nowIso,
      lastUpdatedAt: evaluated.lastUpdatedAt || latestTimestamp([
        sections.notifications && sections.notifications.lastUpdatedAt,
        sections.cityPack && sections.cityPack.lastUpdatedAt,
        sections.emergency && sections.emergency.lastUpdatedAt,
        sections.systemHealth && sections.systemHealth.lastUpdatedAt
      ]) || nowIso,
      status: evaluated.status,
      reasonCodes: evaluated.reasonCodes,
      computedWindow
    });

    return Object.assign({}, envelope, {
      featureId: feature.featureId,
      featureLabelJa: feature.featureLabelJa,
      group: feature.group,
      rowOrder: index + 1,
      metrics: evaluated.metrics || {},
      detail: {
        pane: feature.pane,
        apiPath: feature.apiPath
      }
    });
  });
}

function summarizeRows(rows, nowIso, computedWindow) {
  const list = Array.isArray(rows) ? rows : [];
  const counts = {
    OK: 0,
    WARN: 0,
    ALERT: 0,
    UNKNOWN: 0
  };
  list.forEach((row) => {
    const status = row && row.status ? row.status : STATUS_UNKNOWN;
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    else counts.UNKNOWN += 1;
  });

  const status = resolveGlobalStatus(list);
  const reasonCodes = dedupeReasonCodes(list.flatMap((row) => {
    if (!row || row.status === STATUS_OK) return [];
    return Array.isArray(row.reasonCodes) ? row.reasonCodes : [];
  }));
  const lastUpdatedAt = latestTimestamp(list.map((row) => row && row.lastUpdatedAt)) || nowIso;

  return buildStatusEnvelope({
    nowIso,
    updatedAt: nowIso,
    lastUpdatedAt,
    status,
    reasonCodes,
    computedWindow,
    stalenessSeconds: 0
  });
}

async function computeOpsFeatureCatalogStatus(context) {
  const ctx = context && typeof context === 'object' ? context : {};
  const nowIso = toIsoString(ctx.nowIso) || new Date().toISOString();
  const computedWindow = ctx.computedWindow && typeof ctx.computedWindow === 'object' ? ctx.computedWindow : null;

  const rows = buildFeatureRows(Object.assign({}, ctx, { nowIso, computedWindow }));
  const summary = summarizeRows(rows, nowIso, computedWindow);

  return {
    rows,
    catalog: Object.assign({}, summary, {
      featureCount: rows.length,
      counts: {
        ok: rows.filter((row) => row.status === STATUS_OK).length,
        warn: rows.filter((row) => row.status === STATUS_WARN).length,
        alert: rows.filter((row) => row.status === STATUS_ALERT).length,
        unknown: rows.filter((row) => row.status === STATUS_UNKNOWN).length
      },
      rows: rows.map((row) => ({
        featureId: row.featureId,
        featureLabelJa: row.featureLabelJa,
        group: row.group,
        rowOrder: row.rowOrder,
        status: row.status,
        statusColor: row.statusColor,
        reasonCodes: row.reasonCodes,
        updatedAt: row.updatedAt,
        lastUpdatedAt: row.lastUpdatedAt,
        stalenessSeconds: row.stalenessSeconds,
        metrics: row.metrics,
        detail: row.detail
      }))
    })
  };
}

module.exports = {
  FEATURE_ROWS,
  computeOpsFeatureCatalogStatus
};
