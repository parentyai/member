#!/usr/bin/env node
'use strict';

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

function toWriteFlag(value) {
  if (value === true) return true;
  if (value === undefined || value === null) return false;
  const text = String(value).trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes';
}

function buildInputs(args) {
  return {
    trackBaseUrl: args.trackBaseUrl || null,
    linkRegistryId: args.linkRegistryId || null,
    ctaA: args.ctaA || null,
    ctaB: args.ctaB || null,
    from: args.from || null,
    to: args.to || null,
    runs: args.runs || null
  };
}

function buildFallbackOutput(args, utc) {
  return {
    utc,
    inputs: buildInputs(args),
    kpi: null,
    gate: null,
    result: 'FAIL'
  };
}

async function runScheduled(argv, deps) {
  const args = parseArgs(argv);
  const nowIso = deps && deps.nowIso ? deps.nowIso : () => new Date().toISOString();
  const runAndGate = deps && deps.runAndGate ? deps.runAndGate : require('./phase22_run_and_gate').runOrchestrator;
  const runGateAndRecord = deps && deps.runGateAndRecord ? deps.runGateAndRecord : require('./phase22_run_gate_and_record').runGateAndRecord;

  let runResult;
  try {
    runResult = runAndGate(args);
  } catch (_err) {
    const output = buildFallbackOutput(args, nowIso());
    return { exitCode: 1, output };
  }

  if (!runResult || !runResult.output) {
    const output = buildFallbackOutput(args, nowIso());
    return { exitCode: 1, output };
  }

  if (runResult.exitCode !== 0) {
    return { exitCode: runResult.exitCode, output: runResult.output };
  }

  const write = toWriteFlag(args.write);
  if (!write) {
    return { exitCode: 0, output: runResult.output };
  }

  try {
    const recordResult = await runGateAndRecord(argv, { runAndGate: () => runResult });
    if (recordResult && recordResult.output) {
      return { exitCode: recordResult.exitCode, output: recordResult.output };
    }
    return { exitCode: runResult.exitCode, output: runResult.output };
  } catch (_err) {
    const output = buildFallbackOutput(args, nowIso());
    return { exitCode: 1, output };
  }
}

async function main() {
  const result = await runScheduled(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result.output) + '\n');
  process.exit(result.exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  runScheduled,
  parseArgs
};
