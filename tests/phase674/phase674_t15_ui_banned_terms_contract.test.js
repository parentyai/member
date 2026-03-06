'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function extractVisibleText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('phase674: operator/admin visible copy does not expose banned internal terms', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const visible = extractVisibleText(html).toLowerCase();

  const banned = [
    /\bpane\b/i,
    /\brollout\b/i,
    /\bnot\s+available\b/i,
    /\bprovider[_\s-]*key\b/i
  ];

  for (const token of banned) {
    assert.equal(token.test(visible), false, `banned term leaked: ${token}`);
  }
});

test('phase674: runtime copy normalization keeps operator/admin banned-term firewall', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(src.includes('const UI_COPY_BANNED_TERMS_FOR_OPERATOR = Object.freeze(['));
  assert.ok(src.includes('function normalizeCopyForRole(text, role)'));
  assert.ok(src.includes("replacement: '情報なし'"));
  assert.ok(src.includes("replacement: '画面'"));
  assert.ok(src.includes("replacement: '段階公開'"));
  assert.ok(src.includes("replacement: '提供元ID'"));
});
