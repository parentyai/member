'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const { getNotificationReadModel } = require('../../src/usecases/admin/getNotificationReadModel');

const ROOT = path.resolve(__dirname, '..', '..');
const SSOT_PATH = path.join(ROOT, 'docs', 'SSOT_ADMIN_UI_DATA_MODEL.md');
const READ_MODEL_HTML = path.join(ROOT, 'apps', 'admin', 'read_model.html');
const MONITOR_HTML = path.join(ROOT, 'apps', 'admin', 'monitor.html');

function extractReadModelKeys(ssotText) {
  const start = ssotText.indexOf('## Read Model (View only)');
  if (start === -1) return [];
  const end = ssotText.indexOf('## Draft / Active Rules', start);
  const section = end === -1 ? ssotText.slice(start) : ssotText.slice(start, end);
  const uiMarker = section.indexOf('UI参照キー');
  const uiSection = uiMarker === -1 ? section : section.slice(uiMarker);
  const notesIdx = uiSection.indexOf('### Read Model Notes');
  const listBlock = notesIdx === -1 ? uiSection : uiSection.slice(0, notesIdx);
  const keys = [];
  const regex = /- `([^`]+)`/g;
  let match;
  while ((match = regex.exec(listBlock)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

function hasNested(obj, pathString) {
  const parts = pathString.split('.');
  let cursor = obj;
  for (const part of parts) {
    if (!cursor || !Object.prototype.hasOwnProperty.call(cursor, part)) return false;
    cursor = cursor[part];
  }
  return true;
}

function assertHtmlUsesKey(html, key) {
  if (key.includes('.')) {
    const [first, second] = key.split('.');
    assert.ok(html.includes(first), `missing ${first} in UI`);
    assert.ok(html.includes(second), `missing ${second} in UI`);
    return;
  }
  assert.ok(html.includes(`.${key}`) || html.includes(key), `missing ${key} in UI`);
}

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase191: SSOT read-model keys close loop to output + UI', async () => {
  const ssotText = fs.readFileSync(SSOT_PATH, 'utf8');
  const keys = extractReadModelKeys(ssotText);
  assert.ok(keys.length > 0, 'no read-model keys extracted');

  await notificationsRepo.createNotification({
    title: 'Title',
    scenarioKey: 'A',
    stepKey: '3mo'
  });

  const items = await getNotificationReadModel({ limit: 10 });
  assert.ok(items.length > 0, 'read-model returned no items');
  const item = items[0];

  for (const key of keys) {
    if (key.includes('.')) {
      assert.ok(hasNested(item, key), `missing nested key: ${key}`);
    } else {
      assert.ok(Object.prototype.hasOwnProperty.call(item, key), `missing key: ${key}`);
    }
  }

  const readModelHtml = fs.readFileSync(READ_MODEL_HTML, 'utf8');
  const monitorHtml = fs.readFileSync(MONITOR_HTML, 'utf8');
  for (const key of keys) {
    assertHtmlUsesKey(readModelHtml, key);
    assertHtmlUsesKey(monitorHtml, key);
  }
});
