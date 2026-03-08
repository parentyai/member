'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { parseArgs } = require('../../tools/admin_open');

test('phase651: admin_open defaults to preflight on and adc auto-repair on', () => {
  const args = parseArgs([]);
  assert.equal(args.preflight, 'on');
  assert.equal(args.noAdcRepair, false);
});

test('phase651: admin_open supports no-adc-repair opt-out flag', () => {
  const args = parseArgs(['--no-adc-repair']);
  assert.equal(args.noAdcRepair, true);
});

test('phase651: admin_open includes adc reauth workflow contract', () => {
  const src = fs.readFileSync('tools/admin_open.js', 'utf8');

  assert.ok(src.includes("const { runLocalPreflight } = require('./admin_local_preflight');"));
  assert.ok(src.includes('async function maybeRepairAdcForLocalReadPath(opts, projectId)'));
  assert.ok(src.includes("ADC expired; launching browser for gcloud application-default login"));
  assert.ok(src.includes("runCommand('gcloud', ['auth', 'application-default', 'login']"));
  assert.ok(src.includes("runCommand('gcloud', ['auth', 'application-default', 'print-access-token']"));
  assert.ok(src.includes('[admin:open] adc='));
});
