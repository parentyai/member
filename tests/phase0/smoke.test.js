'use strict';

const assert = require('assert');

let testFn = null;

if (typeof global.test === 'function') {
  testFn = global.test;
} else {
  try {
    // Fallback for Node's built-in test runner.
    testFn = require('node:test').test;
  } catch (err) {
    testFn = null;
  }
}

if (testFn) {
  testFn('phase0 smoke', () => {
    assert.ok(true);
  });
}
