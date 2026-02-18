'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase264: vendor table supports arrow key navigation + enter select (contract)', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'assets', 'admin_app.js');
  const src = fs.readFileSync(filePath, 'utf8');

  assert.ok(src.includes('function setupVendorTableKeyboardNavigation('));
  assert.ok(src.includes("key !== 'ArrowDown'"));
  assert.ok(src.includes("key !== 'ArrowUp'"));
  assert.ok(src.includes("key !== 'Enter'"));
  assert.ok(src.includes("tbody.addEventListener('keydown'"));
  assert.ok(src.includes("tr[data-vendor-index]"));
  assert.ok(src.includes('state.selectedVendorRowIndex'));
  assert.ok(src.includes('state.selectedVendorLinkId'));
});

