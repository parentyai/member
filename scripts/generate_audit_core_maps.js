'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const INDEX_FILE = path.join(ROOT, 'src', 'index.js');
const ROUTES_DIR = path.join(ROOT, 'src', 'routes');
const USECASES_DIR = path.join(ROOT, 'src', 'usecases');
const REPOS_DIR = path.join(ROOT, 'src', 'repos', 'firestore');
const TESTS_DIR = path.join(ROOT, 'tests');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS');

const OUTPUT_FILES = Object.freeze({
  featureMap: path.join(OUTPUT_DIR, 'feature_map.json'),
  dependencyGraph: path.join(OUTPUT_DIR, 'dependency_graph.json'),
  dataModelMap: path.join(OUTPUT_DIR, 'data_model_map.json'),
  stateTransitions: path.join(OUTPUT_DIR, 'state_transitions.json'),
  designAiMeta: path.join(OUTPUT_DIR, 'design_ai_meta.json'),
  protectionMatrix: path.join(OUTPUT_DIR, 'protection_matrix.json'),
  killSwitchPoints: path.join(OUTPUT_DIR, 'kill_switch_points.json')
});

const LEGACY_FEATURES = new Set([
  'phase1Notifications',
  'phase105OpsAssistAdopt',
  'phase121OpsNoticeSend',
  'phase1Events',
  'phaseLLM4FaqAnswer'
]);

const DANGEROUS_CONFIRM_TOKEN_PATHS = new Set([
  '/api/admin/os/automation-config/set',
  '/api/admin/os/config/set',
  '/api/admin/os/delivery-backfill/execute',
  '/api/admin/os/delivery-recovery/execute',
  '/api/admin/os/kill-switch/set',
  '/api/admin/os/notifications/send/execute',
  '/api/phase68/send/execute',
  '/api/phase73/retry-queue/retry'
]);

function resolveGeneratedAt() {
  try {
    const value = childProcess.execSync('git log -1 --format=%cI -- src/index.js', {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8').trim();
    if (value) return value;
  } catch (_err) {
    // fall through
  }
  return 'NOT_AVAILABLE';
}

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function toRepoRelative(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listJsFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        return;
      }
      if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
    });
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function resolveRequire(fromFile, requestPath) {
  if (!requestPath || typeof requestPath !== 'string' || !requestPath.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), requestPath);
  const candidates = [
    base,
    `${base}.js`,
    path.join(base, 'index.js')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function extractRequireRecords(filePath) {
  const text = readText(filePath);
  const records = [];

  const destructured = /const\s*\{([^}]+)\}\s*=\s*require\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
  let match = destructured.exec(text);
  while (match) {
    const rawBindings = match[1]
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
    const symbols = rawBindings
      .map((token) => {
        const parts = token.split(':').map((v) => v.trim()).filter(Boolean);
        return parts[0] || null;
      })
      .filter(Boolean);

    records.push({
      request: match[2],
      kind: 'destructured',
      symbols,
      localName: null
    });
    match = destructured.exec(text);
  }

  const direct = /const\s+([A-Za-z0-9_$]+)\s*=\s*require\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
  match = direct.exec(text);
  while (match) {
    records.push({
      request: match[2],
      kind: 'direct',
      symbols: [],
      localName: match[1]
    });
    match = direct.exec(text);
  }

  return records;
}

