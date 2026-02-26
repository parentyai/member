'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase670: index and admin city pack route wire content update endpoint', () => {
  const indexCode = fs.readFileSync('src/index.js', 'utf8');
  const routeCode = fs.readFileSync('src/routes/admin/cityPacks.js', 'utf8');

  assert.ok(indexCode.includes("/^\\/api\\/admin\\/city-packs\\/[^/]+\\/(activate|retire|structure|content)$/.test(pathname)"));
  assert.ok(routeCode.includes('function parseCityPackContentPath(pathname)'));
  assert.ok(routeCode.includes("error: 'city_pack_not_editable'"));
  assert.ok(routeCode.includes("action: 'city_pack.content.update'"));
  assert.ok(routeCode.includes('slotContents: payload.slotContents'));
  assert.ok(routeCode.includes('slotSchemaVersion: payload.slotSchemaVersion'));
});
