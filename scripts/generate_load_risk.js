'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'load_risk.json');
const BUDGETS_PATH = path.join(ROOT, 'docs', 'READ_PATH_BUDGETS.md');
const DEFAULT_LIMIT_ASSUMED = 1000;

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function walkJsFiles(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(full, out);
      return;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  });
}

function parseLimitFromLine(line) {
  const literalByKey = line.match(/limit\s*:\s*(\d+)/);
  if (literalByKey) {
    const value = Number(literalByKey[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  const literalByCall = line.match(/\.limit\((\d+)\)/);
  if (literalByCall) {
    const value = Number(literalByCall[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function buildLoadRisk() {
  const files = [];
  walkJsFiles(SRC_DIR, files);
  files.sort();

  const hotspots = [];
  const fallbackPoints = [];

  files.forEach((filePath) => {
    const rel = toPosix(path.relative(ROOT, filePath));
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      const lineNo = idx + 1;

      const callRegex = /\b(listAll[A-Za-z0-9_]+)\s*\(/g;
      let match = callRegex.exec(line);
      while (match) {
        const call = match[1];
        const explicitLimit = parseLimitFromLine(line);
        const limitAssumed = explicitLimit || DEFAULT_LIMIT_ASSUMED;
        hotspots.push({
          hotspot: {
            file: rel,
            line: lineNo,
            type: 'listAll',
            call,
            limit: explicitLimit ? String(explicitLimit) : 'UNSPECIFIED'
          },
          endpoint_count: 1,
          limit_assumed: limitAssumed,
          estimated_scan: limitAssumed,
          endpoints: []
        });
        match = callRegex.exec(line);
      }

      const fallbackRegex = /\b(withMissingIndexFallback|isMissingIndexError)\s*\(/g;
      let fb = fallbackRegex.exec(line);
      while (fb) {
        fallbackPoints.push({
          file: rel,
          line: lineNo,
          type: 'missingIndexFallback',
          call: fb[1],
          limit: 'N/A'
        });
        fb = fallbackRegex.exec(line);
      }
    });
  });

  hotspots.sort((a, b) => {
    const diff = Number(b.estimated_scan || 0) - Number(a.estimated_scan || 0);
    if (diff !== 0) return diff;
    const fileDiff = String(a.hotspot.file).localeCompare(String(b.hotspot.file));
    if (fileDiff !== 0) return fileDiff;
    return Number(a.hotspot.line || 0) - Number(b.hotspot.line || 0);
  });

  fallbackPoints.sort((a, b) => {
    const fileDiff = String(a.file).localeCompare(String(b.file));
    if (fileDiff !== 0) return fileDiff;
    return Number(a.line || 0) - Number(b.line || 0);
  });

  const estimatedWorstCaseDocsScan = hotspots.reduce((sum, row) => sum + Number(row.estimated_scan || 0), 0);

  return {
    estimated_worst_case_docs_scan: estimatedWorstCaseDocsScan,
    fallback_risk: fallbackPoints.length,
    hotspots,
    fallback_points: fallbackPoints,
    assumptions: [
      'listAll without explicit limit assumes 1000 docs',
      'endpoint mapping derived from static src/index.js dispatch'
    ]
  };
}

function readBudgets() {
  if (!fs.existsSync(BUDGETS_PATH)) {
    return { worstCaseMax: null, fallbackPointsMax: null };
  }
  const text = fs.readFileSync(BUDGETS_PATH, 'utf8');
  const worstMatch = text.match(/worst_case_docs_scan_max:\s*(\d+)/);
  const fallbackMatch = text.match(/fallback_points_max:\s*(\d+)/);
  return {
    worstCaseMax: worstMatch ? Number(worstMatch[1]) : null,
    fallbackPointsMax: fallbackMatch ? Number(fallbackMatch[1]) : null
  };
}

function verifyBudgets(loadRisk) {
  const budgets = readBudgets();
  if (Number.isFinite(budgets.worstCaseMax) && Number(loadRisk.estimated_worst_case_docs_scan) > budgets.worstCaseMax) {
    throw new Error(`worst-case docs scan exceeds budget (${loadRisk.estimated_worst_case_docs_scan} > ${budgets.worstCaseMax})`);
  }
  if (Number.isFinite(budgets.fallbackPointsMax) && Number(loadRisk.fallback_risk) > budgets.fallbackPointsMax) {
    throw new Error(`fallback points exceed budget (${loadRisk.fallback_risk} > ${budgets.fallbackPointsMax})`);
  }
}

function run() {
  const checkMode = process.argv.includes('--check');
  const payload = buildLoadRisk();
  const next = `${JSON.stringify(payload, null, 2)}\n`;

  if (checkMode) {
    const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
    if (current !== next) {
      process.stderr.write('load_risk.json is stale. run: npm run load-risk:generate\n');
      process.exit(1);
    }
    try {
      verifyBudgets(payload);
    } catch (err) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    process.stdout.write('load_risk.json is up to date and within budgets\n');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, next, 'utf8');
  process.stdout.write(`generated: ${toPosix(path.relative(ROOT, OUTPUT_PATH))}\n`);
}

run();
