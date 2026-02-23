'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase628: supervisor master required audit inputs include structure risk artifact', () => {
  const file = path.join(process.cwd(), 'docs/REPO_AUDIT_INPUTS/supervisor_master.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const required = json && json.required && json.required.audit_inputs;
  assert.equal(required.structure_risk, 'docs/REPO_AUDIT_INPUTS/structure_risk.json');
});
