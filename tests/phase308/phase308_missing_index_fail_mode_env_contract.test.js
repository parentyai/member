'use strict';

const assert = require('assert');
const { test } = require('node:test');

const policy = require('../../src/repos/firestore/indexFallbackPolicy');

test('phase308: missing-index fail mode defaults to true on stg/prod env', () => {
  const prevEnvName = process.env.ENV_NAME;
  const prevFailFlag = process.env.FIRESTORE_FAIL_ON_MISSING_INDEX;

  try {
    delete process.env.FIRESTORE_FAIL_ON_MISSING_INDEX;

    process.env.ENV_NAME = 'stg';
    assert.strictEqual(policy.shouldFailOnMissingIndex(), true);

    process.env.ENV_NAME = 'prod';
    assert.strictEqual(policy.shouldFailOnMissingIndex(), true);

    process.env.ENV_NAME = 'local';
    assert.strictEqual(policy.shouldFailOnMissingIndex(), false);

    process.env.FIRESTORE_FAIL_ON_MISSING_INDEX = '0';
    process.env.ENV_NAME = 'prod';
    assert.strictEqual(policy.shouldFailOnMissingIndex(), false);
  } finally {
    if (prevEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = prevEnvName;
    if (prevFailFlag === undefined) delete process.env.FIRESTORE_FAIL_ON_MISSING_INDEX;
    else process.env.FIRESTORE_FAIL_ON_MISSING_INDEX = prevFailFlag;
  }
});
