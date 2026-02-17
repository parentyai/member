'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

function read(path) {
  return readFileSync(path, 'utf8');
}

test('phase224: admin/master LLM FAQ request uses buildHeaders (x-actor included)', () => {
  const text = read('apps/admin/master.html');
  assert.ok(text.includes("'x-actor': 'admin_master'"));
  assert.ok(text.includes("fetch('/api/admin/llm/faq/answer'"));
  assert.ok(text.includes('headers: buildHeaders'));
});

test('phase224: admin/app LLM FAQ request uses buildHeaders (x-actor included)', () => {
  const text = read('apps/admin/assets/admin_app.js');
  assert.ok(text.includes("OPS_ACTOR_HEADERS = { 'x-actor': 'admin_app' }"));
  assert.ok(text.includes("postJson('/api/admin/llm/faq/answer'"));
  assert.ok(text.includes('buildHeaders'));
});

