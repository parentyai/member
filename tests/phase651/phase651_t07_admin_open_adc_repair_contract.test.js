'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const {
  parseArgs,
  resolveAdminToken,
  evaluateDashboardHealthPayload,
  evaluateFeatureCatalogHealthPayload
} = require('../../tools/admin_open');

test('phase651: admin_open defaults to preflight on and adc auto-repair on', () => {
  const args = parseArgs([]);
  assert.equal(args.preflight, 'on');
  assert.equal(args.noAdcRepair, false);
});

test('phase651: admin_open supports no-adc-repair opt-out flag', () => {
  const args = parseArgs(['--no-adc-repair']);
  assert.equal(args.noAdcRepair, true);
});

test('phase651: admin_open supports fresh-server opt-in flag', () => {
  const args = parseArgs(['--fresh-server']);
  assert.equal(args.freshServer, true);
});

test('phase651: dashboard health evaluator rejects not_available payloads', () => {
  const result = evaluateDashboardHealthPayload({
    ok: true,
    dataSource: 'not_available',
    fallbackBlocked: true,
    kpis: {
      registrations: { available: false }
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'dashboard_not_available');
});

test('phase651: feature catalog evaluator requires available true', () => {
  const result = evaluateFeatureCatalogHealthPayload({
    ok: true,
    available: false
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'feature_catalog_unavailable');
});

test('phase651: admin_open includes adc reauth workflow contract', () => {
  const src = fs.readFileSync('tools/admin_open.js', 'utf8');

  assert.ok(src.includes("const { runLocalPreflight } = require('./admin_local_preflight');"));
  assert.ok(src.includes('async function maybeRepairAdcForLocalReadPath(opts, projectId)'));
  assert.ok(src.includes("ADC expired; launching browser for gcloud application-default login"));
  assert.ok(src.includes("runCommand('gcloud', ['auth', 'application-default', 'login']"));
  assert.ok(src.includes("runCommand('gcloud', ['auth', 'application-default', 'print-access-token']"));
  assert.ok(src.includes('existing server health check failed'));
  assert.ok(src.includes('mode=fresh-server'));
  assert.ok(src.includes('[admin:open] adc='));
});

test('phase651: resolveAdminToken retries after gcloud auth login when secret access requires interactive reauth', () => {
  const calls = [];
  let secretAccessAttempts = 0;
  const run = (cmd, args) => {
    calls.push([cmd, args.slice()]);
    if (cmd !== 'gcloud') return { status: 1, stdout: '', stderr: 'unsupported' };
    if (args[0] === 'secrets') {
      secretAccessAttempts += 1;
      if (secretAccessAttempts === 1) {
        return {
          status: 1,
          stdout: '',
          stderr: 'Reauthentication failed. cannot prompt during non-interactive execution. Please run: gcloud auth login'
        };
      }
      return { status: 0, stdout: 'phase651_token_from_secret\n', stderr: '' };
    }
    if (args[0] === 'auth' && args[1] === 'login') {
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected args' };
  };

  const resolved = resolveAdminToken(
    {},
    {
      env: {},
      runCommand: run,
      resolveProjectId: () => ({ projectId: 'phase651-proj', source: 'stub' }),
      log: () => {}
    }
  );

  assert.equal(resolved.token, 'phase651_token_from_secret');
  assert.equal(resolved.source, 'secretmanager:phase651-proj/ADMIN_OS_TOKEN');
  assert.deepEqual(
    calls.map((entry) => entry[1].slice(0, 2)),
    [
      ['secrets', 'versions'],
      ['auth', 'login'],
      ['secrets', 'versions']
    ]
  );
});

test('phase651: resolveAdminToken returns explicit error when gcloud auth login retry fails', () => {
  const run = (cmd, args) => {
    if (cmd !== 'gcloud') return { status: 1, stdout: '', stderr: 'unsupported' };
    if (args[0] === 'secrets') {
      return {
        status: 1,
        stdout: '',
        stderr: 'Reauthentication failed. cannot prompt during non-interactive execution. Please run: gcloud auth login'
      };
    }
    if (args[0] === 'auth' && args[1] === 'login') {
      return { status: 1, stdout: '', stderr: 'login denied' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected args' };
  };

  const resolved = resolveAdminToken(
    {},
    {
      env: {},
      runCommand: run,
      resolveProjectId: () => ({ projectId: 'phase651-proj', source: 'stub' }),
      log: () => {}
    }
  );

  assert.equal(resolved.token, '');
  assert.equal(resolved.source, 'unresolved');
  assert.match(resolved.error, /gcloud auth login failed/i);
  assert.match(resolved.error, /login denied/i);
});
