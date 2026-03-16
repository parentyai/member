'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const WORKFLOW_DIR = path.join(process.cwd(), '.github', 'workflows');

function listWorkflowFiles() {
  return fs.readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith('.yml'))
    .map((name) => path.join(WORKFLOW_DIR, name));
}

test('phase858: workflows do not keep deprecated google github actions pinned to v2', () => {
  const workflows = listWorkflowFiles().map((file) => ({
    file,
    text: fs.readFileSync(file, 'utf8')
  }));

  const deprecatedMatches = [];
  for (const workflow of workflows) {
    if (/google-github-actions\/auth@v2/.test(workflow.text)) deprecatedMatches.push(`${workflow.file}:auth@v2`);
    if (/google-github-actions\/setup-gcloud@v2/.test(workflow.text)) deprecatedMatches.push(`${workflow.file}:setup-gcloud@v2`);
  }

  assert.deepEqual(deprecatedMatches, []);
  assert.ok(workflows.some((workflow) => /google-github-actions\/auth@v3/.test(workflow.text)));
  assert.ok(workflows.some((workflow) => /google-github-actions\/setup-gcloud@v3/.test(workflow.text)));
});
