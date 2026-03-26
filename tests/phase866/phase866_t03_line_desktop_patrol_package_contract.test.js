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

test('phase866: package exposes the phase866 contract test script', () => {
  assert.ok(packageJson.scripts['test:phase866']);
});

test('phase866: manifest marks read_visible_messages as visible_text_ready', () => {
  const serverManifest = readManifest();
  const tool = serverManifest.tools.find((item) => item.name === 'read_visible_messages');
  assert.ok(tool);
  assert.equal(tool.status, 'visible_text_ready');
});

test('phase866: manifest notes mention PR10 visible message read', () => {
  const serverManifest = readManifest();
  assert.ok(serverManifest.notes.some((item) => item.includes('PR10 adds a standalone bounded visible message read command')));
});
