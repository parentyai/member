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

function toNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function buildParams(args) {
  return {
    minTotalSent: toNumber(args['min-total-sent'], 2),
    minPerVariantSent: toNumber(args['min-per-variant-sent'], 0),
    minTotalClick: toNumber(args['min-total-click'], 0),
    minDeltaCtr: toNumber(args['min-delta-ctr'], 0)
  };
}

function requiredKeys() {
  return ['sentA', 'sentB', 'clickA', 'clickB', 'ctrA', 'ctrB', 'deltaCTR'];
}

function evaluateKpi(kpi, params) {
  const reasons = [];
  const missing = requiredKeys().filter((key) => !Object.prototype.hasOwnProperty.call(kpi || {}, key));
  if (missing.length > 0) {
    missing.forEach((key) => reasons.push(`missing:${key}`));
    return { ok: false, reasons };
  }

  const sentA = toNumber(kpi.sentA, 0);
  const sentB = toNumber(kpi.sentB, 0);
  const clickA = toNumber(kpi.clickA, 0);
  const clickB = toNumber(kpi.clickB, 0);
  const deltaCTR = toNumber(kpi.deltaCTR, 0);

  const totalSent = sentA + sentB;
  const totalClick = clickA + clickB;

  if (totalSent < params.minTotalSent) reasons.push('total_sent_lt_min');
  if (sentA < params.minPerVariantSent) reasons.push('sentA_lt_min');
  if (sentB < params.minPerVariantSent) reasons.push('sentB_lt_min');
  if (totalClick < params.minTotalClick) reasons.push('total_click_lt_min');
  if (deltaCTR < params.minDeltaCtr) reasons.push('delta_ctr_lt_min');

  return { ok: reasons.length === 0, reasons };
}

function safeParseJson(text) {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (err) {
    return { value: null, error: err };
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function readInputText(args, io) {
  if (args.json) return { text: args.json, source: 'arg' };
  try {
    const text = await io.readStdin();
    return { text, source: 'stdin' };
  } catch (_err) {
    const error = new Error('stdin read error');
    error.code = 'STDIN_READ_ERROR';
    throw error;
  }
}

function buildOutput(ok, reasons, params, kpi) {
  return {
    ok,
    reasons,
    params,
    kpi
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const params = buildParams(args);

  let input;
  try {
    input = await readInputText(args, { readStdin });
  } catch (err) {
    const output = buildOutput(false, ['stdin_read_error'], params, null);
    process.stdout.write(JSON.stringify(output) + '\n');
    process.exit(2);
  }

  const parsed = safeParseJson(input.text || '');
  if (parsed.error) {
    const output = buildOutput(false, ['json_parse_error'], params, null);
    process.stdout.write(JSON.stringify(output) + '\n');
    process.exit(1);
  }

  const evaluation = evaluateKpi(parsed.value, params);
  const output = buildOutput(evaluation.ok, evaluation.reasons, params, parsed.value);
  process.stdout.write(JSON.stringify(output) + '\n');
  process.exit(evaluation.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildParams,
  evaluateKpi,
  safeParseJson,
  readInputText
};
