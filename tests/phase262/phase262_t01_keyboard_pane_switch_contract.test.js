'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase262: admin_app defines Alt+0..9 pane shortcuts (contract)', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'assets', 'admin_app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.ok(src.includes('const PANE_SHORTCUTS = Object.freeze('));
  assert.ok(src.includes("'0': 'home'"));
  assert.ok(src.includes("'1': 'composer'"));
  assert.ok(src.includes("'2': 'monitor'"));
  assert.ok(src.includes("'3': 'errors'"));
  assert.ok(src.includes("'4': 'read-model'"));
  assert.ok(src.includes("'5': 'vendors'"));
  assert.ok(src.includes("'6': 'city-pack'"));
  assert.ok(src.includes("'7': 'audit'"));
  assert.ok(src.includes("'8': 'settings'"));
  assert.ok(src.includes("'9': 'maintenance'"));

  assert.ok(src.includes("addEventListener('keydown'"));
  assert.ok(src.includes('setupPaneKeyboardShortcuts'));
});

