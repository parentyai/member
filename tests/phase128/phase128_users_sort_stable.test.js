'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { sortUsersSummaryStable } = require('../../src/usecases/phase5/sortUsersSummaryStable');

function ids(items) {
  return items.map((item) => item.lineUserId);
}

test('phase128: stable ordering is deterministic and follows SSOT sort spec', () => {
  const items = [
    {
      lineUserId: 'U1',
      needsAttention: true,
      readiness: { status: 'NOT_READY' },
      opsState: { nextAction: 'SEND' },
      stale: true,
      lastActionAt: '2026-01-02T00:00:00.000Z'
    },
    {
      lineUserId: 'U2',
      needsAttention: true,
      readiness: { status: 'NOT_READY' },
      opsState: { nextAction: 'NO_ACTION' },
      stale: false,
      lastActionAt: '2026-01-05T00:00:00.000Z'
    },
    {
      lineUserId: 'U3',
      needsAttention: true,
      readiness: { status: 'READY' },
      opsState: { nextAction: 'SEND' },
      stale: false,
      lastActionAt: '2026-01-06T00:00:00.000Z'
    },
    {
      lineUserId: 'U4',
      needsAttention: false,
      readiness: { status: 'NOT_READY' },
      opsState: { nextAction: 'SEND' },
      stale: false,
      lastActionAt: '2026-01-07T00:00:00.000Z'
    },
    {
      lineUserId: 'U5',
      needsAttention: false,
      readiness: { status: 'READY' },
      opsState: { nextAction: 'NO_ACTION' },
      stale: true,
      lastActionAt: null
    },
    {
      lineUserId: 'U6',
      needsAttention: false,
      readiness: { status: 'READY' },
      opsState: { nextAction: 'NO_ACTION' },
      stale: true,
      lastActionAt: '2026-01-01T00:00:00.000Z'
    }
  ];

  const expected = ['U1', 'U2', 'U3', 'U4', 'U6', 'U5'];

  const perm1 = [items[3], items[5], items[0], items[2], items[1], items[4]];
  const perm2 = [items[4], items[2], items[1], items[0], items[5], items[3]];

  assert.deepStrictEqual(ids(sortUsersSummaryStable(perm1)), expected);
  assert.deepStrictEqual(ids(sortUsersSummaryStable(perm2)), expected);
});

