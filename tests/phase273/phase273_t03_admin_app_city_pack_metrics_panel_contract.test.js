'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase273: admin app has city pack metrics panel and loader wiring', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  assert.match(html, /id="city-pack-metrics-window-days"/);
  assert.match(html, /id="city-pack-metrics-limit"/);
  assert.match(html, /id="city-pack-metrics-reload"/);
  assert.match(html, /id="city-pack-metrics-summary"/);
  assert.match(html, /id="city-pack-metrics-rows"/);

  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.match(js, /function loadCityPackMetrics\(/);
  assert.match(js, /\/api\/admin\/city-pack-metrics\?/);
  assert.match(js, /city-pack-metrics-reload/);
  assert.match(js, /loadCityPackMetrics\(\{ notify: false \}\)/);
});

