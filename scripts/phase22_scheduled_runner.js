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

function normalizeStderrHead(value) {
  if (value === undefined || value === null) return '';
  const lines = String(value).split(/\r?\n/).slice(0, 10).map((line) => {
    const trimmed = line.replace(/\s+$/g, '');
    return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
  });
  return lines.join('\n').trimEnd();
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
  if (details.failureClass) {
    output.failure_class = details.failureClass;
  }
  if (details.nextAction) {
    output.nextAction = details.nextAction;
  }
  if (details.errorSignature) {
    output.errorSignature = details.errorSignature;
  }
  if (details.stderrHead !== undefined) {
    output.stderrHead = details.stderrHead;
  }
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
  if (details.failureClass) {
    next.failure_class = details.failureClass;
  }
  if (details.nextAction) {
    next.nextAction = details.nextAction;
  }
  if (details.errorSignature) {
    next.errorSignature = details.errorSignature;
  }
  if (details.stderrHead !== undefined) {
    next.stderrHead = details.stderrHead;
  }
  const subReason = normalizeSubReason(details.subReason);
  if (subReason) {
    next.subReason = subReason;
  }
  return next;
}

function classifyByReasonCode(reasonCode) {
  if (reasonCode === 'INVALID_ARGS') {
    return {
      failureClass: 'CONFIG',
      nextAction: 'fix inputs/thresholds then rerun',
      errorSignature: 'INVALID_ARGS'
    };
  }
  if (reasonCode === 'SUBPROCESS_EXIT_NONZERO') {
    return {
      failureClass: 'IMPL',
      nextAction: 'check gate reasons + thresholds',
      errorSignature: 'SUBPROCESS_EXIT_NONZERO'
    };
  }
  if (reasonCode === 'RUNTIME_ERROR') {
    return {
      failureClass: 'IMPL',
      nextAction: 'inspect stderr + stack',
      errorSignature: 'RUNTIME_ERROR'
    };
  }
  if (reasonCode && reasonCode.includes('VERIFY_ENV_ERROR')) {
    return {
      failureClass: 'ENV',
      nextAction: 'fix auth/env then rerun',
      errorSignature: 'VERIFY_ENV_ERROR'
    };
  }
  return {
    failureClass: 'UNKNOWN',
    nextAction: 'inspect artifacts',
    errorSignature: reasonCode || 'UNKNOWN'
  };
}

function classifyKpiNull(stderrHead) {
  const head = stderrHead || '';
  const lower = head.toLowerCase();
  if (!head) {
    return {
      failureClass: 'UNKNOWN',
      nextAction: 'inspect artifacts',
      errorSignature: 'STDERR_EMPTY'
    };
  }
  if (head.includes('VERIFY_ENV_ERROR')) {
    return {
      failureClass: 'ENV',
      nextAction: 'fix auth/env then rerun',
      errorSignature: 'VERIFY_ENV_ERROR'
    };
  }
  if (head.includes('firebase-admin') && (head.includes('Cannot find module') || head.includes('missing'))) {
    return {
      failureClass: 'ENV',
      nextAction: 'fix auth/env then rerun',
      errorSignature: 'FIREBASE_ADMIN_MISSING'
    };
  }
  if (lower.includes('invalid_rapt') || lower.includes('reauth')) {
    return {
      failureClass: 'ENV',
      nextAction: 'fix auth/env then rerun',
      errorSignature: 'ADC_REAUTH_REQUIRED'
    };
  }
  if (head.includes('GOOGLE_APPLICATION_CREDENTIALS is set')) {
    return {
      failureClass: 'ENV',
      nextAction: 'fix auth/env then rerun',
      errorSignature: 'GAC_SET_GUARD'
    };
  }
  if (head.includes('Failed to read credentials') || head.includes('ENOTDIR')) {
    return {
      failureClass: 'ENV',
      nextAction: 'fix auth/env then rerun',
      errorSignature: 'BAD_CREDENTIALS_PATH'
    };
  }
  if (head.trim().startsWith('missing:') || head.includes('INVALID_ARGS')) {
    return {
      failureClass: 'CONFIG',
      nextAction: 'fix inputs/thresholds then rerun',
      errorSignature: 'INVALID_ARGS'
    };
  }
  return {
    failureClass: 'IMPL',
    nextAction: 'inspect script error and fix implementation',
    errorSignature: 'KPI_NULL_EXIT_1'
  };
}

