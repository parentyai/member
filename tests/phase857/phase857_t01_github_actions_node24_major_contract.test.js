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

test('phase857: workflows do not keep Node 20 deprecated core actions pinned to v4', () => {
  const workflows = listWorkflowFiles().map((file) => ({
    file,
    text: fs.readFileSync(file, 'utf8')
  }));

  const deprecatedMatches = [];
  for (const workflow of workflows) {
    if (/actions\/checkout@v4/.test(workflow.text)) deprecatedMatches.push(`${workflow.file}:checkout@v4`);
    if (/actions\/setup-node@v4/.test(workflow.text)) deprecatedMatches.push(`${workflow.file}:setup-node@v4`);
    if (/actions\/upload-artifact@v4/.test(workflow.text)) deprecatedMatches.push(`${workflow.file}:upload-artifact@v4`);
  }

  assert.deepEqual(deprecatedMatches, []);
  assert.ok(workflows.some((workflow) => /actions\/checkout@v6/.test(workflow.text)));
  assert.ok(workflows.some((workflow) => /actions\/setup-node@v6/.test(workflow.text)));
  assert.ok(workflows.some((workflow) => /actions\/upload-artifact@v7/.test(workflow.text)));
});
