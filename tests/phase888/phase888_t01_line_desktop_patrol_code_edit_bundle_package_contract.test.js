'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const packageJson = require('../../package.json');
const ROOT = path.resolve(__dirname, '..', '..');
const PYTHONPATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'src');

test('phase888: package and manifest expose code edit bundle synthesis without auto-apply authority', () => {
  const manifest = JSON.parse(execFileSync('python3', ['-c', 'import json; from member_line_patrol.mcp_server import build_server_manifest; print(json.dumps(build_server_manifest()))'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH }),
    encoding: 'utf8',
  }));

  assert.ok(packageJson.scripts['line-desktop-patrol:synthesize-code-edit-bundle']);
  assert.ok(packageJson.scripts['test:phase887']);
  assert.ok(packageJson.scripts['test:phase888']);
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', 'line_desktop_patrol', 'src', 'member_line_patrol', 'synthesize_code_edit_bundle.py')));

  const tool = manifest.tools.find((item) => item.name === 'synthesize_code_edit_bundle');
  assert.ok(tool);
  assert.equal(tool.status, 'code_edit_bundle_ready');
  assert.equal(tool.exposure, 'internal_only');
  assert.equal(tool.mutating, true);
});
