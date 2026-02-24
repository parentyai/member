'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'docs', 'PHASE_PATH_MAP.json');

function buildStubText(fileName, archivePath) {
  const title = fileName.replace(/\.md$/, '');
  return [
    `# ${title}`,
    '',
    '> Deprecation Notice (Wave 1 compatibility stub)',
    `> Moved to \`${archivePath}\`.`,
    '> This legacy path will be removed in Wave 2 after explicit approval.',
    ''
  ].join('\n');
}

function run() {
  if (!fs.existsSync(MAP_PATH)) {
    console.error(`missing map file: ${MAP_PATH}`);
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  let count = 0;
  for (const entry of entries) {
    if (!entry || !entry.legacyPath || !entry.archivePath || !entry.fileName) continue;
    const targetPath = path.join(ROOT, entry.legacyPath);
    fs.writeFileSync(targetPath, buildStubText(entry.fileName, entry.archivePath));
    count += 1;
  }
  console.log(`generated compatibility stubs: ${count}`);
}

run();
