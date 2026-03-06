'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.resolve(__dirname, '../../src/index.js');
const impactRoutePath = path.resolve(__dirname, '../../src/routes/admin/osLinkRegistryImpact.js');
const seedScriptPath = path.resolve(__dirname, '../../tools/migrations/rich_menu_task_os_seed.js');

test('phase741: link registry impact route is wired in index', () => {
  const indexJs = fs.readFileSync(indexPath, 'utf8');
  assert.match(indexJs, /\/api\/admin\/os\/link-registry-impact/);
  assert.match(indexJs, /handleOsLinkRegistryImpact/);
});

test('phase741: impact route computes shared and warn metrics fields', () => {
  const routeJs = fs.readFileSync(impactRoutePath, 'utf8');
  [
    'sharedIdCount',
    'referencedWarnOrDisabledCount',
    'sharedWarnOrDisabledCount',
    "registerRef(row, 'task'",
    "registerRef(row, 'notification'",
    "registerRef(row, 'citypack'",
    "registerRef(row, 'vendor'"
  ].forEach((token) => {
    assert.match(routeJs, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('phase741: rich menu task os seed script provides dry-run/apply commands and entry buttons', () => {
  const script = fs.readFileSync(seedScriptPath, 'utf8');
  ['--apply', '--enable-policy', '今やる', '今週の期限', '地域手続き', 'TODO一覧', '通知履歴', '相談']
    .forEach((token) => {
      assert.match(script, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
});
