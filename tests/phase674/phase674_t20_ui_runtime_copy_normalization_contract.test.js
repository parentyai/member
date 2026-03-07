'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: runtime display helpers normalize banned terms for operator/admin surfaces', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(src.includes('function toUnifiedDisplay(value, fallbackValue)'));
  assert.ok(src.includes('return normalizeCopyForRole('), 'expected normalizeCopyForRole call in display helpers');
  assert.ok(src.includes('function asText(value, fallback)'));
  assert.ok(src.includes("return normalizeCopyForRole(fallback || '-', state.role);"));
});

test('phase674: dashboard metric card normalizes runtime valueLabel and note copy', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(src.includes("currentEl.textContent = normalizeCopyForRole(displayCurrent || '-', state.role);"));
  assert.ok(src.includes("noteEl.textContent = normalizeCopyForRole(metric.note || '-', state.role);"));
});
