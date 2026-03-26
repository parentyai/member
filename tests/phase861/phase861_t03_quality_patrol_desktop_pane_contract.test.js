'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('phase861: quality patrol pane exposes local desktop patrol summary shell and docs contract', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dictionary = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  const runbook = fs.readFileSync('docs/RUNBOOK_LINE_DESKTOP_PATROL.md', 'utf8');

  assert.ok(html.includes('id="quality-patrol-desktop-status"'));
  assert.ok(html.includes('id="quality-patrol-desktop-stage"'));
  assert.ok(html.includes('id="quality-patrol-desktop-queue-count"'));
  assert.ok(html.includes('id="quality-patrol-desktop-planning-status"'));
  assert.ok(html.includes('id="quality-patrol-desktop-latest"'));
  assert.ok(html.includes('data-dict-key="ui.label.qualityPatrol.desktopPanel"'));
  assert.ok(html.includes('data-dict-key="ui.desc.qualityPatrol.desktopPanel"'));

  assert.ok(js.includes('function summarizeQualityPatrolArtifactRefs(rows)'));
  assert.ok(js.includes('function renderQualityPatrolDesktopSummary(result)'));
  assert.ok(js.includes("renderQualityPatrolPlaceholder('quality-patrol-desktop-latest', 'LINE Desktop Patrol を読み込み中です。', 'loading-state');"));

  assert.ok(dictionary.includes('"ui.label.qualityPatrol.desktopPanel": "LINE Desktop Patrol (local)"'));
  assert.ok(dictionary.includes('"ui.desc.qualityPatrol.desktopPanel": "ローカル sidecar が残した desktop patrol の最新状態を read-only で確認します。"'));
  assert.ok(ssot.includes('## Quality Patrol Local Desktop Summary（PR5 add-only）'));
  assert.ok(runbook.includes('## Optional operator check'));
});
