'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const LOAD_RISK_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'load_risk.json');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'missing_index_surface.json');
const BUDGETS_PATH = path.join(ROOT, 'docs', 'READ_PATH_BUDGETS.md');

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveGeneratedAt() {
  try {
    const value = childProcess.execSync('git log -1 --format=%cI -- docs/REPO_AUDIT_INPUTS/load_risk.json', {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8').trim();
    if (value) return value;
  } catch (_err) {
    // fall through
  }
  return 'NOT_AVAILABLE';
}

function buildSourceDigest(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizeFallbackPoints(loadRisk) {
  return Array.isArray(loadRisk && loadRisk.fallback_points)
    ? loadRisk.fallback_points.filter((row) => row && row.type === 'missingIndexFallback')
    : [];
}

function buildSurfaceRows(points) {
  const grouped = new Map();
  points.forEach((point) => {
    const file = typeof point.file === 'string' ? point.file : 'UNKNOWN';
    const call = typeof point.call === 'string' ? point.call : 'UNKNOWN';
    const line = Number.isFinite(Number(point.line)) ? Number(point.line) : null;
    const key = `${file}::${call}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        file,
        call,
        lines: [],
        occurrences: 0
      });
    }
    const current = grouped.get(key);
    current.occurrences += 1;
    if (line !== null) current.lines.push(line);
  });

  return Array.from(grouped.values())
    .map((row) => ({
      file: row.file,
      call: row.call,
      lines: Array.from(new Set(row.lines)).sort((a, b) => a - b),
      occurrences: row.occurrences,
      policy: {
        production: 'fail_closed',
        staging: 'fail_closed',
        local: 'fallback_allowed',
        test: 'fallback_allowed'
      }
    }))
    .sort((a, b) => {
      const fileDiff = String(a.file).localeCompare(String(b.file));
      if (fileDiff !== 0) return fileDiff;
      return String(a.call).localeCompare(String(b.call));
    });
}

function readBudget() {
  if (!fs.existsSync(BUDGETS_PATH)) return null;
  const text = fs.readFileSync(BUDGETS_PATH, 'utf8');
  const matches = [...text.matchAll(/missing_index_surface_max:\s*(\d+)/g)];
  if (!matches.length) return null;
  return Number(matches[matches.length - 1][1]);
}

function verifyBudget(surfaceCount) {
  const max = readBudget();
  if (!Number.isFinite(max)) return;
  if (Number(surfaceCount) > max) {
    throw new Error(`missing-index surfaces exceed budget (${surfaceCount} > ${max})`);
  }
}

function buildPayload() {
  const loadRiskRaw = fs.readFileSync(LOAD_RISK_PATH, 'utf8');
  const loadRisk = JSON.parse(loadRiskRaw);
  const points = normalizeFallbackPoints(loadRisk);
  const surfaces = buildSurfaceRows(points);
  const callBreakdown = surfaces.reduce((acc, row) => {
    const key = row.call || 'UNKNOWN';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: resolveGeneratedAt(),
    source: toPosix(path.relative(ROOT, LOAD_RISK_PATH)),
    sourceDigest: buildSourceDigest(loadRiskRaw),
    surface_count: surfaces.length,
    point_count: points.length,
    call_breakdown: callBreakdown,
    items: surfaces,
    assumptions: [
      'derived from docs/REPO_AUDIT_INPUTS/load_risk.json fallback_points',
      'surface is grouped by file + call',
      'policy classification follows src/repos/firestore/indexFallbackPolicy.js'
    ]
  };
}

function run() {
  const checkMode = process.argv.includes('--check');
  const payload = buildPayload();
  const next = `${JSON.stringify(payload, null, 2)}\n`;

  if (checkMode) {
    const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
    if (current !== next) {
      process.stderr.write('missing_index_surface.json is stale. run: npm run missing-index-surface:generate\n');
      process.exit(1);
    }
    try {
      verifyBudget(payload.surface_count);
    } catch (err) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    process.stdout.write('missing_index_surface.json is up to date and within budgets\n');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, next, 'utf8');
  process.stdout.write(`generated: ${toPosix(path.relative(ROOT, OUTPUT_PATH))}\n`);
}

run();
