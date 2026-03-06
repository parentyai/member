'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: admin ui defines unified state normalization helpers', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(src.includes('const UI_STATE_TONE_ALIASES = Object.freeze({'));
  assert.ok(src.includes('function normalizeUiStateTone(value, fallbackTone)'));
  assert.ok(src.includes('function applyBadgeState(el, value, tone, options)'));
  assert.ok(src.includes('function applyRowHealthState(rowEl, tone)'));
  assert.ok(src.includes('function applyBannerState(el, tone, level)'));

  const requiredStates = ['success', 'in_progress', 'pending', 'warn', 'error', 'forbidden', 'disabled', 'unset', 'testing'];
  requiredStates.forEach((state) => {
    assert.ok(src.includes(`state-${state}`) || src.includes(`${state}:`), `missing unified state token: ${state}`);
  });

  assert.ok(src.includes("toastEl.setAttribute('data-ui-message-level', 'toast');"));
  assert.ok(src.includes("toastEl.setAttribute('data-ui-state', stateTone);"));
});

test('phase674: message hierarchy markers and state classes exist in html/css', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(html.includes('id="admin-guard-banner"'));
  assert.ok(html.includes('id="admin-local-preflight-banner"'));
  assert.ok(html.includes('id="ui-fixture-success-banner"'));
  assert.ok(html.includes('id="composer-killswitch-banner"'));
  assert.ok(html.includes('id="toast"'));

  assert.ok(html.includes('data-ui-message-level="system"'));
  assert.ok(html.includes('data-ui-message-level="section"'));
  assert.ok(html.includes('data-ui-message-level="inline"'));
  assert.ok(html.includes('data-ui-message-level="toast"'));

  assert.ok(css.includes('.badge-info'));
  assert.ok(css.includes('.badge-unset'));
  assert.ok(css.includes('.badge-disabled'));
  assert.ok(css.includes('.toast.state-success'));
  assert.ok(css.includes('.toast.state-error'));
  assert.ok(css.includes('.alert-banner.is-ok'));
});
