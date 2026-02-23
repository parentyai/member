'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase625: supervisor master required audit inputs include retention risk artifact', () => {
  const file = path.join(process.cwd(), 'docs/REPO_AUDIT_INPUTS/supervisor_master.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const required = json && json.required && json.required.audit_inputs;
  assert.equal(required.retention_risk, 'docs/REPO_AUDIT_INPUTS/retention_risk.json');
});
