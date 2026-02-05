'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const runner = require('../../scripts/phase22_run_day_window');

function withPatchedSpawnSync(stub, fn) {
  const child = require('node:child_process');
  const original = child.spawnSync;
  child.spawnSync = stub;
  try {
    return fn();
  } finally {
    child.spawnSync = original;
  }
}

test('phase22 t02: verify then kpi order with args', () => {
  const calls = [];
  const verifyArgs = runner.buildVerifyArgs('https://track', 'lr1');
  const kpiArgs = runner.buildKpiArgs('openA', 'openB', '2026-02-05T00:00:00Z', '2026-02-06T00:00:00Z');

  withPatchedSpawnSync((cmd, args) => {
    calls.push([cmd, args]);
    const script = args[0];
    if (script.includes('phase21_verify_day_window.js')) {
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 0, stdout: '{"ok":true}', stderr: '' };
  }, () => {
    runner.runScript(require('path').resolve(__dirname, '../../scripts/phase21_verify_day_window.js'), verifyArgs);
    runner.runScript(require('path').resolve(__dirname, '../../scripts/phase22_cta_kpi_snapshot.js'), kpiArgs);
  });

  assert.equal(calls.length, 2);
  assert.ok(calls[0][1][0].includes('phase21_verify_day_window.js'));
  assert.ok(calls[1][1][0].includes('phase22_cta_kpi_snapshot.js'));
});

test('phase22 t02: exit code mapping to env error', () => {
  const exitCode = runner.classifyExit('VERIFY_ENV_ERROR: firebase-admin missing');
  assert.equal(exitCode, 2);
});

test('phase22 t02: exit code mapping to runtime error', () => {
  const exitCode = runner.classifyExit('some error');
  assert.equal(exitCode, 1);
});

test('phase22 t02: run executes verify then kpi', () => {
  const calls = [];
  const originalArgv = process.argv.slice();
  const originalExit = process.exit;
  const originalStdout = process.stdout.write;

  process.argv = [
    'node',
    'scripts/phase22_run_day_window.js',
    '--track-base-url',
    'https://track',
    '--linkRegistryId',
    'lr1',
    '--ctaA',
    'openA',
    '--ctaB',
    'openB',
    '--from',
    '2026-02-05T00:00:00Z',
    '--to',
    '2026-02-06T00:00:00Z',
    '--runs',
    '1'
  ];

  process.stdout.write = () => true;
  process.exit = (code) => {
    throw new Error(`exit:${code}`);
  };

  try {
    withPatchedSpawnSync((cmd, args) => {
      calls.push([cmd, args]);
      const script = args[0];
      if (script.includes('phase21_verify_day_window.js')) {
        return { status: 0, stdout: '', stderr: '' };
      }
      return { status: 0, stdout: '{\"ok\":true}', stderr: '' };
    }, () => {
      try {
        runner.run();
      } catch (err) {
        if (!String(err.message || '').startsWith('exit:')) throw err;
      }
    });
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit;
    process.stdout.write = originalStdout;
  }

  assert.equal(calls.length, 2);
  assert.ok(calls[0][1][0].includes('phase21_verify_day_window.js'));
  assert.ok(calls[1][1][0].includes('phase22_cta_kpi_snapshot.js'));
});
