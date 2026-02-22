'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase348: phase5 ops/state routes parse fallbackMode and forward it', () => {
  const opsFile = path.join(process.cwd(), 'src/routes/phase5Ops.js');
  const stateFile = path.join(process.cwd(), 'src/routes/phase5State.js');
  const opsSrc = fs.readFileSync(opsFile, 'utf8');
  const stateSrc = fs.readFileSync(stateFile, 'utf8');

  assert.ok(opsSrc.includes("const fallbackModeRaw = url.searchParams.get('fallbackMode');"));
  assert.ok(opsSrc.includes('const fallbackMode = parseFallbackMode(fallbackModeRaw);'));
  assert.ok(opsSrc.includes("throw new Error('invalid fallbackMode')"));
  assert.ok(opsSrc.includes('fallbackMode,'));

  assert.ok(stateSrc.includes("const fallbackModeRaw = url.searchParams.get('fallbackMode');"));
  assert.ok(stateSrc.includes('const fallbackMode = parseFallbackMode(fallbackModeRaw);'));
  assert.ok(stateSrc.includes("throw new Error('invalid fallbackMode')"));
  assert.ok(stateSrc.includes('fallbackMode,'));
});
