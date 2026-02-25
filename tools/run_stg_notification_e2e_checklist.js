'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const DEFAULT_BASE_URL = 'http://127.0.0.1:18080';
const DEFAULT_ACTOR = 'ops_stg_e2e';
const DEFAULT_TRACE_PREFIX = 'trace-stg-e2e';
const DEFAULT_OUT_DIR = 'artifacts/stg-notification-e2e';
const DEFAULT_ROUTE_ERROR_LIMIT = 20;
const DEFAULT_TRACE_LIMIT = 100;
const DEFAULT_FAIL_ON_MISSING_AUDIT_ACTIONS = false;
const SEGMENT_ACCEPTABLE_EXECUTE_REASONS = new Set([
  'send_failed',
  'notification_cap_blocked',
  'notification_policy_blocked'
]);

const SCENARIO_REQUIRED_AUDIT_ACTIONS = Object.freeze({
  product_readiness_gate: ['product_readiness.view'],
  llm_gate: ['llm_config.status.view', 'llm_disclaimer_rendered'],
  segment: ['segment_send.plan', 'segment_send.dry_run', 'segment_send.execute'],
  retry_queue: ['retry_queue.plan', 'retry_queue.execute'],
  kill_switch_block: ['kill_switch.plan', 'kill_switch.set', 'retry_queue.execute'],
  composer_cap_block: ['notifications.send.plan', 'notifications.send.execute']
});

const ADMIN_READINESS_ENDPOINTS = Object.freeze([
  { key: 'productReadiness', endpoint: '/api/admin/product-readiness', label: 'product-readiness' },
  { key: 'fallbackSummary', endpoint: '/api/admin/read-path-fallback-summary', label: 'read-path-fallback-summary' },
  { key: 'retentionRuns', endpoint: '/api/admin/retention-runs', label: 'retention-runs' },
  { key: 'structDriftBackfillRuns', endpoint: '/api/admin/struct-drift/backfill-runs', label: 'struct-drift/backfill-runs' },
  { key: 'osAlertsSummary', endpoint: '/api/admin/os/alerts/summary', label: 'os-alerts-summary' },
  { key: 'monitorInsights', endpoint: '/api/admin/monitor-insights?windowDays=7', label: 'monitor-insights' },
  { key: 'cityPacks', endpoint: '/api/admin/city-packs', label: 'city-packs' }
]);

const LLM_BLOCKED_STATUSES_WHEN_EXPECTED_ENABLED = new Set([
  'disabled',
  'llm_disabled',
  'adapter_missing',
  'OPENAI_API_KEY is not set',
  'consent_missing'
]);

function readValue(argv, index, label) {
  if (index >= argv.length) throw new Error(`${label} value required`);
  return argv[index];
}

function parseJsonArg(text, label) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be JSON object`);
    }
    return parsed;
  } catch (err) {
    if (err && typeof err.message === 'string' && err.message.includes('must be JSON object')) throw err;
    const loose = parseLooseSegmentQuery(text);
    if (loose) return loose;
    throw new Error(`${label} invalid JSON`);
  }
}

function parseLooseSegmentQuery(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/lineUserIds\s*:\s*\[([^\]]*)\]/i);
  if (!match) return null;
  const raw = match[1].trim();
  const ids = raw
    ? raw.split(/[,\s]+/).map((value) => value.trim()).filter(Boolean)
    : [];
  return { lineUserIds: ids };
}

function normalizeBaseUrl(value) {
  const input = (value || '').trim();
  if (!input) return DEFAULT_BASE_URL;
  return input.replace(/\/+$/, '');
}

function parsePositiveInt(value, label, min, max) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new Error(`${label} must be integer ${min}-${max}`);
  }
  return num;
}

function normalizeAdminTokenValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function readAdminTokenFromFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }
  const trimmedPath = filePath.trim();
  if (!trimmedPath) return '';
  try {
    const raw = fs.readFileSync(trimmedPath, 'utf8');
    return normalizeAdminTokenValue(raw);
  } catch (err) {
    throw new Error(`failed to read admin token file: ${trimmedPath}`);
  }
}

function parseArgs(argv, env) {
  const sourceEnv = env || process.env;
  const opts = {
    baseUrl: normalizeBaseUrl(sourceEnv.MEMBER_BASE_URL || sourceEnv.BASE_URL || DEFAULT_BASE_URL),
    adminToken: normalizeAdminTokenValue(sourceEnv.ADMIN_OS_TOKEN || ''),
    adminTokenFile: normalizeAdminTokenValue(sourceEnv.E2E_ADMIN_TOKEN_FILE || sourceEnv.ADMIN_OS_TOKEN_FILE || ''),
    adminTokenFileExplicit: false,
    internalJobToken: sourceEnv.CITY_PACK_JOB_TOKEN || '',
    actor: sourceEnv.E2E_ACTOR || DEFAULT_ACTOR,
    tracePrefix: sourceEnv.E2E_TRACE_PREFIX || DEFAULT_TRACE_PREFIX,
    projectId: sourceEnv.E2E_GCP_PROJECT_ID || sourceEnv.GCP_PROJECT_ID || '',
    fetchRouteErrors: sourceEnv.E2E_FETCH_ROUTE_ERRORS === '1',
    failOnRouteErrors: sourceEnv.E2E_FAIL_ON_ROUTE_ERRORS === '1',
    failOnMissingAuditActions: sourceEnv.E2E_FAIL_ON_MISSING_AUDIT_ACTIONS === '1',
    routeErrorLimit: sourceEnv.E2E_ROUTE_ERROR_LIMIT
      ? parsePositiveInt(sourceEnv.E2E_ROUTE_ERROR_LIMIT, 'E2E_ROUTE_ERROR_LIMIT', 1, 200)
      : DEFAULT_ROUTE_ERROR_LIMIT,
    traceLimit: sourceEnv.E2E_TRACE_LIMIT
      ? parsePositiveInt(sourceEnv.E2E_TRACE_LIMIT, 'E2E_TRACE_LIMIT', 1, 500)
      : DEFAULT_TRACE_LIMIT,
    segmentTemplateKey: sourceEnv.E2E_SEGMENT_TEMPLATE_KEY || '',
    segmentTemplateVersion: sourceEnv.E2E_SEGMENT_TEMPLATE_VERSION || '',
    segmentQuery: parseJsonArg(sourceEnv.E2E_SEGMENT_QUERY_JSON || '', 'E2E_SEGMENT_QUERY_JSON') || {},
    retryQueueId: sourceEnv.E2E_RETRY_QUEUE_ID || '',
    composerNotificationId: sourceEnv.E2E_COMPOSER_NOTIFICATION_ID || '',
    allowSkip: sourceEnv.E2E_ALLOW_SKIP === '1',
    autoSetAutomationMode: sourceEnv.E2E_AUTO_SET_AUTOMATION_MODE !== '0',
    skipSegment: sourceEnv.E2E_SKIP_SEGMENT === '1',
    skipRetry: sourceEnv.E2E_SKIP_RETRY === '1',
    skipKillSwitch: sourceEnv.E2E_SKIP_KILLSWITCH === '1',
    skipComposerCap: sourceEnv.E2E_SKIP_COMPOSER_CAP === '1',
    expectLlmEnabled: sourceEnv.E2E_EXPECT_LLM_ENABLED === '1',
    outFile: sourceEnv.E2E_OUT_FILE || '',
    mdOutFile: sourceEnv.E2E_MD_OUT_FILE || ''
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow-skip') {
      opts.allowSkip = true;
      continue;
    }
    if (arg === '--fetch-route-errors') {
      opts.fetchRouteErrors = true;
      continue;
    }
    if (arg === '--fail-on-route-errors') {
      opts.failOnRouteErrors = true;
      continue;
    }
    if (arg === '--fail-on-missing-audit-actions') {
      opts.failOnMissingAuditActions = true;
      continue;
    }
    if (arg === '--no-auto-set-automation-mode') {
      opts.autoSetAutomationMode = false;
      continue;
    }
    if (arg === '--skip-segment') {
      opts.skipSegment = true;
      continue;
    }
    if (arg === '--skip-retry') {
      opts.skipRetry = true;
      continue;
    }
    if (arg === '--skip-killswitch') {
      opts.skipKillSwitch = true;
      continue;
    }
    if (arg === '--skip-composer-cap') {
      opts.skipComposerCap = true;
      continue;
    }
    if (arg === '--expect-llm-enabled') {
      opts.expectLlmEnabled = true;
      continue;
    }

    if (arg === '--base-url') {
      opts.baseUrl = normalizeBaseUrl(readValue(argv, ++i, '--base-url'));
      continue;
    }
    if (arg === '--admin-token') {
      opts.adminToken = readValue(argv, ++i, '--admin-token');
      continue;
    }
    if (arg === '--admin-token-file') {
      opts.adminTokenFile = readValue(argv, ++i, '--admin-token-file');
      opts.adminTokenFileExplicit = true;
      continue;
    }
    if (arg === '--internal-job-token') {
      opts.internalJobToken = readValue(argv, ++i, '--internal-job-token');
      continue;
    }
    if (arg === '--actor') {
      opts.actor = readValue(argv, ++i, '--actor');
      continue;
    }
    if (arg === '--trace-prefix') {
      opts.tracePrefix = readValue(argv, ++i, '--trace-prefix');
      continue;
    }
    if (arg === '--project-id') {
      opts.projectId = readValue(argv, ++i, '--project-id').trim();
      continue;
    }
    if (arg === '--route-error-limit') {
      opts.routeErrorLimit = parsePositiveInt(readValue(argv, ++i, '--route-error-limit'), '--route-error-limit', 1, 200);
      continue;
    }
    if (arg === '--trace-limit') {
      opts.traceLimit = parsePositiveInt(readValue(argv, ++i, '--trace-limit'), '--trace-limit', 1, 500);
      continue;
    }
    if (arg === '--segment-template-key') {
      opts.segmentTemplateKey = readValue(argv, ++i, '--segment-template-key');
      continue;
    }
    if (arg === '--segment-template-version') {
      opts.segmentTemplateVersion = readValue(argv, ++i, '--segment-template-version');
      continue;
    }
    if (arg === '--segment-query-json') {
      opts.segmentQuery = parseJsonArg(readValue(argv, ++i, '--segment-query-json'), '--segment-query-json') || {};
      continue;
    }
    if (arg === '--retry-queue-id') {
      opts.retryQueueId = readValue(argv, ++i, '--retry-queue-id');
      continue;
    }
    if (arg === '--composer-notification-id') {
      opts.composerNotificationId = readValue(argv, ++i, '--composer-notification-id');
      continue;
    }
    if (arg === '--out-file') {
      opts.outFile = readValue(argv, ++i, '--out-file');
      continue;
    }
    if (arg === '--md-out') {
      opts.mdOutFile = readValue(argv, ++i, '--md-out');
      continue;
    }

    throw new Error(`unknown option: ${arg}`);
  }

  if (opts.adminTokenFileExplicit) {
    opts.adminToken = readAdminTokenFromFile(opts.adminTokenFile);
  }
  if (!opts.adminToken || opts.adminToken.trim().length === 0) {
    opts.adminToken = readAdminTokenFromFile(opts.adminTokenFile);
  }
  if (!opts.adminToken || opts.adminToken.trim().length === 0) {
    throw new Error('admin token required (ADMIN_OS_TOKEN, ADMIN_OS_TOKEN_FILE, --admin-token, --admin-token-file)');
  }
  if (opts.failOnRouteErrors) opts.fetchRouteErrors = true;
  if (typeof opts.failOnMissingAuditActions !== 'boolean') {
    opts.failOnMissingAuditActions = DEFAULT_FAIL_ON_MISSING_AUDIT_ACTIONS;
  }
  if (opts.fetchRouteErrors && (!opts.projectId || typeof opts.projectId !== 'string' || opts.projectId.trim().length === 0)) {
    throw new Error('project id required when --fetch-route-errors is enabled');
  }
  return opts;
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function utcCompact(value) {
  const iso = toIso(value) || new Date().toISOString();
  return iso.replace(/[-:TZ.]/g, '').slice(0, 14);
}

function sanitizeTracePart(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildTraceId(prefix, label, now) {
  const p = sanitizeTracePart(prefix || DEFAULT_TRACE_PREFIX) || DEFAULT_TRACE_PREFIX;
  const l = sanitizeTracePart(label || 'scenario') || 'scenario';
  return `${p}-${l}-${utcCompact(now || new Date())}`;
}

function pickHeadSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (_err) {
    return null;
  }
}

function buildRouteErrorLoggingFilter(traceId) {
  const token = String(traceId || '').trim();
  if (!token) return '';
  return `textPayload:\"[route_error]\" AND textPayload:\"traceId=${token}\"`;
}