function extractIndexRouteModules() {
  const text = readText(INDEX_FILE);
  const routes = new Set();
  const requireRe = /require\(\s*['\"](\.\/routes\/[^'\"]+)['\"]\s*\)/g;
  let match = requireRe.exec(text);
  while (match) {
    const resolved = resolveRequire(INDEX_FILE, match[1]);
    if (resolved) routes.add(resolved);
    match = requireRe.exec(text);
  }
  return Array.from(routes.values()).sort((a, b) => a.localeCompare(b));
}

function parseCollectionNames(repoFilePath) {
  const text = readText(repoFilePath);
  const names = new Set();
  const constants = {};

  for (const match of text.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*['\"]([^'\"]+)['\"]/g)) {
    constants[match[1]] = match[2];
  }

  for (const match of text.matchAll(/\.collection\(\s*['\"]([^'\"]+)['\"]\s*\)/g)) {
    names.add(match[1]);
  }

  for (const match of text.matchAll(/\.collection\(\s*([A-Z0-9_]+)\s*\)/g)) {
    const resolved = constants[match[1]];
    if (resolved) names.add(resolved);
  }

  return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}

function extractExportSymbols(usecaseFilePath) {
  const text = readText(usecaseFilePath);
  const symbols = new Set();

  const moduleExportsBlock = text.match(/module\.exports\s*=\s*\{([\s\S]*?)\};/);
  if (moduleExportsBlock) {
    const rows = moduleExportsBlock[1]
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
    rows.forEach((row) => {
      const parts = row.split(':').map((v) => v.trim()).filter(Boolean);
      if (parts[0]) symbols.add(parts[0]);
    });
  }

  const namedFunction = /(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g;
  let fn = namedFunction.exec(text);
  while (fn) {
    symbols.add(fn[1]);
    fn = namedFunction.exec(text);
  }

  return Array.from(symbols.values()).sort((a, b) => a.localeCompare(b));
}

function toFeatureNameFromRoute(routePath) {
  const base = path.basename(routePath, '.js');
  if (!base) return 'unknownFeature';
  return base;
}

function inferAuthFromRoute(routePath) {
  const rel = toRepoRelative(routePath);
  if (rel.includes('/routes/internal/')) return 'internal';
  if (rel.includes('/routes/admin/')) return 'admin';
  if (rel.includes('webhook')) return 'webhook';
  return 'public';
}

function inferEntrypointsFromIndexForRoute(routePath) {
  const text = readText(INDEX_FILE);
  const relRequire = `./${toRepoRelative(routePath).replace(/^src\//, '')}`;
  const lines = text.split(/\r?\n/);
  const out = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes(relRequire)) continue;
    const from = Math.max(0, i - 40);
    const to = Math.min(lines.length - 1, i + 5);
    const block = lines.slice(from, to + 1).join('\n');

    for (const m of block.matchAll(/pathname\s*===\s*'([^']+)'/g)) out.add(m[1]);
    for (const m of block.matchAll(/pathname\.startsWith\(\s*'([^']+)'\s*\)/g)) out.add(`${m[1]}*`);
    for (const m of block.matchAll(/\/((?:\\.|[^\/])+)\/[gimsuy]*\.test\(pathname\)/g)) {
      out.add(`/${m[1]}/`);
    }
  }

  return Array.from(out.values()).sort((a, b) => a.localeCompare(b));
}

function countTestsForFeature(featureName, routeRelPath) {
  const featureToken = String(featureName || '').toLowerCase();
  const routeBase = path.basename(routeRelPath || '', '.js').toLowerCase();
  const files = listJsFiles(TESTS_DIR).map((f) => toRepoRelative(f));
  let count = 0;
  files.forEach((file) => {
    const lower = file.toLowerCase();
    if (featureToken && lower.includes(featureToken)) {
      count += 1;
      return;
    }
    if (routeBase && lower.includes(routeBase)) count += 1;
  });
  return count;
}

function buildCoreMappings() {
  const routeFiles = listJsFiles(ROUTES_DIR);
  const liveRoutes = new Set(extractIndexRouteModules());
  const usecaseFiles = listJsFiles(USECASES_DIR);
  const repoFiles = listJsFiles(REPOS_DIR);

  const usecaseBySymbol = new Map();
  usecaseFiles.forEach((usecaseFile) => {
    const rel = toRepoRelative(usecaseFile);
    const symbols = extractExportSymbols(usecaseFile);
    symbols.forEach((symbol) => {
      if (!usecaseBySymbol.has(symbol)) usecaseBySymbol.set(symbol, []);
      usecaseBySymbol.get(symbol).push(rel);
    });
    const base = path.basename(usecaseFile, '.js');
    if (!usecaseBySymbol.has(base)) usecaseBySymbol.set(base, []);
    usecaseBySymbol.get(base).push(rel);
  });

  const routeToUsecase = {};
  const usecaseToRepo = {};
  const routeToUsecaseFiles = new Map();

  const targetRoutes = routeFiles.filter((routeFile) => liveRoutes.has(routeFile));

  targetRoutes.forEach((routeFile) => {
    const relRoute = toRepoRelative(routeFile);
    const symbols = new Set();
    const matchedUsecaseFiles = new Set();

    const records = extractRequireRecords(routeFile);
    records.forEach((record) => {
      const resolved = resolveRequire(routeFile, record.request);
      if (!resolved) return;
      const relResolved = toRepoRelative(resolved);
      if (!relResolved.startsWith('src/usecases/')) return;

      if (record.kind === 'destructured' && record.symbols.length) {
        record.symbols.forEach((symbol) => symbols.add(symbol));
      } else {
        symbols.add(path.basename(relResolved, '.js'));
      }

      matchedUsecaseFiles.add(relResolved);
    });

    const sortedSymbols = Array.from(symbols.values()).sort((a, b) => a.localeCompare(b));
    routeToUsecase[relRoute] = sortedSymbols;
    routeToUsecaseFiles.set(relRoute, Array.from(matchedUsecaseFiles.values()).sort((a, b) => a.localeCompare(b)));
  });

  Object.values(routeToUsecase).forEach((symbols) => {
    symbols.forEach((symbol) => {
      if (usecaseToRepo[symbol]) return;
      const candidates = usecaseBySymbol.get(symbol) || [];
      const repos = new Set();
      candidates.forEach((candidate) => {
        const abs = path.join(ROOT, candidate);
        const records = extractRequireRecords(abs);
        records.forEach((record) => {
          const resolved = resolveRequire(abs, record.request);
          if (!resolved) return;
          const rel = toRepoRelative(resolved);
          if (!rel.startsWith('src/repos/firestore/')) return;
          repos.add(path.basename(rel, '.js'));
        });
      });
      usecaseToRepo[symbol] = Array.from(repos.values()).sort((a, b) => a.localeCompare(b));
    });
  });

  const referencedRepoNames = new Set();
  Object.values(usecaseToRepo).forEach((repos) => {
    (repos || []).forEach((repoName) => referencedRepoNames.add(repoName));
  });

  const repoToCollection = {};
  repoFiles.forEach((repoFile) => {
    const rel = toRepoRelative(repoFile);
    const repoName = path.basename(rel, '.js');
    if (!referencedRepoNames.has(repoName)) return;
    repoToCollection[repoName] = parseCollectionNames(repoFile);
  });

  return {
    routeFiles: routeFiles.map((f) => toRepoRelative(f)),
    liveRoutes: targetRoutes.map((f) => toRepoRelative(f)),
    usecaseFiles: usecaseFiles.map((f) => toRepoRelative(f)),
    repoFiles: repoFiles.map((f) => toRepoRelative(f)),
    routeToUsecase,
    routeToUsecaseFiles,
    usecaseToRepo,
    repoToCollection,
    unresolvedDynamicDep: []
  };
}

function buildFeatureMap(core) {
  const features = [];
  const allRoutes = Object.keys(core.routeToUsecase).sort((a, b) => a.localeCompare(b));

  allRoutes.forEach((routeRel) => {
    const routeAbs = path.join(ROOT, routeRel);
    const usecases = core.routeToUsecase[routeRel] || [];
    const repos = new Set();
    usecases.forEach((usecase) => {
      (core.usecaseToRepo[usecase] || []).forEach((repoName) => repos.add(repoName));
    });

    const collections = new Set();
    Array.from(repos.values()).forEach((repoName) => {
      (core.repoToCollection[repoName] || []).forEach((collection) => collections.add(collection));
    });

    const routeText = readText(routeAbs);
    const joinedUsecaseText = (core.routeToUsecaseFiles.get(routeRel) || [])
      .map((file) => readText(path.join(ROOT, file)))
      .join('\n');

    const featureName = toFeatureNameFromRoute(routeRel);
    const item = {
      feature: featureName,
      entrypoints: inferEntrypointsFromIndexForRoute(routeAbs),
      usecases,
      repos: Array.from(repos.values()).sort((a, b) => a.localeCompare(b)),
      collections: Array.from(collections.values()).sort((a, b) => a.localeCompare(b)),
      auth: inferAuthFromRoute(routeRel),
      killSwitch_dependent: /getKillSwitch|setKillSwitch|killSwitch/i.test(`${routeText}\n${joinedUsecaseText}`),
      trace_linked: /traceId|x-trace-id|trace_id/i.test(`${routeText}\n${joinedUsecaseText}`),
      audit_linked: /appendAuditLog|audit_logs|audit/i.test(`${routeText}\n${joinedUsecaseText}`),
      tests_count: countTestsForFeature(featureName, routeRel),
      ssot_refs: [],
      completion: LEGACY_FEATURES.has(featureName) ? 'legacy' : 'completed'
    };

    features.push(item);
  });

  return { features: features.sort((a, b) => a.feature.localeCompare(b.feature)) };
}

function buildDependencyGraph(core) {
  const routeToUsecase = {};
  Object.keys(core.routeToUsecase).sort((a, b) => a.localeCompare(b)).forEach((route) => {
    routeToUsecase[route] = (core.routeToUsecase[route] || []).slice().sort((a, b) => a.localeCompare(b));
  });

  const usecaseToRepo = {};
  Object.keys(core.usecaseToRepo).sort((a, b) => a.localeCompare(b)).forEach((usecase) => {
    usecaseToRepo[usecase] = (core.usecaseToRepo[usecase] || []).slice().sort((a, b) => a.localeCompare(b));
  });

  const repoToCollection = {};
  Object.keys(core.repoToCollection).sort((a, b) => a.localeCompare(b)).forEach((repo) => {
    repoToCollection[repo] = (core.repoToCollection[repo] || []).slice().sort((a, b) => a.localeCompare(b));
  });

  return {
    usecase_to_repo: usecaseToRepo,
    repo_to_collection: repoToCollection,
    route_to_usecase: routeToUsecase,
    unresolved_dynamic_dep: []
  };
}

function buildDataModelMap(core) {
  const repoNameToFile = {};
  core.repoFiles.forEach((repoRel) => {
    repoNameToFile[path.basename(repoRel, '.js')] = repoRel;
  });

  const collectionRows = new Map();
  Object.entries(core.repoToCollection).forEach(([repoName, collections]) => {
    const repoFile = repoNameToFile[repoName];
    const repoSource = repoFile ? readText(path.join(ROOT, repoFile)) : '';
    const hasFallback = /withIndexFallback|fallbackOnMissingIndex|missing.?index|fallback/i.test(repoSource);
    const hasFullScan = /\blistAll[A-Za-z0-9_]*\s*\(/.test(repoSource);

    (collections || []).forEach((collection) => {
      if (!collectionRows.has(collection)) {
        collectionRows.set(collection, {
          repos: new Set(),
          writePaths: new Set(),
          readPaths: new Set(),
          hasFallback: false,
          hasFullScan: false
        });
      }
      const row = collectionRows.get(collection);
      row.repos.add(repoName);
      if (repoFile) {
        row.writePaths.add(repoFile);
        row.readPaths.add(repoFile);
      }
      row.hasFallback = row.hasFallback || hasFallback;
      row.hasFullScan = row.hasFullScan || hasFullScan;
    });
  });

  const collections = Array.from(collectionRows.keys()).sort((a, b) => a.localeCompare(b)).map((collection) => {
    const row = collectionRows.get(collection);
    return {
      collection,
      repos: Array.from(row.repos.values()).sort((a, b) => a.localeCompare(b)),
      write_paths: Array.from(row.writePaths.values()).sort((a, b) => a.localeCompare(b)),
      read_paths: Array.from(row.readPaths.values()).sort((a, b) => a.localeCompare(b)),
      doc_id_patterns: 'UNRESOLVED_STATIC_ONLY',
      required_fields: 'UNRESOLVED_STATIC_ONLY',
      index_dependency: row.hasFallback ? 'POSSIBLE_MISSING_INDEX_FALLBACK' : 'NOT_DETECTED',
      fullscan_risk: row.hasFullScan ? 'HIGH' : 'LOW'
    };
  });

  return { collections };
}

function buildStateTransitions() {
  return {
    notification: {
      states: ['draft', 'active', 'sent'],
      transitions: [
        {
          from: '*',
          to: 'draft',
          writer: 'src/routes/admin/osNotifications.js + src/usecases/notifications/createNotification.js',
          collection_write: 'notifications',
          audit_log: true,
          killSwitch_check: false
        },
        {
          from: 'draft',
          to: 'active',
          writer: 'src/usecases/adminOs/approveNotification.js',
          collection_write: 'notifications',
          audit_log: true,
          killSwitch_check: false
        },
        {
          from: 'active',
          to: 'sent',
          writer: 'src/usecases/notifications/sendNotification.js',
          collection_write: 'notifications',
          audit_log: true,
          killSwitch_check: true
        }
      ]
    },
    city_pack_request: {
      states: ['queued', 'collecting', 'drafted', 'needs_review', 'approved', 'active', 'rejected', 'failed'],
      transitions: [
        {
          from: '*',
          to: 'queued',
          writer: 'src/usecases/cityPack/declareCityRegionFromLine.js',
          collection_write: 'city_pack_requests',
          audit_log: true,
          killSwitch_check: false
        },
        {
          from: 'approved',
          to: 'active',
          writer: 'src/routes/admin/cityPackRequests.js + src/usecases/cityPack/activateCityPack.js',
          collection_write: 'city_pack_requests,city_packs',
          audit_log: true,
          killSwitch_check: true
        }
      ]
    },
    ops_decision: {
      states: ['pending', 'decided', 'escalated', 'resolved'],
      transitions: [
        {
          from: 'pending',
          to: 'decided',
          writer: 'src/usecases/phase25/submitOpsDecision.js',
          collection_write: 'ops_states,decision_logs',
          audit_log: true,
          killSwitch_check: false
        },
        {
          from: 'decided',
          to: 'resolved',
          writer: 'src/usecases/phase33/executeOpsNextAction.js',
          collection_write: 'ops_states,decision_logs',
          audit_log: true,
          killSwitch_check: true
        }
      ]
    },
    emergency: {
      states: ['draft', 'approved', 'sent', 'rejected'],
      transitions: [
        {
          from: '*',
          to: 'draft',
          writer: 'src/usecases/emergency/runEmergencySync.js',
          collection_write: 'emergency_bulletins,emergency_diffs,emergency_snapshots',
          audit_log: true,
          killSwitch_check: true
        },
        {
          from: 'draft',
          to: 'approved',
          writer: 'src/usecases/emergency/approveEmergencyBulletin.js',
          collection_write: 'emergency_bulletins',
          audit_log: true,
          killSwitch_check: true
        },
        {
          from: 'approved',
          to: 'sent',
          writer: 'src/usecases/emergency/approveEmergencyBulletin.js + src/usecases/notifications/sendNotification.js',
          collection_write: 'emergency_bulletins,notification_deliveries,decision_timeline',
          audit_log: true,
          killSwitch_check: true
        }
      ]
    }
  };
}

function buildDesignAiMeta(core) {
  const repoNames = core.repoFiles.map((repoFile) => path.basename(repoFile, '.js')).sort((a, b) => a.localeCompare(b));
  const legacyRepos = [];
  const mergeCandidates = [];

  core.repoFiles.forEach((repoRel) => {
    const abs = path.join(ROOT, repoRel);
    const text = readText(abs);
    const base = path.basename(repoRel, '.js');
    if (text.includes('LEGACY_ALIAS') || text.includes('LEGACY_HEADER')) {
      legacyRepos.push(base);
    }
    const alias = text.match(/LEGACY_ALIAS:\s*.*\/([^/\s]+)\.js\s*->\s*.*\/([^/\s]+)\.js/);
    if (alias && alias[1] && alias[2] && alias[1] !== alias[2]) {
      mergeCandidates.push([alias[2], alias[1]]);
    }
  });

  const scenario = [];
  const scenarioKey = [];
  const srcFiles = listJsFiles(SRC_DIR).map((file) => toRepoRelative(file));
  srcFiles.forEach((file) => {
    const text = readText(path.join(ROOT, file));
    const hasScenarioKey = /scenarioKey/.test(text);
    const hasScenarioOnly = /\bscenario\b/.test(text) && !hasScenarioKey;
    if (hasScenarioOnly) scenario.push(file);
    if (hasScenarioKey) scenarioKey.push(file);
  });

  const uniqueMerge = Array.from(new Set(mergeCandidates.map((pair) => `${pair[0]}::${pair[1]}`)))
    .map((row) => row.split('::'))
    .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`));

  return {
    canonical_repos: repoNames.filter((name) => !legacyRepos.includes(name)),
    legacy_repos: Array.from(new Set(legacyRepos)).sort((a, b) => a.localeCompare(b)),
    merge_candidates: uniqueMerge,
    naming_drift: {
      scenario: Array.from(new Set(scenario)).sort((a, b) => a.localeCompare(b)),
      scenarioKey: Array.from(new Set(scenarioKey)).sort((a, b) => a.localeCompare(b))
    },
    critical_guards: [
      'validateSingleCta',
      'validateLinkRequired',
      'validateWarnLinkBlock',
      'validateKillSwitch',
      'requireAdminToken',
      'requireInternalJobToken',
      'killSwitch',
      'validateCityPackSources'
    ],
    unresolved_dynamic_dep: []
  };
}

function inferMethodFromBlock(text) {
  const methods = new Set();
  for (const m of text.matchAll(/req\.method\s*===\s*'([A-Z]+)'/g)) methods.add(m[1]);
  if (!methods.size) methods.add('*');
  return Array.from(methods.values()).sort((a, b) => a.localeCompare(b));
}

function inferPathsFromBlock(text) {
  const paths = new Map();
  for (const m of text.matchAll(/pathname\s*===\s*'([^']+)'/g)) {
    const value = m[1];
    paths.set(`exact:${value}`, { value, match: 'exact' });
  }
  for (const m of text.matchAll(/pathname\.startsWith\(\s*'([^']+)'\s*\)/g)) {
    const value = `${m[1]}*`;
    paths.set(`prefix:${value}`, { value, match: 'prefix' });
  }
  for (const m of text.matchAll(/\/((?:\\.|[^\/])+)\/[gimsuy]*\.test\(pathname\)/g)) {
    const value = `/${m[1]}/`;
    paths.set(`regex:${value}`, { value, match: 'regex' });
  }
  for (const m of text.matchAll(/pathname\.match\(\s*\/((?:\\.|[^\/])+)\/[gimsuy]*\s*\)/g)) {
    const value = `/${m[1]}/`;
    paths.set(`regex:${value}`, { value, match: 'regex' });
  }
  return Array.from(paths.values()).sort((a, b) => String(a.value).localeCompare(String(b.value)));
}

function resolveAuthForPath(pathValue) {
  const normalized = String(pathValue || '').replace(/\*$/, '');
  if (normalized.startsWith('/internal/')) return 'internalToken';
  if (normalized.startsWith('/api/admin/') || normalized.startsWith('/admin/')) return 'adminToken';
  if (normalized.startsWith('/api/phase') && !normalized.startsWith('/api/phase1/events')) return 'adminToken';
  return 'none';
}

function parseHandlerToRouteMap(indexText) {
  const map = new Map();
  const re = /const\s*\{([^}]+)\}\s*=\s*require\(\s*['\"](\.\/routes\/[^'\"]+)['\"]\s*\)/g;
  let match = re.exec(indexText);
  while (match) {
    const requestPath = match[2];
    const resolved = resolveRequire(INDEX_FILE, requestPath);
    const routeRel = resolved ? toRepoRelative(resolved) : null;
    if (routeRel) {
      const bindings = match[1]
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);
      bindings.forEach((binding) => {
        const parts = binding.split(':').map((part) => part.trim()).filter(Boolean);
        const localName = parts.length > 1 ? parts[1] : parts[0];
        if (!localName) return;
        map.set(localName, routeRel);
      });
    }
    match = re.exec(indexText);
  }
  return map;
}

function parsePathAliasRows(indexText) {
  const map = new Map();
  const re = /const\s+([A-Za-z0-9_$]+)\s*=\s*\(([\s\S]*?)\);\s*/g;
  let match = re.exec(indexText);
  while (match) {
    const aliasName = match[1];
    const aliasExpr = match[2];
    const rows = inferPathsFromBlock(aliasExpr);
    if (rows.length) map.set(aliasName, rows);
    match = re.exec(indexText);
  }
  return map;
}

function findRelevantIfLine(lines, idx) {
  const from = Math.max(0, idx - 160);
  for (let i = idx; i >= from; i -= 1) {
    const line = lines[i];
    if (!line || !line.includes('if (')) continue;
    if (/pathname|is[A-Z]|req\.method/.test(line)) return i;
  }
  return Math.max(0, idx - 20);
}

function buildProtectionMatrix(core) {
  const indexText = readText(INDEX_FILE);
  const lines = indexText.split(/\r?\n/);
  const rows = [];
  const handlerToRoute = parseHandlerToRouteMap(indexText);
  const pathAliasRows = parsePathAliasRows(indexText);
  const routeMeta = new Map();

  function getRouteMeta(routeRel) {
    if (routeMeta.has(routeRel)) return routeMeta.get(routeRel);
    const routeAbs = path.join(ROOT, routeRel);
    const usecases = core.routeToUsecase[routeRel] || [];
    const repos = new Set();
    usecases.forEach((usecase) => {
      (core.usecaseToRepo[usecase] || []).forEach((repoName) => repos.add(repoName));
    });
    const collections = new Set();
    Array.from(repos.values()).forEach((repoName) => {
      (core.repoToCollection[repoName] || []).forEach((name) => collections.add(name));
    });

    const routeText = readText(routeAbs);
    const joinedUsecaseText = (core.routeToUsecaseFiles.get(routeRel) || [])
      .map((file) => readText(path.join(ROOT, file)))
      .join('\n');
    const mergedText = `${routeText}\n${joinedUsecaseText}`;
    const meta = {
      collections: Array.from(collections.values()).sort((a, b) => a.localeCompare(b)),
      killSwitch: /getKillSwitch|killSwitch/i.test(mergedText),
      audit: /appendAuditLog|audit_logs|audit/i.test(mergedText),
      trace: /traceId|x-trace-id|trace_id/i.test(mergedText)
    };
    routeMeta.set(routeRel, meta);
    return meta;
  }

  lines.forEach((line, idx) => {
    handlerToRoute.forEach((routeRel, handlerName) => {
      if (!line.includes(`${handlerName}(`)) return;

      const from = findRelevantIfLine(lines, idx);
      const to = idx;
      const contextBlock = lines.slice(from, to + 1).join('\n');
      let methods = inferMethodFromBlock(contextBlock);
      let pathRows = inferPathsFromBlock(contextBlock);
      const meta = getRouteMeta(routeRel);
      const routeText = readText(path.join(ROOT, routeRel));

      if (!pathRows.length) {
        const aliasIf = contextBlock.match(/\bif\s*\(\s*([A-Za-z0-9_$]+)\s*\)\s*\{/);
        if (aliasIf && pathAliasRows.has(aliasIf[1])) {
          pathRows = pathAliasRows.get(aliasIf[1]) || [];
        }
      }

      if (methods.length === 1 && methods[0] === '*') {
        const routeMethods = inferMethodFromBlock(routeText);
        if (!(routeMethods.length === 1 && routeMethods[0] === '*')) {
          methods = routeMethods;
        }
      }

      if (!pathRows.length) {
        pathRows = inferPathsFromBlock(routeText);
      }

      if (!pathRows.length) {
        rows.push({
          method: methods[0] || '*',
          path: routeRel,
          match: 'route_file',
          line: idx + 1,
          route_files: [routeRel],
          auth_required: routeRel.includes('/internal/') ? 'internalToken' : (routeRel.includes('/admin/') ? 'adminToken' : 'none'),
          csrf_required: false,
          confirm_token_required: false,
          confirm_token_confidence: 'low',
          killSwitch_enforced: meta.killSwitch,
          killSwitch_confidence: meta.killSwitch ? 'high' : 'low',
          writes_collections: meta.collections,
          audit_required: meta.audit,
          trace_required: meta.trace,
          evidence: [`src/index.js:${idx + 1}`, `${routeRel}:1`]
        });
        return;
      }

      pathRows.forEach((pathRow) => {
        methods.forEach((method) => {
          rows.push({
            method,
            path: pathRow.value,
            match: pathRow.match,
            line: idx + 1,
            route_files: [routeRel],
            auth_required: resolveAuthForPath(pathRow.value),
            csrf_required: false,
            confirm_token_required: DANGEROUS_CONFIRM_TOKEN_PATHS.has(pathRow.value),
            confirm_token_confidence: DANGEROUS_CONFIRM_TOKEN_PATHS.has(pathRow.value) ? 'high' : 'low',
            killSwitch_enforced: meta.killSwitch,
            killSwitch_confidence: meta.killSwitch ? 'high' : 'low',
            writes_collections: meta.collections,
            audit_required: meta.audit,
            trace_required: meta.trace,
            evidence: [`src/index.js:${idx + 1}`, `${routeRel}:1`]
          });
        });
      });
    });
  });

  const dedup = new Map();
  rows.forEach((row) => {
    const key = [row.method, row.path, row.match, row.route_files.join(',')].join('::');
    if (!dedup.has(key)) dedup.set(key, row);
  });

  const flat = Array.from(dedup.values()).sort((a, b) => {
    const pathDiff = String(a.path).localeCompare(String(b.path));
    if (pathDiff !== 0) return pathDiff;
    return String(a.method).localeCompare(String(b.method));
  });

  return {
    generatedAt: resolveGeneratedAt(),
    source: 'static_analysis_live_core',
    counts: {
      endpoints: flat.length
    },
    rules: {
      admin_paths_must_admin_token: true,
      internal_paths_must_internal_token: true,
      dangerous_ops_confirm_token_required_paths: Array.from(DANGEROUS_CONFIRM_TOKEN_PATHS.values()).sort((a, b) => a.localeCompare(b))
    },
    global_evidence: [
      'src/index.js:1',
      'src/domain/security/protectionMatrix.js:1'
    ],
    protection_matrix: flat,
    violations: []
  };
}

function buildKillSwitchPoints() {
  const points = [];
  const files = listJsFiles(SRC_DIR);
  files.forEach((filePath) => {
    const rel = toRepoRelative(filePath);
    const lines = readText(filePath).split(/\r?\n/);
    lines.forEach((line, idx) => {
      const symbols = [];
      if (/\bgetKillSwitch\b/.test(line)) symbols.push('getKillSwitch');
      if (/\bsetKillSwitch\b/.test(line)) symbols.push('setKillSwitch');
      if (/\bkillSwitch\b/.test(line) && symbols.length === 0) symbols.push('killSwitch');
      symbols.forEach((symbol) => {
        points.push({
          file: rel,
          line: idx + 1,
          symbol
        });
      });
    });
  });

  const dedup = new Map();
  points.forEach((row) => {
    const key = `${row.file}:${row.line}:${row.symbol}`;
    if (!dedup.has(key)) dedup.set(key, row);
  });

  const normalized = Array.from(dedup.values()).sort((a, b) => {
    const fileDiff = String(a.file).localeCompare(String(b.file));
    if (fileDiff !== 0) return fileDiff;
    const lineDiff = Number(a.line) - Number(b.line);
    if (lineDiff !== 0) return lineDiff;
    return String(a.symbol).localeCompare(String(b.symbol));
  });

  return { kill_switch_points: normalized };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeComparableJson(filePath, jsonText) {
  if (filePath !== OUTPUT_FILES.protectionMatrix) return jsonText;
  try {
    const parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed === 'object') delete parsed.generatedAt;
    return stableJson(parsed);
  } catch (_err) {
    return jsonText;
  }
}

function writeOrCheck(filePath, payload, checkMode) {
  const next = stableJson(payload);
  if (!checkMode) {
    fs.writeFileSync(filePath, next, 'utf8');
    return;
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`${toRepoRelative(filePath)} is missing. run: npm run audit-core:generate`);
  }
  const current = fs.readFileSync(filePath, 'utf8');
  if (normalizeComparableJson(filePath, current) !== normalizeComparableJson(filePath, next)) {
    throw new Error(`${toRepoRelative(filePath)} is stale. run: npm run audit-core:generate`);
  }
}

function buildLiveCounts() {
  const core = buildCoreMappings();
  const usecaseNames = new Set();
  Object.values(core.routeToUsecase || {}).forEach((names) => {
    (names || []).forEach((name) => usecaseNames.add(name));
  });

  const repoNames = new Set();
  Object.values(core.usecaseToRepo || {}).forEach((names) => {
    (names || []).forEach((name) => repoNames.add(name));
  });

  const collectionNames = new Set();
  Object.values(core.repoToCollection || {}).forEach((names) => {
    (names || []).forEach((name) => collectionNames.add(name));
  });

  return {
    routes: Object.keys(core.routeToUsecase || {}).length,
    usecases: usecaseNames.size,
    repos: repoNames.size,
    collections: collectionNames.size
  };
}

function run() {
  const checkMode = process.argv.includes('--check');
  const core = buildCoreMappings();

  const outputs = {
    [OUTPUT_FILES.featureMap]: buildFeatureMap(core),
    [OUTPUT_FILES.dependencyGraph]: buildDependencyGraph(core),
    [OUTPUT_FILES.dataModelMap]: buildDataModelMap(core),
    [OUTPUT_FILES.stateTransitions]: buildStateTransitions(),
    [OUTPUT_FILES.designAiMeta]: buildDesignAiMeta(core),
    [OUTPUT_FILES.protectionMatrix]: buildProtectionMatrix(core),
    [OUTPUT_FILES.killSwitchPoints]: buildKillSwitchPoints()
  };

  try {
    Object.entries(outputs).forEach(([filePath, payload]) => {
      writeOrCheck(filePath, payload, checkMode);
    });
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }

  if (checkMode) {
    process.stdout.write('audit core maps are up to date\n');
  } else {
    process.stdout.write('generated: docs/REPO_AUDIT_INPUTS core maps\n');
  }
}

module.exports = {
  buildCoreMappings,
  buildLiveCounts,
  buildFeatureMap,
  buildDependencyGraph,
  buildDataModelMap,
  buildStateTransitions,
  buildDesignAiMeta,
  buildProtectionMatrix,
  buildKillSwitchPoints
};

if (require.main === module) {
  run();
}
