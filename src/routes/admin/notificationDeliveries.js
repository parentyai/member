'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const { mapFailureCode } = require('../../domain/notificationFailureTaxonomy');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveActor, resolveRequestId, resolveTraceId } = require('./osContext');

function normalizeLimit(value, fallback, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
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

function resolveVendor(link) {
  if (!link) return { vendorKey: 'unknown', vendorLabel: '未分類' };
  const fallbackHost = resolveHost(link.url);
  const vendorKey = link.vendorKey || fallbackHost || 'unknown';
  const vendorLabel = link.vendorLabel || fallbackHost || vendorKey;
  return { vendorKey, vendorLabel };
}

function resolveStatusLabel(status, delivered) {
  if (status === 'delivered' || delivered) return '配信完了';
  if (status === 'sealed') return '封印';
  if (status === 'reserved') return '予約済み';
  if (status === 'error' || status === 'failed') return '送信失敗';
  return '未分類';
}

function resolveFailureLabel(code) {
  if (!code) return '-';
  if (code === 'GUARD_BLOCK_KILL_SWITCH') return '送信停止中';
  if (code === 'GUARD_BLOCK_WARN_LINK') return '危険リンクを検出';
  if (code === 'INVALID_CTA') return 'ボタン文言の設定不備';
  if (code === 'MISSING_LINK_REGISTRY_ID') return 'リンクID未設定';
  if (code === 'DIRECT_URL_FORBIDDEN') return '直接URLは禁止';
  if (code === 'DELIVERY_WRITE_FAIL') return '配信記録の保存失敗';
  if (code === 'LINE_API_FAIL') return 'LINE送信エラー';
  return 'その他の例外';
}

function resolveHealth(item) {
  if (item.failureCode) return 'DANGER';
  if (item.status === 'delivered' || item.deliveredAt) return 'OK';
  if (item.status === 'reserved' || item.status === 'sealed') return 'WARN';
  return 'UNKNOWN';
}

async function handleNotificationDeliveries(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = (url.searchParams.get('lineUserId') || '').trim();
  const memberNumber = (url.searchParams.get('memberNumber') || '').trim();
  const limit = normalizeLimit(url.searchParams.get('limit'), 50, 200);
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const actor = resolveActor(req);

  if (!lineUserId && !memberNumber) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId or memberNumber required' }));
    return;
  }

  try {
    const resolvedLineUserIds = [];
    const memberNumberByLineUser = new Map();

    if (lineUserId) resolvedLineUserIds.push(lineUserId);

    if (memberNumber) {
      const users = await usersRepo.listUsersByMemberNumber(memberNumber, 20);
      users.forEach((user) => {
        if (!user || !user.id) return;
        memberNumberByLineUser.set(user.id, user.memberNumber || null);
        if (!resolvedLineUserIds.includes(user.id)) resolvedLineUserIds.push(user.id);
      });
    }

    if (!resolvedLineUserIds.length) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        serverTime: new Date().toISOString(),
        traceId,
        query: { lineUserId: lineUserId || null, memberNumber: memberNumber || null, resolvedLineUserIds: [] },
        items: [],
        summary: { total: 0, danger: 0, warn: 0, ok: 0, unknown: 0 }
      }));
      return;
    }

    const allDeliveries = [];
    for (const id of resolvedLineUserIds) {
      const deliveries = await deliveriesRepo.listDeliveriesByUser(id, limit);
      deliveries.forEach((delivery) => {
        allDeliveries.push(Object.assign({ lineUserId: id }, delivery));
      });
    }
    allDeliveries.sort((a, b) => toMillis(b.sentAt || b.deliveredAt) - toMillis(a.sentAt || a.deliveredAt));

    const limited = allDeliveries.slice(0, limit);
    const notificationIds = Array.from(new Set(limited.map((item) => item.notificationId).filter(Boolean)));
    const notificationMap = new Map();
    for (const notificationId of notificationIds) {
      const record = await notificationsRepo.getNotification(notificationId);
      if (record) notificationMap.set(notificationId, record);
    }

    const linkIds = Array.from(new Set(Array.from(notificationMap.values()).map((item) => item.linkRegistryId).filter(Boolean)));
    const linkMap = new Map();
    for (const linkId of linkIds) {
      const link = await linkRegistryRepo.getLink(linkId);
      if (link) linkMap.set(linkId, link);
    }

    const items = limited.map((delivery) => {
      const notification = delivery.notificationId ? notificationMap.get(delivery.notificationId) || null : null;
      const member = memberNumberByLineUser.get(delivery.lineUserId) || null;
      const link = notification && notification.linkRegistryId ? linkMap.get(notification.linkRegistryId) || null : null;
      const vendor = resolveVendor(link);
      const failureCode = delivery.lastError ? mapFailureCode({ message: delivery.lastError }) : null;
      const status = delivery.state || (delivery.delivered ? 'delivered' : 'unknown');
      return {
        lineUserId: delivery.lineUserId || null,
        memberNumber: member,
        deliveryId: delivery.id || null,
        notificationId: delivery.notificationId || null,
        title: notification && notification.title ? notification.title : null,
        scenarioKey: notification && notification.scenarioKey ? notification.scenarioKey : null,
        stepKey: notification && notification.stepKey ? notification.stepKey : null,
        sentAt: delivery.sentAt || null,
        deliveredAt: delivery.deliveredAt || delivery.sentAt || null,
        status,
        statusLabel: resolveStatusLabel(status, Boolean(delivery.delivered)),
        failureCode,
        failureLabel: resolveFailureLabel(failureCode),
        lastError: delivery.lastError || null,
        vendorKey: vendor.vendorKey,
        vendorLabel: vendor.vendorLabel,
        traceId: delivery.traceId || null,
        health: resolveHealth({ failureCode, status, deliveredAt: delivery.deliveredAt || null })
      };
    });

    const summary = { total: items.length, danger: 0, warn: 0, ok: 0, unknown: 0 };
    items.forEach((item) => {
      if (item.health === 'DANGER') summary.danger += 1;
      else if (item.health === 'WARN') summary.warn += 1;
      else if (item.health === 'OK') summary.ok += 1;
      else summary.unknown += 1;
    });

    try {
      await appendAuditLog({
        actor,
        action: 'notifications.deliveries.view',
        entityType: 'notification_deliveries',
        entityId: lineUserId || memberNumber || 'query',
        traceId,
        requestId,
        payloadSummary: {
          lineUserId: lineUserId || null,
          memberNumber: memberNumber || null,
          resolvedUsers: resolvedLineUserIds.length,
          count: items.length
        }
      });
    } catch (_err) {
      // best effort only
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      serverTime: new Date().toISOString(),
      traceId,
      query: { lineUserId: lineUserId || null, memberNumber: memberNumber || null, resolvedLineUserIds },
      items,
      summary
    }));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}

module.exports = {
  handleNotificationDeliveries
};
