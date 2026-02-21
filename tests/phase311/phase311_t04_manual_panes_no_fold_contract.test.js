'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

function paneSlice(html, paneId, nextPaneId) {
  const start = html.indexOf(`<section id="${paneId}"`);
  const end = html.indexOf(`<section id="${nextPaneId}"`);
  assert.ok(start >= 0 && end > start, `pane block missing: ${paneId}`);
  return html.slice(start, end);
}

test('phase311: redac/user manuals are rendered without details blocks', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const redacPane = paneSlice(html, 'pane-developer-manual-redac', 'pane-developer-manual-user');
  const userPane = paneSlice(html, 'pane-developer-manual-user', 'pane-llm');

  assert.ok(!redacPane.includes('<details'), 'redac manual contains details');
  assert.ok(!userPane.includes('<details'), 'user manual contains details');
  assert.ok(redacPane.includes('manual-redac-can-do'));
  assert.ok(userPane.includes('manual-user-overview'));
});
