'use strict';

const fs = require('fs');
const path = require('path');
const {
  ARCHIVE_PHASE_DIR,
  LEGACY_DOCS_DIR,
  isPhaseDocFileName
} = require('../src/shared/phaseDocPathResolver');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, LEGACY_DOCS_DIR);
const ARCHIVE_DIR = path.join(ROOT, ARCHIVE_PHASE_DIR);
const MAP_PATH = path.join(ROOT, 'docs', 'PHASE_PATH_MAP.json');

function listPhaseFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((name) => isPhaseDocFileName(name))
    .sort();
}

function buildMapPayload() {
  const phaseNames = new Set();
  for (const name of listPhaseFiles(DOCS_DIR)) phaseNames.add(name);
  for (const name of listPhaseFiles(ARCHIVE_DIR)) phaseNames.add(name);

  const entries = Array.from(phaseNames)
    .sort()
    .map((fileName) => ({
      fileName,
      legacyPath: path.posix.join(LEGACY_DOCS_DIR, fileName),
      archivePath: path.posix.join(ARCHIVE_PHASE_DIR, fileName)
    }));

  return {
    version: 1,
    generatedBy: 'scripts/generate_phase_path_map.js',
    entries
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function run() {
  const checkMode = process.argv.includes('--check');
  const payload = buildMapPayload();
  const next = stableJson(payload);

  if (checkMode) {
    if (!fs.existsSync(MAP_PATH)) {
      console.error(`phase path map missing: ${MAP_PATH}`);
      process.exit(1);
    }
    const current = fs.readFileSync(MAP_PATH, 'utf8');
    if (current !== next) {
      console.error('PHASE_PATH_MAP.json is stale. run: npm run phase-path-map:generate');
      process.exit(1);
    }
    console.log('PHASE_PATH_MAP.json is up to date');
    return;
  }

  fs.writeFileSync(MAP_PATH, next);
  console.log(`generated: ${path.relative(ROOT, MAP_PATH)}`);
}

run();
