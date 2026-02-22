'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('phase353: phase4/phase5 routes expose fallback diagnostics fields', () => {
  const opsOverview = read('src/routes/admin/opsOverview.js');
  const phase5Ops = read('src/routes/phase5Ops.js');
  const phase5State = read('src/routes/phase5State.js');

  [opsOverview, phase5Ops, phase5State].forEach((src) => {
    assert.ok(src.includes('fallbackUsed'));
    assert.ok(src.includes('fallbackBlocked'));
    assert.ok(src.includes('fallbackSources'));
  });
});
