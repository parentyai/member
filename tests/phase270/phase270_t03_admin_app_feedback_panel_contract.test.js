'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase270: admin app includes feedback inbox and detail panels', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  assert.match(html, /city-pack-feedback-rows/);
  assert.match(html, /city-pack-feedback-summary/);
  assert.match(html, /ui\.label\.cityPack\.feedbackInbox/);
  assert.match(html, /ui\.label\.cityPack\.feedbackDetail/);
});
