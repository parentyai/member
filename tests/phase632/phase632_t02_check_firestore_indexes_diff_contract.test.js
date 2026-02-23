'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  normalizeRequiredIndex,
  normalizeActualIndex,
  diffIndexes,
  buildCreateCommand
} = require('../../scripts/check_firestore_indexes');

test('phase632: diffIndexes identifies missing required indexes and ignores __name__ synthetic field', () => {
  const required = [
    normalizeRequiredIndex({
      id: 'audit_logs_action_createdAt_desc',
      collectionGroup: 'audit_logs',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'action', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' }
      ]
    }),
    normalizeRequiredIndex({
      id: 'link_registry_lastHealth_state_createdAt_desc',
      collectionGroup: 'link_registry',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'lastHealth.state', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' }
      ]
    })
  ];

  const actual = [
    normalizeActualIndex({
      name: 'projects/member-485303/databases/(default)/collectionGroups/audit_logs/indexes/CICAgOjXh4EK',
      queryScope: 'COLLECTION',
      state: 'READY',
      fields: [
        { fieldPath: 'action', order: 'ASCENDING' },
        { fieldPath: 'templateKey', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
        { fieldPath: '__name__', order: 'DESCENDING' }
      ]
    })
  ].filter(Boolean);

  const diff = diffIndexes(required, actual);
  assert.strictEqual(diff.present.length, 0);
  assert.strictEqual(diff.missing.length, 2);
  assert.strictEqual(diff.extra.length, 1);
  assert.strictEqual(diff.missing[0].id, 'audit_logs_action_createdAt_desc');
  assert.strictEqual(diff.missing[1].id, 'link_registry_lastHealth_state_createdAt_desc');
});

test('phase632: buildCreateCommand renders executable gcloud command', () => {
  const spec = normalizeRequiredIndex({
    id: 'city_packs_language_status_updatedAt_desc',
    collectionGroup: 'city_packs',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'language', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' }
    ]
  });

  const command = buildCreateCommand('member-485303', spec);
  assert.ok(command.includes('gcloud firestore indexes composite create'));
  assert.ok(command.includes('--project "member-485303"'));
  assert.ok(command.includes('--collection-group="city_packs"'));
  assert.ok(command.includes('--field-config="field-path=language,order=ascending"'));
  assert.ok(command.includes('--field-config="field-path=updatedAt,order=descending"'));
});
