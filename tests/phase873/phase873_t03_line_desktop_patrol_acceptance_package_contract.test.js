'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidation } = require('../../tools/line_desktop_patrol/validate_scaffold');

const ROOT = path.resolve(__dirname, '..', '..');
const TOOL_ROOT = path.join(ROOT, 'tools', 'line_desktop_patrol');

test('phase873: scaffold validation includes acceptance gate assets and scripts', () => {
  const result = runValidation();
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(path.join(TOOL_ROOT, 'src', 'member_line_patrol', 'acceptance_gate.py')));
  assert.ok(fs.existsSync(path.join(TOOL_ROOT, 'config', 'acceptance.manual.example.json')));
  assert.ok(packageJson.scripts['line-desktop-patrol:acceptance-gate']);
  assert.ok(packageJson.scripts['test:phase873']);
});
