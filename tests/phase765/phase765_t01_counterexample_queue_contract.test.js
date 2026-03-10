'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildQueue, classifyCounterexample, main } = require('../../tools/llm_quality/build_counterexample_queue');

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

test('phase765: classifyCounterexample maps loop/default_casual to CE-06', () => {
  const row = classifyCounterexample({
    category: 'loop_case',
    signal: 'routerReason:default_casual',
    severity: 'high'
  });
  assert.equal(row.counterexampleId, 'CE-06');
});

test('phase765: buildQueue deduplicates by counterexampleId + signal and respects limit', () => {
  const queue = buildQueue({
    latest: {
      entries: [
        { category: 'loop_case', signal: 'routerReason:default_casual', severity: 'high', rank: 1 },
        { category: 'loop_case', signal: 'routerReason:default_casual', severity: 'high', rank: 2 },
        { category: 'line_fit_failure', signal: 'retrieveNeededRate', severity: 'medium', rank: 1 }
      ]
    }
  }, 1);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].counterexampleId, 'CE-06');
});

test('phase765: counterexample queue script builds output from failure register', () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase765-counterexample-'));
  const registerPath = path.join(workDir, 'register.json');
  const outPath = path.join(workDir, 'queue.json');
  writeJson(registerPath, {
    latest: {
      id: 'failure_snapshot_1',
      entries: [
        { category: 'context_loss_case', signal: 'followup:none', severity: 'high', rank: 1 },
        { category: 'jp_service_failure', signal: 'legacyTemplateHitRate', severity: 'high', rank: 1 }
      ]
    }
  });

  const code = main([
    'node',
    'build_counterexample_queue.js',
    '--register',
    registerPath,
    '--output',
    outPath,
    '--limit',
    '5'
  ]);
  assert.equal(code, 0);

  const payload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(payload.latestFailureSnapshotId, 'failure_snapshot_1');
  assert.equal(Array.isArray(payload.queue), true);
  assert.equal(payload.queue.length, 2);
  assert.equal(payload.queue.some((row) => row.counterexampleId === 'CE-01'), true);
  assert.equal(payload.queue.some((row) => row.counterexampleId === 'CE-04'), true);
});
