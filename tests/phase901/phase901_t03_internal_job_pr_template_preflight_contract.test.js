'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = process.cwd();

test('phase901: PR template advertises internal job conflict preflight commands', () => {
  const text = fs.readFileSync(path.join(ROOT, '.github', 'PULL_REQUEST_TEMPLATE.md'), 'utf8');
  assert.match(text, /npm run internal-jobs:conflict-watchlist/);
  assert.match(text, /internal job の stacked \/ shared structural artifact PR/);
  assert.match(text, /npm run internal-jobs:merge-regen/);
  assert.match(text, /origin\/main` を working branch に取り込んだ後/);
});
