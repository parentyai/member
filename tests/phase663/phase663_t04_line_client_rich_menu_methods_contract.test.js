'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase663: line client exposes rich menu operation methods', () => {
  const src = read('src/infra/lineClient.js');
  assert.ok(src.includes('async function createRichMenu('));
  assert.ok(src.includes('async function uploadRichMenuImage('));
  assert.ok(src.includes('async function setDefaultRichMenu('));
  assert.ok(src.includes('async function clearDefaultRichMenu('));
  assert.ok(src.includes('async function getUserRichMenu('));
  assert.ok(src.includes('async function upsertRichMenuAlias('));
  assert.ok(src.includes('async function deleteRichMenuAlias('));
});

test('phase663: line client rich menu methods target expected LINE Messaging API paths', () => {
  const src = read('src/infra/lineClient.js');
  assert.ok(src.includes("'/v2/bot/richmenu'"));
  assert.ok(src.includes('/v2/bot/richmenu/${encodedRichMenuId}/content'));
  assert.ok(src.includes('/v2/bot/user/all/richmenu/${encodedRichMenuId}'));
  assert.ok(src.includes("'/v2/bot/user/all/richmenu'"));
  assert.ok(src.includes('/v2/bot/user/${encodedUserId}/richmenu'));
  assert.ok(src.includes("'/v2/bot/richmenu/alias'"));
  assert.ok(src.includes('/v2/bot/richmenu/alias/${encodedAliasId}'));
});

