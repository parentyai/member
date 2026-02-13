'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

test('phase186: stg e2e workflow preflight separates missing from permission issues', () => {
  const contents = read('.github/workflows/stg-notification-e2e.yml');
  assert.match(contents, /Validate required secret exists/, 'preflight step missing');
  assert.match(contents, /ADMIN_OS_TOKEN:\s+\$\{\{\s*secrets\.ADMIN_OS_TOKEN\s*\}\}/, 'ADMIN_OS_TOKEN secret env missing');
  assert.match(contents, /Secret preflight skipped::ADMIN_OS_TOKEN provided via GitHub secrets/, 'secret preflight skip notice missing');
  assert.match(contents, /Missing Secret Manager secret/, 'missing-secret error message missing');
  assert.match(contents, /NOT_FOUND/, 'NOT_FOUND branch missing');
  assert.match(contents, /Secret visibility skipped/, 'permission warning branch missing');
  assert.match(contents, /Secret preflight mode/, 'permission notice branch missing');
  assert.match(contents, /secretmanager\.secrets\.get/, 'permission-denied matcher missing');
  assert.match(contents, /Admin token source::Using ADMIN_OS_TOKEN from GitHub secrets/, 'admin token source notice missing');
});
