'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const packageJson = require('../../package.json');
const ROOT = path.resolve(__dirname, '..', '..');
const PYTHONPATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'src');

function readManifest() {
  return JSON.parse(execFileSync('python3', ['-c', 'import json; from member_line_patrol.mcp_server import build_server_manifest; print(json.dumps(build_server_manifest()))'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH }),
    encoding: 'utf8'
  }));
}

test('phase867: package exposes the phase867 contract test script', () => {
  assert.ok(packageJson.scripts['test:phase867']);
});

test('phase867: manifest notes mention PR11 dry-run visible-message wiring', () => {
  const serverManifest = readManifest();
  assert.ok(serverManifest.notes.some((item) => item.includes('PR11 wires visible message read into the dry-run harness')));
});
