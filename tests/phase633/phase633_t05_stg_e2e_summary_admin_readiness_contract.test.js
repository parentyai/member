'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { renderMarkdownSummary } = require('../../tools/run_stg_notification_e2e_checklist');

test('phase633: markdown summary renders admin readiness checks for product_readiness_gate scenario', () => {
  const markdown = renderMarkdownSummary({
    endedAt: '2026-02-23T04:00:00.000Z',
    baseUrl: 'http://127.0.0.1:18080',
    actor: 'ops_stg_e2e',
    headSha: 'abcdef0',
    summary: {
      traceLimit: 100,
      strictAuditActions: true
    },
    scenarios: [
      {
        name: 'product_readiness_gate',
        status: 'PASS',
        traceId: 'trace-stg-e2e-product-readiness-1',
        adminReadinessChecks: [
          { endpoint: '/api/admin/product-readiness', status: 200, ok: true },
          { endpoint: '/api/admin/read-path-fallback-summary', status: 200, ok: true }
        ]
      }
    ]
  });

  assert.ok(markdown.includes('admin readiness checks'));
  assert.ok(markdown.includes('/api/admin/product-readiness: status=200 ok=true'));
  assert.ok(markdown.includes('/api/admin/read-path-fallback-summary: status=200 ok=true'));
});
