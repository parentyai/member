'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeJourneyGraphCatalog } = require('../../src/repos/firestore/journeyGraphCatalogRepo');

test('phase664: journey graph catalog normalize accepts reactionBranches add-only contract', () => {
  const normalized = normalizeJourneyGraphCatalog({
    enabled: true,
    schemaVersion: 2,
    nodes: [
      { nodeKey: 'N1', title: 'Node 1', planTier: 'all' }
    ],
    edges: [],
    ruleSet: {
      reactionBranches: [
        {
          ruleId: 'rb_1',
          enabled: true,
          priority: 10,
          match: {
            actions: ['save'],
            planTiers: ['pro']
          },
          effect: {
            nextTemplateId: 'tmpl_follow_up',
            queueDispatch: true
          }
        }
      ]
    },
    planUnlocks: {
      free: { includePlanTiers: ['all'], maxNextActions: 1 },
      pro: { includePlanTiers: ['all', 'pro'], maxNextActions: 3 }
    }
  });

  assert.ok(normalized);
  assert.equal(normalized.enabled, true);
  assert.equal(Array.isArray(normalized.ruleSet.reactionBranches), true);
  assert.equal(normalized.ruleSet.reactionBranches.length, 1);
  assert.equal(normalized.ruleSet.reactionBranches[0].ruleId, 'rb_1');
  assert.deepEqual(normalized.ruleSet.reactionBranches[0].match.actions, ['save']);
  assert.deepEqual(normalized.ruleSet.reactionBranches[0].match.planTiers, ['pro']);
});

test('phase664: journey graph catalog normalize rejects invalid reaction branch action silently', () => {
  const normalized = normalizeJourneyGraphCatalog({
    enabled: true,
    schemaVersion: 2,
    nodes: [],
    edges: [],
    ruleSet: {
      reactionBranches: [
        {
          ruleId: 'rb_invalid',
          match: { actions: ['click'] },
          effect: { nextTemplateId: 'tmpl_invalid', queueDispatch: true }
        }
      ]
    }
  });

  assert.ok(normalized);
  assert.equal(Array.isArray(normalized.ruleSet.reactionBranches), true);
  assert.equal(normalized.ruleSet.reactionBranches.length, 0);
});
