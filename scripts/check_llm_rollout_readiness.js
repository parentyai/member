'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.LLM_ROLLOUT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:8080',
    adminToken: process.env.ADMIN_OS_TOKEN || '',
    actor: process.env.LLM_ROLLOUT_ACTOR || 'llm_rollout_check',
    traceId: process.env.LLM_ROLLOUT_TRACE_ID || `llm_rollout_${Date.now()}`,
    windowDays: 7,
    requireReady: false,
    requireJobEntry: false,
    maxCompatShare: null,
    configJsonPath: '',
    summaryJsonPath: ''
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--base-url' && next) {
      args.baseUrl = next;
      i += 1;
      continue;
    }
    if (key === '--admin-token' && next) {
      args.adminToken = next;
      i += 1;
      continue;
    }
    if (key === '--actor' && next) {
      args.actor = next;
      i += 1;
      continue;
    }
    if (key === '--trace-id' && next) {
      args.traceId = next;
      i += 1;
      continue;
    }
    if (key === '--window-days' && next) {
      const value = Number(next);
      if (!Number.isFinite(value) || value <= 0) throw new Error('invalid --window-days');
      args.windowDays = Math.floor(value);
      i += 1;
      continue;
    }
    if (key === '--require-ready') {
      args.requireReady = true;
      continue;
    }
    if (key === '--require-job-entry') {
      args.requireJobEntry = true;
      continue;
    }
    if (key === '--max-compat-share' && next) {
      const value = Number(next);
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error('invalid --max-compat-share');
      }
      args.maxCompatShare = value;
      i += 1;
      continue;
    }
    if (key === '--config-json' && next) {
      args.configJsonPath = next;
      i += 1;
      continue;
    }
    if (key === '--summary-json' && next) {
      args.summaryJsonPath = next;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${key}`);
  }

  return args;
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function normalizeName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function toCountMap(rows, key) {
  const out = Object.create(null);
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const name = normalizeName(row[key]);
    if (!name) return;
    const count = Number.isFinite(Number(row.count)) ? Number(row.count) : 0;
    out[name] = count;
  });
  return out;
}

function hasBooleanKeys(payload, keys) {
  const target = payload && typeof payload === 'object' ? payload : {};
  const missing = [];
  keys.forEach((key) => {
    if (typeof target[key] !== 'boolean') missing.push(key);
  });
  return { ok: missing.length === 0, missing };
}

function buildReadinessReport(input, options) {
  const payload = input && typeof input === 'object' ? input : {};
  const configStatus = payload.configStatus && typeof payload.configStatus === 'object' ? payload.configStatus : {};
  const usageSummary = payload.usageSummary && typeof payload.usageSummary === 'object' ? payload.usageSummary : {};
  const releaseReadiness = usageSummary.releaseReadiness && typeof usageSummary.releaseReadiness === 'object'
    ? usageSummary.releaseReadiness
    : {};
  const gateAuditBaseline = usageSummary.gateAuditBaseline && typeof usageSummary.gateAuditBaseline === 'object'
    ? usageSummary.gateAuditBaseline
    : {};

  const opts = options && typeof options === 'object' ? options : {};
  const requiredEntryTypes = Array.isArray(opts.requiredEntryTypes)
    ? opts.requiredEntryTypes
    : (opts.requireJobEntry === true ? ['webhook', 'admin', 'compat', 'job'] : ['webhook', 'admin', 'compat']);
  const requiredGates = Array.isArray(opts.requiredGates)
    ? opts.requiredGates
    : ['kill_switch', 'url_guard', 'injection'];
  const requireReady = opts.requireReady === true;
  const requireJobEntry = opts.requireJobEntry === true;
  const maxCompatShare = Number.isFinite(Number(opts.maxCompatShare))
    ? Math.max(0, Math.min(1, Number(opts.maxCompatShare)))
    : null;

  const checks = [];
  const configGateCheck = hasBooleanKeys(configStatus, [
    'llmEnabled',
    'llmConciergeEnabled',
    'llmWebSearchEnabled',
    'llmStyleEngineEnabled',
    'llmBanditEnabled'
  ]);
  checks.push({
    id: 'config_flags_present',
    ok: configGateCheck.ok,
    detail: configGateCheck.ok ? 'ok' : `missing: ${configGateCheck.missing.join(',')}`
  });

  const releaseReadyTypeOk = typeof releaseReadiness.ready === 'boolean';
  checks.push({
    id: 'release_readiness_present',
    ok: releaseReadyTypeOk,
    detail: releaseReadyTypeOk ? 'ok' : 'summary.releaseReadiness.ready missing'
  });

  if (requireReady) {
    checks.push({
      id: 'release_ready_required',
      ok: releaseReadiness.ready === true,
      detail: releaseReadiness.ready === true
        ? 'ready=true'
        : `ready=${String(releaseReadiness.ready)} blockedBy=${JSON.stringify(releaseReadiness.blockedBy || [])}`
    });
  }

  const entryTypeMap = toCountMap(gateAuditBaseline.entryTypes, 'entryType');
  const gateCoverageMap = toCountMap(gateAuditBaseline.gatesCoverage, 'gate');

  const missingEntryTypes = requiredEntryTypes.filter((name) => !(normalizeName(name) in entryTypeMap));
  checks.push({
    id: 'entry_types_covered',
    ok: missingEntryTypes.length === 0,
    detail: missingEntryTypes.length === 0 ? 'ok' : `missing: ${missingEntryTypes.join(',')}`
  });
  if (requireJobEntry) {
    const jobCount = Number(entryTypeMap.job || 0);
    checks.push({
      id: 'job_entry_present',
      ok: jobCount > 0,
      detail: `job_count=${jobCount}`
    });
  }

  const missingGates = requiredGates.filter((name) => !(normalizeName(name) in gateCoverageMap));
  checks.push({
    id: 'gate_coverage_present',
    ok: missingGates.length === 0,
    detail: missingGates.length === 0 ? 'ok' : `missing: ${missingGates.join(',')}`
  });

  const callsTotal = Number.isFinite(Number(gateAuditBaseline.callsTotal)) ? Number(gateAuditBaseline.callsTotal) : 0;
  checks.push({
    id: 'gate_calls_total_positive',
    ok: callsTotal > 0,
    detail: `callsTotal=${callsTotal}`
  });
  const compatCount = Number(entryTypeMap.compat || 0);
  const totalEntryCount = Object.keys(entryTypeMap).reduce((sum, key) => {
    const value = Number(entryTypeMap[key] || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const compatShare = totalEntryCount > 0 ? compatCount / totalEntryCount : 0;
  if (maxCompatShare !== null) {
    checks.push({
      id: 'compat_share_within_limit',
      ok: totalEntryCount > 0 && compatShare <= maxCompatShare,
      detail: `compat_share=${compatShare.toFixed(4)} limit=${maxCompatShare.toFixed(4)} total_entry_count=${totalEntryCount}`
    });
  }

  const failedChecks = checks.filter((row) => row.ok !== true);
  return {
    ok: failedChecks.length === 0,
    checks,
    failedChecks,
    summary: {
      releaseReady: releaseReadiness.ready === true,
      blockedBy: Array.isArray(releaseReadiness.blockedBy) ? releaseReadiness.blockedBy : [],
      callsTotal,
      compatShare: Number(compatShare.toFixed(4)),
      entryTypes: entryTypeMap,
      gatesCoverage: gateCoverageMap
    }
  };
}

function requestJson(baseUrl, pathname, headers) {
  return new Promise((resolve, reject) => {
    const target = new URL(pathname, baseUrl);
    const client = target.protocol === 'https:' ? https : http;
    const req = client.request(target, {
      method: 'GET',
      headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, headers || {})
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const status = Number(res.statusCode || 0);
        let json = null;
        try {
          json = JSON.parse(body || '{}');
        } catch (_err) {
          reject(new Error(`invalid_json status=${status} path=${target.pathname}`));
          return;
        }
        if (status < 200 || status >= 300 || !json || json.ok !== true) {
          reject(new Error(`request_failed status=${status} path=${target.pathname} body=${body}`));
          return;
        }
        resolve(json);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function loadSnapshots(args) {
  if (args.configJsonPath || args.summaryJsonPath) {
    if (!args.configJsonPath || !args.summaryJsonPath) {
      throw new Error('both --config-json and --summary-json are required');
    }
    const configStatus = readJsonFile(args.configJsonPath);
    const usagePayload = readJsonFile(args.summaryJsonPath);
    const usageSummary = usagePayload && usagePayload.summary && typeof usagePayload.summary === 'object'
      ? usagePayload.summary
      : usagePayload;
    return { configStatus, usageSummary };
  }

  if (!args.adminToken) throw new Error('ADMIN_OS_TOKEN or --admin-token is required');
  const headers = {
    'x-admin-token': args.adminToken,
    'x-actor': args.actor,
    'x-trace-id': args.traceId
  };
  const configStatus = await requestJson(args.baseUrl, '/api/admin/llm/config/status', headers);
  const usagePayload = await requestJson(
    args.baseUrl,
    `/api/admin/os/llm-usage/summary?windowDays=${encodeURIComponent(String(args.windowDays))}`,
    headers
  );
  return {
    configStatus,
    usageSummary: usagePayload && usagePayload.summary && typeof usagePayload.summary === 'object'
      ? usagePayload.summary
      : {}
  };
}

async function runCli() {
  const args = parseArgs(process.argv);
  const snapshots = await loadSnapshots(args);
  const report = buildReadinessReport(snapshots, {
    requireReady: args.requireReady,
    requireJobEntry: args.requireJobEntry,
    maxCompatShare: args.maxCompatShare
  });
  const output = {
    ok: report.ok,
    requireReady: args.requireReady,
    requireJobEntry: args.requireJobEntry,
    maxCompatShare: args.maxCompatShare,
    source: args.configJsonPath && args.summaryJsonPath ? 'fixture' : 'api',
    checks: report.checks,
    summary: report.summary
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  runCli().catch((err) => {
    process.stderr.write(`llm rollout check failed: ${err && err.message ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  buildReadinessReport,
  loadSnapshots
};
