'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { buildSendSegment } = require('../../src/usecases/phase66/buildSendSegment');

test('phase66: segment filters by ridacStatus + hasMemberNumber', async () => {
  const deps = {
    listOpsConsole: async () => ({
      items: [
        {
          lineUserId: 'U1',
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          memberFlags: { hasMemberNumber: true, memberNumberStale: false, ridacStatus: 'DECLARED', ridacMembershipIdLast4: '1111' }
        },
        {
          lineUserId: 'U2',
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          memberFlags: { hasMemberNumber: true, memberNumberStale: false, ridacStatus: 'NONE', ridacMembershipIdLast4: null }
        },
        {
          lineUserId: 'U3',
          readiness: { status: 'NOT_READY', blocking: ['missing'] },
          recommendedNextAction: 'STOP_AND_ESCALATE',
          allowedNextActions: ['STOP_AND_ESCALATE'],
          memberFlags: { hasMemberNumber: false, memberNumberStale: true, ridacStatus: 'DECLARED', ridacMembershipIdLast4: '3333' }
        },
        {
          lineUserId: 'U4',
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          memberFlags: { hasMemberNumber: false, memberNumberStale: false, ridacStatus: 'UNLINKED', ridacMembershipIdLast4: null }
        }
      ]
    })
  };

  const r1 = await buildSendSegment({ ridacStatus: 'DECLARED', hasMemberNumber: 'true' }, deps);
  assert.strictEqual(r1.ok, true);
  assert.deepStrictEqual(r1.items.map((i) => i.lineUserId), ['U1']);

  const r2 = await buildSendSegment({ ridacStatus: 'UNLINKED', hasMemberNumber: 'false' }, deps);
  assert.strictEqual(r2.ok, true);
  assert.deepStrictEqual(r2.items.map((i) => i.lineUserId), ['U4']);

  const r3 = await buildSendSegment({ ridacStatus: 'NONE', hasMemberNumber: 'true' }, deps);
  assert.strictEqual(r3.ok, true);
  assert.deepStrictEqual(r3.items.map((i) => i.lineUserId), ['U2']);
});

