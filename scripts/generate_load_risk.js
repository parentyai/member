'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const INDEX_FILE = path.join(ROOT, 'src', 'index.js');
const DEP_GRAPH_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'dependency_graph.json');
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

function parsePathsFromBlock(text) {
  const paths = new Set();
  const eqRegex = /pathname\s*===\s*'([^']+)'/g;
  let eq = eqRegex.exec(text);
  while (eq) {
    paths.add(eq[1]);
    eq = eqRegex.exec(text);
  }
  const prefixRegex = /pathname\.startsWith\(\s*'([^']+)'\s*\)/g;
  let prefix = prefixRegex.exec(text);
  while (prefix) {
    paths.add(`${prefix[1]}*`);
    prefix = prefixRegex.exec(text);
  }
  return Array.from(paths.values());
}

function parseHandlerToRouteMap(indexSource) {
  const map = new Map();
  const requireRegex = /const\s*\{([^}]+)\}\s*=\s*require\('(\.\/routes\/[^']+)'\);/g;
  let match = requireRegex.exec(indexSource);
  while (match) {
    const bindings = match[1]
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
    const routePath = `src/${match[2].replace(/^\.\//, '')}.js`;
    bindings.forEach((binding) => {
      const parts = binding.split(':').map((part) => part.trim()).filter(Boolean);
      const localName = parts.length > 1 ? parts[1] : parts[0];
      if (!localName) return;
      map.set(localName, routePath);
    });
    match = requireRegex.exec(indexSource);
  }
  return map;
}

function parseRouteToEndpoints() {
  if (!fs.existsSync(INDEX_FILE)) return new Map();
  const source = fs.readFileSync(INDEX_FILE, 'utf8');
  const handlerToRoute = parseHandlerToRouteMap(source);
  const routeToEndpoints = new Map();
  const lines = source.split(/\r?\n/);

  lines.forEach((line, idx) => {
    handlerToRoute.forEach((routeFile, handler) => {
      if (!line.includes(`${handler}(`)) return;
      const from = Math.max(0, idx - 5);
      const to = Math.min(lines.length - 1, idx + 1);
      const block = lines.slice(from, to + 1).join('\n');
      const paths = parsePathsFromBlock(block);
      if (!paths.length) return;
      if (!routeToEndpoints.has(routeFile)) routeToEndpoints.set(routeFile, new Set());
      const bucket = routeToEndpoints.get(routeFile);
      paths.forEach((entry) => bucket.add(entry));
    });
  });

  return routeToEndpoints;
}

function loadDependencyGraph() {
  if (!fs.existsSync(DEP_GRAPH_PATH)) {
    return {
      route_to_usecase: {},
      usecase_to_repo: {}
    };
  }
  try {
    const json = JSON.parse(fs.readFileSync(DEP_GRAPH_PATH, 'utf8'));
    return {
      route_to_usecase: json.route_to_usecase || {},
      usecase_to_repo: json.usecase_to_repo || {}
    };
  } catch (_err) {
    return {
      route_to_usecase: {},
      usecase_to_repo: {}
    };
  }
}

function parseUsecaseExportNames(usecaseFilePath) {
  if (!fs.existsSync(usecaseFilePath)) return [];
  const source = fs.readFileSync(usecaseFilePath, 'utf8');
  const match = source.match(/module\.exports\s*=\s*\{([\s\S]*?)\};/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const parts = token.split(':').map((part) => part.trim()).filter(Boolean);
      return parts[0] || null;
    })
    .filter(Boolean);
}

