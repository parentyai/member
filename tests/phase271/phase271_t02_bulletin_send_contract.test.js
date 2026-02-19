'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase271: bulletin send uses sendNotification + killSwitch guard', () => {
  const file = fs.readFileSync(path.join(ROOT, 'src/routes/admin/cityPackBulletins.js'), 'utf8');
  assert.match(file, /sendNotification/);
  assert.match(file, /getKillSwitch/);
  assert.match(file, /city_pack\.bulletin\.send/);
});
