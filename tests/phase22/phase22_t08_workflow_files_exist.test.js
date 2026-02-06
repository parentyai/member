'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dryrunPath = path.resolve(__dirname, '../../.github/workflows/phase22-scheduled-dryrun.yml');
const writePath = path.resolve(__dirname, '../../.github/workflows/phase22-scheduled-write.yml');

test('phase22 t08: workflow files exist and include runner', () => {
  assert.ok(fs.existsSync(dryrunPath));
  assert.ok(fs.existsSync(writePath));

  const dryrunContent = fs.readFileSync(dryrunPath, 'utf8');
  const writeContent = fs.readFileSync(writePath, 'utf8');

  assert.ok(dryrunContent.includes('node scripts/phase22_scheduled_runner.js'));
  assert.ok(writeContent.includes('node scripts/phase22_scheduled_runner.js'));
  assert.equal(dryrunContent.includes('--write 1'), false);
  assert.ok(writeContent.includes('--write 1'));
});
