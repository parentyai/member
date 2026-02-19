'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase272: composer pane contains type-driven form, live preview, and saved list blocks', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('id="pane-composer"'));
  assert.ok(html.includes('id="notificationType"'));
  assert.ok(html.includes('data-type-fields="GENERAL"') === false, 'GENERAL should not need extra fields');
  assert.ok(html.includes('data-type-fields="ANNOUNCEMENT"'));
  assert.ok(html.includes('data-type-fields="VENDOR"'));
  assert.ok(html.includes('data-type-fields="AB"'));
  assert.ok(html.includes('data-type-fields="STEP"'));

  assert.ok(html.includes('id="composer-preview-title"'));
  assert.ok(html.includes('id="composer-preview-body"'));
  assert.ok(html.includes('id="composer-preview-cta"'));
  assert.ok(html.includes('id="composer-preview-link"'));

  assert.ok(html.includes('id="composer-saved-search"'));
  assert.ok(html.includes('id="composer-saved-status"'));
  assert.ok(html.includes('id="composer-saved-type"'));
  assert.ok(html.includes('id="composer-saved-rows"'));
});
