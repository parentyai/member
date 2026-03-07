'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleStatus } = require('../../src/routes/admin/uxosNextAction');

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

test('phase742: uxos next-action route returns disabled payload when nba flag is off', async () => {
  const prev = process.env.ENABLE_UXOS_NBA;
  process.env.ENABLE_UXOS_NBA = '0';
  try {
    const req = {
      url: '/api/admin/os/uxos/next-action?lineUserId=U742',
      headers: {
        'x-actor': 'phase742_tester',
        'x-trace-id': 'trace742_nba',
        'x-request-id': 'req742_nba'
      }
    };
    const res = createResCapture();
    await handleStatus(req, res);
    assert.equal(res.statusCode, 200);
    const parsed = JSON.parse(res.body || '{}');
    assert.equal(parsed.ok, true);
    assert.equal(parsed.enabled, false);
    assert.equal(parsed.source, 'disabled');
  } finally {
    if (prev === undefined) delete process.env.ENABLE_UXOS_NBA;
    else process.env.ENABLE_UXOS_NBA = prev;
  }
});
