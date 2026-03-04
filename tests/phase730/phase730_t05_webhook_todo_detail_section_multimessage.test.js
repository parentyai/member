'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const tasksRepo = require('../../src/repos/firestore/tasksRepo');
const taskContentsRepo = require('../../src/repos/firestore/taskContentsRepo');
const { handleLineWebhook } = require('../../src/routes/webhookLine');

const SECRET = 'phase730_webhook_secret';

function signBody(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64');
}

test('phase730: webhook sends manual/failure section as reply + push split messages', async () => {
  const prevSecret = process.env.LINE_CHANNEL_SECRET;
  const prevFlag = process.env.ENABLE_TASK_DETAIL_LINE_V1;
  const prevValve = process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1;
  const prevLimit = process.env.TASK_DETAIL_SECTION_CHUNK_LIMIT;
  process.env.LINE_CHANNEL_SECRET = SECRET;
  process.env.ENABLE_TASK_DETAIL_LINE_V1 = '1';
  process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1 = '1';
  process.env.TASK_DETAIL_SECTION_CHUNK_LIMIT = '2';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await tasksRepo.upsertTask('U_PHASE730_WEBHOOK__bank_open', {
      userId: 'U_PHASE730_WEBHOOK',
      lineUserId: 'U_PHASE730_WEBHOOK',
      ruleId: 'bank_open',
      status: 'todo'
    });

    const manualText = [
      '手順'.repeat(2100),
      '確認'.repeat(2100),
      '完了'.repeat(2100),
      '準備'.repeat(2100),
      '再確認'.repeat(2100)
    ].join('\n\n');
    await taskContentsRepo.upsertTaskContent('bank_open', {
      taskKey: 'bank_open',
      title: '銀行口座を作る',
      manualText,
      failureText: 'failure'
    }, 'phase730_test');

    const body = JSON.stringify({
      events: [
        {
          type: 'postback',
          replyToken: 'rt_phase730_multi',
          source: { userId: 'U_PHASE730_WEBHOOK' },
          postback: {
            data: 'action=todo_detail_section&todoKey=bank_open&section=manual'
          }
        }
      ]
    });

    const replies = [];
    const pushes = [];
    const result = await handleLineWebhook({
      body,
      signature: signBody(body),
      requestId: 'phase730_req_multi',
      logger: () => {},
      allowWelcome: false,
      replyFn: async (replyToken, message) => {
        replies.push({ replyToken, message });
      },
      pushFn: async (lineUserId, message) => {
        pushes.push({ lineUserId, message });
      }
    });

    assert.equal(result.status, 200);
    assert.equal(replies.length, 1);
    assert.ok(replies[0].message);
    assert.equal(replies[0].message.type, 'text');
    assert.ok(replies[0].message.text.length <= 4200);
    assert.match(replies[0].message.text, /【手順マニュアル 1\/\d+】/);

    const sectionPushes = pushes
      .map((item) => item.message && item.message.text)
      .filter((text) => typeof text === 'string' && (text.includes('手順マニュアル') || text.includes('TODO詳細続き:bank_open:manual:3')));
    assert.ok(sectionPushes.length >= 2);
    assert.ok(sectionPushes.some((text) => /【手順マニュアル 2\/\d+】/.test(text)));
    assert.ok(sectionPushes.some((text) => /TODO詳細続き:bank_open:manual:3/.test(text)));
    pushes.forEach((item) => {
      assert.equal(item.lineUserId, 'U_PHASE730_WEBHOOK');
      assert.equal(item.message.type, 'text');
      assert.ok(item.message.text.length <= 4200);
    });
  } finally {
    if (prevSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = prevSecret;
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_DETAIL_LINE_V1;
    else process.env.ENABLE_TASK_DETAIL_LINE_V1 = prevFlag;
    if (prevValve === undefined) delete process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1;
    else process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1 = prevValve;
    if (prevLimit === undefined) delete process.env.TASK_DETAIL_SECTION_CHUNK_LIMIT;
    else process.env.TASK_DETAIL_SECTION_CHUNK_LIMIT = prevLimit;
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
