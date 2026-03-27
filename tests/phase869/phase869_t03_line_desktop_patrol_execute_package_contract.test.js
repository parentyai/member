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

test('phase869: package exposes execute scripts', () => {
  assert.ok(packageJson.scripts['line-desktop-patrol:open-target']);
  assert.ok(packageJson.scripts['line-desktop-patrol:send']);
  assert.ok(packageJson.scripts['line-desktop-patrol:execute-once']);
});

test('phase869: manifest marks execute tools as execute_ready', () => {
  const serverManifest = readManifest();
  const tools = new Map(serverManifest.tools.map((item) => [item.name, item]));
  assert.equal(tools.get('validate_target').status, 'execute_ready');
  assert.equal(tools.get('open_test_chat').status, 'execute_ready');
  assert.equal(tools.get('send_text').status, 'execute_ready');
  assert.equal(tools.get('run_execute_scenario').status, 'execute_ready');
});
