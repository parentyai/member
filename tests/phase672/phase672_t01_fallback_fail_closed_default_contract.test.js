'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('phase672: phase4/phase5 read-model usecases resolve fallback mode via fail-closed policy default', () => {
  const userSummary = read('src/usecases/admin/getUserOperationalSummary.js');
  const notificationSummary = read('src/usecases/admin/getNotificationOperationalSummary.js');
  const userState = read('src/usecases/phase5/getUserStateSummary.js');

  [userSummary, notificationSummary, userState].forEach((src) => {
    assert.ok(src.includes("require('../../domain/readModel/fallbackPolicy')"));
    assert.ok(src.includes('FALLBACK_MODE_BLOCK'));
    assert.ok(!src.includes('return FALLBACK_MODE_ALLOW;'));
    assert.ok(src.includes('const fallbackBlocked = fallbackMode === FALLBACK_MODE_BLOCK;'));
  });

  assert.ok(userSummary.includes('const fallbackMode = resolveFallbackMode(opts.fallbackMode);'));
  assert.ok(notificationSummary.includes('const fallbackMode = resolveFallbackMode(opts.fallbackMode);'));
  assert.ok(userState.includes('const fallbackMode = resolveFallbackMode(payload.fallbackMode);'));
});
