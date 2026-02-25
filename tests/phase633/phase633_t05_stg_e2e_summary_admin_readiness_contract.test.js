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
          { endpoint: '/api/admin/read-path-fallback-summary', status: 200, ok: true },
          {
            endpoint: '/api/admin/monitor-insights?windowDays=7',
            status: 200,
            ok: true,
            resultRows: 2,
            matchedDeliveryCount: 2,
            readLimitUsed: 1000,
            fallbackUsed: false,
            fallbackBlocked: false,
            dataSource: 'delivery-ops',
            asOf: '2026-02-25T00:00:00.000Z',
            freshnessMinutes: 1.25
          }
        ]
      }
    ]
  });

  assert.ok(markdown.includes('admin readiness checks'));
  assert.ok(markdown.includes('/api/admin/product-readiness: status=200 ok=true'));
  assert.ok(markdown.includes('/api/admin/read-path-fallback-summary: status=200 ok=true'));
  assert.ok(markdown.includes('/api/admin/monitor-insights?windowDays=7: status=200 ok=true'));
  assert.ok(markdown.includes('rows=2'));
  assert.ok(markdown.includes('matched=2'));
  assert.ok(markdown.includes('source=delivery-ops'));
  assert.ok(markdown.includes('asOf=2026-02-25T00:00:00.000Z'));
  assert.ok(markdown.includes('freshness=1.25'));
  assert.ok(markdown.includes('readLimit=1000'));
  assert.ok(markdown.includes('fallbackUsed=false'));
  assert.ok(markdown.includes('fallbackBlocked=false'));
});
