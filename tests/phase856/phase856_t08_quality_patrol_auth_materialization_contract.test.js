'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('phase856: quality patrol workflow materializes supported ADC before cycle run', () => {
  const workflow = fs.readFileSync('.github/workflows/quality-patrol.yml', 'utf8');

  assert.match(workflow, /name:\s+Materialize Firebase Admin ADC/);
  assert.match(workflow, /GOOGLE_GHA_CREDS_PATH/);
  assert.match(workflow, /application_default_credentials\.json/);
  assert.match(workflow, /impersonated_service_account\|service_account\|authorized_user/);
  assert.match(workflow, /CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE=/);
  assert.match(workflow, /QUALITY_PATROL_ADC_TYPE/);
});

test('phase856: quality patrol workflow probes Firebase Admin before cycle artifacts', () => {
  const workflow = fs.readFileSync('.github/workflows/quality-patrol.yml', 'utf8');

  assert.match(workflow, /name:\s+Diagnose Firebase Admin ADC/);
  assert.match(workflow, /require\('firebase-admin'\)/);
  assert.match(workflow, /__quality_patrol_adc_probe__\/noop/);
  assert.ok(workflow.indexOf('Diagnose Firebase Admin ADC') < workflow.indexOf('Run quality patrol cycle'));
});
