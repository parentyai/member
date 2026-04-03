'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase893: city pack mode constant is initialized before operator state uses it', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const constantIndex = js.indexOf('const CITY_PACK_OPERATOR_MODE = Object.freeze(');
  const stateIndex = js.indexOf('cityPackOperatorMode: CITY_PACK_OPERATOR_MODE.guide');
  assert.ok(constantIndex >= 0, 'CITY_PACK_OPERATOR_MODE constant missing');
  assert.ok(stateIndex > constantIndex, 'state must not reference CITY_PACK_OPERATOR_MODE before definition');
});

test('phase893: topbar profile menu is excluded from detail auto-open flows', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  ['function expandPaneDetails', 'function expandAllDetails', 'function enforceNoCollapseUi'].forEach((token) => {
    const start = js.indexOf(token);
    assert.ok(start >= 0, `${token} missing`);
    const slice = js.slice(start, start + 600);
    assert.ok(slice.includes("el.hasAttribute('data-topbar-menu')"), `${token} must guard topbar menu details`);
    assert.ok(slice.includes('el.open = false'), `${token} must close topbar menu details`);
  });
  assert.ok(js.includes('function closeTopbarV3Menus('), 'closeTopbarV3Menus missing');
  assert.ok(js.includes('function setupTopbarV3Menus('), 'setupTopbarV3Menus missing');
  assert.ok(js.includes('setupTopbarV3Menus();'), 'topbar menu setup must run during v3 boot');
});
