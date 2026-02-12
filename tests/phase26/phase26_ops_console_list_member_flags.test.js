'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listOpsConsole } = require('../../src/usecases/phase26/listOpsConsole');

test('phase26: ops console list includes memberFlags (add-only)', async () => {
  const deps = {
    listUsers: async () => ([
      { id: 'U1' },
      { id: 'U2' }
    ]),
    getOpsConsole: async ({ lineUserId }) => {
      if (lineUserId === 'U1') {
        return {
          readiness: { status: 'READY', blocking: [] },
          recommendedNextAction: 'NO_ACTION',
          allowedNextActions: ['NO_ACTION'],
          memberSummary: {
            member: {
              hasMemberNumber: true,
              memberNumberStale: false,
              redac: {
                hasRedacMembership: true,
                redacMembershipIdLast4: '3456',
                redacMembershipDeclaredAt: '2026-02-10T00:00:00.000Z',
                redacMembershipDeclaredBy: 'user',
                redacMembershipUnlinkedAt: null,
                redacMembershipUnlinkedBy: null
              }
            }
          }
        };
      }
      return {
        readiness: { status: 'NOT_READY', blocking: ['missing'] },
        recommendedNextAction: 'STOP_AND_ESCALATE',
        allowedNextActions: ['STOP_AND_ESCALATE'],
        memberSummary: {
          member: {
            hasMemberNumber: false,
            memberNumberStale: true,
            redac: {
              hasRedacMembership: false,
              redacMembershipIdLast4: null,
              redacMembershipDeclaredAt: null,
              redacMembershipDeclaredBy: null,
              redacMembershipUnlinkedAt: '2026-02-10T01:02:03.000Z',
              redacMembershipUnlinkedBy: 'ops'
            }
          }
        }
      };
    }
  };

  const out = await listOpsConsole({ status: 'ALL', limit: 10 }, deps);
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.items.length, 2);

  const u1 = out.items.find((it) => it.lineUserId === 'U1');
  const u2 = out.items.find((it) => it.lineUserId === 'U2');
  assert.ok(u1);
  assert.ok(u2);

  assert.deepStrictEqual(u1.memberFlags, {
    hasMemberNumber: true,
    memberNumberStale: false,
    redacStatus: 'DECLARED',
    redacMembershipIdLast4: '3456'
  });
  assert.deepStrictEqual(u2.memberFlags, {
    hasMemberNumber: false,
    memberNumberStale: true,
    redacStatus: 'UNLINKED',
    redacMembershipIdLast4: null
  });
});

