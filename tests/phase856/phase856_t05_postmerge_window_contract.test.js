'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  VERIFY_VERSION,
  buildPostmergeRuntimeWindowVerification,
  run
} = require('../../tools/quality_patrol/verify_postmerge_runtime_window');
const { tempJsonPath, cleanupPaths } = require('../phase855/phase855_helpers');

test('phase856: post-merge verification detects window end after merge and written>=5', () => {
  const artifact = buildPostmergeRuntimeWindowVerification({
    mergeCommit: 'abc123',
    mergeAt: '2026-03-15T16:05:59Z',
    latestArtifact: {
      backlogSeparation: {
        currentRuntime: {
          status: 'healthy',
          window: {
            fromAt: '2026-03-15T16:06:01Z',
            toAt: '2026-03-15T16:10:00Z'
          },
          observedCount: 5
        },
        historicalDebt: {
          status: 'stagnating',
          observedCount: 80,
          debtCounts: {
            skipped_unreviewable_transcript: 16,
            assistant_reply_missing: 11,
            action_trace_join_limited: 71
          }
        },
        backlogSeparationGate: {
          decision: 'NO_GO',
          prDStatus: 'deferred'
        }
      },
      decayAwareReadiness: {
        recentWindow: {
          written: 5
        },
        fullWindow: {
          written: 64
        }
      }
    },
    replayArtifact: {
      replayVersion: 'quality_patrol_replay_harness_v1',
      replayCount: 5,
      events: [{ requestId: 'req_1' }]
    }
  });

  assert.equal(artifact.verificationVersion, VERIFY_VERSION);
  assert.equal(artifact.windowEndsAfterMerge, true);
  assert.equal(artifact.recentWrittenAtLeast5, true);
  assert.equal(artifact.currentRuntime.status, 'healthy');
  assert.equal(artifact.historicalDebt.status, 'stagnating');
  assert.equal(artifact.backlogSeparationGate.decision, 'NO_GO');
  assert.deepEqual(artifact.replaySummary.requestIds, ['req_1']);
});

test('phase856: verify script writes non-breaking artifact shape from input files', async () => {
  const latestPath = tempJsonPath('postmerge_latest');
  const metricsPath = tempJsonPath('postmerge_metrics');
  const replayPath = tempJsonPath('postmerge_replay');
  const outputPath = tempJsonPath('postmerge_verify');

  fs.writeFileSync(latestPath, `${JSON.stringify({
    backlogSeparation: {
      currentRuntime: {
        status: 'healthy',
        window: {
          fromAt: '2026-03-15T15:05:17.205Z',
          toAt: '2026-03-15T16:15:25.096Z'
        },
        observedCount: 5
      },
      historicalDebt: {
        status: 'stagnating',
        observedCount: 80,
        debtCounts: {
          skipped_unreviewable_transcript: 16,
          assistant_reply_missing: 11,
          action_trace_join_limited: 71
        }
      },
      backlogSeparationGate: {
        decision: 'NO_GO',
        prDStatus: 'deferred'
      }
    },
    decayAwareReadiness: {
      recentWindow: {
        fromAt: '2026-03-15T15:05:17.205Z',
        toAt: '2026-03-15T16:15:25.096Z',
        written: 5
      },
      fullWindow: {
        fromAt: '2026-03-14T00:49:26.061Z',
        toAt: '2026-03-15T16:15:25.096Z',
        written: 64
      }
    }
  }, null, 2)}\n`);
  fs.writeFileSync(metricsPath, `${JSON.stringify({ metrics: {} }, null, 2)}\n`);
  fs.writeFileSync(replayPath, `${JSON.stringify({
    replayVersion: 'quality_patrol_replay_harness_v1',
    replayCount: 5,
    events: [{ requestId: 'req_1' }, { requestId: 'req_2' }]
  }, null, 2)}\n`);

  const result = await run([
    'node',
    'tools/quality_patrol/verify_postmerge_runtime_window.js',
    '--merge-commit',
    'c8fd40a2',
    '--merge-at',
    '2026-03-15T16:05:59Z',
    '--metrics',
    metricsPath,
    '--latest',
    latestPath,
    '--replay',
    replayPath,
    '--output',
    outputPath
  ]);

  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(result.outputPath, outputPath);
  assert.equal(written.verificationVersion, VERIFY_VERSION);
  assert.equal(written.windowEndsAfterMerge, true);
  assert.equal(written.recentWrittenAtLeast5, true);
  assert.equal(written.currentRuntime.status, 'healthy');
  assert.equal(written.backlogSeparationGate.prDStatus, 'deferred');

  cleanupPaths(latestPath, metricsPath, replayPath, outputPath);
});
