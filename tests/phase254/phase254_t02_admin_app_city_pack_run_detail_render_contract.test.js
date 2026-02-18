'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase254: run detail renderer opens evidence and handles missing trace', () => {
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('function renderCityPackRunDetail(payload)'));
  assert.ok(js.includes('loadCityPackEvidence(firstEvidenceId)'));
  assert.ok(js.includes('ui.toast.cityPack.traceMissing'));
  assert.ok(js.includes('city-pack-run-detail-rows'));
});
