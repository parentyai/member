#!/usr/bin/env node
'use strict';

const { URL } = require('url');

function usage() {
  console.error('Usage: node scripts/phase22_run_gate_and_record.js [T04 args...] --write 1');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const entry = argv[i];
    if (!entry.startsWith('--')) continue;
    const eq = entry.indexOf('=');
    if (eq !== -1) {
      args[entry.slice(2, eq)] = entry.slice(eq + 1);
      continue;
    }
    const key = entry.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  if (args['track-base-url'] && !args.trackBaseUrl) {
    args.trackBaseUrl = args['track-base-url'];
  }
  return args;
}

function parseUrlHost(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.host || null;
  } catch (_err) {
    return null;
  }
}

function toWriteFlag(value) {
  if (value === true) return true;
  if (value === undefined || value === null) return false;
  const text = String(value).trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes';
}

function buildDocId(fromUtc, toUtc, ctaA, ctaB) {
  const raw = `${fromUtc}__${toUtc}__${ctaA}__${ctaB}`;
  return encodeURIComponent(raw);
}

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildRecord(output, exitCode, host) {
  const inputs = output && output.inputs ? output.inputs : {};
  const kpi = output && output.kpi ? output.kpi : {};
  return {
    fromUtc: inputs.from || null,
    toUtc: inputs.to || null,
    ctaA: inputs.ctaA || null,
    ctaB: inputs.ctaB || null,
    sentA: numberOrNull(kpi.sentA),
    clickA: numberOrNull(kpi.clickA),
    ctrA: numberOrNull(kpi.ctrA),
    sentB: numberOrNull(kpi.sentB),
    clickB: numberOrNull(kpi.clickB),
    ctrB: numberOrNull(kpi.ctrB),
    deltaCTR: numberOrNull(kpi.deltaCTR),
    gateExitCode: exitCode,
    result: output ? output.result : null,
    runs: inputs.runs !== undefined ? numberOrNull(inputs.runs) : null,
    linkRegistryId: inputs.linkRegistryId || null,
    trackBaseUrlHost: host,
    raw: output
  };
}

async function runGateAndRecord(argv, deps) {
  const args = parseArgs(argv);
  const write = toWriteFlag(args.write);

  const runner = deps && deps.runAndGate ? deps.runAndGate : require('./phase22_run_and_gate').runOrchestrator;
  const repo = deps && deps.snapshotsRepo ? deps.snapshotsRepo : require('../src/repos/firestore/kpiSnapshotsReadRepo');
  const logger = deps && deps.logger ? deps.logger : console;
  const hostParser = deps && deps.parseUrlHost ? deps.parseUrlHost : parseUrlHost;

  const result = runner(args);
  const exitCode = result.exitCode;
  const output = result.output;

  if (!output) {
    return { exitCode, output };
  }

  if (!write) {
    return { exitCode, output };
  }

  const inputs = output.inputs || {};
  const docId = buildDocId(inputs.from, inputs.to, inputs.ctaA, inputs.ctaB);
  const host = hostParser(inputs.trackBaseUrl);
  const record = buildRecord(output, exitCode, host);

  try {
    await repo.upsertSnapshot(docId, record);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (logger && logger.error) {
      logger.error(`OBS phase22_record result=error docId=${docId} message=${message}`);
    }
  }

  return { exitCode, output };
}

async function main() {
  const result = await runGateAndRecord(process.argv.slice(2));
  if (!result.output) {
    usage();
    process.exit(result.exitCode || 1);
  }
  process.stdout.write(JSON.stringify(result.output) + '\n');
  process.exit(result.exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  runGateAndRecord,
  buildDocId,
  buildRecord,
  parseUrlHost,
  parseArgs
};
