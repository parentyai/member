'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

test('phase184: stg notification e2e workflow is defined with required inputs', () => {
  const contents = read('.github/workflows/stg-notification-e2e.yml');
  assert.match(contents, /name:\s*STG notification e2e checklist/);
  assert.match(contents, /workflow_dispatch:/, 'workflow_dispatch missing');
  assert.match(contents, /segment_template_key:/, 'segment_template_key input missing');
  assert.match(contents, /composer_notification_id:/, 'composer_notification_id input missing');
  assert.match(contents, /Auth \(OIDC\)/, 'OIDC auth step missing');
});

test('phase184: stg notification e2e workflow runs proxy and strict route error gate', () => {
  const contents = read('.github/workflows/stg-notification-e2e.yml');
  assert.match(contents, /gcloud run services proxy/, 'Cloud Run proxy step missing');
  assert.match(contents, /npm run ops:stg-e2e/, 'ops:stg-e2e command missing');
  assert.match(contents, /--fetch-route-errors/, 'fetch-route-errors option missing');
  assert.match(contents, /--fail-on-route-errors/, 'fail-on-route-errors option missing');
  assert.match(contents, /--project-id/, 'project-id option missing');
});

test('phase184: stg notification e2e workflow uploads artifacts', () => {
  const contents = read('.github/workflows/stg-notification-e2e.yml');
  assert.match(contents, /actions\/upload-artifact@v4/, 'artifact upload action missing');
  assert.match(contents, /artifacts\/stg-notification-e2e/, 'artifact path missing');
  assert.match(contents, /Append markdown summary to job summary/, 'job summary step missing');
});
