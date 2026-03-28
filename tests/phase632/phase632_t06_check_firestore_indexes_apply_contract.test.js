'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');

const {
  buildCreateExecArgs,
  normalizeRequiredIndex,
  run
} = require('../../scripts/check_firestore_indexes');

test('phase632: buildCreateExecArgs renders gcloud exec args with async apply', () => {
  const spec = normalizeRequiredIndex({
    id: 'tasks_userId_dueAt_asc',
    collectionGroup: 'tasks',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'dueAt', order: 'ASCENDING' }
    ]
  });
  const args = buildCreateExecArgs('member-485303', spec, { async: true });
  assert.deepStrictEqual(args.slice(0, 6), [
    'firestore',
    'indexes',
    'composite',
    'create',
    '--project',
    'member-485303'
  ]);
  assert.ok(args.includes('--async'));
  assert.ok(args.includes('field-path=userId,order=ascending'));
  assert.ok(args.includes('field-path=dueAt,order=ascending'));
});

test('phase632: run --apply creates missing indexes and rechecks diff', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase632-apply-'));
  const requiredFile = path.join(tempDir, 'required.json');
  fs.writeFileSync(
    requiredFile,
    JSON.stringify(
      {
        indexes: [
          {
            id: 'tasks_userId_dueAt_asc',
            collectionGroup: 'tasks',
            queryScope: 'COLLECTION',
            fields: [
              { fieldPath: 'userId', order: 'ASCENDING' },
              { fieldPath: 'dueAt', order: 'ASCENDING' }
            ]
          }
        ],
        criticalContracts: []
      },
      null,
      2
    )
  );

  const listOutputs = [
    '[]',
    JSON.stringify([
      {
        name: 'projects/member-485303/databases/(default)/collectionGroups/tasks/indexes/CITest',
        queryScope: 'COLLECTION',
        state: 'CREATING',
        fields: [
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'dueAt', order: 'ASCENDING' },
          { fieldPath: '__name__', order: 'DESCENDING' }
        ]
      }
    ])
  ];
  const createCalls = [];
  const exitCode = run(
    ['node', 'scripts/check_firestore_indexes.js', '--apply', '--check', '--project-id', 'member-485303', '--required-file', requiredFile],
    {},
    (cmd, args) => {
      if (cmd !== 'gcloud') throw new Error(`unexpected command: ${cmd}`);
      if (args.slice(0, 4).join(' ') === 'firestore indexes composite list') {
        return listOutputs.shift() || listOutputs[listOutputs.length - 1];
      }
      createCalls.push(args);
      return 'Create request issued';
    }
  );

  assert.strictEqual(exitCode, 0);
  assert.strictEqual(createCalls.length, 1);
  assert.ok(createCalls[0].includes('--async'));
  assert.ok(createCalls[0].includes('field-path=userId,order=ascending'));
});
