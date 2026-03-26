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

test('phase871: package exposes doctor, execute loop, retention, and promote scripts', () => {
  assert.ok(packageJson.scripts['line-desktop-patrol:doctor']);
  assert.ok(packageJson.scripts['line-desktop-patrol:loop-execute']);
  assert.ok(packageJson.scripts['line-desktop-patrol:retention']);
  assert.ok(packageJson.scripts['line-desktop-patrol:promote-proposal']);
});

test('phase871: manifest marks promote_proposal_to_draft_pr as draft_pr_ready', () => {
  const manifest = readManifest();
  const tool = manifest.tools.find((item) => item.name === 'promote_proposal_to_draft_pr');
  assert.ok(tool);
  assert.equal(tool.status, 'draft_pr_ready');
});
