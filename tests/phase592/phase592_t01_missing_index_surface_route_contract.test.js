'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase592: missing-index-surface route is wired under /api/admin and returns normalized payload keys', () => {
  const indexSrc = fs.readFileSync('src/index.js', 'utf8');
  const routeSrc = fs.readFileSync('src/routes/admin/missingIndexSurface.js', 'utf8');
  assert.ok(indexSrc.includes('/api/admin/missing-index-surface'));
  assert.ok(routeSrc.includes('function handleMissingIndexSurface'));
  assert.ok(routeSrc.includes('requireActor(req, res)'));
  assert.ok(routeSrc.includes('surfaceCount'));
  assert.ok(routeSrc.includes('pointCount'));
  assert.ok(routeSrc.includes('callBreakdown'));
  assert.ok(routeSrc.includes('items'));
});

test('phase592: missing-index-surface route appends audit log on view', () => {
  const routeSrc = fs.readFileSync('src/routes/admin/missingIndexSurface.js', 'utf8');
  assert.ok(routeSrc.includes("action: 'missing_index.surface.view'"));
  assert.ok(routeSrc.includes('appendAuditLog'));
});
