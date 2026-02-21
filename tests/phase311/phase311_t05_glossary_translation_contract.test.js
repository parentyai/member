'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase311: repo map keeps japanese glossary for internal terms and manual labels', () => {
  const repoMap = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/repo_map_ui.json', 'utf8'));
  assert.ok(repoMap.glossaryJa && typeof repoMap.glossaryJa === 'object');
  assert.ok(repoMap.glossaryJa.link_registry);
  assert.ok(repoMap.glossaryJa.killSwitch);
  assert.ok(repoMap.glossaryJa.validators);
  assert.ok(repoMap.glossaryJa.audit_logs);

  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('developer-open-manual-redac'));
  assert.ok(html.includes('developer-open-manual-user'));
  assert.ok(html.includes('manual-redac-faq-rows'));
  assert.ok(html.includes('manual-user-consultation'));
});
