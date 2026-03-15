'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function extractPaneSection(html, paneId) {
  const marker = `<section id="pane-${paneId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const next = html.indexOf('<section id="pane-', start + marker.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

test('phase674: target panes expose unified reflection state and one-click recovery actions', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const panes = ['home', 'monitor', 'city-pack', 'read-model', 'vendors'];

  panes.forEach((paneId) => {
    const pane = extractPaneSection(html, paneId);
    assert.ok(pane, `pane-${paneId} must exist`);
    assert.ok(pane.includes(`id="${paneId}-reflection-state"`), `${paneId} reflection container missing`);
    assert.ok(pane.includes(`id="${paneId}-reflection-state-label"`), `${paneId} reflection state label missing`);
    assert.ok(pane.includes(`id="${paneId}-reflection-reason"`), `${paneId} reflection reason missing`);
    assert.ok(pane.includes(`id="${paneId}-reflection-success-at"`), `${paneId} reflection success timestamp missing`);
    assert.ok(pane.includes(`id="${paneId}-reflection-reload"`), `${paneId} reflection reload action missing`);
    assert.ok(pane.includes(`id="${paneId}-reflection-open-system"`), `${paneId} reflection system handoff missing`);
    assert.ok(pane.includes(`id="${paneId}-reflection-open-audit"`), `${paneId} reflection audit handoff missing`);
  });
});

test('phase674: data reflection contract keeps reason classification and pane-level control wiring', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('const DATA_REFLECTION_PANES = Object.freeze(['));
  assert.ok(js.includes('function resolvePaneReflectionVm(paneKey) {'));
  assert.ok(js.includes('function setupPaneReflectionControls() {'));
  assert.ok(js.includes("void reloadPaneReflectionData(paneKey, { notify: true });"));
  assert.ok(js.includes("activatePane('ops-system-health', { historyMode: 'push', syncHistory: true });"));
  assert.ok(js.includes('void openPaneReflectionAudit(paneKey);'));

  assert.ok(js.includes("markPaneReflectionSuccess('home'"));
  assert.ok(js.includes("markPaneReflectionSuccess('monitor'"));
  assert.ok(js.includes("markPaneReflectionSuccess('city-pack'"));
  assert.ok(js.includes("markPaneReflectionSuccess('read-model'"));
  assert.ok(js.includes("markPaneReflectionSuccess('vendors'"));

  assert.ok(js.includes("markPaneReflectionFailure('home'"));
  assert.ok(js.includes("markPaneReflectionFailure('monitor'"));
  assert.ok(js.includes("markPaneReflectionFailure('city-pack'"));
  assert.ok(js.includes("markPaneReflectionFailure('read-model'"));
  assert.ok(js.includes("markPaneReflectionFailure('vendors'"));
});
