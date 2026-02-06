'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const smoke = require('../../scripts/phase22_kpi_snapshot_smoke');

function baseArgs() {
  return {
    ctaA: 'openA',
    ctaB: 'openB',
    from: '2026-02-05T00:00:00Z',
    to: '2026-02-06T00:00:00Z'
  };
}

test('phase22 t22: ok=true payload includes required keys', () => {
  const args = baseArgs();
  const payload = smoke.buildPayload(args, { status: 0, stdout: '{"ok":true}', stderr: '' });
  assert.equal(payload.ok, true);
  assert.equal(payload.exitCode, 0);
  assert.ok(Object.prototype.hasOwnProperty.call(payload, 'stdoutHead'));
  assert.ok(Object.prototype.hasOwnProperty.call(payload, 'stderrHead'));
  assert.ok(Object.prototype.hasOwnProperty.call(payload, 'stderrBytes'));
});

test('phase22 t22: stderr present yields head and bytes', () => {
  const args = baseArgs();
  const payload = smoke.buildPayload(args, { status: 1, stdout: '', stderr: 'boom\nline2' });
  assert.equal(payload.ok, false);
  assert.equal(payload.stderrHead, 'boom\nline2');
  assert.equal(payload.stderrBytes > 0, true);
});

test('phase22 t22: stderr empty yields (empty) head and 0 bytes', () => {
  const args = baseArgs();
  const payload = smoke.buildPayload(args, { status: 1, stdout: '', stderr: '' });
  assert.equal(payload.ok, false);
  assert.equal(payload.stderrHead, '(empty)');
  assert.equal(payload.stderrBytes, 0);
});
