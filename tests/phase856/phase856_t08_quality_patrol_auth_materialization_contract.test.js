'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('phase856: quality patrol workflow prepares an external-account bridge before cycle run', () => {
  const workflow = fs.readFileSync('.github/workflows/quality-patrol.yml', 'utf8');

  assert.match(workflow, /name:\s+Prepare Firebase Admin external-account bridge/);
  assert.match(workflow, /GOOGLE_GHA_CREDS_PATH/);
  assert.match(workflow, /ExternalAccountClient/);
  assert.match(workflow, /ExternalAccountCredential extends ComputeEngineCredential/);
  assert.match(workflow, /QUALITY_PATROL_AUTH_BRIDGE=external_account/);
  assert.match(workflow, /NODE_OPTIONS=--require=\$BRIDGE_PATH/);
});

test('phase856: quality patrol workflow probes Firebase Admin before cycle artifacts', () => {
  const workflow = fs.readFileSync('.github/workflows/quality-patrol.yml', 'utf8');

  assert.match(workflow, /name:\s+Diagnose Firebase Admin bridge/);
  assert.match(workflow, /require\('firebase-admin'\)/);
  assert.match(workflow, /__quality_patrol_adc_probe__\/noop/);
  assert.ok(workflow.indexOf('Diagnose Firebase Admin bridge') < workflow.indexOf('Run quality patrol cycle'));
});
