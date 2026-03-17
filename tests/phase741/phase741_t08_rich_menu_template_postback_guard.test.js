'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const richMenuTemplatesRepo = require('../../src/repos/firestore/richMenuTemplatesRepo');

function buildTemplate(templateId, actionPayload) {
  return {
    templateId,
    kind: 'default',
    status: 'draft',
    target: {
      locale: 'ja'
    },
    layout: {
      size: 'large',
      areas: [
        {
          label: 'entry',
          bounds: {
            x: 0,
            y: 0,
            width: 1,
            height: 1
          },
          actionType: 'postback',
          actionPayload
        }
      ]
    },
    lineMeta: {}
  };
}

test('phase741: invalid postback action is rejected in rich menu template', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await assert.rejects(
      async () => {
        await richMenuTemplatesRepo.upsertRichMenuTemplate(
          buildTemplate('phase741_invalid_postback_action', { data: 'action=unsupported_foo&todoKey=todo_abc' }),
          'phase741_test'
        );
      },
      /invalid richMenuTemplate/
    );
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase741: allowed postback action is accepted in rich menu template', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const templateId = 'phase741_allowed_postback_action';
    const payload = {
      data: 'action=todo_list&foo=bar'
    };
    const saved = await richMenuTemplatesRepo.upsertRichMenuTemplate(buildTemplate(templateId, payload), 'phase741_test');
    assert.equal(saved.templateId, templateId);
    const normalizedPayload = saved.layout.areas[0].actionPayload;
    assert.equal(normalizedPayload.data, payload.data);
    assert.equal(normalizedPayload.action, undefined);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