function resolveEndpointsForHotspot(filePath, routeToEndpoints, dependencyGraph, usecaseExportCache) {
  const normalizedFile = toPosix(filePath);
  const routeFiles = new Set();
  const routeToUsecase = dependencyGraph.route_to_usecase || {};
  const usecaseToRepo = dependencyGraph.usecase_to_repo || {};

  if (normalizedFile.startsWith('src/routes/')) {
    routeFiles.add(normalizedFile);
  } else if (normalizedFile.startsWith('src/usecases/')) {
    let exportNames = usecaseExportCache.get(normalizedFile);
    if (!exportNames) {
      exportNames = parseUsecaseExportNames(path.join(ROOT, normalizedFile));
      usecaseExportCache.set(normalizedFile, exportNames);
    }
    Object.entries(routeToUsecase).forEach(([routeFile, usecases]) => {
      if (!Array.isArray(usecases)) return;
      if (usecases.some((name) => exportNames.includes(name))) {
        routeFiles.add(routeFile);
      }
    });
  } else if (normalizedFile.startsWith('src/repos/firestore/')) {
    const repoName = path.basename(normalizedFile, '.js');
    const usecaseNames = Object.entries(usecaseToRepo)
      .filter(([, repos]) => Array.isArray(repos) && repos.includes(repoName))
      .map(([usecaseName]) => usecaseName);
    Object.entries(routeToUsecase).forEach(([routeFile, usecases]) => {
      if (!Array.isArray(usecases)) return;
      if (usecases.some((name) => usecaseNames.includes(name))) {
        routeFiles.add(routeFile);
      }
    });
  }

  const endpoints = new Set();
  routeFiles.forEach((routeFile) => {
    const mapped = routeToEndpoints.get(routeFile);
    if (!mapped) return;
    mapped.forEach((endpoint) => endpoints.add(endpoint));
  });
  return Array.from(endpoints.values()).sort();
}

function buildLoadRisk() {
  const files = [];
  walkJsFiles(SRC_DIR, files);
  files.sort();

  const routeToEndpoints = parseRouteToEndpoints();
  const dependencyGraph = loadDependencyGraph();
  const usecaseExportCache = new Map();

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
          endpoint_count: 0,
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

  hotspots.forEach((row) => {
    const hotspotFile = row && row.hotspot ? row.hotspot.file : null;
    const endpoints = hotspotFile
      ? resolveEndpointsForHotspot(hotspotFile, routeToEndpoints, dependencyGraph, usecaseExportCache)
      : [];
    row.endpoints = endpoints;
    row.endpoint_count = endpoints.length;
  });

  const estimatedWorstCaseDocsScan = hotspots.reduce((sum, row) => sum + Number(row.estimated_scan || 0), 0);

  return {
    estimated_worst_case_docs_scan: estimatedWorstCaseDocsScan,
    fallback_risk: fallbackPoints.length,
    hotspots,
    fallback_points: fallbackPoints,
    assumptions: [
      'listAll without explicit limit assumes 1000 docs',
      'endpoint mapping derived from static src/index.js handler dispatch and dependency_graph.json'
    ]
  };
}

function readBudgets() {
  if (!fs.existsSync(BUDGETS_PATH)) {
    return { worstCaseMax: null, fallbackPointsMax: null, hotspotsCountMax: null };
  }
  const text = fs.readFileSync(BUDGETS_PATH, 'utf8');
  const worstMatches = [...text.matchAll(/worst_case_docs_scan_max:\s*(\d+)/g)];
  const fallbackMatches = [...text.matchAll(/fallback_points_max:\s*(\d+)/g)];
  const hotspotMatches = [...text.matchAll(/hotspots_count_max:\s*(\d+)/g)];
  const worstMatch = worstMatches.length ? worstMatches[worstMatches.length - 1] : null;
  const fallbackMatch = fallbackMatches.length ? fallbackMatches[fallbackMatches.length - 1] : null;
  const hotspotMatch = hotspotMatches.length ? hotspotMatches[hotspotMatches.length - 1] : null;
  return {
    worstCaseMax: worstMatch ? Number(worstMatch[1]) : null,
    fallbackPointsMax: fallbackMatch ? Number(fallbackMatch[1]) : null,
    hotspotsCountMax: hotspotMatch ? Number(hotspotMatch[1]) : null
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
  if (Number.isFinite(budgets.hotspotsCountMax) && Array.isArray(loadRisk.hotspots) && loadRisk.hotspots.length > budgets.hotspotsCountMax) {
    throw new Error(`hotspots count exceeds budget (${loadRisk.hotspots.length} > ${budgets.hotspotsCountMax})`);
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
