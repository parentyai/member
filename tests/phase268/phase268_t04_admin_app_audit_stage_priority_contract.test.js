'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

test('phase268: city pack pane includes priority/confidence/stage columns and run mode options', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  assert.match(html, /ui\.label\.cityPack\.col\.priority/);
  assert.match(html, /ui\.label\.cityPack\.col\.confidence/);
  assert.match(html, /ui\.label\.cityPack\.col\.auditStage/);
  assert.match(html, /value="light"/);
  assert.match(html, /value="heavy"/);
  assert.match(html, /ui\.label\.cityPack\.runs\.col\.stage/);
  assert.match(html, /ui\.label\.cityPack\.runs\.col\.confidence/);
});

test('phase268: city pack run action posts stage and mode', () => {
  const js = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');
  assert.match(js, /const stage = document\.getElementById\('city-pack-run-mode'\)\?\.value === 'heavy' \? 'heavy' : 'light';/);
  assert.match(js, /const mode = stage === 'heavy' \? 'canary' : 'scheduled';/);
  assert.match(js, /postJson\('\/api\/admin\/city-pack-source-audit\/run', \{[\s\S]*stage,[\s\S]*runId/);
});
