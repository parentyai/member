'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeJourneyGraphCatalog } = require('../../src/repos/firestore/journeyGraphCatalogRepo');

test('phase665: journey graph normalize supports node aliases and edge enabled/version add-only fields', () => {
  const normalized = normalizeJourneyGraphCatalog({
    enabled: true,
    schemaVersion: 3,
    nodes: [
      {
        id: 'P1-A',
        phase: 'P1',
        domain: 'legal',
        title: 'task A',
        prereqIds: ['P0-Z'],
        defaultDeadlineOffset: 2,
        unlockCondition: 'address_ready',
        completionCriteria: 'upload_evidence',
        planTier: 'all'
      }
    ],
    edges: [
      {
        edgeId: 'edge_1',
        fromNode: 'P0-Z',
        toNode: 'P1-A',
        type: 'address_dependency',
        required: true,
        enabled: false,
        version: 2
      }
    ]
  });

  assert.ok(normalized);
  assert.equal(normalized.nodes.length, 1);
  assert.equal(normalized.nodes[0].nodeKey, 'P1-A');
  assert.equal(normalized.nodes[0].id, 'P1-A');
  assert.equal(normalized.nodes[0].phase, 'P1');
  assert.equal(normalized.nodes[0].domain, 'legal');
  assert.deepEqual(normalized.nodes[0].prereqIds, ['P0-Z']);
  assert.equal(normalized.nodes[0].defaultDeadlineOffset, 2);
  assert.equal(normalized.nodes[0].unlockCondition, 'address_ready');
  assert.equal(normalized.nodes[0].completionCriteria, 'upload_evidence');

  assert.equal(normalized.edges.length, 2);
  const explicitEdge = normalized.edges.find((edge) => edge && edge.edgeId === 'edge_1');
  assert.ok(explicitEdge);
  assert.equal(explicitEdge.from, 'P0-Z');
  assert.equal(explicitEdge.to, 'P1-A');
  assert.equal(explicitEdge.enabled, false);
  assert.equal(explicitEdge.version, 2);
  assert.equal(explicitEdge.type, 'address_dependency');
});
