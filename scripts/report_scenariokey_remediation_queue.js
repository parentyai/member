'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
}

function uniqSorted(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function areaOf(filePath) {
  const value = String(filePath || '').trim();
  if (!value) return 'unknown';
  if (value.startsWith('src/routes/')) return 'routes';
  if (value.startsWith('src/usecases/')) return 'usecases';
  if (value.startsWith('src/repos/')) return 'repos';
  if (value.startsWith('src/domain/')) return 'domain';
  if (value.startsWith('src/')) return 'src_other';
  return 'other';
}

function fileStem(filePath) {
  const base = path.basename(String(filePath || '').trim());
  return base.endsWith('.js') ? base.slice(0, -3) : base;
}

function intersects(a, b) {
  if (!a.length || !b.length) return false;
  const setB = new Set(b);
  return a.some((item) => setB.has(item));
}

function collectSignals(absFilePath) {
  if (!fs.existsSync(absFilePath)) {
    return {
      exists: false,
      hasWriteSignal: false,
      hasReadSignal: false
    };
  }
  const source = fs.readFileSync(absFilePath, 'utf8');
  return {
    exists: true,
    hasWriteSignal: /(\.set\(|\.add\(|\.update\(|\.create\(|\.patch\(|append|upsert|save)/.test(source),
    hasReadSignal: /(list|query|get|where\(|orderBy\(|find)/.test(source)
  };
}

function scoreItem(input) {
  const areaWeight = {
    repos: 3,
    usecases: 2,
    routes: 1,
    domain: 1,
    src_other: 0,
    other: 0,
    unknown: 0
  };
  const score = (areaWeight[input.area] || 0)
    + Math.min(input.features.length, 4)
    + (input.signals.hasWriteSignal ? 3 : 0)
    + (input.collections.length > 0 ? 1 : 0);
  const priorityBand = score >= 8 ? 'P1_high' : score >= 5 ? 'P1_medium' : 'P1_low';
  return { score, priorityBand };
}

function run() {
  const designMeta = readJson('docs', 'REPO_AUDIT_INPUTS', 'design_ai_meta.json');
  const depGraph = readJson('docs', 'REPO_AUDIT_INPUTS', 'dependency_graph.json');
  const featureMap = readJson('docs', 'REPO_AUDIT_INPUTS', 'feature_map.json');

  const scenarioKeyPaths = uniqSorted(
    designMeta
    && designMeta.naming_drift
    && Array.isArray(designMeta.naming_drift.scenarioKey)
      ? designMeta.naming_drift.scenarioKey
      : []
  );

  const routeToUsecases = depGraph && typeof depGraph.route_to_usecase === 'object' ? depGraph.route_to_usecase : {};
  const usecaseToRepos = depGraph && typeof depGraph.usecase_to_repo === 'object' ? depGraph.usecase_to_repo : {};
  const repoToCollections = depGraph && typeof depGraph.repo_to_collection === 'object' ? depGraph.repo_to_collection : {};
  const features = Array.isArray(featureMap.features) ? featureMap.features : [];

  const items = scenarioKeyPaths.map((filePath) => {
    const area = areaOf(filePath);
    const absFilePath = path.join(ROOT, filePath);
    const signals = collectSignals(absFilePath);

    let usecases = [];
    let repos = [];
    if (area === 'routes') {
      usecases = uniqSorted(routeToUsecases[filePath] || []);
    } else if (area === 'usecases') {
      usecases = uniqSorted([fileStem(filePath)]);
    } else if (area === 'repos') {
      repos = uniqSorted([fileStem(filePath)]);
    }

    usecases.forEach((usecase) => {
      repos = repos.concat(usecaseToRepos[usecase] || []);
    });
    repos = uniqSorted(repos);

    let collections = [];
    repos.forEach((repo) => {
      collections = collections.concat(repoToCollections[repo] || []);
    });
    collections = uniqSorted(collections);

    const featureHits = uniqSorted(
      features
        .filter((feature) => {
          const featureUsecases = uniqSorted(feature && feature.usecases);
          const featureRepos = uniqSorted(feature && feature.repos);
          return intersects(featureUsecases, usecases) || intersects(featureRepos, repos);
        })
        .map((feature) => feature && feature.feature)
    );

    const scored = scoreItem({
      area,
      features: featureHits,
      collections,
      signals
    });

    return {
      file: filePath,
      area,
      priorityScore: scored.score,
      priorityBand: scored.priorityBand,
      signals,
      usecases,
      repos,
      collections,
      features: featureHits
    };
  }).sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return a.file.localeCompare(b.file);
  });

  const areaBreakdown = {};
  const priorityBreakdown = {};
  items.forEach((item) => {
    areaBreakdown[item.area] = Number(areaBreakdown[item.area] || 0) + 1;
    priorityBreakdown[item.priorityBand] = Number(priorityBreakdown[item.priorityBand] || 0) + 1;
  });

  const topQueue = items.slice(0, 20).map((item) => ({
    file: item.file,
    area: item.area,
    priorityScore: item.priorityScore,
    priorityBand: item.priorityBand,
    featureCount: item.features.length,
    usecaseCount: item.usecases.length,
    repoCount: item.repos.length,
    collectionCount: item.collections.length,
    hasWriteSignal: item.signals.hasWriteSignal
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      designMeta: 'docs/REPO_AUDIT_INPUTS/design_ai_meta.json',
      dependencyGraph: 'docs/REPO_AUDIT_INPUTS/dependency_graph.json',
      featureMap: 'docs/REPO_AUDIT_INPUTS/feature_map.json'
    },
    summary: {
      scenarioKeyPathCount: scenarioKeyPaths.length,
      areaBreakdown,
      priorityBreakdown
    },
    topQueue,
    items
  };

  process.stdout.write('[scenariokey-remediation-queue] report\n');
  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n');
}

run();
