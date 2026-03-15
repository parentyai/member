'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CYCLE_VERSION,
  DEFAULT_PATHS,
  buildDecisionSummary,
  formatDecisionSummary,
  runQualityPatrolCycle
} = require('../../tools/quality_patrol/run_quality_patrol_cycle');
const { tempJsonPath, cleanupPaths } = require('../phase855/phase855_helpers');

function buildPaths() {
  return {
    replay: tempJsonPath('cycle_replay'),
    metrics: tempJsonPath('cycle_metrics'),
    latest: tempJsonPath('cycle_latest'),
    operator: tempJsonPath('cycle_operator'),
    human: tempJsonPath('cycle_human'),
    verify: tempJsonPath('cycle_verify')
  };
}

test('phase856: cycle runner keeps replay -> metrics -> latest -> operator -> human -> verify order', async () => {
  const paths = buildPaths();
  const calls = [];
  const mergeCommit = '9cfabf866ff861a6db16c492756521a244e0429b';
  const mergeAt = '2026-03-15T17:48:17Z';

  const result = await runQualityPatrolCycle({
    userId: 'U3037952f2f6531a3d8b24fd13ca3c680',
    destination: 'debug',
    prefix: 'phase856_cycle',
    mergeCommit,
    mergeAt,
    paths
  }, {
    resolveGitMergeFacts: () => ({ mergeCommit, mergeAt }),
    replaySameTrafficSet: async (options) => {
      calls.push({ step: 'replay', options });
      return { replayCount: 5, outputPath: options.output };
    },
    runMetrics: async (argv) => {
      calls.push({ step: 'metrics', argv });
      return { outputPath: paths.metrics, artifact: { summary: { overallStatus: 'healthy' } } };
    },
    runPatrol: async (argv) => {
      const mode = argv[argv.indexOf('--mode') + 1];
      const audienceIndex = argv.indexOf('--audience');
      const audience = audienceIndex === -1 ? 'operator' : argv[audienceIndex + 1];
      const step = mode === 'latest'
        ? 'latest'
        : (audience === 'human' ? 'human' : 'operator');
      calls.push({ step, argv });
      return {
        outputPath: step === 'latest' ? paths.latest : (step === 'human' ? paths.human : paths.operator),
        artifact: { audience, mode }
      };
    },
    runVerify: async (argv) => {
      calls.push({ step: 'verify', argv });
      return {
        outputPath: paths.verify,
        artifact: {
          windowEndsAfterMerge: true,
          recentWrittenAtLeast5: true,
          currentRuntime: { status: 'healthy' },
          historicalDebt: { status: 'stagnating' },
          backlogSeparationGate: {
            decision: 'NO_GO',
            prDStatus: 'deferred'
          }
        }
      };
    }
  });

  assert.equal(result.cycleVersion, CYCLE_VERSION);
  assert.deepEqual(result.outputs, paths);
  assert.deepEqual(calls.map((row) => row.step), ['replay', 'metrics', 'latest', 'operator', 'human', 'verify']);
  assert.equal(calls[0].options.output, paths.replay);
  assert.deepEqual(calls[1].argv, ['node', 'tools/run_quality_patrol_metrics.js', '--output', paths.metrics]);
  assert.deepEqual(calls[2].argv, ['node', 'tools/run_quality_patrol.js', '--mode', 'latest', '--output', paths.latest]);
  assert.deepEqual(calls[3].argv, ['node', 'tools/run_quality_patrol.js', '--mode', 'newly-detected-improvements', '--output', paths.operator]);
  assert.deepEqual(calls[4].argv, ['node', 'tools/run_quality_patrol.js', '--mode', 'newly-detected-improvements', '--audience', 'human', '--output', paths.human]);
  assert.deepEqual(calls[5].argv, [
    'node',
    'tools/quality_patrol/verify_postmerge_runtime_window.js',
    '--merge-commit',
    mergeCommit,
    '--merge-at',
    mergeAt,
    '--metrics',
    paths.metrics,
    '--latest',
    paths.latest,
    '--replay',
    paths.replay,
    '--output',
    paths.verify
  ]);
  assert.deepEqual(result.summary, {
    runtime: 'healthy',
    backlog: 'stagnating',
    decision: 'NO_GO',
    prD: 'deferred'
  });
  assert.equal(result.summaryText, [
    'QUALITY PATROL STATUS',
    '',
    'runtime: healthy',
    'backlog: stagnating',
    'decision: NO_GO',
    'prD: deferred'
  ].join('\n'));

  cleanupPaths(paths.replay, paths.metrics, paths.latest, paths.operator, paths.human, paths.verify);
});

test('phase856: cycle runner decision logging keeps compressed runtime/backlog summary', () => {
  assert.deepEqual(buildDecisionSummary({
    currentRuntime: { status: 'healthy' },
    historicalDebt: { status: 'stagnating' },
    backlogSeparationGate: {
      decision: 'NO_GO',
      prDStatus: 'deferred'
    }
  }), {
    runtime: 'healthy',
    backlog: 'stagnating',
    decision: 'NO_GO',
    prD: 'deferred'
  });

  assert.equal(formatDecisionSummary({
    runtime: 'healthy',
    backlog: 'stagnating',
    decision: 'NO_GO',
    prD: 'deferred'
  }), [
    'QUALITY PATROL STATUS',
    '',
    'runtime: healthy',
    'backlog: stagnating',
    'decision: NO_GO',
    'prD: deferred'
  ].join('\n'));

  assert.ok(DEFAULT_PATHS.metrics.endsWith('quality_patrol_cycle_metrics.json'));
  assert.ok(DEFAULT_PATHS.latest.endsWith('quality_patrol_cycle_latest.json'));
  assert.ok(DEFAULT_PATHS.operator.endsWith('quality_patrol_cycle_operator.json'));
  assert.ok(DEFAULT_PATHS.human.endsWith('quality_patrol_cycle_human.json'));
  assert.ok(DEFAULT_PATHS.verify.endsWith('quality_patrol_cycle_verify.json'));
});
