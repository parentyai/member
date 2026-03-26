'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const PYTHONPATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'src');

function runPythonModule(moduleName, args) {
  const output = execFileSync('python3', ['-m', moduleName].concat(args || []), {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH }),
    encoding: 'utf8'
  });
  return JSON.parse(output);
}

test('phase858: host probe reports macOS adapter capabilities in a stable shape', () => {
  const payload = runPythonModule('member_line_patrol.macos_adapter', []);
  assert.equal(typeof payload.platform, 'string');
  assert.equal(typeof payload.is_macos, 'boolean');
  assert.equal(payload.line_bundle_id, 'jp.naver.line.mac');
  assert.equal(typeof payload.tools.open.available, 'boolean');
  assert.equal(typeof payload.tools.osascript.available, 'boolean');
  assert.ok(Object.prototype.hasOwnProperty.call(payload, 'line_bundle_present'));
});