function normalizeRouteErrorLines(raw, maxLines) {
  const text = typeof raw === 'string' ? raw : String(raw || '');
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (maxLines && maxLines > 0) return lines.slice(0, maxLines);
  return lines;
}

function extractExecErrorMessage(err) {
  if (!err) return 'unknown';
  if (typeof err.stderr === 'string' && err.stderr.trim().length > 0) return err.stderr.trim();
  if (err && err.message) return String(err.message);
  return 'unknown';
}

function fetchRouteErrors(ctx, traceId, execFn) {
  const projectId = ctx && typeof ctx.projectId === 'string' ? ctx.projectId.trim() : '';
  if (!ctx || ctx.fetchRouteErrors !== true) {
    return { ok: false, reason: 'disabled' };
  }
  if (!projectId) {
    return { ok: false, reason: 'project_id_missing' };
  }
  if (!traceId || String(traceId).trim().length === 0) {
    return { ok: false, reason: 'trace_id_missing' };
  }
  const filter = buildRouteErrorLoggingFilter(traceId);
  const runner = typeof execFn === 'function' ? execFn : execFileSync;
  try {
    const out = runner('gcloud', [
      'logging',
      'read',
      filter,
      '--project',
      projectId,
      '--limit',
      String(ctx.routeErrorLimit || DEFAULT_ROUTE_ERROR_LIMIT),
      '--format=value(textPayload)'
    ], { encoding: 'utf8' });
    const lines = normalizeRouteErrorLines(out, 10);
    return {
      ok: true,
      projectId,
      filter,
      count: lines.length,
      lines
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'gcloud_logging_read_failed',
      projectId,
      filter,
      error: extractExecErrorMessage(err)
    };
  }
}

function applyRouteErrorStrictGate(status, reason, routeErrors, strictMode) {
  const nextStatus = typeof status === 'string' ? status : 'PASS';
  const nextReason = typeof reason === 'string' && reason.length > 0 ? reason : null;
  if (strictMode !== true) {
    return { status: nextStatus, reason: nextReason };
  }
  if (!routeErrors) {
    return {
      status: 'FAIL',
      reason: nextReason || 'route_error_fetch_not_attempted'
    };
  }
  if (routeErrors.ok !== true) {
    const detail = typeof routeErrors.reason === 'string' && routeErrors.reason.length > 0
      ? routeErrors.reason
      : 'unknown';
    return {
      status: 'FAIL',
      reason: nextReason || `route_error_fetch_failed:${detail}`
    };
  }
  if (Number(routeErrors.count || 0) > 0) {
    return {
      status: 'FAIL',
      reason: nextReason || `route_error_detected:${routeErrors.count}`
    };
  }
  return { status: nextStatus, reason: nextReason };
}

async function apiRequest(ctx, method, endpoint, traceId, body, extraHeaders) {
  if (typeof fetch !== 'function') {
    throw new Error('global fetch unavailable; use Node 20+');
  }
  const headers = {
    'x-admin-token': ctx.adminToken,
    'x-actor': ctx.actor,
    'accept': 'application/json'
  };
  if (extraHeaders && typeof extraHeaders === 'object') {
    Object.keys(extraHeaders).forEach((key) => {
      const value = extraHeaders[key];
      if (value === undefined || value === null || value === '') return;
      headers[key] = String(value);
    });
  }
  if (traceId) headers['x-trace-id'] = traceId;
  const init = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json; charset=utf-8';
    init.body = JSON.stringify(body);
  }
  const url = `${ctx.baseUrl}${endpoint}`;
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_err) {
    json = null;
  }
  return {
    method,
    endpoint,
    url,
    status: response.status,
    okStatus: response.status >= 200 && response.status < 300,
    text,
    body: json
  };
}

function summarizeResponse(resp) {
  const body = resp && resp.body && typeof resp.body === 'object' ? resp.body : null;
  return {
    status: resp.status,
    ok: body ? body.ok : null,
    reason: body && typeof body.reason === 'string' ? body.reason : null,
    error: body && typeof body.error === 'string' ? body.error : null,
    traceId: body && typeof body.traceId === 'string' ? body.traceId : null,
    requestId: body && typeof body.requestId === 'string' ? body.requestId : null
  };
}

