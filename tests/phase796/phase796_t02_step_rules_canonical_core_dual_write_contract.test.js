'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const stepRulesRepo = require('../../src/repos/firestore/stepRulesRepo');

const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

test('phase796: stepRulesRepo dual-writes canonical core outbox for task_template and rule_set sidecars', async (t) => {
  const prevDualWrite = process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
  process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = 'true';
  t.after(() => {
    if (prevDualWrite === undefined) delete process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
    else process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = prevDualWrite;
  });

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const ruleId = 'journey_us_v1__onboarding__ssn_apply';
  await stepRulesRepo.upsertStepRule(ruleId, {
    [FIELD_SCK]: 'US_ASSIGNMENT',
    stepKey: 'ssn_apply',
    category: 'BANKING',
    trigger: { eventKey: 'assignment_created', source: 'admin' },
    leadTime: { kind: 'after', days: 5 },
    dependsOn: ['journey_us_v1__onboarding__visa_precheck'],
    priority: 120,
    enabled: true,
    riskLevel: 'high',
    meaning: {
      meaningKey: 'ssn_apply',
      title: 'SSN申請',
      summary: 'SSA 窓口で SSN 申請を行う',
      whyNow: '入社手続きと金融導線の前提になる'
    },
    recommendedVendorLinkIds: ['vendor_shadow_ssa']
  }, 'admin_app');

  const outbox = db._state.collections.canonical_core_outbox;
  assert.ok(outbox, 'canonical_core_outbox collection must exist');
  const rows = Object.values(outbox.docs).map((doc) => doc.data).filter((row) => row.objectId === ruleId);
  assert.equal(rows.length, 1, 'step rule dual-write should emit a single normalized outbox event');
  const latest = rows[0];
  assert.equal(latest.objectType, 'task_template');
  assert.deepEqual(latest.materializationHints.targetTables, ['task_template', 'rule_set']);
  assert.equal(latest.payloadSummary.lifecycleBucket, 'task_engine_template');
  assert.equal(latest.canonicalPayload.taskTemplate.taskCode, ruleId);
  assert.equal(latest.canonicalPayload.taskTemplate.countryCode, 'US');
  assert.equal(latest.canonicalPayload.ruleSet.ruleCode, ruleId);
  assert.equal(latest.canonicalPayload.ruleSet.outputPayload.taskTemplateCanonicalKey, `task_template:${ruleId}`);
});
