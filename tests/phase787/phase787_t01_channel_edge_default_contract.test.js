'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveV1FeatureMatrix } = require('../../src/v1/shared/featureMatrix');

test('phase787: feature matrix defaults channel edge on when env is unset', () => {
  const matrix = resolveV1FeatureMatrix({});
  assert.equal(matrix.channelEdge, true, 'channel edge default must be true');
});

test('phase787: feature matrix keeps rollback path for explicit false', () => {
  const matrix = resolveV1FeatureMatrix({ ENABLE_V1_CHANNEL_EDGE: 'false' });
  assert.equal(matrix.channelEdge, false, 'channel edge should honor explicit false rollback');
});

test('phase787: webhook resolver default for ENABLE_V1_CHANNEL_EDGE is true', () => {
  const filePath = path.resolve(process.cwd(), 'src/routes/webhookLine.js');
  const text = fs.readFileSync(filePath, 'utf8');
  assert.match(
    text,
    /function resolveV1ChannelEdgeEnabled\(\)\s*{\s*return resolveBooleanEnvFlag\('ENABLE_V1_CHANNEL_EDGE', true\);\s*}/s,
    'webhookLine must default ENABLE_V1_CHANNEL_EDGE to true'
  );
});