function pickPreferredTemplate(items) {
  const rows = Array.isArray(items) ? items : [];
  if (rows.length === 0) return null;
  const normalized = rows
    .filter((row) => row && typeof row.key === 'string' && row.key.trim().length > 0)
    .map((row) => ({
      key: row.key.trim(),
      e2ePreferred: row.key.toLowerCase().includes('e2e')
    }));
  if (normalized.length === 0) return null;
  const preferred = normalized.find((row) => row.e2ePreferred);
  return preferred ? preferred.key : normalized[0].key;
}

function pickUserSeed(items) {
  const rows = Array.isArray(items) ? items : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const lineUserId = typeof row.lineUserId === 'string' ? row.lineUserId.trim() : '';
    if (!lineUserId) continue;
    const scenarioKey = typeof row.scenarioKey === 'string' ? row.scenarioKey.trim() : '';
    const stepKey = typeof row.stepKey === 'string' ? row.stepKey.trim() : '';
    return {
      lineUserId,
      scenarioKey: scenarioKey || null,
      stepKey: stepKey || null
    };
  }
  return null;
}

async function resolveUserSeed(ctx, traceId, requestFn) {
  const request = typeof requestFn === 'function' ? requestFn : apiRequest;
  const endpoint = '/api/phase5/ops/users-summary?limit=100&snapshotMode=prefer&fallbackMode=allow&fallbackOnEmpty=true';
  const resp = await request(ctx, 'GET', endpoint, traceId);
  if (!resp.okStatus || !resp.body || typeof resp.body !== 'object') {
    return {
      seed: null,
      reason: 'users_summary_fetch_failed',
      response: summarizeResponse(resp)
    };
  }
  const seed = pickUserSeed(resp.body.items);
  if (!seed) {
    return {
      seed: null,
      reason: 'users_summary_seed_not_found',
      response: summarizeResponse(resp)
    };
  }
  return {
    seed,
    reason: null,
    response: summarizeResponse(resp)
  };
}

function hasSegmentLineUserIds(value) {
  if (!value || typeof value !== 'object') return false;
  if (!Array.isArray(value.lineUserIds)) return false;
  return value.lineUserIds.some((item) => typeof item === 'string' && item.trim().length > 0);
}

async function resolveSegmentTemplateKey(ctx, traceId, preferredKey, requestFn) {
  if (preferredKey && preferredKey.trim()) {
    return {
      templateKey: preferredKey.trim(),
      source: 'input',
      reason: null
    };
  }
  const request = typeof requestFn === 'function' ? requestFn : apiRequest;
  const resp = await request(ctx, 'GET', '/api/phase61/templates?status=active', traceId);
  if (!resp.okStatus || !resp.body || typeof resp.body !== 'object') {
    const bootstrap = await bootstrapSegmentTemplate(ctx, traceId, request);
    if (bootstrap.templateKey) return bootstrap;
    return {
      templateKey: '',
      source: 'auto',
      reason: 'segment_template_list_failed',
      response: summarizeResponse(resp)
    };
  }
  const picked = pickPreferredTemplate(resp.body.items);
  if (!picked) {
    const bootstrap = await bootstrapSegmentTemplate(ctx, traceId, request);
    if (bootstrap.templateKey) return bootstrap;
    return {
      templateKey: '',
      source: 'auto',
      reason: 'segment_template_not_found'
    };
  }
  return {
    templateKey: picked,
    source: 'auto',
    reason: null
  };
}

function buildE2eTemplateKey(traceId) {
  const compact = utcCompact(new Date());
  const base = sanitizeTracePart(traceId).replace(/-/g, '_').slice(0, 24) || 'auto';
  return `stg_e2e_${base}_${compact}`.slice(0, 64);
}

async function bootstrapSegmentTemplate(ctx, traceId, requestFn) {
  const request = typeof requestFn === 'function' ? requestFn : apiRequest;
  const templateKey = buildE2eTemplateKey(traceId);
  const createResp = await request(ctx, 'POST', '/api/phase61/templates', `${traceId}-template-bootstrap`, {
    key: templateKey,
    status: 'active',
    title: 'STG E2E auto template',
    body: 'stg-e2e segment bootstrap template'
  });
  if (!createResp.okStatus || !createResp.body || createResp.body.ok !== true) {
    return {
      templateKey: '',
      source: 'bootstrap',
      reason: 'segment_template_bootstrap_failed',
      response: summarizeResponse(createResp)
    };
  }
  return {
    templateKey,
    source: 'bootstrap',
    reason: null
  };
}

function rankComposerCandidates(items) {
  const rows = Array.isArray(items) ? items : [];
  return rows
    .filter((row) => row && typeof row.id === 'string' && row.id.trim().length > 0)
    .map((row) => ({
      id: row.id.trim(),
      title: typeof row.title === 'string' ? row.title : '',
      linkRegistryId: typeof row.linkRegistryId === 'string' ? row.linkRegistryId.trim() : '',
      scenarioKey: typeof row.scenarioKey === 'string' ? row.scenarioKey.trim() : '',
      stepKey: typeof row.stepKey === 'string' ? row.stepKey.trim() : '',
      e2ePreferred: (
        row.id.toLowerCase().includes('e2e')
        || (typeof row.title === 'string' && row.title.toLowerCase().includes('e2e'))
      )
    }))
    .sort((a, b) => {
      if (a.e2ePreferred === b.e2ePreferred) return 0;
      return a.e2ePreferred ? -1 : 1;
    });
}

function buildComposerBootstrapPayload(seed, traceId, scenarioSeed) {
  const marker = utcCompact(new Date());
  const baseTitle = seed && typeof seed.title === 'string' && seed.title.trim()
    ? seed.title.trim()
    : 'STG E2E composer bootstrap';
  const scenarioKey = scenarioSeed && typeof scenarioSeed.scenarioKey === 'string' && scenarioSeed.scenarioKey.trim()
    ? scenarioSeed.scenarioKey.trim()
    : (seed && typeof seed.scenarioKey === 'string' && seed.scenarioKey.trim() ? seed.scenarioKey.trim() : 'A');
  const stepKey = scenarioSeed && typeof scenarioSeed.stepKey === 'string' && scenarioSeed.stepKey.trim()
    ? scenarioSeed.stepKey.trim()
    : (seed && typeof seed.stepKey === 'string' && seed.stepKey.trim() ? seed.stepKey.trim() : '3mo');
  return {
    title: `${baseTitle} ${marker}`.slice(0, 120),
    body: 'stg-e2e composer cap block bootstrap notification',
    ctaText: 'open',
    linkRegistryId: seed && typeof seed.linkRegistryId === 'string' ? seed.linkRegistryId.trim() : '',
    scenarioKey,
    stepKey,
    target: { limit: 1 },
    sourceRefs: [`stg-e2e:${traceId}`]
  };
}

