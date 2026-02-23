'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase633: audit workflow uses aggregate required gate job named audit', () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'audit.yml');
  const src = fs.readFileSync(workflowPath, 'utf8');
  assert.ok(src.includes('audit-run:'));
  assert.ok(src.includes('needs:'));
  assert.ok(src.includes('- docs'));
  assert.ok(src.includes('- firestore-indexes'));
  assert.ok(src.includes('- audit-run'));
  assert.ok(src.includes('if: always()'));
  assert.ok(src.includes('DOCS_RESULT="${{ needs.docs.result }}"'));
  assert.ok(src.includes('INDEX_RESULT="${{ needs.firestore-indexes.result }}"'));
  assert.ok(src.includes('AUDIT_RUN_RESULT="${{ needs.audit-run.result }}"'));
});
