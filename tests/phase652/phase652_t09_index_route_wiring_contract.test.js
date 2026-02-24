'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase652: index route wiring includes stripe webhook, llm policy api, and billing detail api', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(src.includes("pathname === '/webhook/stripe'"));
  assert.ok(src.includes("pathname === '/api/admin/llm/policy/status'"));
  assert.ok(src.includes("pathname === '/api/admin/llm/policy/plan'"));
  assert.ok(src.includes("pathname === '/api/admin/llm/policy/set'"));
  assert.ok(src.includes("pathname === '/api/admin/os/user-billing-detail'"));
});
