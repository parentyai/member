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

  // Shared formatter remains the stable fallback for dashboard and evidence-style panes.
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

  // Task-first panes may surface human-readable task notes instead of the generic 2-line formatter.
  assert.ok((js.match(/buildDecisionReasons\(/g) || []).length >= 4);
  assert.ok(js.includes('reason1: taskSummary.primaryNote'));
  assert.ok(js.includes('reason2: taskSummary.secondaryNote'));
});
