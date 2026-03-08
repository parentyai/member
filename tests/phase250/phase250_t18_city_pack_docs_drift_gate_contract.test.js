'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

test('phase250: city pack docs drift gate keeps feature/dependency/data map contract', () => {
  const featureMap = readJson('docs/REPO_AUDIT_INPUTS/feature_map.json');
  const dependencyGraph = readJson('docs/REPO_AUDIT_INPUTS/dependency_graph.json');
  const dataMap = readText('docs/DATA_MAP.md');

  assert.ok(Array.isArray(featureMap.features));
  const cityPackBulletinsFeature = featureMap.features.find((feature) => feature && feature.feature === 'cityPackBulletins');
  assert.ok(cityPackBulletinsFeature, 'feature_map must include cityPackBulletins');
  assert.strictEqual(cityPackBulletinsFeature.auth, 'admin');

  assert.ok(dependencyGraph.route_to_usecase && typeof dependencyGraph.route_to_usecase === 'object');
  assert.ok(
    Object.prototype.hasOwnProperty.call(dependencyGraph.route_to_usecase, 'src/routes/admin/cityPackBulletins.js'),
    'dependency_graph route_to_usecase must include cityPackBulletins route'
  );
  assert.ok(
    Array.isArray(dependencyGraph.repo_to_collection && dependencyGraph.repo_to_collection.cityPackBulletinsRepo),
    'dependency_graph repo_to_collection must include cityPackBulletinsRepo'
  );
  assert.ok(
    dependencyGraph.repo_to_collection.cityPackBulletinsRepo.includes('city_pack_bulletins'),
    'cityPackBulletinsRepo must map to city_pack_bulletins'
  );

  assert.ok(dataMap.includes('city_pack_bulletins/{id}'));
  assert.ok(dataMap.includes('nationwidePolicy'));
  assert.ok(dataMap.includes('federal_only'));
});
