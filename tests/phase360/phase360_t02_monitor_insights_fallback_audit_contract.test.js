'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase360: monitor insights emits read_path fallback audit action when fallback is used or blocked', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/monitorInsights.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("action: 'read_path.fallback.monitor_insights'"));
  assert.ok(src.includes('if (fallbackUsed || fallbackBlockedFlag) {'));
  assert.ok(src.includes('fallbackSources'));
});

