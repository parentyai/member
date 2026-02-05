#!/usr/bin/env node
'use strict';

const path = require('path');

function usage() {
  console.error('Usage: node scripts/phase22_run_day_window.js --track-base-url "<url>" --linkRegistryId "<id>" --ctaA "openA" --ctaB "openB" --from "<utc>" --to "<utc>" --runs 2');
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

function toInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.floor(num));
}

function classifyExit(output) {
  if (!output) return 1;
  if (output.includes('VERIFY_ENV_ERROR')) return 2;
  return 1;
}

function runScript(scriptPath, args) {
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, [scriptPath].concat(args), { encoding: 'utf8' });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function buildVerifyArgs(trackBaseUrl, linkRegistryId) {
  return ['--track-base-url', trackBaseUrl, '--linkRegistryId', linkRegistryId];
}

function buildKpiArgs(ctaA, ctaB, fromUtc, toUtc) {
  return ['--ctaA', ctaA, '--ctaB', ctaB, '--from', fromUtc, '--to', toUtc];
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const trackBaseUrl = args.trackBaseUrl;
  const linkRegistryId = args.linkRegistryId;
  const ctaA = args.ctaA;
  const ctaB = args.ctaB;
  const fromUtc = args.from;
  const toUtc = args.to;
  const runs = toInt(args.runs, 1);

  if (!trackBaseUrl || !linkRegistryId || !ctaA || !ctaB || !fromUtc || !toUtc) {
    usage();
    process.exit(1);
  }

  const verifyPath = path.resolve(__dirname, 'phase21_verify_day_window.js');
  const kpiPath = path.resolve(__dirname, 'phase22_cta_kpi_snapshot.js');

  for (let i = 0; i < runs; i += 1) {
    const result = runScript(verifyPath, buildVerifyArgs(trackBaseUrl, linkRegistryId));
    if (result.status !== 0) {
      const reason = classifyExit(result.stderr);
      if (result.stderr) console.error(result.stderr.trim());
      process.exit(reason);
    }
  }

  const kpiResult = runScript(kpiPath, buildKpiArgs(ctaA, ctaB, fromUtc, toUtc));
  if (kpiResult.status !== 0) {
    const reason = classifyExit(kpiResult.stderr || kpiResult.stdout);
    if (kpiResult.stderr) console.error(kpiResult.stderr.trim());
    process.exit(reason);
  }

  process.stdout.write(kpiResult.stdout.trim() + '\n');
  process.exit(0);
}

if (require.main === module) {
  run();
}

module.exports = {
  parseArgs,
  buildVerifyArgs,
  buildKpiArgs,
  runScript,
  classifyExit,
  run
};
