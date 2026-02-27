'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function parseRolePaneList(src, role) {
  const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escapedRole}:\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const match = src.match(re);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

test('phase674: role visibility observation (operator/admin/developer pane policy and role controls)', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  const operatorPanes = parseRolePaneList(js, 'operator');
  const adminPanes = parseRolePaneList(js, 'admin');
  const developerPanes = parseRolePaneList(js, 'developer');

  assert.ok(operatorPanes.includes('home'));
  assert.ok(operatorPanes.includes('composer'));
  assert.ok(operatorPanes.includes('monitor'));
  assert.ok(!operatorPanes.includes('llm'));
  assert.ok(!operatorPanes.includes('maintenance'));
  assert.ok(!operatorPanes.includes('developer-map'));

  ['llm', 'maintenance', 'developer-map', 'developer-manual-redac', 'developer-manual-user'].forEach((pane) => {
    assert.ok(adminPanes.includes(pane), `admin pane missing: ${pane}`);
    assert.ok(developerPanes.includes(pane), `developer pane missing: ${pane}`);
  });

  assert.ok(html.includes('data-role-value="operator"'));
  assert.ok(html.includes('data-role-value="admin"'));
  assert.ok(html.includes('data-role-value="developer"'));
  assert.ok(html.includes('data-role-allow="admin,developer"'));
});

