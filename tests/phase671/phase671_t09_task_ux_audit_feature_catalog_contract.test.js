'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase671: ops feature catalog evaluates task ux audit feature rows', () => {
  const src = fs.readFileSync('src/usecases/admin/opsSnapshot/computeOpsFeatureCatalogStatus.js', 'utf8');
  assert.ok(src.includes("featureId: 'task_read_model_overlap'"));
  assert.ok(src.includes("featureId: 'task_key_integrity'"));
  assert.ok(src.includes("featureId: 'link_registry_impact'"));
  assert.ok(src.includes("feature.featureId === 'task_read_model_overlap'"));
  assert.ok(src.includes("feature.featureId === 'task_key_integrity'"));
  assert.ok(src.includes("feature.featureId === 'link_registry_impact'"));
  assert.ok(src.includes('evaluateReadModelOverlap(metrics.readModelOverlap)'));
  assert.ok(src.includes('evaluateTaskKeyIntegrity(metrics.taskKeyLinkage)'));
  assert.ok(src.includes('evaluateLinkRegistryImpact(metrics.linkRegistryImpact)'));
});
