'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const runbookDoc = path.resolve(__dirname, '../../docs/RUNBOOK_OPS.md');
const taskEngineDoc = path.resolve(__dirname, '../../docs/SSOT_TASK_ENGINE_V1.md');
const commandSurfaceDoc = path.resolve(__dirname, '../../docs/JOURNEY_COMMAND_SURFACE_V2.md');
const copyGuidelineDoc = path.resolve(__dirname, '../../docs/UI_COPY_GUIDELINES_JA_V2.md');

test('phase748: docs include due/overdue split and support-mode wording', () => {
  const runbook = fs.readFileSync(runbookDoc, 'utf8');
  const taskEngine = fs.readFileSync(taskEngineDoc, 'utf8');
  const commandSurface = fs.readFileSync(commandSurfaceDoc, 'utf8');
  const copyGuideline = fs.readFileSync(copyGuidelineDoc, 'utf8');

  ['期限（7日以内）', '期限超過', 'ブロック:x件', 'チケット作成なし'].forEach((token) => {
    assert.match(runbook, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  ['Journey Command Surface: 期限/ブロッカー整合', 'ブロッカー:<reason>'].forEach((token) => {
    assert.match(taskEngine, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  ['今週の期限', '期限（7日以内）', '期限超過', '相談'].forEach((token) => {
    assert.match(commandSurface, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  ['内部語を表示しない', 'DUE_SOON', 'ブロッカー'].forEach((token) => {
    assert.match(copyGuideline, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});
