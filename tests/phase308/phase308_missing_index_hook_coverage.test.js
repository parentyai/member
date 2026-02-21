'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function listFirestoreRepoFiles() {
  const rootDir = path.join(process.cwd(), 'src', 'repos', 'firestore');
  return fs.readdirSync(rootDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(rootDir, name));
}

test('phase308: every repo fallback branch has indexFallbackPolicy hooks', () => {
  const files = listFirestoreRepoFiles();
  for (const file of files) {
    const basename = path.basename(file);
    if (basename === 'queryFallback.js' || basename === 'indexFallbackPolicy.js') continue;
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('isMissingIndexError(')) continue;
    assert.ok(
      source.includes('recordMissingIndexFallback'),
      `${basename}: missing recordMissingIndexFallback hook`
    );
    assert.ok(
      source.includes('shouldFailOnMissingIndex'),
      `${basename}: missing shouldFailOnMissingIndex gate`
    );
  }
});
