'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase313: index wires /api/admin/legacy-status route', () => {
  const indexJs = fs.readFileSync(path.resolve(__dirname, '../../src/index.js'), 'utf8');
  assert.ok(indexJs.includes('/api/admin/legacy-status'));
  assert.ok(indexJs.includes("require('./routes/admin/legacyStatus')"));
});
