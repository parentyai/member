'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handlePlan } = require('../../src/routes/admin/journeyPolicyConfig');

function createResCapture() {
  const out = {
    statusCode: null,
    body: ''
  };
  return {
    writeHead(statusCode) {
      out.statusCode = statusCode;
    },
    end(chunk) {
      if (chunk) out.body += String(chunk);
    },
    readJson() {
      return JSON.parse(out.body || '{}');
    },
    result: out
  };
}

test('phase746: journey policy plan hash reflects notificationCaps contract', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const reqBase = {
      headers: {
        'x-actor': 'phase746_test',
        'x-request-id': 'req_phase746',
        'x-trace-id': 'trace_phase746'
      },
      url: '/api/admin/os/journey-policy/plan'
    };

    const res1 = createResCapture();
    await handlePlan(reqBase, res1, JSON.stringify({
      policy: {
        enabled: true,
        reminder_offsets_days: [7, 3, 1]
      }
    }));
    assert.equal(res1.result.statusCode, 200);

    const res2 = createResCapture();
    await handlePlan(reqBase, res2, JSON.stringify({
      policy: {
        enabled: true,
        reminder_offsets_days: [7, 3, 1],
        notificationCaps: {
          quietHours: {
            startHourUtc: 22,
            endHourUtc: 7
          }
        }
      }
    }));
    assert.equal(res2.result.statusCode, 200);

    const plan1 = res1.readJson();
    const plan2 = res2.readJson();
    assert.notEqual(plan1.planHash, plan2.planHash);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
