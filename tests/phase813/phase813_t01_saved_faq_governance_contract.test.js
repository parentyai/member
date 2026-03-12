'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { refineSavedFaqReuseSignals } = require('../../src/usecases/faq/refineSavedFaqReuseSignals');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase813: high-risk saved FAQ reuse fails without official source refs', () => {
  const result = refineSavedFaqReuseSignals({
    intentRiskTier: 'high',
    savedFaqSignals: {
      savedFaqReused: true,
      savedFaqReusePass: true,
      savedFaqReuseReasonCodes: ['saved_faq_reuse_ready'],
      sourceSnapshotRefs: ['snapshot-1']
    },
    sourceReadiness: {
      officialOnlySatisfied: false,
      sourceReadinessDecision: 'allow'
    }
  });

  assert.equal(result.savedFaqReused, true);
  assert.equal(result.savedFaqReusePass, false);
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_missing_official_source_refs'));
  assert.deepEqual(result.sourceSnapshotRefs, ['snapshot-1']);
});

test('phase813: source readiness refusal blocks saved FAQ reuse even outside explicit stale code', () => {
  const result = refineSavedFaqReuseSignals({
    intentRiskTier: 'medium',
    savedFaqSignals: {
      savedFaqReused: true,
      savedFaqReusePass: true,
      savedFaqReuseReasonCodes: ['saved_faq_reuse_ready'],
      sourceSnapshotRefs: ['snapshot-2']
    },
    sourceReadiness: {
      officialOnlySatisfied: true,
      sourceReadinessDecision: 'refuse'
    }
  });

  assert.equal(result.savedFaqReusePass, false);
  assert.ok(result.savedFaqReuseReasonCodes.includes('saved_faq_source_readiness_blocked'));
});

test('phase813: FAQ path refines saved FAQ signals before readiness telemetry is written', () => {
  const faqUsecase = read('src/usecases/faq/answerFaqFromKb.js');

  assert.ok(faqUsecase.includes("const { refineSavedFaqReuseSignals } = require('./refineSavedFaqReuseSignals');"));
  assert.ok(faqUsecase.includes('const rawSavedFaqSignals = buildSavedFaqReuseSignals'));
  assert.ok(faqUsecase.includes('const savedFaqSignals = refineSavedFaqReuseSignals({'));
  assert.ok(faqUsecase.includes('savedFaqReusePass: savedFaqSignals.savedFaqReusePass === true'));
});
