'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase892: operator primary nav is fixed to five minimal destinations', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const navStart = html.indexOf('data-v3-nav-group="operator-primary"');
  const navEnd = html.indexOf('data-v3-nav-group="system-console"');
  const operatorNav = html.slice(navStart, navEnd);

  assert.ok(js.includes("const OPERATOR_PRIMARY_NAV = Object.freeze(['home', 'alerts', 'read-model', 'city-pack', 'llm']);"));
  assert.ok(operatorNav.includes('>ダッシュボード</span>'));
  assert.ok(operatorNav.includes('>通知配信状況</span>'));
  assert.ok(operatorNav.includes('>会員情報</span>'));
  assert.ok(operatorNav.includes('>City Pack・緊急レイヤー</span>'));
  assert.ok(operatorNav.includes('>FAQ</span>'));

  const paneOrder = Array.from(operatorNav.matchAll(/data-pane-target="([^"]+)"/g), (match) => match[1]);
  assert.deepEqual(paneOrder.slice(0, 5), ['home', 'alerts', 'read-model', 'city-pack', 'llm']);
  assert.ok(!operatorNav.includes('data-pane-target="emergency-layer"'));
});
