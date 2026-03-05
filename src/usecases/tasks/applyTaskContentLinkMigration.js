'use strict';

const { appendAuditLog } = require('../audit/appendAuditLog');
const taskContentLinksRepo = require('../../repos/firestore/taskContentLinksRepo');
const { planTaskContentLinkMigration } = require('./planTaskContentLinkMigration');
const { isTaskContentLinkMigrationApplyEnabled } = require('../../domain/tasks/featureFlags');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

async function applyTaskContentLinkMigration(params, deps) {
  if (!isTaskContentLinkMigrationApplyEnabled()) {
    const err = new Error('task_content_link_migration_apply_disabled');
    err.code = 'task_content_link_migration_apply_disabled';
    err.statusCode = 409;
    throw err;
  }

  const payload = params && typeof params === 'object' ? params : {};
  const actor = normalizeText(payload.actor, 'task_content_link_migration_apply');
  const traceId = normalizeText(payload.traceId, null);
  const requestId = normalizeText(payload.requestId, null);
  const migrationTraceId = normalizeText(payload.migrationTraceId, traceId || requestId || null);

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const linkRepo = resolvedDeps.taskContentLinksRepo || taskContentLinksRepo;
  const appendAudit = resolvedDeps.appendAuditLog || appendAuditLog;

  const planned = await planTaskContentLinkMigration(payload, resolvedDeps);
  const candidates = Array.isArray(planned && planned.candidates) ? planned.candidates : [];

  const saved = [];
  for (const candidate of candidates) {
    const ruleId = normalizeText(candidate && candidate.ruleId, '');
    if (!ruleId) continue;
    const sourceTaskKey = normalizeText(candidate && candidate.sourceTaskKey, null);
    const status = normalizeText(candidate && candidate.status, sourceTaskKey ? 'active' : 'warn') || 'warn';
    const confidence = normalizeText(candidate && candidate.confidence, 'manual') || 'manual';
    const note = normalizeText(candidate && candidate.note, null);

    // eslint-disable-next-line no-await-in-loop
    const row = await linkRepo.upsertTaskContentLink(ruleId, {
      ruleId,
      sourceTaskKey,
      status,
      confidence,
      note,
      migrationTraceId
    }, actor);
    saved.push(row);
  }

  await appendAudit({
    actor,
    action: 'task_content_links.migration.apply',
    entityType: 'task_content_links',
    entityId: 'task_content_links',
    traceId,
    requestId,
    payloadSummary: {
      migrationTraceId,
      linkedCount: planned && planned.summary ? planned.summary.linkedCount : 0,
      unlinkedCount: planned && planned.summary ? planned.summary.unlinkedCount : 0,
      savedCount: saved.length,
      warningCount: Array.isArray(planned && planned.warnings) ? planned.warnings.length : 0
    }
  }).catch(() => null);

  return {
    ok: true,
    migrationTraceId,
    summary: Object.assign({}, planned && planned.summary ? planned.summary : {}, {
      savedCount: saved.length
    }),
    warnings: Array.isArray(planned && planned.warnings) ? planned.warnings : [],
    unlinked: Array.isArray(planned && planned.unlinked) ? planned.unlinked : [],
    saved
  };
}

module.exports = {
  applyTaskContentLinkMigration
};
