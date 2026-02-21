'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase310: developer-map pane keeps no-fold structure', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const start = html.indexOf('<section id="pane-developer-map"');
  const end = html.indexOf('<section id="pane-llm"');
  assert.ok(start >= 0 && end > start);
  const block = html.slice(start, end);

  assert.ok(!block.includes('<details'));
  assert.ok(!block.includes('decision-card'));
});
