'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase363: load risk hotspots exclude listAll function declarations', () => {
  const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/REPO_AUDIT_INPUTS/load_risk.json'), 'utf8'));
  const hasRepoDefinitionHotspot = (report.hotspots || []).some((row) => {
    const hotspot = row && row.hotspot ? row.hotspot : {};
    return hotspot.file === 'src/repos/firestore/analyticsReadRepo.js'
      && typeof hotspot.call === 'string'
      && hotspot.call.startsWith('listAll');
  });
  assert.strictEqual(hasRepoDefinitionHotspot, false);

  const script = fs.readFileSync(path.join(process.cwd(), 'scripts/generate_load_risk.js'), 'utf8');
  assert.ok(script.includes('isFunctionDeclarationLine'));
  assert.ok(script.includes('runtime callsites only'));
});