async function bootstrapComposerNotification(ctx, traceId, requestFn, seedCandidates) {
  const request = typeof requestFn === 'function' ? requestFn : apiRequest;
  const attempts = [];
  let candidates = Array.isArray(seedCandidates) ? seedCandidates : [];
  if (!candidates.length) {
    const listAllResp = await request(ctx, 'GET', '/api/admin/os/notifications/list?limit=100', `${traceId}-bootstrap-list`);
    attempts.push({ stage: 'list_all', response: summarizeResponse(listAllResp) });
    if (!listAllResp.okStatus || !listAllResp.body || typeof listAllResp.body !== 'object') {
      return {
        notificationId: '',
        source: 'bootstrap',
        reason: 'composer_notification_bootstrap_list_failed',
        attempts
      };
    }
    candidates = rankComposerCandidates(listAllResp.body.items);
  }

  let seed = candidates.find((row) => row && row.linkRegistryId);
  if (!seed) {
    const linkResp = await request(
      ctx,
      'POST',
      '/admin/link-registry',
      traceId,
      {
        title: `stg-e2e-bootstrap-${utcCompact(new Date())}`,
        url: `https://example.com/stg-e2e/${utcCompact(new Date())}`
      }
    );
    attempts.push({ stage: 'link_create', response: summarizeResponse(linkResp) });
    if (!linkResp.okStatus || !linkResp.body || linkResp.body.ok !== true || typeof linkResp.body.id !== 'string') {
      return {
        notificationId: '',
        source: 'bootstrap',
        reason: 'composer_notification_bootstrap_seed_missing',
        attempts
      };
    }
    seed = {
      id: '',
      title: 'stg e2e bootstrap',
      linkRegistryId: linkResp.body.id,
      e2ePreferred: true
    };
  }

  const scenarioSeedResult = await resolveUserSeed(ctx, `${traceId}-composer-seed`, request);
  attempts.push({
    stage: 'users_summary_seed',
    reason: scenarioSeedResult.reason || null,
    response: scenarioSeedResult.response || null,
    seed: scenarioSeedResult.seed || null
  });
  const draftPayload = buildComposerBootstrapPayload(seed, traceId, scenarioSeedResult.seed);
  const draftResp = await request(ctx, 'POST', '/api/admin/os/notifications/draft', traceId, draftPayload);
  attempts.push({ stage: 'draft', response: summarizeResponse(draftResp) });
  if (!draftResp.okStatus || !draftResp.body || draftResp.body.ok !== true || typeof draftResp.body.notificationId !== 'string') {
    return {
      notificationId: '',
      source: 'bootstrap',
      reason: 'composer_notification_bootstrap_draft_failed',
      attempts
    };
  }

  const notificationId = draftResp.body.notificationId.trim();
  const approveResp = await request(
    ctx,
    'POST',
    '/api/admin/os/notifications/approve',
    traceId,
    { notificationId }
  );
  attempts.push({ stage: 'approve', notificationId, response: summarizeResponse(approveResp) });
  if (!approveResp.okStatus || !approveResp.body || approveResp.body.ok !== true) {
    return {
      notificationId: '',
      source: 'bootstrap',
      reason: 'composer_notification_bootstrap_approve_failed',
      attempts
    };
  }

  const planProbeResp = await request(
    ctx,
    'POST',
    '/api/admin/os/notifications/send/plan',
    traceId,
    { notificationId }
  );
  attempts.push({ stage: 'plan_probe', notificationId, response: summarizeResponse(planProbeResp) });
  if (planProbeResp.okStatus && planProbeResp.body && planProbeResp.body.ok === true && typeof planProbeResp.body.planHash === 'string') {
    return {
      notificationId,
      source: 'bootstrap',
      reason: null,
      attempts
    };
  }

  return {
    notificationId: '',
    source: 'bootstrap',
    reason: 'composer_notification_bootstrap_not_plannable',
    attempts
  };
}

async function resolveComposerNotificationId(ctx, traceId, preferredId, requestFn) {
  if (preferredId && preferredId.trim()) {
    return {
      notificationId: preferredId.trim(),
      source: 'input',
      reason: null,
      attempts: []
    };
  }
  const request = typeof requestFn === 'function' ? requestFn : apiRequest;
  let listResp = await request(ctx, 'GET', '/api/admin/os/notifications/list?status=active&limit=100', traceId);
  let candidates = [];
  if (listResp.okStatus && listResp.body && typeof listResp.body === 'object') {
    candidates = rankComposerCandidates(listResp.body.items);
  } else {
    const fallbackResp = await request(ctx, 'GET', '/api/admin/os/notifications/list?limit=100', `${traceId}-list-fallback`);
    if (!fallbackResp.okStatus || !fallbackResp.body || typeof fallbackResp.body !== 'object') {
      return {
        notificationId: '',
        source: 'auto',
        reason: 'composer_notification_list_failed',
        response: summarizeResponse(listResp),
        attempts: [{ stage: 'list_fallback', response: summarizeResponse(fallbackResp) }]
      };
    }
    listResp = fallbackResp;
    candidates = rankComposerCandidates(fallbackResp.body.items);
  }
  if (candidates.length === 0) {
    const bootstrap = await bootstrapComposerNotification(ctx, traceId, request, candidates);
    if (bootstrap.notificationId) return bootstrap;
    return Object.assign({
      notificationId: '',
      source: 'auto',
      reason: 'composer_notification_not_found',
      attempts: []
    }, { attempts: Array.isArray(bootstrap.attempts) ? bootstrap.attempts : [] });
  }

  const attempts = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const planResp = await request(
      ctx,
      'POST',
      '/api/admin/os/notifications/send/plan',
      traceId,
      { notificationId: candidate.id }
    );
    const summary = summarizeResponse(planResp);
    attempts.push({ notificationId: candidate.id, response: summary });
    if (planResp.okStatus && planResp.body && planResp.body.ok === true && typeof planResp.body.planHash === 'string') {
      return {
        notificationId: candidate.id,
        source: 'auto',
        reason: null,
        attempts
      };
    }
  }

  const bootstrap = await bootstrapComposerNotification(ctx, traceId, request, candidates);
  if (bootstrap.notificationId) return bootstrap;

  return {
    notificationId: '',
    source: 'auto',
    reason: 'composer_notification_plannable_not_found',
    attempts: attempts.concat(Array.isArray(bootstrap.attempts) ? bootstrap.attempts : [])
  };
}

function requireHttpOk(resp, label) {
  if (!resp.okStatus) {
    const detail = summarizeResponse(resp);
    throw new Error(`${label} failed: http=${resp.status} reason=${detail.reason || detail.error || 'unknown'}`);
  }
  if (!resp.body || typeof resp.body !== 'object') {
    throw new Error(`${label} failed: non-json response`);
  }
  return resp.body;
}

async function fetchTraceBundle(ctx, traceId) {
  if (!traceId) return { ok: false, reason: 'trace_id_missing' };
  const limit = Number.isInteger(ctx && ctx.traceLimit) ? ctx.traceLimit : DEFAULT_TRACE_LIMIT;
  const resp = await apiRequest(
    ctx,
    'GET',
    `/api/admin/trace?traceId=${encodeURIComponent(traceId)}&limit=${encodeURIComponent(String(limit))}`,
    traceId
  );
  if (!resp.okStatus || !resp.body || typeof resp.body !== 'object') {
    return {
      ok: false,
      status: resp.status,
      reason: 'trace_fetch_failed',
      response: summarizeResponse(resp)
    };
  }
  const body = resp.body;
  return {
    ok: Boolean(body.ok),
    status: resp.status,
    audits: Array.isArray(body.audits) ? body.audits.length : 0,
    decisions: Array.isArray(body.decisions) ? body.decisions.length : 0,
    timeline: Array.isArray(body.timeline) ? body.timeline.length : 0,
    actions: Array.isArray(body.audits)
      ? body.audits
        .map((item) => item && item.action)
        .filter((item) => typeof item === 'string')
      : []
  };
}

function getRequiredAuditActionsForScenario(scenarioName) {
  const key = typeof scenarioName === 'string' ? scenarioName : '';
  const actions = SCENARIO_REQUIRED_AUDIT_ACTIONS[key];
  return Array.isArray(actions) ? actions.slice() : [];
}

function evaluateAuditActionCoverage(observedActions, requiredActions) {
  const required = Array.isArray(requiredActions) ? requiredActions.filter(Boolean) : [];
  const observedSet = new Set(
    (Array.isArray(observedActions) ? observedActions : [])
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
  );
  const missing = required.filter((action) => !observedSet.has(action));
  return {
    ok: missing.length === 0,
    required,
    missing
  };
}

function applyAuditCoverageGate(status, reason, coverage, strictMode) {
  const nextStatus = typeof status === 'string' ? status : 'PASS';
  const nextReason = typeof reason === 'string' && reason.length > 0 ? reason : null;
  if (strictMode !== true) {
    return { status: nextStatus, reason: nextReason };
  }
  if (!coverage || coverage.ok === true) {
    return { status: nextStatus, reason: nextReason };
  }
  const missing = Array.isArray(coverage.missing) ? coverage.missing.join(',') : '';
  return {
    status: 'FAIL',
    reason: nextReason || `missing_audit_actions:${missing || 'unknown'}`
  };
}

async function getAutomationConfig(ctx, traceId) {
  const resp = await apiRequest(ctx, 'GET', '/api/admin/os/automation-config/status', traceId);
  const body = requireHttpOk(resp, 'automation-config status');
  if (!body.config || typeof body.config !== 'object') {
    throw new Error('automation-config status missing config');
  }
  return body.config;
}

