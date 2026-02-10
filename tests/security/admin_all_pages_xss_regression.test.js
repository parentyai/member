'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

test('security: admin pages avoid unsafe HTML injection primitives', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const adminDir = path.join(repoRoot, 'apps', 'admin');

  const targets = [
    'monitor.html',
    'errors.html',
    'master.html',
    'read_model.html'
  ].map((name) => path.join(adminDir, name));

  for (const file of targets) {
    const html = readUtf8(file);
    assert.ok(!html.includes('innerHTML'), `${path.relative(repoRoot, file)} must not use innerHTML`);
    assert.ok(!html.includes('insertAdjacentHTML'), `${path.relative(repoRoot, file)} must not use insertAdjacentHTML`);
    assert.ok(!html.includes('document.write('), `${path.relative(repoRoot, file)} must not use document.write`);
  }
});

