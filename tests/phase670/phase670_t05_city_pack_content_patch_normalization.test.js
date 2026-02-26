'use strict';

const assert = require('assert');
const { test } = require('node:test');

const cityPacksRepo = require('../../src/repos/firestore/cityPacksRepo');

test('phase670: normalizeCityPackContentPatch normalizes editable fields', () => {
  const patch = cityPacksRepo.normalizeCityPackContentPatch({
    name: '  Updated Name  ',
    sourceRefs: [' sr_1 ', 'sr_1', 'sr_2'],
    packClass: 'NATIONWIDE',
    language: 'EN',
    slotSchemaVersion: '  slot_v1  ',
    slotContents: {
      emergency: {
        description: ' emergency ',
        ctaText: ' open ',
        linkRegistryId: ' lr_1 ',
        sourceRefs: [' ref_1 ', 'ref_1']
      }
    },
    metadata: { owner: 'ops' }
  });

  assert.strictEqual(patch.name, 'Updated Name');
  assert.deepStrictEqual(patch.sourceRefs, ['sr_1', 'sr_2']);
  assert.strictEqual(patch.packClass, 'nationwide');
  assert.strictEqual(patch.nationwidePolicy, 'federal_only');
  assert.strictEqual(patch.language, 'en');
  assert.strictEqual(patch.slotSchemaVersion, 'slot_v1');
  assert.ok(patch.slotContents && patch.slotContents.emergency);
  assert.strictEqual(patch.slotContents.emergency.linkRegistryId, 'lr_1');
  assert.deepStrictEqual(patch.slotContents.emergency.sourceRefs, ['ref_1']);
  assert.deepStrictEqual(patch.metadata, { owner: 'ops' });
});

test('phase670: normalizeCityPackContentPatch rejects empty required values when provided', () => {
  assert.throws(() => {
    cityPacksRepo.normalizeCityPackContentPatch({ name: '   ' });
  }, /name required/);

  assert.throws(() => {
    cityPacksRepo.normalizeCityPackContentPatch({ sourceRefs: [] });
  }, /sourceRefs required/);

  assert.throws(() => {
    cityPacksRepo.normalizeCityPackContentPatch({ validUntil: 'invalid-date' });
  }, /validUntil invalid/);
});
