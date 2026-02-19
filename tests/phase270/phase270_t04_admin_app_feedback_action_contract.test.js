'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase270: admin app loads feedback and posts actions', () => {
  const js = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');
  assert.match(js, /loadCityPackFeedback/);
  assert.match(js, /\/api\/admin\/city-pack-feedback/);
  assert.match(js, /runCityPackFeedbackAction/);
});