async function setAutomationConfigMode(ctx, traceId, mode, baseConfig) {
  const payload = {
    mode,
    allowScenarios: Array.isArray(baseConfig.allowScenarios) ? baseConfig.allowScenarios : [],
    allowSteps: Array.isArray(baseConfig.allowSteps) ? baseConfig.allowSteps : [],
    allowNextActions: Array.isArray(baseConfig.allowNextActions) ? baseConfig.allowNextActions : []
  };
  const planResp = await apiRequest(ctx, 'POST', '/api/admin/os/automation-config/plan', traceId, payload);
  const plan = requireHttpOk(planResp, 'automation-config plan');
  const setResp = await apiRequest(ctx, 'POST', '/api/admin/os/automation-config/set', traceId, {
    mode: payload.mode,
    allowScenarios: payload.allowScenarios,
    allowSteps: payload.allowSteps,
    allowNextActions: payload.allowNextActions,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken
  });
  requireHttpOk(setResp, 'automation-config set');
  return true;
}

async function getKillSwitchStatus(ctx, traceId) {
  const resp = await apiRequest(ctx, 'GET', '/api/admin/os/kill-switch/status', traceId);
  const body = requireHttpOk(resp, 'kill-switch status');
  return Boolean(body.killSwitch);
}

async function setKillSwitch(ctx, traceId, isOn) {
  const planResp = await apiRequest(ctx, 'POST', '/api/admin/os/kill-switch/plan', traceId, { isOn: Boolean(isOn) });
  const plan = requireHttpOk(planResp, 'kill-switch plan');
  const setResp = await apiRequest(ctx, 'POST', '/api/admin/os/kill-switch/set', traceId, {
    isOn: Boolean(isOn),
    planHash: plan.planHash,
    confirmToken: plan.confirmToken
  });
  requireHttpOk(setResp, 'kill-switch set');
  return true;
}

async function refreshOpsSnapshotsBestEffort(ctx, traceId) {
  const token = typeof ctx.internalJobToken === 'string' ? ctx.internalJobToken.trim() : '';
  if (!token) return { ok: false, reason: 'internal_job_token_missing' };
  const resp = await apiRequest(
    ctx,
    'POST',
    '/internal/jobs/ops-snapshot-build',
    traceId,
    {
      dryRun: false,
      scanLimit: 500,
      targets: ['dashboard_kpi', 'user_operational_summary', 'notification_operational_summary']
    },
    { 'x-city-pack-job-token': token }
  );
  if (!resp.okStatus || !resp.body || resp.body.ok !== true) {
    return { ok: false, reason: 'internal_snapshot_refresh_failed', response: summarizeResponse(resp) };
  }
  return { ok: true, response: summarizeResponse(resp) };
}

function normalizeNotificationCaps(caps) {
  const source = caps && typeof caps === 'object' ? caps : {};
  const quietHours = source.quietHours && typeof source.quietHours === 'object'
    ? {
        startHourUtc: source.quietHours.startHourUtc === null || source.quietHours.startHourUtc === undefined
          ? null
          : Number(source.quietHours.startHourUtc),
        endHourUtc: source.quietHours.endHourUtc === null || source.quietHours.endHourUtc === undefined
          ? null
          : Number(source.quietHours.endHourUtc)
      }
    : null;
  return {
    perUserWeeklyCap: source.perUserWeeklyCap === undefined ? null : source.perUserWeeklyCap,
    perUserDailyCap: source.perUserDailyCap === undefined ? null : source.perUserDailyCap,
    perCategoryWeeklyCap: source.perCategoryWeeklyCap === undefined ? null : source.perCategoryWeeklyCap,
    quietHours
  };
}

function buildActiveQuietHours(now) {
  const hour = (now instanceof Date ? now : new Date()).getUTCHours();
  return {
    startHourUtc: hour,
    endHourUtc: (hour + 1) % 24
  };
}

async function getSystemConfig(ctx, traceId) {
  const resp = await apiRequest(ctx, 'GET', '/api/admin/os/config/status', traceId);
  const body = requireHttpOk(resp, 'system-config status');
  return {
    servicePhase: body.servicePhase,
    notificationPreset: body.notificationPreset,
    notificationCaps: normalizeNotificationCaps(body.notificationCaps),
    deliveryCountLegacyFallback: body.deliveryCountLegacyFallback !== false
  };
}

async function setSystemConfig(ctx, traceId, config) {
  const payload = {
    servicePhase: config.servicePhase,
    notificationPreset: config.notificationPreset,
    notificationCaps: normalizeNotificationCaps(config.notificationCaps),
    deliveryCountLegacyFallback: config.deliveryCountLegacyFallback !== false
  };
  const planResp = await apiRequest(ctx, 'POST', '/api/admin/os/config/plan', traceId, payload);
  const plan = requireHttpOk(planResp, 'system-config plan');
  const setResp = await apiRequest(ctx, 'POST', '/api/admin/os/config/set', traceId, {
    servicePhase: payload.servicePhase,
    notificationPreset: payload.notificationPreset,
    notificationCaps: payload.notificationCaps,
    deliveryCountLegacyFallback: payload.deliveryCountLegacyFallback,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken
  });
  requireHttpOk(setResp, 'system-config set');
  return true;
}

async function resolveRetryQueueId(ctx, traceId, preferredId) {
  if (preferredId && preferredId.trim()) return preferredId.trim();
  const resp = await apiRequest(ctx, 'GET', '/api/phase73/retry-queue?limit=10', traceId);
  const body = requireHttpOk(resp, 'retry-queue list');
  const items = Array.isArray(body.items) ? body.items : [];
  const pending = items.find((item) => item && item.status === 'PENDING' && typeof item.id === 'string');
  return pending ? pending.id : '';
}

async function runSegmentScenario(ctx, opts, traceId) {
  if (opts.skipSegment) return { status: 'SKIP', reason: 'skip_segment_flag' };
  let resolvedSegmentQuery = opts.segmentQuery || {};
  let segmentSeed = null;
  if (!hasSegmentLineUserIds(resolvedSegmentQuery)) {
    const seedResult = await resolveUserSeed(ctx, `${traceId}-segment-seed`);
    if (seedResult.seed && seedResult.seed.lineUserId) {
      segmentSeed = seedResult.seed;
      resolvedSegmentQuery = Object.assign({}, resolvedSegmentQuery, {
        lineUserIds: [seedResult.seed.lineUserId]
      });
    }
  }
  const resolvedTemplate = await resolveSegmentTemplateKey(ctx, traceId, opts.segmentTemplateKey);
  if (!resolvedTemplate.templateKey) {
    return {
      status: 'SKIP',
      reason: resolvedTemplate.reason || 'segment_template_key_missing',
      templateKeySource: resolvedTemplate.source || 'auto'
    };
  }

  const payload = {
    templateKey: resolvedTemplate.templateKey,
    segmentQuery: resolvedSegmentQuery
  };
  if (opts.segmentTemplateVersion) payload.templateVersion = Number(opts.segmentTemplateVersion);

  const planResp = await apiRequest(ctx, 'POST', '/api/phase67/send/plan', traceId, payload);
  const plan = requireHttpOk(planResp, 'segment plan');
  const dryResp = await apiRequest(ctx, 'POST', '/api/phase81/segment-send/dry-run', traceId, payload);
  const dry = requireHttpOk(dryResp, 'segment dry-run');
  const executeResp = await apiRequest(ctx, 'POST', '/api/phase68/send/execute', traceId, {
    templateKey: payload.templateKey,
    templateVersion: payload.templateVersion,
    segmentQuery: payload.segmentQuery,
    planHash: plan.planHash,
    confirmToken: dry.confirmToken
  });
  const execute = requireHttpOk(executeResp, 'segment execute');

  if (execute.ok !== true && !SEGMENT_ACCEPTABLE_EXECUTE_REASONS.has(execute.reason)) {
    return {
      status: 'FAIL',
      reason: `segment_execute_not_ok:${execute.reason || 'unknown'}`,
      steps: {
        plan: summarizeResponse(planResp),
        dryRun: summarizeResponse(dryResp),
        execute: summarizeResponse(executeResp)
      }
    };
  }

  return {
    status: 'PASS',
    templateKey: payload.templateKey,
    templateKeySource: resolvedTemplate.source || 'input',
    segmentQuerySource: segmentSeed ? 'auto_user_seed' : 'input_or_default',
    steps: {
      plan: summarizeResponse(planResp),
      dryRun: summarizeResponse(dryResp),
      execute: summarizeResponse(executeResp)
    }
  };
}

