'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase664: firestore infra wraps missing firebase-admin with FIRESTORE_SDK_MISSING contract', () => {
  const src = fs.readFileSync('src/infra/firestore.js', 'utf8');
  assert.ok(src.includes('function isFirebaseAdminModuleNotFound(err)'));
  assert.ok(src.includes('function buildFirestoreSdkMissingError(innerError)'));
  assert.ok(src.includes("error.code = 'FIRESTORE_SDK_MISSING'"));
  assert.ok(src.includes('if (isFirebaseAdminModuleNotFound(err)) {'));
});
