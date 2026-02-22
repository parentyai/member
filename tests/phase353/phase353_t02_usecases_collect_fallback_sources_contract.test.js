'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('phase353: summary/state usecases track fallback source diagnostics', () => {
  const userSummary = read('src/usecases/admin/getUserOperationalSummary.js');
  const notificationSummary = read('src/usecases/admin/getNotificationOperationalSummary.js');
  const userState = read('src/usecases/phase5/getUserStateSummary.js');

  [userSummary, notificationSummary, userState].forEach((src) => {
    assert.ok(src.includes('const fallbackSources = [];'));
    assert.ok(src.includes('fallbackUsed: fallbackSources.length > 0'));
    assert.ok(src.includes('fallbackBlocked: fallbackBlockedNotAvailable'));
    assert.ok(src.includes('fallbackSources'));
  });
});
