'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase304: composer pane keeps type-driven form + live preview + saved list while hiding trace input UI', () => {
  const html = read('apps/admin/app.html');
  assert.ok(html.includes('id="pane-composer"'));
  assert.ok(html.includes('id="notificationType"'));
  assert.ok(html.includes('id="composer-preview-title"'));
  assert.ok(html.includes('id="composer-preview-cta2"'));
  assert.ok(html.includes('id="composer-saved-rows"'));
  assert.ok(html.includes('id="traceId"'));
  assert.ok(html.includes('type="hidden" id="traceId"'));
  assert.ok(!html.includes('for="traceId"'));
});

