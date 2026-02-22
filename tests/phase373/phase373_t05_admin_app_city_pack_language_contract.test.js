'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase373: admin city pack pane includes packClass/language filters and authority policy control', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  assert.ok(html.includes('id="city-pack-request-class-filter"'));
  assert.ok(html.includes('id="city-pack-request-language-filter"'));
  assert.ok(html.includes('id="city-pack-feedback-class-filter"'));
  assert.ok(html.includes('id="city-pack-feedback-language-filter"'));
  assert.ok(html.includes('id="city-pack-pack-class-filter"'));
  assert.ok(html.includes('id="city-pack-language-filter"'));
  assert.ok(html.includes('id="city-pack-authority-level"'));
});

test('phase373: admin app JS wires packClass/language filters and authority policy payload', () => {
  const js = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');
  assert.ok(js.includes("params.set('requestClass', requestClass)"));
  assert.ok(js.includes("params.set('requestedLanguage', requestedLanguage)"));
  assert.ok(js.includes("params.set('packClass', packClass)"));
  assert.ok(js.includes("params.set('language', language)"));
  assert.ok(js.includes('authorityLevel'));
});
