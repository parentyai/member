'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { renderMarkdownSummary } = require('../../tools/run_stg_notification_e2e_checklist');

test('phase631: markdown summary prints strict audit controls and missing actions', () => {
  const markdown = renderMarkdownSummary({
    endedAt: '2026-02-23T10:00:00.000Z',
    baseUrl: 'http://127.0.0.1:18080',
    actor: 'ops_stg_e2e',
    headSha: 'abc123',
    summary: {
      traceLimit: 180,
      strictAuditActions: true
    },
    scenarios: [
      {
        name: 'segment',
        status: 'FAIL',
        traceId: 'trace-segment-1',
        reason: 'missing_audit_actions:segment_send.execute',
        traceBundle: { audits: 3, decisions: 1, timeline: 1 },
        requiredAuditActions: ['segment_send.plan', 'segment_send.execute'],
        missingAuditActions: ['segment_send.execute']
      }
    ]
  });

  assert.match(markdown, /traceLimit: 180/);
  assert.match(markdown, /strictAuditActions: true/);
  assert.match(markdown, /required audit actions: segment_send.plan, segment_send.execute/);
  assert.match(markdown, /missing audit actions: segment_send.execute/);
});
