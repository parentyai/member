'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase585: monitor empty fallback uses bounded range query (no listAll)', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/monitorInsights.js');
  const src = fs.readFileSync(file, 'utf8');

  assert.ok(src.includes("fallbackSources.push('listNotificationDeliveriesBySentAtRange:fallback');"));
  assert.ok(!src.includes('listAllNotificationDeliveries({ limit: readLimit })'));
});

