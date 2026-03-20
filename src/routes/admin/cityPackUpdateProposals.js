'use strict';

const cityPackUpdateProposalsRepo = require('../../repos/firestore/cityPackUpdateProposalsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const LIST_ROUTE_KEY = 'admin.city_pack_update_proposals_list';
const DETAIL_ROUTE_KEY = 'admin.city_pack_update_proposals_detail';
const CREATE_ROUTE_KEY = 'admin.city_pack_update_proposals_create';
const ACTION_ROUTE_KEY = 'admin.city_pack_update_proposals_action';

const ALLOWED_PATCH_KEYS = new Set([
  'targetingRules',
  'slots',
  'basePackId',
  'overrides',
  'sourceRefs',
  'validUntil',
  'metadata'
]);

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 200);
}

function parseActionPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-update-proposals\/([^/]+)\/(approve|reject|apply)$/);
  if (!match) return null;
  return {
    proposalId: decodeURIComponent(match[1]),
    action: match[2]
  };
}

function parseDetailPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-update-proposals\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

function normalizeValidUntil(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeProposalPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'proposalPatch required' };
  }
  const keys = Object.keys(input);
  const invalidKeys = keys.filter((key) => !ALLOWED_PATCH_KEYS.has(key));
  if (invalidKeys.length) {
    return { ok: false, error: 'proposalPatch contains disallowed keys', invalidKeys };
  }

  const patch = {};
  let hasAny = false;

  if ('targetingRules' in input || 'slots' in input || 'basePackId' in input) {
    const structurePatch = cityPacksRepo.normalizeCityPackStructurePatch({
      basePackId: input.basePackId,
      targetingRules: input.targetingRules,
      slots: input.slots
    });
    patch.basePackId = structurePatch.basePackId;
    patch.targetingRules = structurePatch.targetingRules;
    patch.slots = structurePatch.slots;
    if (structurePatch.overrides) patch.overrides = structurePatch.overrides;
    hasAny = true;
  }

  if ('overrides' in input) {
    const overrides = cityPacksRepo.normalizeOverrides(input.overrides);
    if (input.overrides && !overrides) return { ok: false, error: 'invalid overrides' };
    patch.overrides = overrides;
    hasAny = true;
  }

  if ('sourceRefs' in input) {
    const sourceRefs = normalizeStringArray(input.sourceRefs);
    if (!sourceRefs.length) return { ok: false, error: 'sourceRefs required' };
    patch.sourceRefs = sourceRefs;
    hasAny = true;
  }

  if ('validUntil' in input) {
    const validUntil = normalizeValidUntil(input.validUntil);
    if (!validUntil) return { ok: false, error: 'validUntil invalid' };
    patch.validUntil = validUntil;
    hasAny = true;
  }

  if ('metadata' in input) {
    if (!input.metadata || typeof input.metadata !== 'object' || Array.isArray(input.metadata)) {
      return { ok: false, error: 'metadata invalid' };
    }
    patch.metadata = Object.assign({}, input.metadata);
    hasAny = true;
  }

  if (!hasAny) return { ok: false, error: 'proposalPatch empty' };
  return { ok: true, patch };
}

