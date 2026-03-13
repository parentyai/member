'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');

function toMap(rows, key) {
  return Object.fromEntries((Array.isArray(rows) ? rows : []).map((row) => [row[key], row.count]));
}

test('phase830: conversation quality summary exposes router coverage aggregates', () => {
  const summary = buildConversationQualitySummary([
    {
      entryType: 'webhook',
      routeKind: 'canonical',
      routerReason: 'question_pattern',
      routerReasonObserved: true,
      sharedReadinessBridge: 'webhook_direct_readiness',
      sharedReadinessBridgeObserved: true,
      routeDecisionSource: 'conversation_router',
      fallbackType: 'none'
    },
    {
      entryType: 'compat',
      routeKind: 'compat',
      routerReason: 'compat_ops_explain_fallback',
      routerReasonObserved: true,
      compatFallbackReason: 'legacy_compat_ops_explain',
      sharedReadinessBridge: 'shared_compat_ops_explain',
      sharedReadinessBridgeObserved: true,
      routeDecisionSource: 'compat_route',
      fallbackType: 'compat_ops_blocked'
    },
    {
      entryType: 'webhook',
      conversationMode: 'casual',
      routeKind: 'canonical',
      routerReasonObserved: false,
      sharedReadinessBridgeObserved: false,
      routeDecisionSource: 'webhook_route',
      fallbackType: 'none'
    }
  ]);

  assert.equal(summary.routerReasonObservedRate, 0.6667);
  assert.equal(summary.sharedReadinessBridgeObservedRate, 0.6667);
  assert.equal(summary.routeAttributionCompleteness, 1);

  const routerReasons = toMap(summary.routerReasons, 'routerReason');
  const routeKinds = toMap(summary.routeKinds, 'routeKind');
  const compatFallbackReasons = toMap(summary.compatFallbackReasons, 'compatFallbackReason');
  const bridges = toMap(summary.sharedReadinessBridges, 'sharedReadinessBridge');
  const decisionSources = toMap(summary.routeDecisionSources, 'routeDecisionSource');

  assert.equal(routerReasons.question_pattern, 1);
  assert.equal(routerReasons.compat_ops_explain_fallback, 1);
  assert.equal(routerReasons.none, 1);
  assert.equal(routeKinds.canonical, 2);
  assert.equal(routeKinds.compat, 1);
  assert.equal(compatFallbackReasons.legacy_compat_ops_explain, 1);
  assert.equal(bridges.webhook_direct_readiness, 1);
  assert.equal(bridges.shared_compat_ops_explain, 1);
  assert.equal(decisionSources.conversation_router, 1);
  assert.equal(decisionSources.compat_route, 1);
  assert.equal(decisionSources.webhook_route, 1);
});
