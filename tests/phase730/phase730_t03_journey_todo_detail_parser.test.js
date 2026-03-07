'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseJourneyLineCommand,
  parseJourneyPostbackData
} = require('../../src/domain/journey/lineCommandParsers');

test('phase730: line command parser resolves TODO詳細 command', () => {
  const command = parseJourneyLineCommand('TODO詳細:bank_open');
  assert.ok(command);
  assert.equal(command.action, 'todo_detail');
  assert.equal(command.todoKey, 'bank_open');
});

test('phase730: postback parser resolves todo_detail_section payload', () => {
  const action = parseJourneyPostbackData('action=todo_detail_section&todoKey=bank_open&section=manual');
  assert.ok(action);
  assert.equal(action.action, 'todo_detail_section');
  assert.equal(action.todoKey, 'bank_open');
  assert.equal(action.section, 'manual');
});

test('phase730: postback parser keeps detail attribution metadata when provided', () => {
  const action = parseJourneyPostbackData('action=todo_detail&todoKey=bank_open&notificationId=n1&deliveryId=d1&source=notification&traceId=t1');
  assert.ok(action);
  assert.equal(action.action, 'todo_detail');
  assert.equal(action.todoKey, 'bank_open');
  assert.equal(action.notificationId, 'n1');
  assert.equal(action.deliveryId, 'd1');
  assert.equal(action.attributionSource, 'notification');
  assert.equal(action.attributionTraceId, 't1');
});

test('phase730: postback parser rejects invalid todo_detail_section payload', () => {
  const action = parseJourneyPostbackData('action=todo_detail_section&todoKey=bank_open&section=unknown');
  assert.ok(action);
  assert.equal(action.action, 'todo_detail_section_missing');
});

test('phase730: line command parser resolves TODO詳細続き command', () => {
  const command = parseJourneyLineCommand('TODO詳細続き:bank_open:manual:4');
  assert.ok(command);
  assert.equal(command.action, 'todo_detail_section_continue');
  assert.equal(command.todoKey, 'bank_open');
  assert.equal(command.section, 'manual');
  assert.equal(command.startChunk, 4);
});