async function runRetryScenario(ctx, opts, traceId) {
  if (opts.skipRetry) return { status: 'SKIP', reason: 'skip_retry_flag' };
  const queueId = await resolveRetryQueueId(ctx, traceId, opts.retryQueueId);
  if (!queueId) return { status: 'SKIP', reason: 'retry_queue_not_found' };

  const planResp = await apiRequest(ctx, 'POST', '/api/phase73/retry-queue/plan', traceId, { queueId });
  const plan = requireHttpOk(planResp, 'retry plan');
  const retryResp = await apiRequest(ctx, 'POST', '/api/phase73/retry-queue/retry', traceId, {
    queueId,
    planHash: plan.planHash,
    confirmToken: plan.confirmToken
  });
  const retryBody = requireHttpOk(retryResp, 'retry execute');

  const unexpectedReason = retryBody.ok === false
    && retryBody.reason !== 'send_failed'
    && retryBody.reason !== 'notification_cap_blocked'
    && retryBody.reason !== 'notification_policy_blocked';

  if (unexpectedReason) {
    return {
      status: 'FAIL',
      reason: `retry_execute_unexpected_reason:${retryBody.reason}`,
      steps: {
        plan: summarizeResponse(planResp),
        retry: summarizeResponse(retryResp)
      }
    };
  }

  return {
    status: 'PASS',
    queueId,
    steps: {
      plan: summarizeResponse(planResp),
      retry: summarizeResponse(retryResp)
    }
  };
}

async function runKillSwitchScenario(ctx, opts, traceId) {
  if (opts.skipKillSwitch) return { status: 'SKIP', reason: 'skip_killswitch_flag' };

  const queueId = await resolveRetryQueueId(ctx, traceId, opts.retryQueueId);
  if (!queueId) return { status: 'SKIP', reason: 'retry_queue_not_found_for_killswitch' };

  const baseline = await getKillSwitchStatus(ctx, traceId);
  const changed = !baseline;
  try {
    await setKillSwitch(ctx, traceId, true);
    const planResp = await apiRequest(ctx, 'POST', '/api/phase73/retry-queue/plan', traceId, { queueId });
    const plan = requireHttpOk(planResp, 'kill-switch retry plan');
    const retryResp = await apiRequest(ctx, 'POST', '/api/phase73/retry-queue/retry', traceId, {
      queueId,
      planHash: plan.planHash,
      confirmToken: plan.confirmToken
    });
    const retryBody = requireHttpOk(retryResp, 'kill-switch retry execute');
    if (retryBody.reason !== 'kill_switch_on') {
      return {
        status: 'FAIL',
        reason: `kill_switch_expected_block_got:${retryBody.reason || 'unknown'}`,
        queueId,
        steps: {
          plan: summarizeResponse(planResp),
          retry: summarizeResponse(retryResp)
        }
      };
    }
    return {
      status: 'PASS',
      queueId,
      steps: {
        plan: summarizeResponse(planResp),
        retry: summarizeResponse(retryResp)
      }
    };
  } finally {
    if (changed) {
      try {
        await setKillSwitch(ctx, traceId, false);
      } catch (_err) {
        // Keep scenario result as-is; restore failure will appear via smoke/manual checks.
      }
    }
  }
}

async function runComposerCapScenario(ctx, opts, traceId) {
  if (opts.skipComposerCap) return { status: 'SKIP', reason: 'skip_composer_cap_flag' };
  const resolved = await resolveComposerNotificationId(ctx, traceId, opts.composerNotificationId);
  if (!resolved.notificationId) {
    return {
      status: 'SKIP',
      reason: resolved.reason || 'composer_notification_id_missing',
      notificationIdSource: resolved.source || 'auto',
      resolveAttempts: Array.isArray(resolved.attempts) ? resolved.attempts.length : 0
    };
  }

  const statusResp = await apiRequest(
    ctx,
    'GET',
    `/api/admin/os/notifications/status?notificationId=${encodeURIComponent(resolved.notificationId)}`,
    traceId
  );
  const statusBody = requireHttpOk(statusResp, 'composer notification status');
  if (statusBody.status !== 'active') {
    return {
      status: 'FAIL',
      reason: `composer_notification_not_active:${statusBody.status || 'unknown'}`,
      notificationId: resolved.notificationId,
      notificationIdSource: resolved.source || 'input',
      steps: {
        status: summarizeResponse(statusResp)
      }
    };
  }

  const baseline = await getSystemConfig(ctx, `${traceId}-status`);
  const desiredCaps = normalizeNotificationCaps(baseline.notificationCaps);
  desiredCaps.quietHours = buildActiveQuietHours(new Date());

  let configChanged = false;
  try {
    await setSystemConfig(ctx, `${traceId}-set-cap`, {
      servicePhase: baseline.servicePhase,
      notificationPreset: baseline.notificationPreset,
      notificationCaps: desiredCaps,
      deliveryCountLegacyFallback: baseline.deliveryCountLegacyFallback
    });
    configChanged = true;

    const planResp = await apiRequest(ctx, 'POST', '/api/admin/os/notifications/send/plan', traceId, {
      notificationId: resolved.notificationId
    });
    const plan = requireHttpOk(planResp, 'composer send plan');

    const executeResp = await apiRequest(ctx, 'POST', '/api/admin/os/notifications/send/execute', traceId, {
      notificationId: resolved.notificationId,
      planHash: plan.planHash,
      confirmToken: plan.confirmToken
    });
    const execute = requireHttpOk(executeResp, 'composer send execute');
    if (execute.reason !== 'notification_cap_blocked') {
      return {
        status: 'FAIL',
        reason: `composer_expected_cap_block_got:${execute.reason || 'unknown'}`,
        notificationId: resolved.notificationId,
        notificationIdSource: resolved.source || 'input',
        steps: {
          plan: summarizeResponse(planResp),
          execute: summarizeResponse(executeResp)
        }
      };
    }
    return {
      status: 'PASS',
      notificationId: resolved.notificationId,
      notificationIdSource: resolved.source || 'input',
      resolveAttempts: Array.isArray(resolved.attempts) ? resolved.attempts.length : 0,
      steps: {
        plan: summarizeResponse(planResp),
        execute: summarizeResponse(executeResp)
      }
    };
  } finally {
    if (configChanged) {
      try {
        await setSystemConfig(ctx, `${traceId}-restore-cap`, baseline);
      } catch (_err) {
        // Restore best-effort.
      }
    }
  }
}

function joinBlockerCodes(blockers) {
  if (!Array.isArray(blockers)) return '';
  return blockers
    .map((item) => (item && typeof item.code === 'string' ? item.code.trim() : ''))
    .filter(Boolean)
    .join(',');
}

function evaluateProductReadinessBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'product_readiness_invalid_payload' };
  }
  if (body.status !== 'GO') {
    const blockerCodes = joinBlockerCodes(body.blockers);
    return {
      ok: false,
      reason: blockerCodes
        ? `product_readiness_no_go:${blockerCodes}`
        : 'product_readiness_no_go:unknown'
    };
  }
  const checks = body.checks && typeof body.checks === 'object' ? body.checks : null;
  if (!checks) {
    return { ok: false, reason: 'product_readiness_checks_missing' };
  }
  if (!checks.retentionRisk || checks.retentionRisk.ok !== true) {
    return { ok: false, reason: 'product_readiness_retention_not_ok' };
  }
  if (!checks.structureRisk || checks.structureRisk.ok !== true) {
    return { ok: false, reason: 'product_readiness_structure_not_ok' };
  }
  return { ok: true, reason: null };
}

