'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseArgs,
  evaluateServiceUniqueness
} = require('../../scripts/check_cloud_run_service_uniqueness');

test('phase718: service uniqueness parser accepts required args and allow-missing option', () => {
  const args = parseArgs([
    'node',
    'scripts/check_cloud_run_service_uniqueness.js',
    '--service-name', 'member-webhook',
    '--project-id', 'member-485303',
    '--expected-region', 'us-east1',
    '--allow-missing'
  ]);
  assert.equal(args.serviceName, 'member-webhook');
  assert.equal(args.projectId, 'member-485303');
  assert.equal(args.expectedRegion, 'us-east1');
  assert.equal(args.allowMissing, true);
});

test('phase718: service uniqueness passes when only expected region exists', () => {
  const result = evaluateServiceUniqueness([
    {
      metadata: {
        name: 'member-webhook',
        labels: { 'cloud.googleapis.com/location': 'us-east1' }
      },
      status: { url: 'https://member-webhook-ue.a.run.app' }
    }
  ], {
    serviceName: 'member-webhook',
    expectedRegion: 'us-east1',
    allowMissing: false
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.foundRegions, ['us-east1']);
});

test('phase718: service uniqueness fails when same service exists in multiple regions', () => {
  const result = evaluateServiceUniqueness([
    { metadata: { name: 'member-webhook', labels: { 'cloud.googleapis.com/location': 'us-east1' } } },
    { metadata: { name: 'member-webhook', labels: { 'cloud.googleapis.com/location': 'us-central1' } } }
  ], {
    serviceName: 'member-webhook',
    expectedRegion: 'us-east1',
    allowMissing: false
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.foundRegions, ['us-central1', 'us-east1']);
  assert.deepEqual(result.reasons, ['duplicate_regions_detected']);
});

test('phase718: service uniqueness fails when service exists only outside expected region', () => {
  const result = evaluateServiceUniqueness([
    { metadata: { name: 'member-webhook', labels: { 'cloud.googleapis.com/location': 'us-central1' } } }
  ], {
    serviceName: 'member-webhook',
    expectedRegion: 'us-east1',
    allowMissing: false
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, ['region_mismatch']);
});

test('phase718: service uniqueness handles missing service according to allow-missing flag', () => {
  const strictResult = evaluateServiceUniqueness([], {
    serviceName: 'member-webhook',
    expectedRegion: 'us-east1',
    allowMissing: false
  });
  assert.equal(strictResult.ok, false);
  assert.deepEqual(strictResult.reasons, ['service_missing']);

  const bootstrapResult = evaluateServiceUniqueness([], {
    serviceName: 'member-webhook',
    expectedRegion: 'us-east1',
    allowMissing: true
  });
  assert.equal(bootstrapResult.ok, true);
  assert.deepEqual(bootstrapResult.reasons, []);
});
