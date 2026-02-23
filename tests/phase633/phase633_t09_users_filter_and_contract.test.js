'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: users summary filter enforces AND conditions for id/date/category/status', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="users-filter-line-user-id"'));
  assert.ok(html.includes('id="users-filter-created-from"'));
  assert.ok(html.includes('id="users-filter-created-to"'));
  assert.ok(html.includes('id="users-filter-category"'));
  assert.ok(html.includes('id="users-filter-status"'));

  assert.ok(js.includes('function applyUsersSummaryFilters()'));
  assert.ok(js.includes('if (userIdKeyword && !lineUserId.includes(userIdKeyword)) return false;'));
  assert.ok(js.includes('if (createdFromMs && (!createdAtMs || createdAtMs < createdFromMs)) return false;'));
  assert.ok(js.includes('if (createdToMs && (!createdAtMs || createdAtMs > createdToMs)) return false;'));
  assert.ok(js.includes("if (category && String(item && item.category ? item.category : '') !== category) return false;"));
  assert.ok(js.includes("if (status && String(item && item.statusLabel ? item.statusLabel : '') !== status) return false;"));
});
