'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = process.cwd();
const MAP_PATH = path.join(ROOT, 'docs', 'PHASE_PATH_MAP.json');
const ARCHIVE_DIR = path.join(ROOT, 'docs', 'archive', 'phases');

test('phase649: phase_path_map covers all archived phase docs and legacy stubs are removed in wave2', () => {
  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const entries = map.entries || [];
  assert.ok(entries.length > 0);

  const archiveFiles = fs
    .readdirSync(ARCHIVE_DIR)
    .filter((name) => /^PHASE[A-Z0-9_-]*\.md$/.test(name))
    .sort();
  const mappedFiles = entries.map((entry) => entry.fileName).sort();

  assert.deepStrictEqual(mappedFiles, archiveFiles);

  for (const entry of entries) {
    const archiveAbs = path.join(ROOT, entry.archivePath);
    const legacyAbs = path.join(ROOT, entry.legacyPath);
    assert.ok(fs.existsSync(archiveAbs), `missing archive phase doc: ${entry.archivePath}`);
    assert.ok(!fs.existsSync(legacyAbs), `legacy stub should be removed in wave2: ${entry.legacyPath}`);
  }
});
