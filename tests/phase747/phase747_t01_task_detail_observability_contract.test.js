'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleJourneyLineCommand } = require('../../src/usecases/journey/handleJourneyLineCommand');
const { handleJourneyPostback } = require('../../src/usecases/journey/handleJourneyPostback');

test('phase747: TODO詳細 open event includes attribution key', async () => {
  const prevFlag = process.env.ENABLE_TASK_DETAIL_LINE_V1;
  process.env.ENABLE_TASK_DETAIL_LINE_V1 = '1';
  try {
    const events = [];
    const result = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE747_OPEN',
      text: 'TODO詳細:bank_open',
      traceId: 'trace_747',
      requestId: 'req_747',
      attribution: {
        notificationId: 'notification_747',
        deliveryId: 'delivery_747',
        source: 'journey_primary_notification_sent'
      }
    }, {
      tasksRepo: {
        getTask: async () => ({
          taskId: 'U_PHASE747_OPEN__bank_open',
          ruleId: 'bank_open',
          meaning: { title: '銀行口座を作る' }
        })
      },
      taskContentsRepo: {
        getTaskContent: async () => ({
          taskKey: 'bank_open',
          title: '銀行口座を作る',
          manualText: 'manual',
          failureText: 'failure'
        })
      },
      linkRegistryRepo: {
        getLink: async () => null
      },
      eventsRepo: {
        createEvent: async (event) => {
          events.push(event);
          return { id: `event_${events.length}` };
        }
      }
    });

    assert.equal(result.handled, true);
    assert.equal(result.replyMessage.type, 'flex');
    const opened = events.find((event) => event && event.type === 'todo_detail_opened');
    assert.ok(opened);
    assert.equal(opened.ref.todoKey, 'bank_open');
    assert.equal(opened.attribution.deliveryId, 'delivery_747');
    assert.equal(opened.attribution.notificationId, 'notification_747');
    assert.equal(opened.attributionKey, 'delivery:delivery_747');
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_DETAIL_LINE_V1;
    else process.env.ENABLE_TASK_DETAIL_LINE_V1 = prevFlag;
  }
});

test('phase747: todo_detail_section postback emits opened/continue events', async () => {
  const prevFlag = process.env.ENABLE_TASK_DETAIL_LINE_V1;
  process.env.ENABLE_TASK_DETAIL_LINE_V1 = '1';
  try {
    const events = [];
    const deps = {
      tasksRepo: {
        getTask: async () => ({
          taskId: 'U_PHASE747_SECTION__bank_open',
          ruleId: 'bank_open'
        })
      },
      taskContentsRepo: {
        getTaskContent: async () => ({
          taskKey: 'bank_open',
          manualText: ['A'.repeat(2100), 'B'.repeat(2100), 'C'.repeat(2100), 'D'.repeat(2100)].join('\n\n')
        })
      },
      eventsRepo: {
        createEvent: async (event) => {
          events.push(event);
          return { id: `event_${events.length}` };
        }
      }
    };

    const opened = await handleJourneyPostback({
      lineUserId: 'U_PHASE747_SECTION',
      data: 'action=todo_detail_section&todoKey=bank_open&section=manual&notificationId=n1&deliveryId=d1'
    }, deps);
    assert.equal(opened.handled, true);

    const resumed = await handleJourneyPostback({
      lineUserId: 'U_PHASE747_SECTION',
      data: 'action=todo_detail_section&todoKey=bank_open&section=manual&chunk=3&notificationId=n1&deliveryId=d1'
    }, deps);
    assert.equal(resumed.handled, true);

    assert.ok(events.some((event) => event && event.type === 'todo_detail_section_opened'));
    assert.ok(events.some((event) => event && event.type === 'todo_detail_section_continue'));
    const resumeEvent = events.find((event) => event && event.type === 'todo_detail_section_continue');
    assert.equal(resumeEvent.attribution.deliveryId, 'd1');
    assert.equal(resumeEvent.attributionKey, 'delivery:d1');
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_DETAIL_LINE_V1;
    else process.env.ENABLE_TASK_DETAIL_LINE_V1 = prevFlag;
  }
});
