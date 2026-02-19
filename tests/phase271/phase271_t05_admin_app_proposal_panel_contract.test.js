'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase271: admin app includes proposal inbox and detail panels', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  assert.match(html, /city-pack-proposal-rows/);
  assert.match(html, /city-pack-proposal-detail-summary/);
  assert.match(html, /ui\.label\.cityPack\.proposalInbox/);
  assert.match(html, /ui\.label\.cityPack\.proposalDetail/);
});
