'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const CONFIRM_TOKEN_ROUTE_FILES = [
  'src/routes/admin/osKillSwitch.js',
  'src/routes/admin/osConfig.js',
  'src/routes/admin/osAutomationConfig.js',
  'src/routes/admin/osDeliveryRecovery.js',
  'src/routes/admin/osDeliveryBackfill.js',
  'src/routes/admin/cityPacks.js',
  'src/routes/admin/journeyPolicyConfig.js',
  'src/routes/admin/llmConfig.js',
  'src/routes/admin/llmPolicyConfig.js'
];

test('phase657: dangerous admin write routes keep planHash/confirmToken two-step guard', () => {
  for (const filePath of CONFIRM_TOKEN_ROUTE_FILES) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.ok(src.includes('createConfirmToken('), `${filePath} must keep createConfirmToken`);
    assert.ok(src.includes('verifyConfirmToken('), `${filePath} must keep verifyConfirmToken`);
    assert.ok(src.includes('planHash/confirmToken required'), `${filePath} must require planHash/confirmToken`);
  }
});
