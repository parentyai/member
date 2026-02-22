'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase373: cityPacks route accepts packClass/language filters and create payload fields', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/routes/admin/cityPacks.js'), 'utf8');
  assert.ok(src.includes("url.searchParams.get('packClass')"));
  assert.ok(src.includes("url.searchParams.get('language')"));
  assert.ok(src.includes('packClass: payload.packClass'));
  assert.ok(src.includes('language: payload.language'));
});

test('phase373: cityPack review inbox route supports source authority policy update', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/routes/admin/cityPackReviewInbox.js'), 'utf8');
  assert.ok(src.includes('authorityLevel'));
  assert.ok(src.includes("url.searchParams.get('packClass')"));
  assert.ok(src.includes("url.searchParams.get('language')"));
});
