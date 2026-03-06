'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const taskEngineDoc = path.resolve(__dirname, '../../docs/SSOT_TASK_ENGINE_V1.md');
const runbookDoc = path.resolve(__dirname, '../../docs/RUNBOOK_OPS.md');
const richMenuDoc = path.resolve(__dirname, '../../docs/SSOT_LINE_RICH_MENU.md');

test('phase741: task engine doc includes category/dag/next-task contracts', () => {
  const text = fs.readFileSync(taskEngineDoc, 'utf8');
  [
    'Phase741 Add-only（US Assignment Task OS）',
    'step_rules.category',
    'computeTaskGraph()',
    'computeNextTasks()',
    'city_packs.recommendedTasks[]',
    'TODO業者:<todoKey>'
  ].forEach((token) => {
    assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('phase741: runbook includes rich menu seed and task os line command checks', () => {
  const text = fs.readFileSync(runbookDoc, 'utf8');
  [
    'rich_menu_task_os_seed.js',
    '今やる',
    '今週の期限',
    '地域手続き',
    'カテゴリ:IMMIGRATION',
    'TODO業者:<todoKey>',
    'city_pack.recommended_tasks.sync'
  ].forEach((token) => {
    assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('phase741: rich menu ssot includes task os entry mapping', () => {
  const text = fs.readFileSync(richMenuDoc, 'utf8');
  ['Task OS Entry Menu', 'CityPack案内', '通知履歴', '相談']
    .forEach((token) => {
      assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
});
