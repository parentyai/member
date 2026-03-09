'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase750: admin llm pane includes quality framework sections', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  [
    'llm-quality-scorecard',
    'llm-quality-slices',
    'llm-quality-judge',
    'llm-quality-benchmark',
    'llm-quality-replay',
    'llm-quality-frontier',
    'llm-quality-top-failures',
    'llm-quality-top-patterns'
  ].forEach((id) => {
    assert.match(html, new RegExp(`id=\\"${id}\\"`));
  });
});

test('phase750: admin app renders quality framework dashboard from usage summary', () => {
  const appJs = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');
  assert.match(appJs, /function renderLlmQualityFrameworkDashboard\(/);
  assert.match(appJs, /renderLlmQualityFrameworkDashboard\(data && data\.summary \? data\.summary : null\)/);
  assert.match(appJs, /llm-quality-top-failures/);
  assert.match(appJs, /llm-quality-top-patterns/);
});
