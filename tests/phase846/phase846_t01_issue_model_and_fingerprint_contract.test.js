'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildIssueFingerprint } = require('../../src/domain/qualityPatrol/fingerprint');
const { normalizeSeverity } = require('../../src/domain/qualityPatrol/normalizeSeverity');
const { normalizeStatus } = require('../../src/domain/qualityPatrol/normalizeStatus');
const { buildIssueRecord } = require('../../src/domain/qualityPatrol/buildIssueRecord');

test('phase846: fingerprint is stable across trace and timestamp noise', () => {
  const left = buildIssueFingerprint({
    layer: 'conversation',
    category: 'followup_reset',
    slice: 'followup',
    rootCauseHint: ['followup_context_gap'],
    traceRefs: ['trace_a'],
    detectedAt: '2026-03-14T10:00:00.000Z',
    supportingEvidence: [
      { signal: 'history_missing', summary: 'history lookup missed' },
      { signal: 'generic_reset', summary: 'generic reset response observed' }
    ]
  });
  const right = buildIssueFingerprint({
    layer: 'conversation',
    category: 'followup_reset',
    slice: 'followup',
    rootCauseHint: ['followup_context_gap'],
    traceRefs: ['trace_b'],
    detectedAt: '2026-03-14T11:00:00.000Z',
    supportingEvidence: [
      { signal: 'generic_reset', summary: 'generic reset response observed' },
      { signal: 'history_missing', summary: 'history lookup missed' }
    ]
  });

  assert.equal(left, right);
});

test('phase846: severity normalization elevates blockers and softens low-confidence observations', () => {
  assert.equal(normalizeSeverity({
    category: 'observation_blocked',
    provenance: 'live',
    observationBlocker: true,
    confidence: 0.91
  }), 'high');

  assert.equal(normalizeSeverity({
    category: 'missing_transcript_availability',
    provenance: 'historical',
    confidence: 0.72
  }), 'medium');

  assert.equal(normalizeSeverity({
    category: 'city_specificity_missing',
    confidence: 0.2,
    sampleCount: 1
  }), 'low');
});

test('phase846: status normalization keeps low-confidence issues in watching and does not auto-close', () => {
  assert.equal(normalizeStatus({
    severity: 'medium',
    confidence: 0.2,
    sampleCount: 1
  }), 'watching');

  assert.equal(normalizeStatus({
    severity: 'high',
    confidence: 0.83,
    sampleCount: 4
  }), 'open');

  assert.equal(normalizeStatus({
    status: 'mitigated',
    severity: 'high',
    confidence: 0.9
  }), 'mitigated');
});

test('phase846: buildIssueRecord normalizes blocker and provenance fields into canonical shape', () => {
  const record = buildIssueRecord({
    threadId: 'T001',
    layer: 'conversation',
    category: 'answer_too_template_like',
    slice: 'broad',
    provenance: 'historical',
    observationBlocker: false,
    confidence: 0.88,
    latestSummary: 'broad answer repeated the same skeleton',
    rootCauseHint: ['finalizer_template_collapse'],
    sourceCollections: ['llm_action_logs', 'llm_action_logs', 'faq_answer_logs']
  });

  assert.equal(record.threadId, 'T001');
  assert.equal(record.status, 'open');
  assert.equal(record.severity, 'high');
  assert.deepEqual(record.rootCauseHint, ['finalizer_template_collapse']);
  assert.deepEqual(record.sourceCollections, ['llm_action_logs', 'faq_answer_logs']);
  assert.ok(record.issueId.startsWith('qi_'));
});
