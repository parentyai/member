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

function normalizeSubReason(value) {
  if (!value) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > 200 ? text.slice(0, 200) : text;
}

function buildFailureOutput(args, utc, details) {
  const output = {
    utc,
    inputs: buildInputs(args),
    kpi: null,
    gate: null,
    result: 'FAIL',
    reasonCode: details.reasonCode,
    stage: details.stage
  };
  const subReason = normalizeSubReason(details.subReason);
  if (subReason) {
    output.subReason = subReason;
  }
  return output;
}

function ensureFailureDetails(output, details) {
  const next = Object.assign({}, output || {});
  next.reasonCode = details.reasonCode;
  next.stage = details.stage;
  const subReason = normalizeSubReason(details.subReason);
  if (subReason) {
    next.subReason = subReason;
  }
  return next;
}

function classifyMissing(output, exitCode) {
  const suffix = exitCode !== undefined ? `exitCode=${exitCode}` : undefined;
  if (!output || typeof output !== 'object') {
    return { reasonCode: 'RUNTIME_ERROR', stage: 'run_and_gate', subReason: suffix || 'missing output' };
  }
  if (output.kpi === null || output.kpi === undefined) {
    return { reasonCode: 'KPI_NULL', stage: 'kpi_snapshot', subReason: suffix };
  }
  if (output.gate === null || output.gate === undefined) {
    return { reasonCode: 'GATE_NULL', stage: 'kpi_gate', subReason: suffix };
  }
  return { reasonCode: 'SUBPROCESS_EXIT_NONZERO', stage: 'kpi_gate', subReason: suffix };
}

async function runScheduled(argv, deps) {
  // Failure paths (for taxonomy):
  // - missing args -> INVALID_ARGS @ parse_args
  // - runAndGate throws / missing output -> RUNTIME_ERROR @ run_and_gate
  // - runAndGate exitCode!=0 with kpi null -> KPI_NULL @ kpi_snapshot
  // - runAndGate exitCode!=0 with gate null -> GATE_NULL @ kpi_gate
  // - runAndGate exitCode!=0 with kpi+gate -> SUBPROCESS_EXIT_NONZERO @ kpi_gate
  // - record write throws / exitCode!=0 -> RUNTIME_ERROR or SUBPROCESS_EXIT_NONZERO @ record_write
  const args = parseArgs(argv);
  const required = ['trackBaseUrl', 'linkRegistryId', 'ctaA', 'ctaB', 'from', 'to'];
  const missing = required.filter((key) => !args[key]);
  if (missing.length > 0) {
    const output = buildFailureOutput(args, new Date().toISOString(), {
      reasonCode: 'INVALID_ARGS',
      stage: 'parse_args',
      subReason: `missing:${missing.join(',')}`
    });
    return { exitCode: 1, output };
  }
  const nowIso = deps && deps.nowIso ? deps.nowIso : () => new Date().toISOString();
  const runAndGate = deps && deps.runAndGate ? deps.runAndGate : require('./phase22_run_and_gate').runOrchestrator;
  const runGateAndRecord = deps && deps.runGateAndRecord ? deps.runGateAndRecord : require('./phase22_run_gate_and_record').runGateAndRecord;

  let runResult;
  try {
    runResult = await runAndGate(args);
  } catch (err) {
    const output = buildFailureOutput(args, nowIso(), {
      reasonCode: 'RUNTIME_ERROR',
      stage: 'run_and_gate',
      subReason: err && err.message ? err.message : 'run_and_gate threw'
    });
    return { exitCode: 1, output };
  }

  if (!runResult || !runResult.output) {
    const output = buildFailureOutput(args, nowIso(), {
      reasonCode: 'RUNTIME_ERROR',
      stage: 'run_and_gate',
      subReason: 'missing output'
    });
    return { exitCode: 1, output };
  }

  if (runResult.exitCode !== 0) {
    const details = classifyMissing(runResult.output, runResult.exitCode);
    return { exitCode: runResult.exitCode, output: ensureFailureDetails(runResult.output, details) };
  }

  const write = toWriteFlag(args.write);
  if (!write) {
    return { exitCode: 0, output: runResult.output };
  }

  try {
    const recordResult = await runGateAndRecord(argv, { runAndGate: () => runResult });
    if (recordResult && recordResult.output) {
      if (recordResult.exitCode !== 0) {
        const details = classifyMissing(recordResult.output, recordResult.exitCode);
        details.stage = 'record_write';
        return { exitCode: recordResult.exitCode, output: ensureFailureDetails(recordResult.output, details) };
      }
      return { exitCode: recordResult.exitCode, output: recordResult.output };
    }
    return { exitCode: runResult.exitCode, output: runResult.output };
  } catch (err) {
    const output = buildFailureOutput(args, nowIso(), {
      reasonCode: 'RUNTIME_ERROR',
      stage: 'record_write',
      subReason: err && err.message ? err.message : 'record write threw'
    });
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