async function handleListProposals(req, res, context, deps) {
  const url = new URL(req.url, 'http://localhost');
  const status = (url.searchParams.get('status') || '').trim() || null;
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const listProposals = typeof resolvedDeps.listProposals === 'function'
    ? resolvedDeps.listProposals
    : cityPackUpdateProposalsRepo.listProposals;
  const items = await listProposals({ status, limit });
  writeJson(res, LIST_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, items }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleGetProposal(req, res, context, proposalId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getProposal = typeof resolvedDeps.getProposal === 'function'
    ? resolvedDeps.getProposal
    : cityPackUpdateProposalsRepo.getProposal;
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    writeJson(res, DETAIL_ROUTE_KEY, 404, { ok: false, error: 'proposal not found' }, {
      state: 'error',
      reason: 'proposal_not_found'
    });
    return;
  }
  writeJson(res, DETAIL_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, item: proposal }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleCreateProposal(req, res, bodyText, context, deps) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const cityPackId = typeof payload.cityPackId === 'string' ? payload.cityPackId.trim() : '';
  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';
  if (!cityPackId || !summary) {
    writeJson(res, CREATE_ROUTE_KEY, 400, { ok: false, error: 'cityPackId/summary required' }, {
      state: 'error',
      reason: 'city_pack_id_summary_required'
    });
    return;
  }
  const normalized = normalizeProposalPatch(payload.proposalPatch);
  if (!normalized.ok) {
    writeJson(res, CREATE_ROUTE_KEY, 400, { ok: false, error: normalized.error, invalidKeys: normalized.invalidKeys }, {
      state: 'error',
      reason: 'proposal_patch_invalid'
    });
    return;
  }
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const createProposal = typeof resolvedDeps.createProposal === 'function'
    ? resolvedDeps.createProposal
    : cityPackUpdateProposalsRepo.createProposal;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const created = await createProposal({
    cityPackId,
    summary,
    proposalPatch: normalized.patch,
    traceId: context.traceId,
    requestId: payload.requestId || null,
    status: 'draft'
  });
  await appendAudit({
    actor: context.actor,
    action: 'city_pack.proposal.create',
    entityType: 'city_pack_update_proposal',
    entityId: created.id,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      cityPackId
    }
  });
  writeJson(res, CREATE_ROUTE_KEY, 201, { ok: true, traceId: context.traceId, proposalId: created.id }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleApproveProposal(req, res, context, proposalId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getProposal = typeof resolvedDeps.getProposal === 'function'
    ? resolvedDeps.getProposal
    : cityPackUpdateProposalsRepo.getProposal;
  const updateProposal = typeof resolvedDeps.updateProposal === 'function'
    ? resolvedDeps.updateProposal
    : cityPackUpdateProposalsRepo.updateProposal;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    writeJson(res, ACTION_ROUTE_KEY, 404, { ok: false, error: 'proposal not found' }, {
      state: 'error',
      reason: 'proposal_not_found'
    });
    return;
  }
  if (proposal.status !== 'draft') {
    writeJson(res, ACTION_ROUTE_KEY, 409, { ok: false, error: 'proposal_not_draft' }, {
      state: 'blocked',
      reason: 'proposal_not_draft'
    });
    return;
  }
  await updateProposal(proposalId, {
    status: 'approved',
    approvedAt: new Date().toISOString()
  });
  await appendAudit({
    actor: context.actor,
    action: 'city_pack.proposal.approve',
    entityType: 'city_pack_update_proposal',
    entityId: proposalId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      cityPackId: proposal.cityPackId || null
    }
  });
  writeJson(res, ACTION_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, proposalId }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleRejectProposal(req, res, context, proposalId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getProposal = typeof resolvedDeps.getProposal === 'function'
    ? resolvedDeps.getProposal
    : cityPackUpdateProposalsRepo.getProposal;
  const updateProposal = typeof resolvedDeps.updateProposal === 'function'
    ? resolvedDeps.updateProposal
    : cityPackUpdateProposalsRepo.updateProposal;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    writeJson(res, ACTION_ROUTE_KEY, 404, { ok: false, error: 'proposal not found' }, {
      state: 'error',
      reason: 'proposal_not_found'
    });
    return;
  }
  if (proposal.status === 'applied') {
    writeJson(res, ACTION_ROUTE_KEY, 409, { ok: false, error: 'proposal_already_applied' }, {
      state: 'blocked',
      reason: 'proposal_already_applied'
    });
    return;
  }
  await updateProposal(proposalId, {
    status: 'rejected'
  });
  await appendAudit({
    actor: context.actor,
    action: 'city_pack.proposal.reject',
    entityType: 'city_pack_update_proposal',
    entityId: proposalId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      cityPackId: proposal.cityPackId || null
    }
  });
  writeJson(res, ACTION_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, proposalId }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleApplyProposal(req, res, context, proposalId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getProposal = typeof resolvedDeps.getProposal === 'function'
    ? resolvedDeps.getProposal
    : cityPackUpdateProposalsRepo.getProposal;
  const updateProposal = typeof resolvedDeps.updateProposal === 'function'
    ? resolvedDeps.updateProposal
    : cityPackUpdateProposalsRepo.updateProposal;
  const getCityPack = typeof resolvedDeps.getCityPack === 'function'
    ? resolvedDeps.getCityPack
    : cityPacksRepo.getCityPack;
  const updateCityPack = typeof resolvedDeps.updateCityPack === 'function'
    ? resolvedDeps.updateCityPack
    : cityPacksRepo.updateCityPack;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    writeJson(res, ACTION_ROUTE_KEY, 404, { ok: false, error: 'proposal not found' }, {
      state: 'error',
      reason: 'proposal_not_found'
    });
    return;
  }
  if (proposal.status !== 'approved') {
    writeJson(res, ACTION_ROUTE_KEY, 409, { ok: false, error: 'proposal_not_approved' }, {
      state: 'blocked',
      reason: 'proposal_not_approved'
    });
    return;
  }
  const normalized = normalizeProposalPatch(proposal.proposalPatch);
  if (!normalized.ok) {
    writeJson(res, ACTION_ROUTE_KEY, 409, { ok: false, error: normalized.error }, {
      state: 'error',
      reason: 'proposal_patch_invalid'
    });
    return;
  }

  const cityPack = await getCityPack(proposal.cityPackId);
  if (!cityPack) {
    writeJson(res, ACTION_ROUTE_KEY, 404, { ok: false, error: 'city pack not found' }, {
      state: 'error',
      reason: 'city_pack_not_found'
    });
    return;
  }

  if (normalized.patch.basePackId) {
    if (normalized.patch.basePackId === cityPack.id) {
      writeJson(res, ACTION_ROUTE_KEY, 409, { ok: false, error: 'base_pack_self_reference' }, {
        state: 'blocked',
        reason: 'base_pack_self_reference'
      });
      return;
    }
    const basePack = await getCityPack(normalized.patch.basePackId);
    const validation = cityPacksRepo.validateBasePackDepth(basePack);
    if (!validation.ok) {
      writeJson(res, ACTION_ROUTE_KEY, 409, { ok: false, error: validation.reason }, {
        state: 'blocked',
        reason: validation.reason || 'base_pack_invalid'
      });
      return;
    }
  }

  await updateCityPack(proposal.cityPackId, normalized.patch);
  await updateProposal(proposalId, {
    status: 'applied',
    appliedAt: new Date().toISOString()
  });
  await appendAudit({
    actor: context.actor,
    action: 'city_pack.proposal.apply',
    entityType: 'city_pack_update_proposal',
    entityId: proposalId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      cityPackId: proposal.cityPackId || null
    }
  });
  writeJson(res, ACTION_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, proposalId }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleCityPackUpdateProposals(req, res, bodyText, deps) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };
  let routeKey = LIST_ROUTE_KEY;

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-pack-update-proposals') {
      routeKey = LIST_ROUTE_KEY;
      await handleListProposals(req, res, context, deps);
      return;
    }
    if (req.method === 'GET') {
      const detailId = parseDetailPath(pathname);
      if (detailId) {
        routeKey = DETAIL_ROUTE_KEY;
        await handleGetProposal(req, res, context, detailId, deps);
        return;
      }
    }
    if (req.method === 'POST' && pathname === '/api/admin/city-pack-update-proposals') {
      routeKey = CREATE_ROUTE_KEY;
      await handleCreateProposal(req, res, bodyText, context, deps);
      return;
    }
    if (req.method === 'POST') {
      const action = parseActionPath(pathname);
      if (action && action.action === 'approve') {
        routeKey = ACTION_ROUTE_KEY;
        await handleApproveProposal(req, res, context, action.proposalId, deps);
        return;
      }
      if (action && action.action === 'reject') {
        routeKey = ACTION_ROUTE_KEY;
        await handleRejectProposal(req, res, context, action.proposalId, deps);
        return;
      }
      if (action && action.action === 'apply') {
        routeKey = ACTION_ROUTE_KEY;
        await handleApplyProposal(req, res, context, action.proposalId, deps);
        return;
      }
    }
    writeJson(res, routeKey, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found'
    });
  } catch (err) {
    logRouteError('admin.city_pack_update_proposals', err, context);
    writeJson(res, routeKey, 500, { ok: false, error: 'error' }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleCityPackUpdateProposals
};