async function runProductReadinessScenario(ctx, traceId) {
  const steps = {};
  const adminReadinessChecks = [];
  const snapshotRefresh = await refreshOpsSnapshotsBestEffort(ctx, traceId);
  steps.snapshotRefresh = snapshotRefresh.ok === true
    ? { ok: true, reason: null, error: null, status: 200 }
    : {
        ok: false,
        reason: snapshotRefresh.reason || null,
        error: snapshotRefresh.response && snapshotRefresh.response.error ? snapshotRefresh.response.error : null,
        status: snapshotRefresh.response && Number.isFinite(snapshotRefresh.response.status)
          ? snapshotRefresh.response.status
          : null
      };

  for (const endpoint of ADMIN_READINESS_ENDPOINTS) {
    const resp = await apiRequest(ctx, 'GET', endpoint.endpoint, traceId);
    steps[endpoint.key] = summarizeResponse(resp);
    const baseCheck = {
      endpoint: endpoint.endpoint,
      status: resp.status,
      ok: resp.okStatus
    };
    if (endpoint.key === 'monitorInsights' && resp.body && typeof resp.body === 'object') {
      adminReadinessChecks.push({
        ...baseCheck,
        resultRows: Number.isFinite(resp.body.resultRows) ? resp.body.resultRows : null,
        matchedDeliveryCount: Number.isFinite(resp.body.matchedDeliveryCount) ? resp.body.matchedDeliveryCount : null,
        dataSource: resp.body.dataSource || resp.body.source || null,
        asOf: typeof resp.body.asOf === 'string' ? resp.body.asOf : null,
        freshnessMinutes: Number.isFinite(resp.body.freshnessMinutes) ? resp.body.freshnessMinutes : null
      });
    } else {
      adminReadinessChecks.push(baseCheck);
    }

    if (!resp.okStatus) {
      return {
        status: 'FAIL',
        reason: `admin_readiness_endpoint_failed:${endpoint.endpoint}:http_${resp.status}`,
        adminReadinessChecks,
        steps
      };
    }

    if (endpoint.endpoint === '/api/admin/product-readiness') {
      const readinessBody = requireHttpOk(resp, 'product-readiness');
      const evaluation = evaluateProductReadinessBody(readinessBody);
      if (!evaluation.ok) {
        return {
          status: 'FAIL',
          reason: evaluation.reason,
          adminReadinessChecks,
          steps
        };
      }
    }
  }

  if (adminReadinessChecks.some((item) => item.ok !== true)) {
    return {
      status: 'FAIL',
      reason: 'admin_readiness_checks_not_all_ok',
      adminReadinessChecks,
      steps
    };
  }

  return {
    status: 'PASS',
    adminReadinessChecks,
    steps
  };
}

async function runLlmGateScenario(ctx, opts, traceId) {
  const expectLlmEnabled = Boolean(opts && opts.expectLlmEnabled === true);
  const statusResp = await apiRequest(ctx, 'GET', '/api/admin/llm/config/status', traceId);
  const statusBody = requireHttpOk(statusResp, 'llm config status');

  if (expectLlmEnabled) {
    const llmEnabledOk = statusBody.llmEnabled === true;
    const envFlagOk = statusBody.envLlmFeatureFlag === true;
    const effectiveOk = statusBody.effectiveEnabled === true;
    if (!llmEnabledOk || !envFlagOk || !effectiveOk) {
      return {
        status: 'FAIL',
        reason: `llm_gate_status_not_enabled:llmEnabled=${statusBody.llmEnabled === true ? 'true' : 'false'}:envLlmFeatureFlag=${statusBody.envLlmFeatureFlag === true ? 'true' : 'false'}:effectiveEnabled=${statusBody.effectiveEnabled === true ? 'true' : 'false'}`,
        steps: {
          llmConfigStatus: summarizeResponse(statusResp)
        }
      };
    }
  }

  const seedResult = await resolveUserSeed(ctx, `${traceId}-llm-seed`);
  const lineUserId = seedResult && seedResult.seed && typeof seedResult.seed.lineUserId === 'string' && seedResult.seed.lineUserId.trim().length > 0
    ? seedResult.seed.lineUserId.trim()
    : 'U_E2E_LLM_PROBE';
  const lineUserIdSource = lineUserId === 'U_E2E_LLM_PROBE' ? 'fallback_static' : 'auto_user_seed';

  const explainResp = await apiRequest(
    ctx,
    'GET',
    `/api/admin/llm/ops-explain?lineUserId=${encodeURIComponent(lineUserId)}`,
    traceId
  );
  const explainBody = requireHttpOk(explainResp, 'llm ops explain');
  const llmStatus = explainBody && typeof explainBody.llmStatus === 'string' ? explainBody.llmStatus.trim() : '';

  if (expectLlmEnabled && (!llmStatus || LLM_BLOCKED_STATUSES_WHEN_EXPECTED_ENABLED.has(llmStatus))) {
    return {
      status: 'FAIL',
      reason: `llm_gate_status_blocked:${llmStatus || 'missing'}`,
      lineUserId,
      lineUserIdSource,
      steps: {
        llmConfigStatus: summarizeResponse(statusResp),
        llmOpsExplain: summarizeResponse(explainResp)
      }
    };
  }

  return {
    status: 'PASS',
    lineUserId,
    lineUserIdSource,
    steps: {
      llmConfigStatus: summarizeResponse(statusResp),
      llmOpsExplain: summarizeResponse(explainResp)
    }
  };
}

function evaluateExitCode(results, allowSkip) {
  const items = Array.isArray(results) ? results : [];
  const hasFail = items.some((item) => item && item.status === 'FAIL');
  if (hasFail) return 1;
  const hasSkip = items.some((item) => item && item.status === 'SKIP');
  if (hasSkip && !allowSkip) return 1;
  return 0;
}

