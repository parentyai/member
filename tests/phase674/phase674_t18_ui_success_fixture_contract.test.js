'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: ui fixture success mode is available for safe local observation', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(src.includes("const UI_FIXTURE_QUERY_KEY = 'ui_fixture';"));
  assert.ok(src.includes("const UI_FIXTURE_SUCCESS_VALUE = 'success';"));
  assert.ok(src.includes('function renderUiFixtureSuccess(paneKey)'));
  assert.ok(src.includes("banner.classList.add('is-visible');"));
  assert.ok(src.includes("banner.dataset.uiFixture = 'visible';"));
  assert.ok(src.includes("targetEl.textContent = `role=${roleLabel}, pane=${nextPane}`;"));

  assert.ok(html.includes('id="ui-fixture-success-banner"'));
  assert.ok(html.includes('data-ui="fixture-success-banner"'));
  assert.ok(html.includes('id="ui-fixture-success-message"'));
  assert.ok(html.includes('id="ui-fixture-success-target"'));
});
