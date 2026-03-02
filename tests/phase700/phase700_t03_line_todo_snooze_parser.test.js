'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseJourneyLineCommand,
  parseJourneyPostbackData
} = require('../../src/domain/journey/lineCommandParsers');

test('phase700: line command parser resolves TODOスヌーズ days syntax', () => {
  const command = parseJourneyLineCommand('TODOスヌーズ:visa_documents:3');
  assert.ok(command);
  assert.equal(command.action, 'todo_snooze');
  assert.equal(command.todoKey, 'visa_documents');
  assert.equal(command.snoozeDays, 3);
  assert.equal(command.snoozeUntil, null);
});

test('phase700: line command parser resolves TODOスヌーズ date syntax', () => {
  const command = parseJourneyLineCommand('TODOスヌーズ:visa_documents:2026-04-01');
  assert.ok(command);
  assert.equal(command.action, 'todo_snooze');
  assert.equal(command.todoKey, 'visa_documents');
  assert.equal(command.snoozeUntil, '2026-04-01');
  assert.equal(command.snoozeDays, null);
});

test('phase700: postback parser resolves todo_snooze payload', () => {
  const action = parseJourneyPostbackData('action=todo_snooze&todoKey=visa_documents&days=5');
  assert.ok(action);
  assert.equal(action.action, 'todo_snooze');
  assert.equal(action.todoKey, 'visa_documents');
  assert.equal(action.snoozeDays, 5);
});
