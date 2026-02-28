'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

function toNumber(value, name, fallback, min) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  if (typeof min === 'number' && n < min) throw new Error(`${name} must be >= ${min}`);
  return n;
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

function summarizeDurations(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return {
      min: null,
      max: null,
      avg: null,
      p50: null,
      p95: null,
      p99: null
    };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = sum / values.length;
  return {
    min: round(min),
    max: round(max),
    avg: round(avg),
    p50: round(percentile(values, 50)),
    p95: round(percentile(values, 95)),
    p99: round(percentile(values, 99))
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const raw = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith('--')) throw new Error(`unknown argument: ${key}`);
    const name = key.slice(2);
    if (name === 'help' || name === 'allow-status-mismatch') {
      raw[name] = true;
      continue;
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`missing value for --${name}`);
    raw[name] = value;
    i += 1;
  }

  const mode = raw.mode || 'post';
  if (mode !== 'post' && mode !== 'get') throw new Error('mode must be post|get');

  const opts = {
    baseUrl: raw['base-url'] || null,
    mode,
    deliveryId: raw['delivery-id'] || null,
    linkRegistryId: raw['link-registry-id'] || null,
    token: raw.token || null,
    count: toNumber(raw.count, 'count', 20, 1),
    warmup: toNumber(raw.warmup, 'warmup', 2, 0),
    timeoutMs: toNumber(raw['timeout-ms'], 'timeout-ms', 10000, 1),
    expectStatus: toNumber(raw['expect-status'], 'expect-status', 302, 100),
    maxP95Ms: raw['max-p95-ms'] === undefined ? null : toNumber(raw['max-p95-ms'], 'max-p95-ms', null, 1),
    bearerToken: raw['bearer-token'] || null,
    tracePrefix: raw['trace-prefix'] || 'trace-track-click-latency',
    allowStatusMismatch: Boolean(raw['allow-status-mismatch'])
  };

  if (!opts.baseUrl) throw new Error('--base-url is required');
  if (opts.mode === 'post' && (!opts.deliveryId || !opts.linkRegistryId)) {
    throw new Error('--delivery-id and --link-registry-id are required in post mode');
  }
  if (opts.mode === 'get' && !opts.token) {
    throw new Error('--token is required in get mode');
  }
  return opts;
}

function makeRequestPlan(opts, sequence) {
  const baseUrl = String(opts.baseUrl || '').replace(/\/$/, '');
  const path = opts.mode === 'post'
    ? '/track/click'
    : `/t/${encodeURIComponent(String(opts.token || ''))}`;
  const target = new URL(`${baseUrl}${path}`);
  const headers = {
    'x-request-id': `track-latency-${Date.now()}-${sequence}`,
    'x-trace-id': `${opts.tracePrefix}-${sequence}`
  };
  if (opts.bearerToken) headers.authorization = `Bearer ${opts.bearerToken}`;

  if (opts.mode === 'post') {
    const payload = JSON.stringify({
      deliveryId: opts.deliveryId,
      linkRegistryId: opts.linkRegistryId
    });
    headers['content-type'] = 'application/json; charset=utf-8';
    headers['content-length'] = Buffer.byteLength(payload);
    return {
      target,
      method: 'POST',
      headers,
      body: payload
    };
  }

  return {
    target,
    method: 'GET',
    headers,
    body: null
  };
}

function requestOnce(plan, timeoutMs) {
  return new Promise((resolve) => {
    const transport = plan.target.protocol === 'https:' ? https : http;
    const started = process.hrtime.bigint();
    const req = transport.request({
      protocol: plan.target.protocol,
      hostname: plan.target.hostname,
      port: plan.target.port || (plan.target.protocol === 'https:' ? 443 : 80),
      path: `${plan.target.pathname}${plan.target.search || ''}`,
      method: plan.method,
      headers: plan.headers
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
        resolve({
          statusCode: Number(res.statusCode || 0),
          durationMs: round(elapsedMs),
          error: null
        });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });

    req.on('error', (err) => {
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({
        statusCode: 0,
        durationMs: round(elapsedMs),
        error: err && err.message ? err.message : 'request_error'
      });
    });

    if (plan.body) req.write(plan.body);
    req.end();
  });
}

async function runProbe(opts) {
  const total = opts.count + opts.warmup;
  const samples = [];
  for (let i = 0; i < total; i += 1) {
    const plan = makeRequestPlan(opts, i + 1);
    const result = await requestOnce(plan, opts.timeoutMs);
    if (i >= opts.warmup) {
      samples.push({
        index: i - opts.warmup + 1,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        error: result.error
      });
    }
  }

  const durations = samples
    .map((sample) => sample.durationMs)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  const summary = summarizeDurations(durations);

  const statusCounts = samples.reduce((acc, sample) => {
    const key = String(sample.statusCode);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const mismatchCount = samples.filter((sample) => sample.statusCode !== opts.expectStatus).length;
  const stopReasons = [];
  if (mismatchCount > 0 && !opts.allowStatusMismatch) stopReasons.push('status_mismatch');
  if (opts.maxP95Ms !== null && summary.p95 !== null && summary.p95 > opts.maxP95Ms) {
    stopReasons.push('p95_exceeded');
  }

  return {
    generatedAtUtc: new Date().toISOString(),
    baseUrl: opts.baseUrl,
    mode: opts.mode,
    requestCount: opts.count,
    warmupCount: opts.warmup,
    expectStatus: opts.expectStatus,
    statusCounts,
    mismatchCount,
    latencyMs: summary,
    maxP95Ms: opts.maxP95Ms,
    stopReasons,
    samples
  };
}

function printHelp() {
  console.log([
    'Usage: node tools/track_click_latency_probe.js [options]',
    '',
    'Required:',
    '  --base-url <url>',
    '  --mode <post|get>                      (default: post)',
    '  post mode: --delivery-id <id> --link-registry-id <id>',
    '  get mode : --token <trackToken>',
    '',
    'Optional:',
    '  --count <n>                            (default: 20)',
    '  --warmup <n>                           (default: 2)',
    '  --timeout-ms <ms>                      (default: 10000)',
    '  --expect-status <code>                 (default: 302)',
    '  --max-p95-ms <ms>                      (no default)',
    '  --allow-status-mismatch                (default: false)',
    '  --bearer-token <token>                 (optional Authorization header)',
    '  --trace-prefix <prefix>                (default: trace-track-click-latency)',
    '  --help'
  ].join('\n'));
}

async function main(argv) {
  try {
    if (argv.includes('--help')) {
      printHelp();
      return 0;
    }
    const opts = parseArgs(argv);
    const report = await runProbe(opts);
    const output = Object.assign({}, report);
    delete output.samples;
    console.log(JSON.stringify(output, null, 2));
    if (report.stopReasons.length > 0) return 1;
    return 0;
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    console.error(message);
    return 1;
  }
}

if (require.main === module) {
  main(process.argv).then((exitCode) => {
    process.exit(exitCode);
  });
}

module.exports = {
  parseArgs,
  percentile,
  summarizeDurations,
  makeRequestPlan,
  requestOnce,
  runProbe,
  main
};

