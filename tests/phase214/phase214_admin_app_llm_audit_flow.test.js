'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase214: admin app includes llm audit drilldown button', () => {
  const file = path.resolve('apps/admin/app.html');
  const text = fs.readFileSync(file, 'utf8');

  assert.match(text, /id="llm-open-audit"/);
  assert.match(text, /data-dict-key="ui\.label\.llm\.openAudit"/);
});

test('phase214: admin app wires llm trace to audit pane search', () => {
  const file = path.resolve('apps/admin/assets/admin_app.js');
  const text = fs.readFileSync(file, 'utf8');

  assert.match(text, /function copyLlmTraceToAudit\(\)/);
  assert.match(text, /activatePane\('audit'\)/);
  assert.match(text, /loadAudit\(\)\.catch/);
  assert.match(text, /document\.getElementById\('llm-open-audit'\)\?\.addEventListener/);
});
