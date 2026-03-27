'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase896: package and manifest expose code apply evidence synthesis without auto-apply authority', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(
    require('node:child_process').execFileSync(
      'python3',
      ['-m', 'member_line_patrol.mcp_server'],
      {
        cwd: ROOT,
        env: { ...process.env, PYTHONPATH: path.join(ROOT, 'tools', 'line_desktop_patrol', 'src') },
        encoding: 'utf8',
      }
    )
  );

  assert.equal(packageJson.scripts['line-desktop-patrol:synthesize-code-apply-evidence'].includes('synthesize_code_apply_evidence'), true);
  assert.ok(packageJson.scripts['test:phase895']);
  assert.ok(packageJson.scripts['test:phase896']);
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', 'line_desktop_patrol', 'src', 'member_line_patrol', 'synthesize_code_apply_evidence.py')));

  const tool = manifest.tools.find((item) => item.name === 'synthesize_code_apply_evidence');
  assert.ok(tool, 'manifest should expose synthesize_code_apply_evidence');
  assert.equal(tool.status, 'code_apply_evidence_ready');
  assert.equal(tool.exposure, 'internal_only');
  assert.equal(tool.mutating, true);
});
