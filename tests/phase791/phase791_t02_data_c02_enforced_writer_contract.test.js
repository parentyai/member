'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');
}

test('phase791: DATA-C-02 enforced writers call assertRecordEnvelopeCompliance', () => {
  const targets = [
    ['src/repos/firestore/llmActionLogsRepo.js', 'llm_action_logs'],
    ['src/repos/firestore/llmQualityLogsRepo.js', 'llm_quality_logs'],
    ['src/repos/firestore/faqAnswerLogsRepo.js', 'faq_answer_logs'],
    ['src/repos/firestore/sourceRefsRepo.js', 'source_refs'],
    ['src/v1/memory_fabric/taskMemoryRepo.js', 'memory_task'],
    ['src/v1/memory_fabric/sessionMemoryRepo.js', 'memory_session'],
    ['src/v1/memory_fabric/profileMemoryRepo.js', 'memory_profile'],
    ['src/v1/memory_fabric/complianceMemoryRepo.js', 'memory_compliance'],
    ['src/v1/evidence_ledger/deliveryRecordsRepo.js', 'delivery_records'],
    ['src/repos/firestore/liffSyntheticEventsRepo.js', 'liff_synthetic_events']
  ];

  targets.forEach(([filePath, dataClass]) => {
    const source = read(filePath);
    assert.match(source, /assertRecordEnvelopeCompliance/, `${filePath} must import compliance assertion`);
    assert.match(
      source,
      new RegExp(`dataClass:\\s*'${dataClass}'`),
      `${filePath} must assert DATA-C-02 dataClass=${dataClass}`
    );
  });
});

