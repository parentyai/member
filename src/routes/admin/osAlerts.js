'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { getNotificationReadModel } = require('../../usecases/admin/getNotificationReadModel');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const value = Number(url.searchParams.get('limit'));
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(50, Math.min(MAX_LIMIT, Math.floor(value)));
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value === 'string' || typeof value === 'number') {
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

function isUtcToday(value, nowMs) {
  const targetMs = toMillis(value);
  if (!Number.isFinite(targetMs)) return false;
  const now = new Date(nowMs);
  const target = new Date(targetMs);
  return now.getUTCFullYear() === target.getUTCFullYear()
    && now.getUTCMonth() === target.getUTCMonth()
    && now.getUTCDate() === target.getUTCDate();
}

function buildAlertItems(summary) {
  const payload = summary && typeof summary === 'object' ? summary : {};
  return [
    {
      type: 'kill_switch_on',
      typeLabel: 'KillSwitch ON',
      count: payload.killSwitch ? 1 : 0,
      impact: '通知送信が停止します。',
      actionPane: 'settings',
      actionLabel: '設定を確認'
    },
    {
      type: 'link_warn',
      typeLabel: 'Link WARN',
      count: Number.isFinite(payload.warnLinkCount) ? payload.warnLinkCount : 0,
      impact: 'WARNリンクを含む通知は送信できません。',
      actionPane: 'errors',
      actionLabel: '状態確認を開く'
    },
    {
      type: 'target_zero',
      typeLabel: '対象0件通知',
      count: Number.isFinite(payload.targetZeroCount) ? payload.targetZeroCount : 0,
      impact: '送信計画が成立せず配信できません。',
      actionPane: 'monitor',
      actionLabel: '配信結果を開く'
    },
    {
      type: 'unapproved_notifications',
      typeLabel: '未承認通知',
      count: Number.isFinite(payload.draftCount) ? payload.draftCount : 0,
      impact: '承認前のため配信対象になりません。',
      actionPane: 'composer',
      actionLabel: '通知作成を開く'
    },
    {
      type: 'retry_queue_pending',
      typeLabel: '再送待ち',
      count: Number.isFinite(payload.retryPendingCount) ? payload.retryPendingCount : 0,
      impact: '再送待ちが滞留すると配信遅延につながります。',
      actionPane: 'errors',
      actionLabel: '状態確認を開く'
    }
  ];
}

async function handleAlertsSummary(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);
  const nowMs = Date.now();

  try {
    const [killSwitch, warnLinks, draftNotifications, activeNotifications, retryPending, activeReadModel] = await Promise.all([
      systemFlagsRepo.getKillSwitch(),
      linkRegistryRepo.listLinks({ state: 'WARN', limit }),
      notificationsRepo.listNotifications({ status: 'draft', limit }),
      notificationsRepo.listNotifications({ status: 'active', limit }),
      sendRetryQueueRepo.listPending(limit),
      getNotificationReadModel({ status: 'active', limit: Math.min(150, limit) })
    ]);

    const scheduledTodayCount = (Array.isArray(activeNotifications) ? activeNotifications : []).reduce((count, notification) => {
      if (String(notification && notification.status) !== 'active') return count;
      if (isUtcToday(notification && notification.scheduledAt, nowMs)) return count + 1;
      return count;
    }, 0);

    const targetZeroCount = (Array.isArray(activeReadModel) ? activeReadModel : []).filter((item) => {
      const value = item && item.targetCount;
      return Number.isFinite(Number(value)) && Number(value) === 0;
    }).length;

    const summary = {
      killSwitch: killSwitch === true,
      warnLinkCount: Array.isArray(warnLinks) ? warnLinks.length : 0,
      targetZeroCount,
      draftCount: Array.isArray(draftNotifications) ? draftNotifications.length : 0,
      retryPendingCount: Array.isArray(retryPending) ? retryPending.length : 0,
      scheduledTodayCount
    };

    const items = buildAlertItems(summary);
    const openAlerts = items.reduce((sum, item) => sum + (Number.isFinite(item.count) ? item.count : 0), 0);

    await appendAuditLog({
      actor,
      action: 'admin_os.alerts.view',
      entityType: 'admin_os',
      entityId: 'alerts',
      traceId,
      requestId,
      payloadSummary: {
        openAlerts,
        scheduledTodayCount,
        limit,
        fallbackMode: 'bounded'
      }
    });

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      totals: {
        openAlerts,
        scheduledTodayCount
      },
      note: 'operational_actionable_only',
      items
    }));
  } catch (err) {
    logRouteError('admin.os_alerts_summary', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleAlertsSummary
};
