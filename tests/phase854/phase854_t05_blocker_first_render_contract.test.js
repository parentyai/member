'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase854: quality patrol pane keeps blocker-first render order', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const paneStart = html.indexOf('id="pane-quality-patrol"');
  const paneEnd = html.indexOf('id="pane-developer-map"', paneStart);
  const paneBlock = html.slice(paneStart, paneEnd);

  assert.ok(paneBlock.indexOf('id="quality-patrol-observation-blockers"') < paneBlock.indexOf('id="quality-patrol-recommended-pr"'));
  assert.ok(paneBlock.indexOf('id="quality-patrol-recommended-pr"') < paneBlock.indexOf('id="quality-patrol-issues"'));
  assert.ok(js.indexOf('renderQualityPatrolObservationBlockers(payload);') < js.indexOf('renderQualityPatrolRecommendedPr(payload);'));
  assert.ok(js.indexOf('renderQualityPatrolRecommendedPr(payload);') < js.indexOf('renderQualityPatrolIssues(payload);'));
});
