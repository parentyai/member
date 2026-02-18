'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase263: decision reasons are built via shared 2-line formatter (contract)', () => {
  const jsPath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'assets', 'admin_app.js');
  const js = fs.readFileSync(jsPath, 'utf8');

  assert.ok(js.includes('function buildDecisionReasons('));
  assert.ok(js.includes("reason1: `${pendingLabel}: ${pending}`"));
  assert.ok(js.includes("reason2: `${primaryLabel}: ${primary}`"));

  // All panes must route through the formatter to keep the 2-line contract stable.
  assert.ok(js.includes('resolveHomeDecisionVm()'));
  assert.ok(js.includes('resolveComposerDecisionVm()'));
  assert.ok(js.includes('resolveMonitorDecisionVm()'));
  assert.ok(js.includes('resolveErrorsDecisionVm()'));
  assert.ok(js.includes('resolveReadModelDecisionVm()'));
  assert.ok(js.includes('resolveCityPackDecisionVm()'));
  assert.ok(js.includes('resolveVendorsDecisionVm()'));

  const usages = [
    'resolveHomeDecisionVm',
    'resolveComposerDecisionVm',
    'resolveMonitorDecisionVm',
    'resolveErrorsDecisionVm',
    'resolveReadModelDecisionVm',
    'resolveCityPackDecisionVm',
    'resolveVendorsDecisionVm'
  ].map((name) => ({ name, count: js.split(`${name}()`).length - 1 }));

  usages.forEach(({ name, count }) => {
    assert.ok(count >= 1, `missing function: ${name}`);
  });

  // The formatter should be referenced multiple times (>= 6) across resolve* functions.
  assert.ok((js.match(/buildDecisionReasons\(/g) || []).length >= 6);
});

