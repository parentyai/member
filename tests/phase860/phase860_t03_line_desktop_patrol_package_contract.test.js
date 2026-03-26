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

test('phase860: package exposes proposal queue script and phase test script', () => {
  assert.ok(packageJson.scripts['line-desktop-patrol:enqueue-proposals']);
  assert.ok(packageJson.scripts['test:phase860']);
});

test('phase860: manifest marks enqueue_proposal as proposal_queue_ready', () => {
  const serverManifest = readManifest();
  const tool = serverManifest.tools.find((item) => item.name === 'enqueue_proposal');
  assert.ok(tool);
  assert.equal(tool.status, 'proposal_queue_ready');
});
