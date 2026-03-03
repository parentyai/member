'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { signTaskApiRequest } = require('../../src/domain/tasks/signature');
const { handleTasksRoute } = require('../../src/routes/tasks');

function createResponseCapture() {
  const capture = { status: null, body: null, headers: null };
  return {
    res: {
      writeHead(status, headers) {
        capture.status = status;
        capture.headers = headers;
      },
      end(payload) {
        capture.body = payload;
      }
    },
    capture
  };
}

test('phase706: GET /api/tasks returns task payload (engine disabled safe path)', async () => {
  const prevEngine = process.env.ENABLE_TASK_ENGINE_V1;
  const prevSecret = process.env.TASK_API_SIGNING_SECRET;
  process.env.ENABLE_TASK_ENGINE_V1 = '0';
  process.env.TASK_API_SIGNING_SECRET = 'phase706_signature_secret';

  try {
    const ts = String(Date.now());
    const sig = signTaskApiRequest({
      method: 'GET',
      pathname: '/api/tasks',
      userId: 'U_SIG_1',
      ts,
      taskId: ''
    }, { secret: process.env.TASK_API_SIGNING_SECRET });

    const req = {
      method: 'GET',
      url: `/api/tasks?userId=U_SIG_1&ts=${encodeURIComponent(ts)}&sig=${encodeURIComponent(sig)}`,
      headers: {}
    };
    const { res, capture } = createResponseCapture();

    await handleTasksRoute(req, res, '', '/api/tasks');

    assert.equal(capture.status, 200);
    const body = JSON.parse(String(capture.body || '{}'));
    assert.equal(body.ok, true);
    assert.equal(body.userId, 'U_SIG_1');
    assert.ok(Array.isArray(body.tasks));
  } finally {
    if (prevEngine === undefined) delete process.env.ENABLE_TASK_ENGINE_V1;
    else process.env.ENABLE_TASK_ENGINE_V1 = prevEngine;
    if (prevSecret === undefined) delete process.env.TASK_API_SIGNING_SECRET;
    else process.env.TASK_API_SIGNING_SECRET = prevSecret;
  }
});
