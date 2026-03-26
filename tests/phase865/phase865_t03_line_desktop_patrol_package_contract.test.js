'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const packageJson = require('../../package.json');
const samplePolicy = require('../../tools/line_desktop_patrol/config/policy.example.json');
const ROOT = path.resolve(__dirname, '..', '..');
const PYTHONPATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'src');

function readManifest() {
  return JSON.parse(execFileSync('python3', ['-c', 'import json; from member_line_patrol.mcp_server import build_server_manifest; print(json.dumps(build_server_manifest()))'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH }),
    encoding: 'utf8'
  }));
}

test('phase865: package exposes the phase865 contract test script', () => {
  assert.ok(packageJson.scripts['test:phase865']);
});

test('phase865: sample policy keeps store_ax_tree disabled by default', () => {
  assert.equal(samplePolicy.store_ax_tree, false);
});

test('phase865: manifest notes mention PR9 dry-run AX wiring', () => {
  const serverManifest = readManifest();
  assert.ok(serverManifest.notes.some((item) => item.includes('PR9 wires AX summary dump into the dry-run harness')));
});
