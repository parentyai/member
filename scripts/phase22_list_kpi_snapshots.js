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
  return args;
}

function normalizeOrder(value) {
  if (!value) return 'desc';
  const text = String(value).toLowerCase();
  if (text !== 'asc' && text !== 'desc') return null;
  return text;
}

function normalizeLimit(value) {
  if (value === undefined || value === null) return 20;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.max(1, Math.floor(num));
  return Math.min(200, rounded);
}

function buildFilters(args, order, limit) {
  return {
    ctaA: args.ctaA || null,
    ctaB: args.ctaB || null,
    from: args.from || null,
    to: args.to || null,
    limit,
    order
  };
}

async function runList(argv, deps) {
  const args = parseArgs(argv);
  const order = normalizeOrder(args.order);
  const limit = normalizeLimit(args.limit);

  if (!order || !limit) {
    return { exitCode: 1, output: null };
  }

  const repo = deps && deps.repo ? deps.repo : require('../src/repos/firestore/phase22KpiSnapshotsReadRepo');
  const logger = deps && deps.logger ? deps.logger : console;
  const nowIso = deps && deps.nowIso ? deps.nowIso : () => new Date().toISOString();

  try {
    const docs = await repo.listSnapshots({
      ctaA: args.ctaA,
      ctaB: args.ctaB,
      from: args.from,
      to: args.to,
      order,
      limit
    });
    const output = {
      utc: nowIso(),
      projectId: process.env.FIRESTORE_PROJECT_ID || null,
      filters: buildFilters(args, order, limit),
      count: docs.length,
      docs
    };
    return { exitCode: 0, output };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (logger && logger.error) logger.error(`LIST_ENV_ERROR: ${message}`);
    return { exitCode: 2, output: null };
  }
}

async function main() {
  const result = await runList(process.argv.slice(2));
  if (result.output) {
    process.stdout.write(JSON.stringify(result.output) + '\n');
    process.exit(result.exitCode);
  }
  process.exit(result.exitCode || 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  runList,
  parseArgs,
  normalizeLimit,
  normalizeOrder
};
