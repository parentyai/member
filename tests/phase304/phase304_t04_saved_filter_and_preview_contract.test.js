'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('phase304: saved filter uses AND conditions and preview reflects CTA2', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes("searchable = [item.title, item.body, item.ctaText]"));
  assert.ok(js.includes("if (status && normalizeComposerSavedStatus(item.status) !== status) return false;"));
  assert.ok(js.includes("if (type && normalizeComposerType(item.notificationType || 'STEP') !== type) return false;"));
  assert.ok(js.includes("if (category && String(item.notificationCategory || '').toUpperCase() !== category) return false;"));
  assert.ok(js.includes("if (scenarioKey && String(item.scenarioKey || '').toUpperCase() !== scenarioKey) return false;"));
  assert.ok(js.includes("if (stepKey && String(item.stepKey || '').toLowerCase() !== stepKey) return false;"));
  assert.ok(js.includes("const cta2 = document.getElementById('ctaText2')?.value?.trim() || ''"));
});

