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
const { validateCityPackSchoolLinks } = require('../../src/usecases/cityPack/validateCityPackSchoolLinks');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase666: city pack school slot passes only when schoolType is public', async () => {
  const publicLink = await linkRegistryRepo.createLink({
    title: 'Public School',
    url: 'https://example.org/public-school',
    schoolType: 'public'
  });
  const privateLink = await linkRegistryRepo.createLink({
    title: 'Private School',
    url: 'https://example.org/private-school',
    schoolType: 'private'
  });

  const ok = await validateCityPackSchoolLinks({
    cityPack: {
      slotContents: {
        school: {
          description: 'School',
          ctaText: 'Open',
          linkRegistryId: publicLink.id,
          sourceRefs: []
        }
      }
    }
  });
  assert.strictEqual(ok.ok, true);

  const blocked = await validateCityPackSchoolLinks({
    cityPack: {
      slotContents: {
        school: {
          description: 'School',
          ctaText: 'Open',
          linkRegistryId: privateLink.id,
          sourceRefs: []
        }
      }
    }
  });
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.reason, 'school_link_not_public');
  assert.strictEqual(blocked.schoolType, 'private');
});
