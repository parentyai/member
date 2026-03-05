'use strict';

const { getDb } = require('../../../infra/firestore');
const {
  getTaskUxAuditOverlapWarnThresholdPct,
  getTaskUxAuditTaskKeyWarnThresholdPct
} = require('../../../domain/tasks/featureFlags');

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 10) return 1000;
  return Math.max(100, Math.min(5000, Math.floor(num)));
}

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function toPercent(numerator, denominator) {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return Math.round((num / den) * 10000) / 100;
}

async function countCollection(db, collectionName, sampleLimit) {
  const collection = db.collection(collectionName);
  if (collection && typeof collection.count === 'function') {
    try {
      const aggregate = await collection.count().get();
      if (aggregate && typeof aggregate.data === 'function') {
        const data = aggregate.data();
        if (data && Number.isFinite(Number(data.count))) {
          return { count: Number(data.count), exact: true, mode: 'aggregate' };
        }
      }
    } catch (_err) {
      // fallback below
    }
  }
  const limit = normalizeLimit(sampleLimit);
  const snap = await collection.limit(limit).get();
  const observed = Array.isArray(snap && snap.docs) ? snap.docs.length : 0;
  return {
    count: observed,
    exact: false,
    mode: 'sample',
    truncated: observed >= limit
  };
}

async function listCollectionDocs(db, collectionName, limit) {
  const cap = normalizeLimit(limit);
  const snap = await db.collection(collectionName).limit(cap).get();
  const docs = Array.isArray(snap && snap.docs)
    ? snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data() || {}))
    : [];
  return {
    docs,
    truncated: docs.length >= cap,
    limit: cap
  };
}

function resolveJourneyPolicyRichMenuEnabled(doc) {
  const row = doc && typeof doc === 'object' ? doc : {};
  if (row.rich_menu_enabled === true) return true;
  if (row.richMenuEnabled === true) return true;
  return false;
}

async function computeRichMenuState(db, limit) {
  const [templatesCount, rulesCount, phaseProfilesCount, bindingsCount, journeyPolicySnap] = await Promise.all([
    countCollection(db, 'rich_menu_templates', limit),
    countCollection(db, 'rich_menu_assignment_rules', limit),
    countCollection(db, 'rich_menu_phase_profiles', limit),
    countCollection(db, 'rich_menu_bindings', limit),
    db.collection('opsConfig').doc('journeyPolicy').get().catch(() => null)
  ]);

  const journeyPolicy = journeyPolicySnap && journeyPolicySnap.exists
    ? (journeyPolicySnap.data() || {})
    : {};
  const policyEnabled = resolveJourneyPolicyRichMenuEnabled(journeyPolicy);
  const dataTotal = Number(templatesCount.count || 0)
    + Number(rulesCount.count || 0)
    + Number(phaseProfilesCount.count || 0)
    + Number(bindingsCount.count || 0);
  const hasData = dataTotal > 0;
  const state = (policyEnabled && hasData) ? 'configured' : 'unconfigured';

  return {
    state,
    policyEnabled,
    hasData,
    collectionCounts: {
      templates: templatesCount,
      assignmentRules: rulesCount,
      phaseProfiles: phaseProfilesCount,
      bindings: bindingsCount
    }
  };
}

function extractTaskJoinKey(row) {
  const item = row && typeof row === 'object' ? row : {};
  const userId = normalizeText(item.userId || item.lineUserId, '');
  const ruleId = normalizeText(item.ruleId, '');
  if (userId && ruleId) return `${userId}__${ruleId}`;
  const docId = normalizeText(item.id || item.taskId, '');
  return docId || null;
}

function extractTodoJoinKey(row) {
  const item = row && typeof row === 'object' ? row : {};
  const lineUserId = normalizeText(item.lineUserId, '');
  const todoKey = normalizeText(item.todoKey, '');
  if (lineUserId && todoKey) return `${lineUserId}__${todoKey}`;
  const docId = normalizeText(item.id, '');
  return docId || null;
}

