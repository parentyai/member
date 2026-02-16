'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { FAILURE_CODES, mapFailureCode } = require('../../src/domain/notificationFailureTaxonomy');

function codeFrom(message) {
  return mapFailureCode({ message });
}

test('phase206: failure taxonomy mapping', () => {
  assert.strictEqual(codeFrom('kill switch is ON'), FAILURE_CODES.GUARD_BLOCK_KILL_SWITCH);
  assert.strictEqual(codeFrom('link health WARN'), FAILURE_CODES.GUARD_BLOCK_WARN_LINK);
  assert.strictEqual(codeFrom('CTA text required'), FAILURE_CODES.INVALID_CTA);
  assert.strictEqual(codeFrom('CTA must be exactly 1'), FAILURE_CODES.INVALID_CTA);
  assert.strictEqual(codeFrom('linkRegistryId required'), FAILURE_CODES.MISSING_LINK_REGISTRY_ID);
  assert.strictEqual(codeFrom('link id required'), FAILURE_CODES.MISSING_LINK_REGISTRY_ID);
  assert.strictEqual(codeFrom('link registry entry not found'), FAILURE_CODES.MISSING_LINK_REGISTRY_ID);
  assert.strictEqual(codeFrom('direct URL is forbidden'), FAILURE_CODES.DIRECT_URL_FORBIDDEN);
  assert.strictEqual(codeFrom('LINE API error: 500'), FAILURE_CODES.LINE_API_FAIL);
  assert.strictEqual(codeFrom('delivery write failed'), FAILURE_CODES.DELIVERY_WRITE_FAIL);
  assert.strictEqual(codeFrom('unknown error'), FAILURE_CODES.UNEXPECTED_EXCEPTION);
});
