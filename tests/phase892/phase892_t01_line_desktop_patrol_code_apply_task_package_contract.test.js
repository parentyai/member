'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase892: package and manifest expose code apply task synthesis without auto-apply authority', () => {
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

  assert.equal(packageJson.scripts['line-desktop-patrol:synthesize-code-apply-task'].includes('synthesize_code_apply_task'), true);
  assert.ok(packageJson.scripts['test:phase891']);
  assert.ok(packageJson.scripts['test:phase892']);
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', 'line_desktop_patrol', 'src', 'member_line_patrol', 'synthesize_code_apply_task.py')));

  const tool = manifest.tools.find((item) => item.name === 'synthesize_code_apply_task');
  assert.ok(tool, 'manifest should expose synthesize_code_apply_task');
  assert.equal(tool.status, 'code_apply_task_ready');
  assert.equal(tool.exposure, 'internal_only');
  assert.equal(tool.mutating, true);
});