function classifyMissing(output, exitCode, stderrHead) {
  const suffix = exitCode !== undefined ? `exitCode=${exitCode}` : undefined;
  if (!output || typeof output !== 'object') {
    const meta = classifyByReasonCode('RUNTIME_ERROR');
    return {
      reasonCode: 'RUNTIME_ERROR',
      stage: 'run_and_gate',
      subReason: suffix || 'missing output',
      failureClass: meta.failureClass,
      nextAction: meta.nextAction,
      errorSignature: meta.errorSignature,
      stderrHead
    };
  }
  if (output.kpi === null || output.kpi === undefined) {
    const meta = classifyKpiNull(stderrHead);
    return {
      reasonCode: 'KPI_NULL',
      stage: 'kpi_snapshot',
      subReason: suffix,
      failureClass: meta.failureClass,
      nextAction: meta.nextAction,
      errorSignature: meta.errorSignature,
      stderrHead
    };
  }
  if (output.gate === null || output.gate === undefined) {
    const meta = classifyByReasonCode('GATE_NULL');
    return {
      reasonCode: 'GATE_NULL',
      stage: 'kpi_gate',
      subReason: suffix,
      failureClass: meta.failureClass,
      nextAction: meta.nextAction,
      errorSignature: meta.errorSignature,
      stderrHead
    };
  }
  const meta = classifyByReasonCode('SUBPROCESS_EXIT_NONZERO');
  return {
    reasonCode: 'SUBPROCESS_EXIT_NONZERO',
    stage: 'kpi_gate',
    subReason: suffix,
    failureClass: meta.failureClass,
    nextAction: meta.nextAction,
    errorSignature: meta.errorSignature,
    stderrHead
  };
}

function extractStderrHead(runResult) {
  if (!runResult) return '';
  const raw = runResult.stderr
    || runResult.stderrHead
    || (runResult.output && runResult.output.stderrHead)
    || '';
  return normalizeStderrHead(raw);
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
      subReason: `missing:${missing.join(',')}`,
      failureClass: 'CONFIG',
      nextAction: 'fix inputs/thresholds then rerun',
      errorSignature: 'INVALID_ARGS',
      stderrHead: ''
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
      subReason: err && err.message ? err.message : 'run_and_gate threw',
      failureClass: 'IMPL',
      nextAction: 'inspect stderr + stack',
      errorSignature: 'RUNTIME_ERROR',
      stderrHead: ''
    });
    return { exitCode: 1, output };
  }

  if (!runResult || !runResult.output) {
    const output = buildFailureOutput(args, nowIso(), {
      reasonCode: 'RUNTIME_ERROR',
      stage: 'run_and_gate',
      subReason: 'missing output',
      failureClass: 'IMPL',
      nextAction: 'inspect stderr + stack',
      errorSignature: 'RUNTIME_ERROR',
      stderrHead: ''
    });
    return { exitCode: 1, output };
  }

  if (runResult.exitCode !== 0) {
    const stderrHead = extractStderrHead(runResult);
    const details = classifyMissing(runResult.output, runResult.exitCode, stderrHead);
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
        const stderrHead = extractStderrHead(recordResult);
        const details = classifyMissing(recordResult.output, recordResult.exitCode, stderrHead);
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
      subReason: err && err.message ? err.message : 'record write threw',
      failureClass: 'IMPL',
      nextAction: 'inspect stderr + stack',
      errorSignature: 'RUNTIME_ERROR',
      stderrHead: ''
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