async function computeReadModelOverlap(db, limit) {
  const [tasksResult, todoResult] = await Promise.all([
    listCollectionDocs(db, 'tasks', limit),
    listCollectionDocs(db, 'journey_todo_items', limit)
  ]);

  const taskKeys = new Set();
  tasksResult.docs.forEach((row) => {
    const key = extractTaskJoinKey(row);
    if (key) taskKeys.add(key);
  });

  const todoKeys = new Set();
  todoResult.docs.forEach((row) => {
    const key = extractTodoJoinKey(row);
    if (key) todoKeys.add(key);
  });

  let overlapCount = 0;
  taskKeys.forEach((key) => {
    if (todoKeys.has(key)) overlapCount += 1;
  });

  const taskOnlyCount = Math.max(0, taskKeys.size - overlapCount);
  const todoOnlyCount = Math.max(0, todoKeys.size - overlapCount);
  const overlapRatePct = toPercent(overlapCount, taskKeys.size);

  return {
    tasksTotal: taskKeys.size,
    journeyTodoItemsTotal: todoKeys.size,
    overlapCount,
    taskOnlyCount,
    todoOnlyCount,
    overlapRatePct,
    overlapWarnThresholdPct: getTaskUxAuditOverlapWarnThresholdPct(),
    truncated: tasksResult.truncated || todoResult.truncated
  };
}

async function computeTaskKeyLinkage(db, limit) {
  const [stepRules, taskContents, taskContentLinks] = await Promise.all([
    listCollectionDocs(db, 'step_rules', 2000),
    listCollectionDocs(db, 'task_contents', 1000),
    listCollectionDocs(db, 'task_content_links', 1000)
  ]);

  const ruleIds = new Set(stepRules.docs
    .map((row) => normalizeText(row && row.ruleId, ''))
    .filter(Boolean));
  const taskContentKeys = taskContents.docs
    .map((row) => normalizeText(row && row.taskKey, ''))
    .filter(Boolean);

  const directLinkedKeys = new Set(taskContentKeys.filter((taskKey) => ruleIds.has(taskKey)));

  const mappedKeys = new Set();
  taskContentLinks.docs.forEach((row) => {
    const link = row && typeof row === 'object' ? row : {};
    const ruleId = normalizeText(link.ruleId, '');
    const sourceTaskKey = normalizeText(link.sourceTaskKey, '');
    const status = normalizeText(link.status, 'warn').toLowerCase();
    if (!ruleId || !sourceTaskKey) return;
    if (status !== 'active') return;
    if (!ruleIds.has(ruleId)) return;
    if (!taskContentKeys.includes(sourceTaskKey)) return;
    mappedKeys.add(sourceTaskKey);
  });

  const effective = new Set();
  directLinkedKeys.forEach((key) => effective.add(key));
  mappedKeys.forEach((key) => effective.add(key));

  const unlinked = taskContentKeys.filter((taskKey) => !effective.has(taskKey));

  return {
    stepRulesTotal: ruleIds.size,
    taskContentsTotal: taskContentKeys.length,
    directLinkedCount: directLinkedKeys.size,
    mappedLinkedCount: mappedKeys.size,
    effectiveLinkedCount: effective.size,
    unlinkedCount: unlinked.length,
    linkageRatePct: toPercent(effective.size, taskContentKeys.length),
    unlinkedTaskKeys: unlinked.slice(0, 100),
    linkageWarnThresholdPct: getTaskUxAuditTaskKeyWarnThresholdPct(),
    truncated: stepRules.truncated || taskContents.truncated || taskContentLinks.truncated
  };
}

function toLinkState(row) {
  const item = row && typeof row === 'object' ? row : {};
  if (item.enabled === false) return 'disabled';
  const healthState = normalizeText(item.lastHealth && item.lastHealth.state, '').toUpperCase();
  if (healthState === 'WARN') return 'WARN';
  if (healthState) return healthState;
  return 'unknown';
}

