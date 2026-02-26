'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const schoolCalendarLinksRepo = require('../../src/repos/firestore/schoolCalendarLinksRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase668: school_calendar_links enforces traceId and defaults validUntil', async () => {
  await assert.rejects(
    async () => schoolCalendarLinksRepo.createSchoolCalendarLink({
      regionKey: 'tx::austin',
      linkRegistryId: 'lr_phase668',
      sourceRefId: 'sr_phase668',
      schoolYear: '2025-2026'
    }),
    /traceId required/
  );

  const created = await schoolCalendarLinksRepo.createSchoolCalendarLink({
    regionKey: 'tx::austin',
    linkRegistryId: 'lr_phase668',
    sourceRefId: 'sr_phase668',
    schoolYear: '2025-2026',
    traceId: 'trace_phase668_validity'
  });
  const row = await schoolCalendarLinksRepo.getSchoolCalendarLink(created.id);
  assert.strictEqual(row.status, 'active');
  assert.ok(row.validUntil);
});
