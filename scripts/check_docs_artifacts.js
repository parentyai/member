'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function run() {
  const result = spawnSync(process.execPath, [path.join('scripts', 'generate_docs_artifacts.js'), '--check'], {
    cwd: ROOT,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run();

