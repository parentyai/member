'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveRouteCoverageMeta } = require('../../src/domain/llm/router/resolveRouteCoverageMeta');

test('phase830: route coverage meta normalizes canonical and compat attribution', () => {
  const canonical = resolveRouteCoverageMeta({
    entryType: 'webhook',
    routerReason: 'question_pattern',
    sharedReadinessBridge: 'webhook_direct_readiness'
  });
  const compat = resolveRouteCoverageMeta({
    entryType: 'compat',
    routeKind: 'compat',
    routerReason: 'compat_ops_explain_fallback',
    compatFallbackReason: 'legacy_compat_ops_explain',
    sharedReadinessBridge: 'shared_compat_ops_explain'
  });

  assert.deepEqual(canonical, {
    routeKind: 'canonical',
    routerReason: 'question_pattern',
    routerReasonObserved: true,
    fallbackType: null,
    compatFallbackReason: null,
    sharedReadinessBridge: 'webhook_direct_readiness',
    sharedReadinessBridgeObserved: true,
    routeDecisionSource: 'conversation_router'
  });
  assert.deepEqual(compat, {
    routeKind: 'compat',
    routerReason: 'compat_ops_explain_fallback',
    routerReasonObserved: true,
    fallbackType: null,
    compatFallbackReason: 'legacy_compat_ops_explain',
    sharedReadinessBridge: 'shared_compat_ops_explain',
    sharedReadinessBridgeObserved: true,
    routeDecisionSource: 'compat_route'
  });
});
