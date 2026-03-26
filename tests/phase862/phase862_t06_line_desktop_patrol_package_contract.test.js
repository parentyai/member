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

test('phase862: package exposes guarded loop and phase test script', () => {
  assert.ok(packageJson.scripts['line-desktop-patrol:loop']);
  assert.ok(packageJson.scripts['test:phase862']);
});

test('phase862: manifest marks run_guarded_patrol_loop as guarded_loop_ready', () => {
  const serverManifest = readManifest();
  const tool = serverManifest.tools.find((item) => item.name === 'run_guarded_patrol_loop');
  assert.ok(tool);
  assert.equal(tool.status, 'guarded_loop_ready');
});
