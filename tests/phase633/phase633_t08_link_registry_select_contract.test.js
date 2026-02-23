'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: composer linkRegistryId uses select options from registry list and lookup', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('<select id="linkRegistryId">'));
  assert.ok(!html.includes('<input id="linkRegistryId"'));

  assert.ok(js.includes('async function loadComposerLinkRegistryOptions(options)'));
  assert.ok(js.includes('fetch(`/admin/link-registry?${query.toString()}`'));
  assert.ok(js.includes('async function ensureComposerLinkRegistryOption(linkRegistryId)'));
  assert.ok(js.includes('fetch(`/api/admin/os/link-registry/${encodeURIComponent(id)}`'));
  assert.ok(js.includes('linkRegistryInput.addEventListener(\'change\''));
  assert.ok(js.includes('return `${title} / ${domain} / ${id}`;'));
});
