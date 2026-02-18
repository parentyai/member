'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase263: decision card state classes exist in CSS and JS (contract)', () => {
  const cssPath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'assets', 'admin.css');
  const jsPath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'assets', 'admin_app.js');

  const css = fs.readFileSync(cssPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.ok(css.includes('.decision-card.is-ready'));
  assert.ok(css.includes('.decision-card.is-attention'));
  assert.ok(css.includes('.decision-card.is-stop'));

  assert.ok(js.includes('function decisionCardClass('));
  assert.ok(js.includes("cardEl.classList.remove('is-ready', 'is-attention', 'is-stop')"));
  assert.ok(js.includes('cardEl.classList.add(decisionCardClass(vm.state))'));
});

