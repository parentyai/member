'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { resolveSharedAnswerReadiness } = require('../../src/domain/llm/quality/resolveSharedAnswerReadiness');

const ROOT = path.join(__dirname, '..', '..');
const read = (filePath) => fs.readFileSync(path.join(ROOT, filePath), 'utf8');

test('phase830: shared readiness helper returns bridge visibility metadata', () => {
  const result = resolveSharedAnswerReadiness({
    entryType: 'compat',
    routeKind: 'compat',
    routerReason: 'compat_ops_next_actions_fallback',
    compatFallbackReason: 'legacy_compat_ops_next_actions',
    sharedReadinessBridge: 'shared_compat_next_actions',
    routeDecisionSource: 'compat_route',
    domainIntent: 'general',
    llmUsed: true,
    replyText: 'ok'
  });

  assert.equal(result.routeCoverageMeta.routeKind, 'compat');
  assert.equal(result.routeCoverageMeta.compatFallbackReason, 'legacy_compat_ops_next_actions');
  assert.equal(result.routeCoverageMeta.sharedReadinessBridge, 'shared_compat_next_actions');
  assert.equal(result.routeCoverageMeta.sharedReadinessBridgeObserved, true);
  assert.equal(result.routeCoverageMeta.routeDecisionSource, 'compat_route');
});

test('phase830: trace bundle route hints expose route coverage dimensions', () => {
  const traceBundle = read('src/usecases/admin/getTraceBundle.js');
  assert.ok(traceBundle.includes('routeKinds'));
  assert.ok(traceBundle.includes('compatFallbackReasons'));
  assert.ok(traceBundle.includes('sharedReadinessBridges'));
  assert.ok(traceBundle.includes('routeDecisionSources'));
});
