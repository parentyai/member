'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { parseJourneyLineCommand, parseJourneyPostbackData } = require('../../src/domain/journey/lineCommandParsers');
const { handleJourneyLineCommand } = require('../../src/usecases/journey/handleJourneyLineCommand');

test('phase730: parser supports delivery/citypack/vendor guide commands', () => {
  assert.deepEqual(parseJourneyLineCommand('通知履歴'), { action: 'delivery_history' });
  assert.deepEqual(parseJourneyLineCommand('CityPack案内'), { action: 'city_pack_guide' });
  assert.deepEqual(parseJourneyLineCommand('Vendor案内'), { action: 'vendor_guide' });
  assert.deepEqual(parseJourneyPostbackData('action=delivery_history'), { action: 'delivery_history' });
});

test('phase730: 通知履歴 command returns compact history text', async () => {
  const prevFlag = process.env.ENABLE_TASK_DETAIL_GUIDE_COMMANDS_V1;
  try {
    process.env.ENABLE_TASK_DETAIL_GUIDE_COMMANDS_V1 = '1';
    const result = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE730_T10',
      text: '通知履歴',
      traceId: 'trace_phase730_t10'
    }, {
      deliveriesRepo: {
        listDeliveriesByUser: async () => [
          { id: 'd_1', notificationId: 'n_1', state: 'delivered', delivered: true, sentAt: '2026-03-01T00:00:00.000Z' },
          { id: 'd_2', notificationId: 'n_2', state: 'failed', delivered: false, sentAt: '2026-03-02T00:00:00.000Z', lastError: 'LINE API fail' }
        ]
      },
      notificationsRepo: {
        getNotification: async (id) => {
          if (id === 'n_1') return { id, title: '通知A' };
          if (id === 'n_2') return { id, title: '通知B' };
          return null;
        }
      },
      linkRegistryRepo: { getLink: async () => null },
      usersRepo: { listUsersByMemberNumber: async () => [] },
      appendAuditLog: async () => ({ ok: true })
    });
    assert.equal(result.handled, true);
    assert.match(result.replyText, /通知履歴（直近）/);
    assert.match(result.replyText, /合計:2/);
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_TASK_DETAIL_GUIDE_COMMANDS_V1;
    else process.env.ENABLE_TASK_DETAIL_GUIDE_COMMANDS_V1 = prevFlag;
  }
});