function renderMarkdownSummary(report) {
  const lines = [];
  lines.push('# STG Notification E2E Result');
  lines.push('');
  lines.push(`- UTC: ${report.endedAt}`);
  lines.push(`- baseUrl: ${report.baseUrl}`);
  lines.push(`- actor: ${report.actor}`);
  lines.push(`- headSha: ${report.headSha || 'unknown'}`);
  if (report.summary) {
    lines.push(`- traceLimit: ${report.summary.traceLimit || DEFAULT_TRACE_LIMIT}`);
    lines.push(`- strictAuditActions: ${report.summary.strictAuditActions === true ? 'true' : 'false'}`);
  }
  lines.push('');
  for (const scenario of report.scenarios || []) {
    lines.push(`## ${scenario.name}`);
    lines.push(`- status: ${scenario.status}`);
    lines.push(`- traceId: ${scenario.traceId || 'n/a'}`);
    if (scenario.reason) lines.push(`- reason: ${scenario.reason}`);
    const bundle = scenario.traceBundle || null;
    if (bundle) {
      lines.push(`- trace bundle: audits=${bundle.audits || 0} decisions=${bundle.decisions || 0} timeline=${bundle.timeline || 0}`);
    }
    if (Array.isArray(scenario.adminReadinessChecks) && scenario.adminReadinessChecks.length > 0) {
      lines.push('- admin readiness checks:');
      scenario.adminReadinessChecks.forEach((item) => {
        const isMonitorInsights = item && item.endpoint === '/api/admin/monitor-insights?windowDays=7';
        const extra = isMonitorInsights
          ? ` rows=${Number.isFinite(item.resultRows) ? item.resultRows : '-'} matched=${Number.isFinite(item.matchedDeliveryCount) ? item.matchedDeliveryCount : '-'} source=${item.dataSource || '-'} asOf=${item.asOf || '-'} freshness=${Number.isFinite(item.freshnessMinutes) ? item.freshnessMinutes : '-'}`
          : '';
        lines.push(`  - ${item.endpoint}: status=${item.status} ok=${item.ok === true ? 'true' : 'false'}${extra}`);
      });
    }
    const routeErrors = scenario.routeErrors || null;
    if (routeErrors) {
      if (routeErrors.ok) {
        lines.push(`- route_error logs: count=${routeErrors.count}`);
      } else {
        lines.push(`- route_error logs: unavailable (${routeErrors.reason || 'unknown'})`);
      }
    }
    if (Array.isArray(scenario.requiredAuditActions) && scenario.requiredAuditActions.length > 0) {
      lines.push(`- required audit actions: ${scenario.requiredAuditActions.join(', ')}`);
      if (Array.isArray(scenario.missingAuditActions) && scenario.missingAuditActions.length > 0) {
        lines.push(`- missing audit actions: ${scenario.missingAuditActions.join(', ')}`);
      }
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function runScenario(ctx, scenarioName, runner) {
  const traceId = buildTraceId(ctx.tracePrefix, scenarioName, new Date());
  const startedAt = new Date().toISOString();
  const requiredAuditActions = getRequiredAuditActionsForScenario(scenarioName);
  try {
    const result = await runner(traceId);
    const traceBundle = await fetchTraceBundle(ctx, traceId);
    const coverage = evaluateAuditActionCoverage(
      traceBundle && Array.isArray(traceBundle.actions) ? traceBundle.actions : [],
      requiredAuditActions
    );
    const shouldFetchRouteErrors = ctx.fetchRouteErrors === true
      && (result.status === 'FAIL' || ctx.failOnRouteErrors === true);
    const routeErrors = shouldFetchRouteErrors ? fetchRouteErrors(ctx, traceId) : null;
    const routeGate = applyRouteErrorStrictGate(
      result.status || 'PASS',
      result.reason || null,
      routeErrors,
      ctx.failOnRouteErrors === true
    );
    const strictGate = applyAuditCoverageGate(
      routeGate.status,
      routeGate.reason,
      coverage,
      ctx.failOnMissingAuditActions === true
    );
    return {
      name: scenarioName,
      traceId,
      startedAt,
      endedAt: new Date().toISOString(),
      status: strictGate.status,
      reason: strictGate.reason,
      steps: result.steps || null,
      queueId: result.queueId || null,
      adminReadinessChecks: Array.isArray(result.adminReadinessChecks) ? result.adminReadinessChecks : null,
      traceBundle,
      routeErrors,
      requiredAuditActions: coverage.required,
      missingAuditActions: coverage.missing
    };
  } catch (err) {
    const traceBundle = await fetchTraceBundle(ctx, traceId);
    const coverage = evaluateAuditActionCoverage(
      traceBundle && Array.isArray(traceBundle.actions) ? traceBundle.actions : [],
      requiredAuditActions
    );
    const routeErrors = fetchRouteErrors(ctx, traceId);
    const strictGate = applyAuditCoverageGate(
      'FAIL',
      err && err.message ? err.message : 'error',
      coverage,
      ctx.failOnMissingAuditActions === true
    );
    return {
      name: scenarioName,
      traceId,
      startedAt,
      endedAt: new Date().toISOString(),
      status: strictGate.status,
      reason: strictGate.reason,
      traceBundle,
      routeErrors,
      requiredAuditActions: coverage.required,
      missingAuditActions: coverage.missing
    };
  }
}

async function runAll(opts) {
  const startedAt = new Date().toISOString();
  const ctx = {
    baseUrl: opts.baseUrl,
    adminToken: opts.adminToken,
    internalJobToken: opts.internalJobToken || '',
    actor: opts.actor,
    tracePrefix: opts.tracePrefix,
    projectId: opts.projectId || '',
    fetchRouteErrors: opts.fetchRouteErrors === true,
    failOnRouteErrors: opts.failOnRouteErrors === true,
    failOnMissingAuditActions: opts.failOnMissingAuditActions === true,
    routeErrorLimit: opts.routeErrorLimit || DEFAULT_ROUTE_ERROR_LIMIT,
    traceLimit: opts.traceLimit || DEFAULT_TRACE_LIMIT
  };

  const scenarios = [];
  let automationRestoreConfig = null;
  if (opts.autoSetAutomationMode) {
    const automationTrace = buildTraceId(opts.tracePrefix, 'automation-setup', new Date());
    const current = await getAutomationConfig(ctx, automationTrace);
    if (current.mode !== 'EXECUTE') {
      await setAutomationConfigMode(ctx, automationTrace, 'EXECUTE', current);
      automationRestoreConfig = current;
    }
  }

  try {
    scenarios.push(await runScenario(ctx, 'product_readiness_gate', (traceId) => runProductReadinessScenario(ctx, traceId)));
    scenarios.push(await runScenario(ctx, 'llm_gate', (traceId) => runLlmGateScenario(ctx, opts, traceId)));
    scenarios.push(await runScenario(ctx, 'segment', (traceId) => runSegmentScenario(ctx, opts, traceId)));
    scenarios.push(await runScenario(ctx, 'retry_queue', (traceId) => runRetryScenario(ctx, opts, traceId)));
    scenarios.push(await runScenario(ctx, 'kill_switch_block', (traceId) => runKillSwitchScenario(ctx, opts, traceId)));
    scenarios.push(await runScenario(ctx, 'composer_cap_block', (traceId) => runComposerCapScenario(ctx, opts, traceId)));
  } finally {
    if (automationRestoreConfig) {
      const restoreTrace = buildTraceId(opts.tracePrefix, 'automation-restore', new Date());
      await setAutomationConfigMode(ctx, restoreTrace, automationRestoreConfig.mode, automationRestoreConfig);
    }
  }

  const endedAt = new Date().toISOString();
  const report = {
    startedAt,
    endedAt,
    baseUrl: opts.baseUrl,
    actor: opts.actor,
    headSha: pickHeadSha(),
    scenarios,
    summary: {
      pass: scenarios.filter((item) => item.status === 'PASS').length,
      fail: scenarios.filter((item) => item.status === 'FAIL').length,
      skip: scenarios.filter((item) => item.status === 'SKIP').length,
      strict: opts.allowSkip !== true,
      routeErrorFetchEnabled: opts.fetchRouteErrors === true,
      strictRouteErrors: opts.failOnRouteErrors === true,
      strictAuditActions: opts.failOnMissingAuditActions === true,
      traceLimit: opts.traceLimit || DEFAULT_TRACE_LIMIT,
      routeErrorFailures: scenarios.filter((item) => (
        item.status === 'FAIL'
        && typeof item.reason === 'string'
        && item.reason.startsWith('route_error_')
      )).length,
      auditCoverageFailures: scenarios.filter((item) => (
        item.status === 'FAIL'
        && typeof item.reason === 'string'
        && item.reason.startsWith('missing_audit_actions:')
      )).length
    }
  };
  return report;
}

function resolveOutFile(opts) {
  if (opts.outFile) return opts.outFile;
  const stamp = utcCompact(new Date());
  return path.join(DEFAULT_OUT_DIR, `stg-notification-e2e-${stamp}.json`);
}

function printSummary(report) {
  console.log('--- stg notification e2e summary ---');
  for (const scenario of report.scenarios) {
    const bundle = scenario.traceBundle || {};
    console.log(`${scenario.name}: ${scenario.status}${scenario.reason ? ` (${scenario.reason})` : ''}`);
    console.log(`  traceId=${scenario.traceId}`);
    console.log(`  audits=${bundle.audits || 0} decisions=${bundle.decisions || 0} timeline=${bundle.timeline || 0}`);
    if (Array.isArray(scenario.adminReadinessChecks) && scenario.adminReadinessChecks.length > 0) {
      scenario.adminReadinessChecks.forEach((item) => {
        console.log(`  admin_readiness_check ${item.endpoint}: status=${item.status} ok=${item.ok === true ? 'true' : 'false'}`);
      });
    }
    if (scenario.routeErrors) {
      if (scenario.routeErrors.ok) console.log(`  route_error_logs=${scenario.routeErrors.count}`);
      else console.log(`  route_error_logs=unavailable (${scenario.routeErrors.reason || 'unknown'})`);
    }
    if (Array.isArray(scenario.requiredAuditActions) && scenario.requiredAuditActions.length > 0) {
      console.log(`  required_audit_actions=${scenario.requiredAuditActions.join(',')}`);
      if (Array.isArray(scenario.missingAuditActions) && scenario.missingAuditActions.length > 0) {
        console.log(`  missing_audit_actions=${scenario.missingAuditActions.join(',')}`);
      }
    }
  }
  console.log(`pass=${report.summary.pass} fail=${report.summary.fail} skip=${report.summary.skip}`);
  if (report.summary.strictRouteErrors === true) {
    console.log(`route_error_failures=${report.summary.routeErrorFailures || 0}`);
  }
  if (report.summary.strictAuditActions === true) {
    console.log(`audit_action_failures=${report.summary.auditCoverageFailures || 0}`);
  }
}

async function main(argv) {
  const opts = parseArgs(argv, process.env);
  const report = await runAll(opts);
  const outFile = resolveOutFile(opts);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (opts.mdOutFile) {
    fs.mkdirSync(path.dirname(opts.mdOutFile), { recursive: true });
    fs.writeFileSync(opts.mdOutFile, renderMarkdownSummary(report), 'utf8');
  }

  printSummary(report);
  console.log(`report written: ${outFile}`);
  if (opts.mdOutFile) console.log(`markdown written: ${opts.mdOutFile}`);

  const exitCode = evaluateExitCode(report.scenarios, opts.allowSkip);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

module.exports = {
  parseArgs,
  buildTraceId,
  evaluateExitCode,
  renderMarkdownSummary,
  buildActiveQuietHours,
  normalizeNotificationCaps,
  resolveOutFile,
  buildRouteErrorLoggingFilter,
  fetchRouteErrors,
  applyRouteErrorStrictGate,
  evaluateAuditActionCoverage,
  getRequiredAuditActionsForScenario,
  applyAuditCoverageGate,
  evaluateProductReadinessBody,
  ADMIN_READINESS_ENDPOINTS,
  resolveSegmentTemplateKey,
  resolveComposerNotificationId
};

if (require.main === module) {
  main(process.argv).catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  });
}
