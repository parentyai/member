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
  assert.match(contents, /Resolve Cloud Run service URL/, 'service url step missing');
  assert.match(contents, /token_format:\s+id_token/, 'id_token auth missing');
  assert.match(contents, /id_token_audience:\s+\$\{\{\s*steps\.service_url\.outputs\.service_url\s*\}\}/, 'id_token audience missing');
  assert.match(contents, /create_credentials_file:\s+false/, 'proxy auth should not override credentials');
  assert.match(contents, /PROXY_ID_TOKEN:\s+\$\{\{\s*steps\.proxy_auth\.outputs\.id_token\s*\}\}/, 'proxy id token env missing');
  assert.match(contents, /--token "\$PROXY_ID_TOKEN"/, 'proxy token injection missing');
  assert.match(contents, /segment_query_json/, 'segment_query_json input missing');
  assert.match(contents, /--segment-query-json/, 'segment query arg missing');
});