function isWarnOrDisabled(row) {
  const state = toLinkState(row);
  return state === 'WARN' || state === 'disabled';
}

function isVendorRow(row) {
  const item = row && typeof row === 'object' ? row : {};
  const category = normalizeText(item.category, '').toLowerCase();
  const vendorKey = normalizeText(item.vendorKey, '').toLowerCase();
  const vendorLabel = normalizeText(item.vendorLabel, '').toLowerCase();
  const title = normalizeText(item.title, '').toLowerCase();
  const tags = Array.isArray(item.tags)
    ? item.tags.map((v) => normalizeText(v, '').toLowerCase()).filter(Boolean)
    : [];
  return category.includes('vendor')
    || vendorKey.length > 0
    || vendorLabel.length > 0
    || title.includes('[vendor_link]')
    || tags.some((v) => v.includes('vendor'));
}

function buildImpactMap(links, taskContents, notifications, cityPacks) {
  const map = new Map();
  (Array.isArray(links) ? links : []).forEach((row) => {
    const id = normalizeText(row && row.id, '');
    if (!id) return;
    map.set(id, {
      id,
      warnOrDisabled: isWarnOrDisabled(row),
      refs: {
        task: 0,
        notification: 0,
        citypack: 0,
        vendor: isVendorRow(row) ? 1 : 0
      }
    });
  });

  (Array.isArray(taskContents) ? taskContents : []).forEach((row) => {
    const video = normalizeText(row && row.videoLinkId, '');
    const action = normalizeText(row && row.actionLinkId, '');
    if (video && map.has(video)) map.get(video).refs.task += 1;
    if (action && map.has(action)) map.get(action).refs.task += 1;
  });

  (Array.isArray(notifications) ? notifications : []).forEach((row) => {
    const primary = normalizeText(row && row.linkRegistryId, '');
    if (primary && map.has(primary)) map.get(primary).refs.notification += 1;
    const secondary = Array.isArray(row && row.secondaryCtas) ? row.secondaryCtas : [];
    secondary.forEach((cta) => {
      const id = normalizeText(cta && cta.linkRegistryId, '');
      if (id && map.has(id)) map.get(id).refs.notification += 1;
    });
    const fallback = normalizeText(row && row.cityPackFallback && row.cityPackFallback.fallbackLinkRegistryId, '');
    if (fallback && map.has(fallback)) map.get(fallback).refs.notification += 1;
  });

  (Array.isArray(cityPacks) ? cityPacks : []).forEach((row) => {
    const slotContents = row && row.slotContents && typeof row.slotContents === 'object' ? row.slotContents : {};
    Object.keys(slotContents).forEach((slotKey) => {
      const id = normalizeText(slotContents[slotKey] && slotContents[slotKey].linkRegistryId, '');
      if (id && map.has(id)) map.get(id).refs.citypack += 1;
    });
    const slots = Array.isArray(row && row.slots) ? row.slots : [];
    slots.forEach((slot) => {
      const id = normalizeText(slot && slot.fallbackLinkRegistryId, '');
      if (id && map.has(id)) map.get(id).refs.citypack += 1;
    });
  });

  const rows = Array.from(map.values()).map((item) => {
    const domainCount = Number(item.refs.task > 0)
      + Number(item.refs.notification > 0)
      + Number(item.refs.citypack > 0)
      + Number(item.refs.vendor > 0);
    const refCount = item.refs.task + item.refs.notification + item.refs.citypack + item.refs.vendor;
    return Object.assign({}, item, { domainCount, refCount });
  });

  const sharedIdCount = rows.filter((row) => row.domainCount >= 2).length;
  const sharedWarnOrDisabledCount = rows.filter((row) => row.domainCount >= 2 && row.warnOrDisabled).length;
  const referencedWarnOrDisabledCount = rows.filter((row) => row.refCount > 0 && row.warnOrDisabled).length;

  return {
    linkRegistryTotal: rows.length,
    sharedIdCount,
    sharedWarnOrDisabledCount,
    referencedWarnOrDisabledCount,
    rows
  };
}

