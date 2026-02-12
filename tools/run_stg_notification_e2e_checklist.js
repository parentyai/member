'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_BASE_URL = 'http://127.0.0.1:18080';
const DEFAULT_ACTOR = 'ops_stg_e2e';
const DEFAULT_TRACE_PREFIX = 'trace-stg-e2e';
const DEFAULT_OUT_DIR = 'artifacts/stg-notification-e2e';

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
    throw new Error(`${label} invalid JSON`);
  }
}

function normalizeBaseUrl(value) {
  const input = (value || '').trim();
  if (!input) return DEFAULT_BASE_URL;
  return input.replace(/\/+$/, '');
}

function parseArgs(argv, env) {
  const sourceEnv = env || process.env;
  const opts = {
    baseUrl: normalizeBaseUrl(sourceEnv.MEMBER_BASE_URL || sourceEnv.BASE_URL || DEFAULT_BASE_URL),
    adminToken: sourceEnv.ADMIN_OS_TOKEN || '',
    actor: sourceEnv.E2E_ACTOR || DEFAULT_ACTOR,
    tracePrefix: sourceEnv.E2E_TRACE_PREFIX || DEFAULT_TRACE_PREFIX,
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
    outFile: sourceEnv.E2E_OUT_FILE || '',
    mdOutFile: sourceEnv.E2E_MD_OUT_FILE || ''
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow-skip') {
      opts.allowSkip = true;
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

    if (arg === '--base-url') {
      opts.baseUrl = normalizeBaseUrl(readValue(argv, ++i, '--base-url'));
      continue;
    }
    if (arg === '--admin-token') {
      opts.adminToken = readValue(argv, ++i, '--admin-token');
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

  if (!opts.adminToken || typeof opts.adminToken !== 'string' || opts.adminToken.trim().length === 0) {
    throw new Error('admin token required (ADMIN_OS_TOKEN or --admin-token)');
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

async function apiRequest(ctx, method, endpoint, traceId, body) {
  if (typeof fetch !== 'function') {
    throw new Error('global fetch unavailable; use Node 20+');
  }
  const headers = {
    'x-admin-token': ctx.adminToken,
    'x-actor': ctx.actor,
    'accept': 'application/json'
  };
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
  const resp = await apiRequest(ctx, 'GET', `/api/admin/trace?traceId=${encodeURIComponent(traceId)}&limit=100`, traceId);
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
  if (!opts.segmentTemplateKey) return { status: 'SKIP', reason: 'segment_template_key_missing' };

  const payload = {
    templateKey: opts.segmentTemplateKey,
    segmentQuery: opts.segmentQuery || {}
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

  if (execute.ok !== true) {
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

  const baseline = await getKillSwitchStatus(ctx, `${traceId}-status`);
  let changed = false;
  try {
    if (!baseline) {
      await setKillSwitch(ctx, `${traceId}-on`, true);
      changed = true;
    }
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
        await setKillSwitch(ctx, `${traceId}-restore`, false);
      } catch (_err) {
        // Keep scenario result as-is; restore failure will appear via smoke/manual checks.
      }
    }
  }
}

async function runComposerCapScenario(ctx, opts, traceId) {
  if (opts.skipComposerCap) return { status: 'SKIP', reason: 'skip_composer_cap_flag' };
  if (!opts.composerNotificationId) return { status: 'SKIP', reason: 'composer_notification_id_missing' };

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
      notificationId: opts.composerNotificationId
    });
    const plan = requireHttpOk(planResp, 'composer send plan');

    const executeResp = await apiRequest(ctx, 'POST', '/api/admin/os/notifications/send/execute', traceId, {
      notificationId: opts.composerNotificationId,
      planHash: plan.planHash,
      confirmToken: plan.confirmToken
    });
    const execute = requireHttpOk(executeResp, 'composer send execute');
    if (execute.reason !== 'notification_cap_blocked') {
      return {
        status: 'FAIL',
        reason: `composer_expected_cap_block_got:${execute.reason || 'unknown'}`,
        steps: {
          plan: summarizeResponse(planResp),
          execute: summarizeResponse(executeResp)
        }
      };
    }
    return {
      status: 'PASS',
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
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function runScenario(ctx, scenarioName, runner) {
  const traceId = buildTraceId(ctx.tracePrefix, scenarioName, new Date());
  const startedAt = new Date().toISOString();
  try {
    const result = await runner(traceId);
    const traceBundle = await fetchTraceBundle(ctx, traceId);
    return {
      name: scenarioName,
      traceId,
      startedAt,
      endedAt: new Date().toISOString(),
      status: result.status || 'PASS',
      reason: result.reason || null,
      steps: result.steps || null,
      queueId: result.queueId || null,
      traceBundle
    };
  } catch (err) {
    const traceBundle = await fetchTraceBundle(ctx, traceId);
    return {
      name: scenarioName,
      traceId,
      startedAt,
      endedAt: new Date().toISOString(),
      status: 'FAIL',
      reason: err && err.message ? err.message : 'error',
      traceBundle
    };
  }
}

async function runAll(opts) {
  const startedAt = new Date().toISOString();
  const ctx = {
    baseUrl: opts.baseUrl,
    adminToken: opts.adminToken,
    actor: opts.actor,
    tracePrefix: opts.tracePrefix
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
      strict: opts.allowSkip !== true
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
  }
  console.log(`pass=${report.summary.pass} fail=${report.summary.fail} skip=${report.summary.skip}`);
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
  resolveOutFile
};

if (require.main === module) {
  main(process.argv).catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  });
}
