'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  resolveSnapshotReadMode,
  isSnapshotReadEnabled,
  isSnapshotRequired,
  isFallbackAllowed
} = require('../../src/domain/readModel/snapshotReadPolicy');

test('phase312: snapshot read mode defaults to prefer', () => {
  const prevMode = process.env.OPS_SNAPSHOT_MODE;
  const prevLegacy = process.env.OPS_SNAPSHOT_READ_ENABLED;
  delete process.env.OPS_SNAPSHOT_MODE;
  delete process.env.OPS_SNAPSHOT_READ_ENABLED;
  try {
    const mode = resolveSnapshotReadMode({});
    assert.strictEqual(mode, 'prefer');
    assert.strictEqual(isSnapshotReadEnabled(mode), true);
    assert.strictEqual(isSnapshotRequired(mode), false);
    assert.strictEqual(isFallbackAllowed(mode), true);
  } finally {
    if (prevMode === undefined) delete process.env.OPS_SNAPSHOT_MODE;
    else process.env.OPS_SNAPSHOT_MODE = prevMode;
    if (prevLegacy === undefined) delete process.env.OPS_SNAPSHOT_READ_ENABLED;
    else process.env.OPS_SNAPSHOT_READ_ENABLED = prevLegacy;
  }
});

test('phase312: snapshot read mode supports require and legacy disabled compatibility', () => {
  const prevMode = process.env.OPS_SNAPSHOT_MODE;
  const prevLegacy = process.env.OPS_SNAPSHOT_READ_ENABLED;
  try {
    process.env.OPS_SNAPSHOT_MODE = 'require';
    let mode = resolveSnapshotReadMode({});
    assert.strictEqual(mode, 'require');
    assert.strictEqual(isSnapshotRequired(mode), true);
    assert.strictEqual(isFallbackAllowed(mode), false);

    delete process.env.OPS_SNAPSHOT_MODE;
    process.env.OPS_SNAPSHOT_READ_ENABLED = '0';
    mode = resolveSnapshotReadMode({});
    assert.strictEqual(mode, 'disabled');
    assert.strictEqual(isSnapshotReadEnabled(mode), false);
    assert.strictEqual(isFallbackAllowed(mode), true);
  } finally {
    if (prevMode === undefined) delete process.env.OPS_SNAPSHOT_MODE;
    else process.env.OPS_SNAPSHOT_MODE = prevMode;
    if (prevLegacy === undefined) delete process.env.OPS_SNAPSHOT_READ_ENABLED;
    else process.env.OPS_SNAPSHOT_READ_ENABLED = prevLegacy;
  }
});
