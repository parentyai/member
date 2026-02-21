'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase309: trace repos use index-oriented where+orderBy queries', () => {
  const auditSrc = fs.readFileSync('src/repos/firestore/auditLogsRepo.js', 'utf8');
  const decisionSrc = fs.readFileSync('src/repos/firestore/decisionLogsRepo.js', 'utf8');
  const timelineSrc = fs.readFileSync('src/repos/firestore/decisionTimelineRepo.js', 'utf8');

  assert.ok(auditSrc.includes("where('traceId', '==', traceId)") && auditSrc.includes("orderBy('createdAt', 'desc')"));
  assert.ok(decisionSrc.includes("where('traceId', '==', traceId)") && decisionSrc.includes("orderBy('decidedAt', 'desc')"));
  assert.ok(timelineSrc.includes("where('traceId', '==', traceId)") && timelineSrc.includes("orderBy('createdAt', 'desc')"));
});
