'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { runOpsBatch } = require('../../src/usecases/phase52/runOpsBatch');

test('phase52: invalid jobKey is rejected', async () => {
  await assert.rejects(
    () => runOpsBatch({ jobKey: 'invalid_job' }),
    /invalid jobKey/
  );
});
