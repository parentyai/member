#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

function usage() {
  console.error('Usage: node scripts/phase22_kpi_snapshot_smoke.js --ctaA "openA" --ctaB "openB" --from "2026-02-05T00:00:00Z" --to "2026-02-06T00:00:00Z"');
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
  return args;
}

function headString(value, limit) {
  const text = value === undefined || value === null ? '' : String(value);
  if (!text) return '(empty)';
  return text.length > limit ? text.slice(0, limit) : text;
}

function stderrBytes(value) {
  if (value === undefined || value === null) return 0;
  return Buffer.byteLength(String(value), 'utf8');
}

function runSnapshot(ctaA, ctaB, fromUtc, toUtc, deps) {
  const execPath = deps && deps.execPath ? deps.execPath : process.execPath;
  const runner = deps && deps.spawnSync ? deps.spawnSync : spawnSync;
  const scriptPath = path.resolve(__dirname, 'phase22_cta_kpi_snapshot.js');
  const result = runner(execPath, [scriptPath, '--ctaA', ctaA, '--ctaB', ctaB, '--from', fromUtc, '--to', toUtc], {
    encoding: 'utf8'
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function buildPayload(args, runResult) {
  const utc = new Date().toISOString();
  const stdoutHead = headString(runResult.stdout, 200);
  const stderrHead = headString(runResult.stderr, 200);
  const bytes = stderrBytes(runResult.stderr);
  const ok = runResult.status === 0;

  return {
    utc,
    inputs: {
      ctaA: args.ctaA || null,
      ctaB: args.ctaB || null,
      from: args.from || null,
      to: args.to || null
    },
    ok,
    exitCode: runResult.status,
    stdoutHead,
    stderrHead,
    stderrBytes: bytes
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ctaA || !args.ctaB || !args.from || !args.to) {
    usage();
    process.exit(1);
  }

  const runResult = runSnapshot(args.ctaA, args.ctaB, args.from, args.to);
  const payload = buildPayload(args, runResult);
  process.stdout.write(JSON.stringify(payload) + '\n');
  process.exit(runResult.status === 0 ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  runSnapshot,
  buildPayload
};
