'use strict';

const assert = require('assert');
const analyticsReadRepo = require('../../src/repos/firestore/analyticsReadRepo');
const { test } = require('node:test');

test('phase587: analytics read repo exports createdAt range helpers for checklist domains', () => {
  assert.equal(typeof analyticsReadRepo.listChecklistsByCreatedAtRange, 'function');
  assert.equal(typeof analyticsReadRepo.listUserChecklistsByCreatedAtRange, 'function');
});

