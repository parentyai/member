'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildTaskMenuHints } = require('../../src/domain/llm/concierge/buildTaskMenuHints');

test('phase908: due-driven taskable responses map to due_soon menu bucket', () => {
  const result = buildTaskMenuHints({
    lane: 'paid_main',
    topic: 'ssn',
    nextBestAction: '今週中に必要書類を提出する',
    dueNotes: ['提出期限は今週です。'],
    dueAt: '2026-04-02T12:00:00.000Z'
  });

  assert.equal(result.menuHint && result.menuHint.menu_bucket, 'due_soon_tasks');
  assert.equal(result.quickReplies[0] && result.quickReplies[0].text, '今週の期限');
  assert.equal(result.taskHint && result.taskHint.due_class, 'due_soon');
});

test('phase908: regional topics prefer regional procedures and non-taskable general turns stay quiet', () => {
  const regional = buildTaskMenuHints({
    lane: 'paid_main',
    topic: 'school',
    jurisdiction: 'ca::san_jose',
    nextBestAction: '学区の提出条件を確認する'
  });
  const quiet = buildTaskMenuHints({
    lane: 'paid_casual',
    topic: 'general'
  });

  assert.equal(regional.menuHint && regional.menuHint.menu_bucket, 'regional_procedures');
  assert.equal(regional.quickReplies[0] && regional.quickReplies[0].text, '地域手続き');
  assert.equal(quiet.menuHint, null);
  assert.equal(quiet.semanticTasks.length, 0);
});

test('phase908: refusal and blocker-heavy responses route to support guide', () => {
  const result = buildTaskMenuHints({
    lane: 'paid_main',
    topic: 'general',
    resolutionState: 'refuse',
    blockerNotes: ['制度確認が未完了です。'],
    nextBestAction: '確認論点を整理する'
  });

  assert.equal(result.menuHint && result.menuHint.menu_bucket, 'support_guide');
  assert.equal(result.quickReplies[0] && result.quickReplies[0].text, '相談');
});
