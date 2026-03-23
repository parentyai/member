'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');
const appHtml = fs.readFileSync(path.join(rootDir, 'apps/admin/app.html'), 'utf8');
const appJs = fs.readFileSync(path.join(rootDir, 'apps/admin/assets/admin_app.js'), 'utf8');
const dict = fs.readFileSync(path.join(rootDir, 'docs/ADMIN_UI_DICTIONARY_JA.md'), 'utf8');

test('phase674: emergency rules surface exposes WARN+ and policy column', () => {
  assert.equal(appHtml.includes('<option value="WARN+">WARN+</option>'), true);
  assert.equal(appHtml.includes('data-dict-key="ui.label.emergency.col.policy"'), true);
});

test('phase674: emergency rule preview and rows render policy metadata', () => {
  assert.match(appJs, /displayLabel/);
  assert.match(appJs, /policySummary/);
  assert.match(appJs, /operatorAction/);
  assert.match(appJs, /policy=/);
});

test('phase674: emergency dictionary defines policy column label', () => {
  assert.equal(dict.includes('"ui.label.emergency.col.policy": "policy"'), true);
});
