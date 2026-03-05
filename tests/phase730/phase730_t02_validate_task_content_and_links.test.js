'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  validateTaskContent,
  resolveTaskKeyWarnings,
  resolveTaskContentLinks,
  isHealthyLink,
  inferLinkKind
} = require('../../src/usecases/tasks/validateTaskContent');

test('phase730: validateTaskContent rejects invalid min/max and warns on missing manual/failure', () => {
  const result = validateTaskContent({
    taskKey: 'bank_open',
    title: '銀行口座を作る',
    timeMin: 50,
    timeMax: 30,
    checklistItems: [{ id: 'passport', text: 'パスポート準備', order: 1 }]
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('timeMin must be <= timeMax'));
  assert.ok(result.warnings.includes('manualText missing'));
  assert.ok(result.warnings.includes('failureText missing'));
});

test('phase730: resolveTaskContentLinks validates registry existence/health/kind', async () => {
  const links = {
    video_good: { id: 'video_good', url: 'https://www.youtube.com/watch?v=abc', enabled: true },
    cta_good: { id: 'cta_good', url: 'https://example.com/open', enabled: true },
    video_bad_kind: { id: 'video_bad_kind', url: 'https://example.com/not-youtube', enabled: true },
    cta_warn: { id: 'cta_warn', url: 'https://example.com/warn', enabled: true, lastHealth: { state: 'WARN' } }
  };
  const linkRegistryRepo = {
    getLink: async (id) => links[id] || null
  };

  const okResult = await resolveTaskContentLinks({ videoLinkId: 'video_good', actionLinkId: 'cta_good' }, { linkRegistryRepo });
  assert.equal(okResult.video.ok, true);
  assert.equal(okResult.action.ok, true);
  assert.equal(okResult.warnings.length, 0);

  const badResult = await resolveTaskContentLinks({ videoLinkId: 'video_bad_kind', actionLinkId: 'cta_warn' }, { linkRegistryRepo });
  assert.equal(badResult.video.ok, false);
  assert.equal(badResult.video.reason, 'video_kind_invalid');
  assert.equal(badResult.action.ok, false);
  assert.equal(badResult.action.reason, 'invalid_or_warn');
  assert.ok(badResult.warnings.length >= 1);

  const missingResult = await resolveTaskContentLinks({ videoLinkId: 'missing' }, { linkRegistryRepo });
  assert.equal(missingResult.video.ok, false);
  assert.equal(missingResult.video.reason, 'not_found');
});

test('phase730: link helpers detect health and kind', () => {
  assert.equal(isHealthyLink({ url: 'https://example.com', enabled: true }), true);
  assert.equal(isHealthyLink({ url: 'https://example.com', enabled: false }), false);
  assert.equal(isHealthyLink({ url: 'https://example.com', enabled: true, lastHealth: { state: 'WARN' } }), false);

  assert.equal(inferLinkKind({ kind: 'youtube', url: 'https://example.com' }), 'youtube');
  assert.equal(inferLinkKind({ url: 'https://youtu.be/abc' }), 'youtube');
  assert.equal(inferLinkKind({ url: 'https://liff.line.me/123' }), 'liff');
  assert.equal(inferLinkKind({ url: 'https://example.com' }), 'web');
});

test('phase730: resolveTaskKeyWarnings detects unlinked and dangerous keys', async () => {
  const linkedWarnings = await resolveTaskKeyWarnings({
    taskKey: 'rule_bank_open'
  }, {
    stepRulesRepo: {
      getStepRule: async (ruleId) => (ruleId === 'rule_bank_open' ? { ruleId } : null)
    }
  });
  assert.equal(linkedWarnings.length, 0);

  const unlinkedWarnings = await resolveTaskKeyWarnings({
    taskKey: 'TODO__BANK OPEN'
  }, {
    stepRulesRepo: {
      getStepRule: async () => null
    }
  });
  assert.ok(unlinkedWarnings.includes('taskKey should match [a-z0-9][a-z0-9_-]{1,63}'));
  assert.ok(unlinkedWarnings.includes('taskKey includes "__" and may be runtime todo composite'));
  assert.ok(unlinkedWarnings.includes('taskKey is not linked to step_rules.ruleId (todoKey fallback only)'));
});
