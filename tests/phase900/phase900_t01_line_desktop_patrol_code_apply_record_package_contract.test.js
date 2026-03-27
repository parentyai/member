'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('phase900: package and manifest expose code apply record synthesis without auto-apply authority', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(packageJson.scripts['line-desktop-patrol:synthesize-code-apply-record']);

  const rawManifest = execFileSync('python3', ['-m', 'member_line_patrol.mcp_server'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PYTHONPATH: path.join(repoRoot, 'tools', 'line_desktop_patrol', 'src'),
    },
    encoding: 'utf8',
  });
  const manifest = JSON.parse(rawManifest);
  const tool = manifest.tools.find((entry) => entry.name === 'synthesize_code_apply_record');
  assert.ok(tool);
  assert.equal(tool.status, 'code_apply_record_ready');
  assert.equal(tool.exposure, 'internal_only');
  assert.equal(tool.mutating, true);
});
