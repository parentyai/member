#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

function usage() {
  console.error('Usage: node scripts/phase22_run_and_gate.js --track-base-url "<url>" --linkRegistryId "<id>" --ctaA "openA" --ctaB "openB" --from "<utc>" --to "<utc>" --runs 2 --min-total-sent 2 --min-per-variant-sent 0 --min-total-click 0 --min-delta-ctr 0');
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

function runScript(scriptPath, args, input) {
  const result = spawnSync(process.execPath, [scriptPath].concat(args), {
    encoding: 'utf8',
    input
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function classifyExit(result) {
  if (!result) return 1;
  if (result.status === 2) return 2;
  if (result.stderr && result.stderr.includes('VERIFY_ENV_ERROR')) return 2;
  return 1;
}

function buildInputs(args) {
  return {
    trackBaseUrl: args.trackBaseUrl,
    linkRegistryId: args.linkRegistryId,
    ctaA: args.ctaA,
    ctaB: args.ctaB,
    from: args.from,
    to: args.to,
    runs: args.runs
  };
}

function buildGateArgs(args) {
  const keys = ['min-total-sent', 'min-per-variant-sent', 'min-total-click', 'min-delta-ctr'];
  const out = [];
  keys.forEach((key) => {
    if (args[key] !== undefined) {
      out.push(`--${key}`);
      out.push(String(args[key]));
    }
  });
  return out;
}

function buildResult(exitCode) {
  if (exitCode === 0) return 'PASS';
  if (exitCode === 2) return 'VERIFY_ENV_ERROR';
  return 'FAIL';
}

function defaultDeps() {
  const runnerPath = path.resolve(__dirname, 'phase22_run_day_window.js');
  const snapshotPath = path.resolve(__dirname, 'phase22_cta_kpi_snapshot.js');
  const gatePath = path.resolve(__dirname, 'phase22_kpi_gate.js');

  return {
    runRunner: (inputs) => {
      const args = [
        '--track-base-url', inputs.trackBaseUrl,
        '--linkRegistryId', inputs.linkRegistryId,
        '--ctaA', inputs.ctaA,
        '--ctaB', inputs.ctaB,
        '--from', inputs.from,
        '--to', inputs.to
      ];
      if (inputs.runs !== undefined) {
        args.push('--runs', String(inputs.runs));
      }
      return runScript(runnerPath, args);
    },
    runSnapshot: (inputs) => {
      const args = [
        '--ctaA', inputs.ctaA,
        '--ctaB', inputs.ctaB,
        '--from', inputs.from,
        '--to', inputs.to
      ];
      return runScript(snapshotPath, args);
    },
    runGate: (kpiJson, args) => {
      const gateArgs = ['--json', kpiJson].concat(buildGateArgs(args));
      return runScript(gatePath, gateArgs);
    }
  };
}

function runOrchestrator(args, deps) {
  const inputs = buildInputs(args);
  const missing = ['trackBaseUrl', 'linkRegistryId', 'ctaA', 'ctaB', 'from', 'to'].filter((key) => !inputs[key]);
  if (missing.length > 0) {
    usage();
    return { exitCode: 1, output: null };
  }

  const utc = new Date().toISOString();
  const runnerDeps = deps || defaultDeps();
  let kpi = null;
  let gate = null;

  try {
    const runnerResult = runnerDeps.runRunner(inputs);
    if (runnerResult.status !== 0) {
      const exitCode = classifyExit(runnerResult);
      return {
        exitCode,
        output: {
          utc,
          inputs,
          kpi,
          gate,
          result: buildResult(exitCode)
        }
      };
    }
  } catch (_err) {
    const exitCode = 1;
    return {
      exitCode,
      output: {
        utc,
        inputs,
        kpi,
        gate,
        result: buildResult(exitCode)
      }
    };
  }

  try {
    const snapshotResult = runnerDeps.runSnapshot(inputs);
    if (snapshotResult.status !== 0) {
      const exitCode = classifyExit(snapshotResult);
      return {
        exitCode,
        output: {
          utc,
          inputs,
          kpi,
          gate,
          result: buildResult(exitCode)
        }
      };
    }
    kpi = JSON.parse(snapshotResult.stdout);
  } catch (_err) {
    const exitCode = 1;
    return {
      exitCode,
      output: {
        utc,
        inputs,
        kpi,
        gate,
        result: buildResult(exitCode)
      }
    };
  }

  try {
    const gateResult = runnerDeps.runGate(JSON.stringify(kpi), args);
    gate = gateResult.stdout ? JSON.parse(gateResult.stdout) : null;
    const exitCode = gateResult.status === 0 ? 0 : classifyExit(gateResult);
    return {
      exitCode,
      output: {
        utc,
        inputs,
        kpi,
        gate,
        result: buildResult(exitCode)
      }
    };
  } catch (_err) {
    const exitCode = 1;
    return {
      exitCode,
      output: {
        utc,
        inputs,
        kpi,
        gate,
        result: buildResult(exitCode)
      }
    };
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runOrchestrator(args);
  if (!result.output) {
    process.exit(result.exitCode);
  }
  process.stdout.write(JSON.stringify(result.output) + '\n');
  process.exit(result.exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  runOrchestrator,
  buildGateArgs,
  classifyExit
};
