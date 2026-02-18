'use strict';

const crypto = require('crypto');
const sourceRefsRepo = require('../../repos/firestore/sourceRefsRepo');
const sourceEvidenceRepo = require('../../repos/firestore/sourceEvidenceRepo');
const sourceAuditRunsRepo = require('../../repos/firestore/sourceAuditRunsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

const DEFAULT_TIMEOUT_MS = 12000;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMillis(value) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

function addDays(baseDate, days) {
  const next = new Date(baseDate.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeMode(value) {
  const mode = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return mode === 'canary' ? 'canary' : 'scheduled';
}

function normalizeTargetSourceRefIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())));
}

function summarizeFailures(failureCounts) {
  return Array.from(failureCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key, count]) => `${key}:${count}`);
}

function classifyHttpResult(result) {
  if (!result || typeof result !== 'object') return 'error';
  if (result.type === 'timeout') return 'timeout';
  if (result.type === 'http_error') return 'http_error';
  if (result.type === 'redirect') return 'redirect';
  if (result.type === 'ok') return 'ok';
  return 'error';
}

async function fetchSource(sourceUrl, deps) {
  const fetchFn = deps && typeof deps.fetchFn === 'function' ? deps.fetchFn : (typeof fetch === 'function' ? fetch : null);
  if (!fetchFn) {
    return {
      type: 'error',
      statusCode: null,
      finalUrl: sourceUrl,
      bodyText: '',
      error: 'fetch unavailable'
    };
  }

  const timeoutMs = deps && Number.isFinite(Number(deps.timeoutMs)) ? Number(deps.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeoutHandle = null;
  if (controller) {
    timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const response = await fetchFn(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller ? controller.signal : undefined,
      headers: {
        'user-agent': 'Member-CityPack-Audit/1.0'
      }
    });
    const statusCode = Number.isFinite(Number(response.status)) ? Number(response.status) : null;
    const finalUrl = typeof response.url === 'string' && response.url ? response.url : sourceUrl;
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch (_err) {
      bodyText = '';
    }
    const type = response.ok ? (response.redirected ? 'redirect' : 'ok') : 'http_error';
    return { type, statusCode, finalUrl, bodyText, error: null };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return {
        type: 'timeout',
        statusCode: null,
        finalUrl: sourceUrl,
        bodyText: '',
        error: 'timeout'
      };
    }
    return {
      type: 'error',
      statusCode: null,
      finalUrl: sourceUrl,
      bodyText: '',
      error: err && err.message ? String(err.message) : 'error'
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function captureScreenshots(input, deps) {
  if (!deps || typeof deps.captureScreenshots !== 'function') return [];
  const output = await deps.captureScreenshots(input);
  if (!Array.isArray(output)) return [];
  return output.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
}

async function buildDiffSummary(input, deps) {
  if (!deps || typeof deps.summarizeDiff !== 'function') {
    return {
      llm_used: false,
      model: null,
      promptVersion: null,
      diffSummary: null
    };
  }
  const result = await deps.summarizeDiff(input);
  if (!result || typeof result !== 'object') {
    return {
      llm_used: false,
      model: null,
      promptVersion: null,
      diffSummary: null
    };
  }
  return {
    llm_used: Boolean(result.llm_used),
    model: typeof result.model === 'string' ? result.model : null,
    promptVersion: typeof result.promptVersion === 'string' ? result.promptVersion : null,
    diffSummary: typeof result.diffSummary === 'string' ? result.diffSummary : null
  };
}

function hashContent(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  return crypto.createHash('sha256').update(value).digest('hex');
}

function resolveNextStatus(sourceRef, result, diffDetected, nowMs) {
  if (toMillis(sourceRef && sourceRef.validUntil) <= nowMs) return 'blocked';
  if (result === 'http_error' || result === 'timeout' || result === 'error') return 'dead';
  if (diffDetected) return 'needs_review';
  return 'active';
}

async function runCityPackSourceAuditJob(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const now = payload.now instanceof Date ? payload.now : new Date();
  const nowMs = now.getTime();
  const mode = normalizeMode(payload.mode);
  const targetSourceRefIds = normalizeTargetSourceRefIds(payload.targetSourceRefIds);
  const actor = payload.actor || 'city_pack_audit_job';
  const traceId = payload.traceId || `trace-city-pack-${now.getTime()}`;
  const runId = typeof payload.runId === 'string' && payload.runId.trim() ? payload.runId.trim() : `cp_run_${now.getTime()}`;

  const getRun = deps && deps.getRun ? deps.getRun : sourceAuditRunsRepo.getRun;
  const saveRun = deps && deps.saveRun ? deps.saveRun : sourceAuditRunsRepo.saveRun;
  const listSourceRefs = deps && deps.listSourceRefs ? deps.listSourceRefs : sourceRefsRepo.listSourceRefs;
  const listSourceRefsForAudit = deps && deps.listSourceRefsForAudit ? deps.listSourceRefsForAudit : sourceRefsRepo.listSourceRefsForAudit;
  const updateSourceRef = deps && deps.updateSourceRef ? deps.updateSourceRef : sourceRefsRepo.updateSourceRef;
  const createEvidence = deps && deps.createEvidence ? deps.createEvidence : sourceEvidenceRepo.createEvidence;
  const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  const existingRun = await getRun(runId);
  if (existingRun && existingRun.endedAt) {
    return {
      ok: true,
      runId,
      mode: existingRun.mode || mode,
      startedAt: existingRun.startedAt || null,
      endedAt: existingRun.endedAt || null,
      processed: Number(existingRun.processed) || 0,
      succeeded: Number(existingRun.succeeded) || 0,
      failed: Number(existingRun.failed) || 0,
      failureTop3: Array.isArray(existingRun.failureTop3) ? existingRun.failureTop3 : [],
      traceId,
      idempotent: true
    };
  }

  await saveRun(runId, {
    runId,
    mode,
    traceId,
    startedAt: now.toISOString(),
    endedAt: null,
    processed: 0,
    succeeded: 0,
    failed: 0,
    failureTop3: [],
    targetSourceRefIds
  });

  let candidates = [];
  if (targetSourceRefIds.length) {
    const all = await listSourceRefs({ limit: 1000 });
    const map = new Map(all.map((item) => [item.id, item]));
    candidates = targetSourceRefIds.map((id) => map.get(id)).filter(Boolean);
  } else {
    candidates = await listSourceRefsForAudit({
      now,
      horizonDays: 14,
      limit: 500
    });
  }

  const failureCounts = new Map();
  let succeeded = 0;
  let failed = 0;

  for (const sourceRef of candidates) {
    try {
      const httpResult = await fetchSource(sourceRef.url, deps);
      const result = classifyHttpResult(httpResult);
      const contentHash = hashContent(httpResult.bodyText);
      const previousHash = typeof sourceRef.contentHash === 'string' ? sourceRef.contentHash : null;
      const diffDetected = Boolean(contentHash && previousHash && contentHash !== previousHash);
      const resolvedResult = diffDetected ? 'diff_detected' : result;

      const screenshotPaths = await captureScreenshots({
        sourceRefId: sourceRef.id,
        url: httpResult.finalUrl || sourceRef.url,
        runId,
        traceId,
        checkedAt: now.toISOString()
      }, deps);

      const llmSummary = await buildDiffSummary({
        sourceRef,
        previousHash,
        nextHash: contentHash,
        result: resolvedResult,
        finalUrl: httpResult.finalUrl || sourceRef.url,
        traceId
      }, deps);

      const evidence = await createEvidence({
        sourceRefId: sourceRef.id,
        checkedAt: now.toISOString(),
        result: resolvedResult,
        statusCode: httpResult.statusCode,
        finalUrl: httpResult.finalUrl || sourceRef.url,
        contentHash,
        screenshotPaths,
        diffSummary: llmSummary.diffSummary,
        traceId,
        llm_used: llmSummary.llm_used,
        model: llmSummary.model,
        promptVersion: llmSummary.promptVersion
      });

      const nextStatus = resolveNextStatus(sourceRef, resolvedResult, diffDetected, nowMs);
      await updateSourceRef(sourceRef.id, {
        status: nextStatus,
        lastResult: resolvedResult,
        lastCheckAt: now.toISOString(),
        contentHash,
        evidenceLatestId: evidence.id
      });

      succeeded += 1;
    } catch (err) {
      failed += 1;
      const key = err && err.message ? String(err.message) : 'error';
      failureCounts.set(key, (failureCounts.get(key) || 0) + 1);
      await updateSourceRef(sourceRef.id, {
        status: 'needs_review',
        lastResult: 'error',
        lastCheckAt: now.toISOString()
      });
      await createEvidence({
        sourceRefId: sourceRef.id,
        checkedAt: now.toISOString(),
        result: 'error',
        statusCode: null,
        finalUrl: sourceRef.url,
        contentHash: null,
        screenshotPaths: [],
        diffSummary: err && err.message ? String(err.message) : 'error',
        traceId,
        llm_used: false,
        model: null,
        promptVersion: null
      });
    }
  }

  const finishedAt = new Date().toISOString();
  const failureTop3 = summarizeFailures(failureCounts);

  await saveRun(runId, {
    endedAt: finishedAt,
    processed: candidates.length,
    succeeded,
    failed,
    failureTop3
  });

  await audit({
    actor,
    action: 'city_pack.source_audit.run',
    entityType: 'source_audit_run',
    entityId: runId,
    traceId,
    requestId: payload.requestId || null,
    payloadSummary: {
      mode,
      processed: candidates.length,
      succeeded,
      failed,
      failureTop3
    }
  });

  return {
    ok: true,
    runId,
    mode,
    startedAt: now.toISOString(),
    endedAt: finishedAt,
    processed: candidates.length,
    succeeded,
    failed,
    failureTop3,
    traceId,
    idempotent: false
  };
}

module.exports = {
  runCityPackSourceAuditJob,
  DEFAULT_TIMEOUT_MS,
  addDays
};
