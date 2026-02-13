'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { parseArgs } = require('../../tools/run_stg_notification_e2e_checklist');

test('phase186: segment query accepts loose lineUserIds format', () => {
  const argv = ['node', 'script', '--segment-query-json', '{lineUserIds:[U1,U2]}'];
  const opts = parseArgs(argv, { ADMIN_OS_TOKEN: 'test-token' });
  assert.deepStrictEqual(opts.segmentQuery, { lineUserIds: ['U1', 'U2'] });
});
