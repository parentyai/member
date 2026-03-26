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

test('phase863: package exposes the phase863 contract test script', () => {
  assert.ok(packageJson.scripts['test:phase863']);
});

test('phase863: manifest marks capture_screenshot as observation_ready', () => {
  const serverManifest = readManifest();
  const tool = serverManifest.tools.find((item) => item.name === 'capture_screenshot');
  assert.ok(tool);
  assert.equal(tool.status, 'observation_ready');
});
