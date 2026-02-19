'use strict';

const cityPackUpdateProposalsRepo = require('../../repos/firestore/cityPackUpdateProposalsRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

const ALLOWED_PATCH_KEYS = new Set([
  'targetingRules',
  'slots',
  'basePackId',
  'overrides',
  'sourceRefs',
  'validUntil',
  'metadata'
]);

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
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

async function handleListProposals(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const status = (url.searchParams.get('status') || '').trim() || null;
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const items = await cityPackUpdateProposalsRepo.listProposals({ status, limit });
  writeJson(res, 200, { ok: true, traceId: context.traceId, items });
}

async function handleGetProposal(req, res, context, proposalId) {
  const proposal = await cityPackUpdateProposalsRepo.getProposal(proposalId);
  if (!proposal) {
    writeJson(res, 404, { ok: false, error: 'proposal not found' });
    return;
  }
  writeJson(res, 200, { ok: true, traceId: context.traceId, item: proposal });
}

async function handleCreateProposal(req, res, bodyText, context) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const cityPackId = typeof payload.cityPackId === 'string' ? payload.cityPackId.trim() : '';
  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';
  if (!cityPackId || !summary) {
    writeJson(res, 400, { ok: false, error: 'cityPackId/summary required' });
    return;
  }
  const normalized = normalizeProposalPatch(payload.proposalPatch);
  if (!normalized.ok) {
    writeJson(res, 400, { ok: false, error: normalized.error, invalidKeys: normalized.invalidKeys });
    return;
  }
  const created = await cityPackUpdateProposalsRepo.createProposal({
    cityPackId,
    summary,
    proposalPatch: normalized.patch,
    traceId: context.traceId,
    requestId: payload.requestId || null,
    status: 'draft'
  });
  await appendAuditLog({
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
  writeJson(res, 201, { ok: true, traceId: context.traceId, proposalId: created.id });
}

async function handleApproveProposal(req, res, context, proposalId) {
  const proposal = await cityPackUpdateProposalsRepo.getProposal(proposalId);
  if (!proposal) {
    writeJson(res, 404, { ok: false, error: 'proposal not found' });
    return;
  }
  if (proposal.status !== 'draft') {
    writeJson(res, 409, { ok: false, error: 'proposal_not_draft' });
    return;
  }
  await cityPackUpdateProposalsRepo.updateProposal(proposalId, {
    status: 'approved',
    approvedAt: new Date().toISOString()
  });
  await appendAuditLog({
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
  writeJson(res, 200, { ok: true, traceId: context.traceId, proposalId });
}

async function handleRejectProposal(req, res, context, proposalId) {
  const proposal = await cityPackUpdateProposalsRepo.getProposal(proposalId);
  if (!proposal) {
    writeJson(res, 404, { ok: false, error: 'proposal not found' });
    return;
  }
  if (proposal.status === 'applied') {
    writeJson(res, 409, { ok: false, error: 'proposal_already_applied' });
    return;
  }
  await cityPackUpdateProposalsRepo.updateProposal(proposalId, {
    status: 'rejected'
  });
  await appendAuditLog({
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
  writeJson(res, 200, { ok: true, traceId: context.traceId, proposalId });
}

async function handleApplyProposal(req, res, context, proposalId) {
  const proposal = await cityPackUpdateProposalsRepo.getProposal(proposalId);
  if (!proposal) {
    writeJson(res, 404, { ok: false, error: 'proposal not found' });
    return;
  }
  if (proposal.status !== 'approved') {
    writeJson(res, 409, { ok: false, error: 'proposal_not_approved' });
    return;
  }
  const normalized = normalizeProposalPatch(proposal.proposalPatch);
  if (!normalized.ok) {
    writeJson(res, 409, { ok: false, error: normalized.error });
    return;
  }

  const cityPack = await cityPacksRepo.getCityPack(proposal.cityPackId);
  if (!cityPack) {
    writeJson(res, 404, { ok: false, error: 'city pack not found' });
    return;
  }

  if (normalized.patch.basePackId) {
    if (normalized.patch.basePackId === cityPack.id) {
      writeJson(res, 409, { ok: false, error: 'base_pack_self_reference' });
      return;
    }
    const basePack = await cityPacksRepo.getCityPack(normalized.patch.basePackId);
    const validation = cityPacksRepo.validateBasePackDepth(basePack);
    if (!validation.ok) {
      writeJson(res, 409, { ok: false, error: validation.reason });
      return;
    }
  }

  await cityPacksRepo.updateCityPack(proposal.cityPackId, normalized.patch);
  await cityPackUpdateProposalsRepo.updateProposal(proposalId, {
    status: 'applied',
    appliedAt: new Date().toISOString()
  });
  await appendAuditLog({
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
  writeJson(res, 200, { ok: true, traceId: context.traceId, proposalId });
}

async function handleCityPackUpdateProposals(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-pack-update-proposals') {
      await handleListProposals(req, res, context);
      return;
    }
    if (req.method === 'GET') {
      const detailId = parseDetailPath(pathname);
      if (detailId) {
        await handleGetProposal(req, res, context, detailId);
        return;
      }
    }
    if (req.method === 'POST' && pathname === '/api/admin/city-pack-update-proposals') {
      await handleCreateProposal(req, res, bodyText, context);
      return;
    }
    if (req.method === 'POST') {
      const action = parseActionPath(pathname);
      if (action && action.action === 'approve') {
        await handleApproveProposal(req, res, context, action.proposalId);
        return;
      }
      if (action && action.action === 'reject') {
        await handleRejectProposal(req, res, context, action.proposalId);
        return;
      }
      if (action && action.action === 'apply') {
        await handleApplyProposal(req, res, context, action.proposalId);
        return;
      }
    }
    writeJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    logRouteError('admin.city_pack_update_proposals', err, context);
    writeJson(res, 500, { ok: false, error: 'error' });
  }
}

module.exports = {
  handleCityPackUpdateProposals
};
