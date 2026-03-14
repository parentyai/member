'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase854: quality patrol pane distinguishes loading, blocked, empty, and error states', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('Quality Patrol を読み込み中です。'));
  assert.ok(js.includes('ローカル診断が未復旧のため、Quality Patrol の読込を停止しています。'));
  assert.ok(js.includes('観測不足が主因のため、強い改善提案はまだ出していません。'));
  assert.ok(js.includes('断定可能な issue はまだありません。先に観測不足を解消してください。'));
  assert.ok(js.includes('Quality Patrol の取得に失敗しました'));
});
