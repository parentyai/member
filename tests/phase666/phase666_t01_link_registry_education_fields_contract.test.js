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
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase666: link registry stores normalized education metadata and supports filters', async () => {
  const created = await linkRegistryRepo.createLink({
    title: 'District Calendar',
    url: 'https://example.org/calendar',
    domainClass: 'K12_DISTRICT',
    schoolType: 'PUBLIC',
    eduScope: 'calendar',
    regionKey: 'NY::Manhattan',
    tags: ['Education', 'Calendar', 'Public', 'Public']
  });
  const row = await linkRegistryRepo.getLink(created.id);
  assert.strictEqual(row.domainClass, 'k12_district');
  assert.strictEqual(row.schoolType, 'public');
  assert.strictEqual(row.eduScope, 'calendar');
  assert.strictEqual(row.regionKey, 'ny::manhattan');
  assert.deepStrictEqual(row.tags, ['education', 'calendar', 'public']);

  const list = await linkRegistryRepo.listLinks({
    schoolType: 'public',
    eduScope: 'calendar',
    regionKey: 'ny::manhattan',
    tags: ['education'],
    limit: 10
  });
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].id, created.id);
});

test('phase666: link registry update patch normalizes only provided education fields', async () => {
  const created = await linkRegistryRepo.createLink({
    title: 'School Link',
    url: 'https://example.org/school',
    domainClass: 'unknown',
    schoolType: 'unknown'
  });
  await linkRegistryRepo.updateLink(created.id, {
    schoolType: 'private',
    regionKey: 'TX::Austin',
    tags: ['Education']
  });
  const row = await linkRegistryRepo.getLink(created.id);
  assert.strictEqual(row.domainClass, 'unknown');
  assert.strictEqual(row.schoolType, 'private');
  assert.strictEqual(row.regionKey, 'tx::austin');
  assert.deepStrictEqual(row.tags, ['education']);
});
