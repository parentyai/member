#!/usr/bin/env node
'use strict';

const path = require('path');

function usage() {
  console.error('Usage: node scripts/phase22_cta_kpi_snapshot.js --ctaA "openA" --ctaB "openB" --from "2026-02-05T00:00:00Z" --to "2026-02-06T00:00:00Z"');
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

function numberOrZero(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function computeCtr(click, sent) {
  if (!sent) return 0;
  return click / sent;
}

function buildSnapshot(stats, ctaA, ctaB, now) {
  const sentA = numberOrZero(stats && stats.sentCountA);
  const clickA = numberOrZero(stats && stats.clickCountA);
  const sentB = numberOrZero(stats && stats.sentCountB);
  const clickB = numberOrZero(stats && stats.clickCountB);
  const ctrA = computeCtr(clickA, sentA);
  const ctrB = computeCtr(clickB, sentB);
  const utc = (now ? new Date(now) : new Date()).toISOString();

  return {
    utc,
    ctaA,
    ctaB,
    sentA,
    clickA,
    ctrA,
    sentB,
    clickB,
    ctrB,
    deltaCTR: ctrA - ctrB
  };
}

async function runPhase20Stats(ctaA, ctaB, fromUtc, toUtc) {
  const statsPath = path.resolve(__dirname, 'phase20_cta_ab_stats.js');
  delete require.cache[statsPath];

  const originalArgv = process.argv;
  const originalLog = console.log;
  const originalError = console.error;
  const originalExit = process.exit;

  let output = null;
  const errors = [];
  let restored = false;

  const restore = () => {
    if (restored) return;
    restored = true;
    process.argv = originalArgv;
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      restore();
      reject(new Error('stats timeout'));
    }, 60000);

    console.log = (...args) => {
      if (output !== null) return;
      output = args.join(' ');
      clearTimeout(timeout);
      restore();
      resolve(output);
    };

    console.error = (...args) => {
      errors.push(args.join(' '));
    };

    process.exit = (code) => {
      const message = errors.join('\n') || `stats exit ${code}`;
      clearTimeout(timeout);
      restore();
      const err = new Error(message);
      err.exitCode = code;
      reject(err);
      throw err;
    };

    process.argv = ['node', statsPath, ctaA, ctaB, fromUtc, toUtc].filter(Boolean);

    try {
      require(statsPath);
    } catch (err) {
      if (err && err.exitCode !== undefined) return;
      clearTimeout(timeout);
      restore();
      reject(err);
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ctaA = args.ctaA;
  const ctaB = args.ctaB;
  const fromUtc = args.from;
  const toUtc = args.to;

  if (!ctaA || !ctaB || !fromUtc || !toUtc) {
    usage();
    process.exit(1);
  }

  let stats;
  try {
    const output = await runPhase20Stats(ctaA, ctaB, fromUtc, toUtc);
    stats = JSON.parse(output);
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  }

  const snapshot = buildSnapshot(stats, ctaA, ctaB);
  console.log(JSON.stringify(snapshot));
}

if (require.main === module) {
  main();
}

module.exports = {
  buildSnapshot,
  computeCtr,
  numberOrZero
};
