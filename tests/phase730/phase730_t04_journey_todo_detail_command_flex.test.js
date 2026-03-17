'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleJourneyLineCommand } = require('../../src/usecases/journey/handleJourneyLineCommand');

test('phase730: TODO詳細 command returns flex task detail message', async () => {
  const prevFlag = process.env.ENABLE_TASK_DETAIL_LINE_V1;
  process.env.ENABLE_TASK_DETAIL_LINE_V1 = '1';
  try {
    const events = [];
    const result = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE730_DETAIL',
      text: 'TODO詳細:bank_open'
    }, {
      tasksRepo: {
        getTask: async () => ({
          taskId: 'U_PHASE730_DETAIL__bank_open',
          ruleId: 'bank_open',
          meaning: { title: '銀行口座を作る' }
        })
      },
      taskContentsRepo: {
        getTaskContent: async () => ({
          taskKey: 'bank_open',
          title: '銀行口座を作る',
          timeMin: 20,
          timeMax: 40,
          checklistItems: [
            { id: 'passport', text: 'パスポート準備', order: 1, enabled: true },
            { id: 'ssn', text: 'SSNまたはITIN確認', order: 2, enabled: true },
            { id: 'reserve', text: '銀行予約', order: 3, enabled: true }
          ],
          manualText: '手順マニュアル本文',
          failureText: 'よくある失敗本文',
          videoLinkId: 'video_1',
          actionLinkId: 'cta_1'
        })
      },
      linkRegistryRepo: {
        getLink: async (id) => {
          if (id === 'video_1') {
            return { id, url: 'https://www.youtube.com/watch?v=abc123', kind: 'youtube', enabled: true };
          }
          if (id === 'cta_1') {
            return { id, url: 'https://www.usbank.com/checking-accounts.html', kind: 'web', enabled: true, title: 'US Bankで口座開設' };
          }
          return null;
        }
      },
      eventsRepo: {
        createEvent: async (event) => {
          events.push(event);
          return { id: `event_${events.length}` };
        }
      }
    });

    assert.equal(result.handled, true);
    assert.ok(result.replyMessage);
    assert.equal(result.replyMessage.type, 'flex');
    const body = result.replyMessage.contents.body.contents;
    const labels = body
      .filter((item) => item && item.type === 'box' && Array.isArray(item.contents))
      .flatMap((box) => box.contents)
      .map((item) => item && item.action && item.action.label)
      .filter(Boolean);
    assert.ok(labels.includes('📖 手順マニュアル'));
    assert.ok(labels.includes('🎥 3分動画'));
    assert.ok(labels.includes('⚠ よくある失敗'));
    assert.ok(labels.includes('TODO完了:bank_open'));
    assert.ok(labels.includes('TODO進行中:bank_open'));
    assert.ok(labels.includes('TODOスヌーズ:bank_open:3'));
    assert.ok(events.some((event) => event && event.type === 'todo_detail_opened'));
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_DETAIL_LINE_V1;
    else process.env.ENABLE_TASK_DETAIL_LINE_V1 = prevFlag;
  }
});

test('phase730: TODO詳細続き command returns chunked messages with continuation hint', async () => {
  const prevFlag = process.env.ENABLE_TASK_DETAIL_LINE_V1;
  const prevValve = process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1;
  const prevLimit = process.env.TASK_DETAIL_SECTION_CHUNK_LIMIT;
  process.env.ENABLE_TASK_DETAIL_LINE_V1 = '1';
  process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1 = '1';
  process.env.TASK_DETAIL_SECTION_CHUNK_LIMIT = '2';
  try {
    const events = [];
    const result = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE730_CONTINUE',
      text: 'TODO詳細続き:bank_open:manual:1'
    }, {
      tasksRepo: {
        getTask: async () => ({
          taskId: 'U_PHASE730_CONTINUE__bank_open',
          ruleId: 'bank_open'
        })
      },
      taskContentsRepo: {
        getTaskContent: async () => ({
          taskKey: 'bank_open',
          manualText: ['A'.repeat(2100), 'B'.repeat(2100), 'C'.repeat(2100), 'D'.repeat(2100), 'E'.repeat(2100)].join('\n\n')
        })
      },
      eventsRepo: {
        createEvent: async (event) => {
          events.push(event);
          return { id: `event_${events.length}` };
        }
      }
    });

    assert.equal(result.handled, true);
    assert.ok(Array.isArray(result.replyMessages));
    assert.equal(result.replyMessages.length, 3);
    assert.match(result.replyMessages[0].text, /【手順マニュアル 1\/5】/);
    assert.match(result.replyMessages[1].text, /【手順マニュアル 2\/5】/);
    assert.match(result.replyMessages[2].text, /TODO詳細続き:bank_open:manual:3/);
    assert.ok(events.some((event) => event && event.type === 'todo_detail_section_opened'));
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_DETAIL_LINE_V1;
    else process.env.ENABLE_TASK_DETAIL_LINE_V1 = prevFlag;
    if (prevValve === undefined) delete process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1;
    else process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1 = prevValve;
    if (prevLimit === undefined) delete process.env.TASK_DETAIL_SECTION_CHUNK_LIMIT;
    else process.env.TASK_DETAIL_SECTION_CHUNK_LIMIT = prevLimit;
  }
});

test('phase730: TODO詳細続き command from chunk>1 emits resume event', async () => {
  const prevFlag = process.env.ENABLE_TASK_DETAIL_LINE_V1;
  const prevValve = process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1;
  process.env.ENABLE_TASK_DETAIL_LINE_V1 = '1';
  process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1 = '1';
  try {
    const events = [];
    const result = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE730_CONTINUE2',
      text: 'TODO詳細続き:bank_open:manual:3'
    }, {
      tasksRepo: {
        getTask: async () => ({
          taskId: 'U_PHASE730_CONTINUE2__bank_open',
          ruleId: 'bank_open'
        })
      },
      taskContentsRepo: {
        getTaskContent: async () => ({
          taskKey: 'bank_open',
          manualText: ['A'.repeat(2100), 'B'.repeat(2100), 'C'.repeat(2100), 'D'.repeat(2100), 'E'.repeat(2100)].join('\n\n')
        })
      },
      eventsRepo: {
        createEvent: async (event) => {
          events.push(event);
          return { id: `event_${events.length}` };
        }
      }
    });
    assert.equal(result.handled, true);
    assert.ok(events.some((event) => event && event.type === 'todo_detail_section_continue'));
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_DETAIL_LINE_V1;
    else process.env.ENABLE_TASK_DETAIL_LINE_V1 = prevFlag;
    if (prevValve === undefined) delete process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1;
    else process.env.ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1 = prevValve;
  }
});
