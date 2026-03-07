'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleStatus } = require('../../src/routes/admin/uxPolicyReadonly');

function createResCapture() {
  return {
    statusCode: 0,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

test('phase742: ux-policy readonly route returns disabled snapshot when flag is off', async () => {
  const prev = process.env.ENABLE_UXOS_POLICY_READONLY;
  process.env.ENABLE_UXOS_POLICY_READONLY = '0';
  try {
    const req = {
      url: '/api/admin/os/ux-policy/readonly',
      headers: {
        'x-actor': 'phase742_tester',
        'x-trace-id': 'trace742_policy',
        'x-request-id': 'req742_policy'
      }
    };
    const res = createResCapture();
    await handleStatus(req, res);
    assert.equal(res.statusCode, 200);
    const parsed = JSON.parse(res.body || '{}');
    assert.equal(parsed.ok, true);
    assert.equal(parsed.enabled, false);
    assert.equal(parsed.reason, 'disabled_by_flag');
    assert.ok(parsed.flags);
    assert.equal(typeof parsed.flags.uxosPolicyReadonlyEnabled, 'boolean');
  } finally {
    if (prev === undefined) delete process.env.ENABLE_UXOS_POLICY_READONLY;
    else process.env.ENABLE_UXOS_POLICY_READONLY = prev;
  }
});