async function computeLinkRegistryImpactKpi(db, limit) {
  const [links, taskContents, notifications, cityPacks] = await Promise.all([
    listCollectionDocs(db, 'link_registry', 2000),
    listCollectionDocs(db, 'task_contents', 1000),
    listCollectionDocs(db, 'notifications', 3000),
    listCollectionDocs(db, 'city_packs', 500)
  ]);
  const impact = buildImpactMap(links.docs, taskContents.docs, notifications.docs, cityPacks.docs);
  return Object.assign({}, impact, {
    truncated: links.truncated || taskContents.truncated || notifications.truncated || cityPacks.truncated
  });
}

async function computeNotificationTotals(db, limit) {
  const [notifications, notificationDeliveries, deliveries, cityPackBulletins] = await Promise.all([
    countCollection(db, 'notifications', limit),
    countCollection(db, 'notification_deliveries', limit),
    countCollection(db, 'deliveries', limit),
    countCollection(db, 'city_pack_bulletins', limit)
  ]);
  return {
    notificationsTotal: notifications.count,
    notificationDeliveriesTotal: notificationDeliveries.count,
    deliveriesTotal: deliveries.count,
    cityPackBulletinsTotal: cityPackBulletins.count,
    exact: {
      notifications: notifications.exact === true,
      notificationDeliveries: notificationDeliveries.exact === true,
      deliveries: deliveries.exact === true,
      cityPackBulletins: cityPackBulletins.exact === true
    },
    modes: {
      notifications: notifications.mode,
      notificationDeliveries: notificationDeliveries.mode,
      deliveries: deliveries.mode,
      cityPackBulletins: cityPackBulletins.mode
    }
  };
}

async function computeContinuationMetrics(db, limit) {
  const cap = normalizeLimit(limit);
  const [openSnap, resumeSnap] = await Promise.all([
    db.collection('audit_logs').where('action', '==', 'task_detail.section.open').limit(cap).get().catch(() => null),
    db.collection('audit_logs').where('action', '==', 'task_detail.section.resume').limit(cap).get().catch(() => null)
  ]);

  const openRows = Array.isArray(openSnap && openSnap.docs)
    ? openSnap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data() || {}))
    : [];
  const resumeRows = Array.isArray(resumeSnap && resumeSnap.docs)
    ? resumeSnap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data() || {}))
    : [];

  const openCount = openRows.length;
  const resumeCount = resumeRows.length;
  const completionRatePct = openCount > 0
    ? Math.min(100, Math.round((resumeCount / openCount) * 10000) / 100)
    : null;

  return {
    openCount,
    resumeCount,
    continuationCompletionRatePct: completionRatePct,
    truncated: openCount >= cap || resumeCount >= cap
  };
}

async function computeTaskUxAuditKpis(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const scanLimit = normalizeLimit(payload.scanLimit);
  const db = getDb();

  const [richMenu, readModelOverlap, taskKeyLinkage, linkRegistryImpact, notification, continuation] = await Promise.all([
    computeRichMenuState(db, scanLimit),
    computeReadModelOverlap(db, scanLimit),
    computeTaskKeyLinkage(db, scanLimit),
    computeLinkRegistryImpactKpi(db, scanLimit),
    computeNotificationTotals(db, scanLimit),
    computeContinuationMetrics(db, scanLimit)
  ]);

  return {
    richMenu,
    readModelOverlap,
    taskKeyLinkage,
    linkRegistryImpact,
    notification,
    continuation
  };
}

module.exports = {
  computeTaskUxAuditKpis
};
