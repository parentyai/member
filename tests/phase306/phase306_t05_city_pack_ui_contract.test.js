'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase306: city pack pane shows request stage/warning/aging and feedback slot/resolution', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('ui.label.cityPack.request.col.stage'));
  assert.ok(html.includes('ui.label.cityPack.request.col.warningCount'));
  assert.ok(html.includes('ui.label.cityPack.request.col.agingHours'));
  assert.ok(html.includes('ui.label.cityPack.feedback.col.slot'));
  assert.ok(html.includes('ui.label.cityPack.feedback.col.resolution'));
  assert.ok(html.includes('ui.value.cityPack.feedbackStatus.triaged'));
  assert.ok(html.includes('ui.value.cityPack.feedbackStatus.resolved'));
});

test('phase306: city pack feedback actions include triage/resolve handlers', () => {
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.match(js, /\{ key: 'triage'/);
  assert.match(js, /\{ key: 'resolve'/);
  assert.match(js, /row\.warningCount/);
  assert.match(js, /row\.experienceStage/);
});
