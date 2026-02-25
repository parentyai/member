'use strict';

const assert = require('assert');
const { createDbStub } = require('../phase0/firestoreStub');
const fs = require('fs');
const { clearDbForTest, setDbForTest } = require('../../src/infra/firestore');
const path = require('path');
const { test } = require('node:test');
const { handleMonitorInsights } = require('../../src/routes/admin/monitorInsights');

function createRes() {
  return {
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(payload) {
      this.body = payload || '';
    }
  };
}

test('phase360: monitor insights route accepts fallbackMode and blocks listAll fallback', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/monitorInsights.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('const fallbackModeRaw = url.searchParams.get(\'fallbackMode\');'));
  assert.ok(src.includes('const fallbackMode = resolveFallbackMode(fallbackModeRaw);'));
  assert.ok(src.includes('const fallbackBlocked = fallbackMode === \'block\';'));
  assert.ok(src.includes('if (!all.length) {'));
  assert.ok(
    src.includes('if (!fallbackBlocked) {') ||
      src.includes('if (!fallbackBlocked && fallbackOnEmpty) {')
  );
  assert.ok(src.includes("dataSource = 'not_available';"));
  assert.ok(src.includes("noteDiagnostics = 'NOT AVAILABLE';"));
});

test('phase360: fallbackOnEmpty=false の場合、fallbackMode=block で not_available を返す', async () => {
  setDbForTest(createDbStub());
  try {
    const req = {
      method: 'GET',
      url: '/api/admin/monitor-insights?windowDays=7&fallbackMode=block&fallbackOnEmpty=false&readLimit=10'
    };
    const res = createRes();
    await handleMonitorInsights(req, res);

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body || '{}');
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.dataSource, 'not_available');
    assert.strictEqual(body.fallbackUsed, false);
    assert.strictEqual(body.fallbackBlocked, true);
    assert.strictEqual(body.note, 'NOT AVAILABLE');
  } finally {
    clearDbForTest();
  }
});
