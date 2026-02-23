'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase634: legacy routes emit deprecation headers with successor links', () => {
  const phase1 = fs.readFileSync('src/routes/admin/phase1Notifications.js', 'utf8');
  const phase105 = fs.readFileSync('src/routes/phase105OpsAssistAdopt.js', 'utf8');
  const phase121 = fs.readFileSync('src/routes/phase121OpsNoticeSend.js', 'utf8');

  [phase1, phase105, phase121].forEach((source) => {
    assert.ok(source.includes("res.setHeader('Deprecation', 'true')"));
    assert.ok(source.includes("res.setHeader('Sunset', LEGACY_SUNSET)"));
    assert.ok(source.includes("res.setHeader('Link', `<${successorPath.trim()}>; rel=\"successor-version\"`)"));
  });
});
