'use strict';

function parseBoolean(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback === true;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') return false;
  return fallback === true;
}

function parseArgs(argv, env) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const sourceEnv = env && typeof env === 'object' ? env : process.env;
  const out = {
    serviceUrl: sourceEnv.EMERGENCY_SERVICE_URL || sourceEnv.SERVICE_URL || '',
    jobToken: sourceEnv.CITY_PACK_JOB_TOKEN || '',
    runId: '',
    traceId: '',
    providerKeys: [],
    forceProviderKeys: [],
    forceRefresh: false,
    skipSummarize: false,
    timeoutMs: 20000
  };

  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const next = i + 1 < args.length ? args[i + 1] : '';
    if (key === '--service-url') {
      out.serviceUrl = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--job-token') {
      out.jobToken = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--run-id') {
      out.runId = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--trace-id') {
      out.traceId = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--provider-keys') {
      out.providerKeys = String(next || '').split(',').map((item) => item.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (key === '--force-provider-keys') {
      out.forceProviderKeys = String(next || '').split(',').map((item) => item.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (key === '--force-refresh') {
      out.forceRefresh = parseBoolean(next, false);
      i += 1;
      continue;
    }
    if (key === '--skip-summarize') {
      out.skipSummarize = parseBoolean(next, false);
      i += 1;
      continue;
    }
    if (key === '--timeout-ms') {
      const ms = Number(next);
      if (Number.isFinite(ms) && ms > 0) out.timeoutMs = Math.floor(ms);
      i += 1;
      continue;
    }
    throw new Error(`unknown arg: ${key}`);
  }

  if (!out.serviceUrl) throw new Error('serviceUrl required');
  if (!out.jobToken) throw new Error('jobToken required');
  out.serviceUrl = out.serviceUrl.replace(/\/+$/, '');
  if (!out.runId) out.runId = `emg_sync_${Date.now()}`;
  if (!out.traceId) out.traceId = `trace_emergency_sync_${Date.now()}`;
  return out;
}

function buildPayload(options) {
  return {
    runId: options.runId,
    traceId: options.traceId,
    providerKeys: options.providerKeys,
    forceProviderKeys: options.forceProviderKeys,
    forceRefresh: options.forceRefresh === true,
    skipSummarize: options.skipSummarize === true
  };
}

async function invokeEmergencySync(options, deps) {
  const impl = deps && typeof deps === 'object' ? deps : {};
  const fetchFn = typeof impl.fetchFn === 'function' ? impl.fetchFn : (typeof fetch === 'function' ? fetch : null);
  if (!fetchFn) throw new Error('fetch unavailable');

  const endpoint = `${options.serviceUrl}/internal/jobs/emergency-sync`;
  const body = JSON.stringify(buildPayload(options));

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  if (controller) timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-city-pack-job-token': options.jobToken,
        'x-trace-id': options.traceId
      },
      body,
      signal: controller ? controller.signal : undefined
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch (_err) {
      parsed = { ok: false, error: 'invalid_json_response', raw: text };
    }
    return {
      ok: response.ok && parsed && parsed.ok === true,
      status: response.status,
      endpoint,
      payload: buildPayload(options),
      response: parsed
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2), process.env);
    const result = await invokeEmergencySync(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    const output = {
      ok: false,
      error: err && err.message ? err.message : 'runner_error'
    };
    process.stdout.write(`${JSON.stringify(output)}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  buildPayload,
  invokeEmergencySync
};
