'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('phase800: exception playbook authority docs are present', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', 'docs', 'SCHEMA_notification_templates.md'),
    'utf8'
  );
  const runbook = fs.readFileSync(
    path.join(__dirname, '..', '..', 'docs', 'RUNBOOK_OPS_TEMPLATES.md'),
    'utf8'
  );
  const dataMap = fs.readFileSync(
    path.join(__dirname, '..', '..', 'docs', 'DATA_MAP.md'),
    'utf8'
  );

  assert.match(schema, /# SCHEMA_notification_templates/);
  assert.match(schema, /exceptionPlaybook/);
  assert.match(runbook, /exceptionPlaybook/);
  assert.match(dataMap, /notification_templates/);
  assert.match(dataMap, /exception_playbook/);
});
