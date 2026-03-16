'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  materializeExceptionPlaybookRecordFromEvent
} = require('../../src/domain/data/canonicalCoreExceptionPlaybookMapping');

test('phase800: exception_playbook materializer derives row from notification template event', () => {
  const result = materializeExceptionPlaybookRecordFromEvent({
    objectType: 'exception_playbook',
    materializationHints: { targetTables: ['exception_playbook'] },
    canonicalPayload: {
      exceptionPlaybook: {
        canonicalKey: 'exception_playbook:ops_escalate',
        exceptionCode: 'ops_escalate',
        title: 'Escalate to Ops',
        domain: 'ops',
        topic: 'delivery_failure',
        countryCode: 'US',
        scopeKey: 'GLOBAL',
        severity: 'high',
        symptomPatterns: ['push persisted failed'],
        fallbackSteps: ['seal delivery'],
        escalationContacts: { queue: 'ops-primary' },
        authorityFloor: 'T3',
        reviewerStatus: 'approved',
        activeFlag: true,
        staleFlag: false,
        metadata: {
          templateId: 'tpl_1',
          templateKey: 'ops_escalate'
        }
      }
    }
  });

  assert.equal(result.skipped, false);
  assert.equal(result.row.exceptionCode, 'ops_escalate');
  assert.equal(result.row.countryCode, 'US');
  assert.deepEqual(result.row.fallbackSteps, ['seal delivery']);
});

test('phase800: exception_playbook materializer reports explicit skip reason when required metadata is missing', () => {
  const result = materializeExceptionPlaybookRecordFromEvent({
    objectType: 'exception_playbook',
    materializationHints: { targetTables: ['exception_playbook'] },
    canonicalPayload: {
      exceptionPlaybook: {
        canonicalKey: 'exception_playbook:ops_escalate',
        exceptionCode: 'ops_escalate',
        title: 'Escalate to Ops',
        domain: 'ops',
        topic: 'delivery_failure',
        countryCode: 'US',
        symptomPatterns: [],
        fallbackSteps: ['seal delivery']
      }
    }
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'symptom_patterns_missing');
});
