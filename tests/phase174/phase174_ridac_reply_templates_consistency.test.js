'use strict';

const assert = require('assert');
const { test } = require('node:test');

const messages = require('../../src/domain/ridacLineMessages');

const builders = [
  () => messages.statusDeclared('1234'),
  () => messages.statusUnlinked(),
  () => messages.statusNotDeclared(),
  () => messages.declareLinked(),
  () => messages.declareDuplicate(),
  () => messages.declareInvalidFormat(),
  () => messages.declareUsage(),
  () => messages.declareServerMisconfigured()
];

test('phase174: all ridac reply templates include explicit next action phrase', () => {
  for (const build of builders) {
    const text = build();
    assert.ok(typeof text === 'string' && text.length > 0);
    assert.ok(text.includes('次にすること:'), text);
  }
});
