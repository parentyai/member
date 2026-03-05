'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const appHtmlPath = path.resolve(__dirname, '../../apps/admin/app.html');
const adminJsPath = path.resolve(__dirname, '../../apps/admin/assets/admin_app.js');

test('phase740: admin html contains nextgen task/link/citypack inputs', () => {
  const html = fs.readFileSync(appHtmlPath, 'utf8');
  [
    'task-rules-task-content-summary-short',
    'task-rules-task-content-top-mistakes',
    'task-rules-task-content-context-tips',
    'task-rules-link-registry-intent-tag',
    'task-rules-link-registry-audience-tag',
    'task-rules-link-registry-region-scope',
    'task-rules-link-registry-risk-level',
    'city-pack-manage-modules'
  ].forEach((id) => {
    assert.match(html, new RegExp(`id=\"${id}\"`));
  });
});

test('phase740: admin app wires nextgen payload fields', () => {
  const js = fs.readFileSync(adminJsPath, 'utf8');
  [
    'task-rules-task-content-summary-short',
    'task-rules-task-content-top-mistakes',
    'task-rules-task-content-context-tips',
    'task-rules-link-registry-intent-tag',
    'task-rules-link-registry-audience-tag',
    'task-rules-link-registry-region-scope',
    'task-rules-link-registry-risk-level',
    'city-pack-manage-modules'
  ].forEach((token) => {
    assert.match(js, new RegExp(token.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')));
  });
});
