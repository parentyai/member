'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  upsertCanonicalCoreObject
} = require('../../src/domain/data/canonicalCorePostgresSink');

test('phase796: typed materializer upserts task_template and rule_set sidecars', async (t) => {
  const prevEnabled = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
  const prevStrict = process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
  const prevTypedEnabled = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
  const prevTypedStrict = process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = 'false';
  process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1 = 'true';
  process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1 = 'false';
  t.after(() => {
    if (prevEnabled === undefined) delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1;
    else process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1 = prevEnabled;
    if (prevStrict === undefined) delete process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1;
    else process.env.ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1 = prevStrict;
    if (prevTypedEnabled === undefined) delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1;
    else process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1 = prevTypedEnabled;
    if (prevTypedStrict === undefined) delete process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1;
    else process.env.ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1 = prevTypedStrict;
  });

  const calls = [];
  const pool = {
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (/INSERT INTO canonical_core_objects/i.test(sql)) {
        return { rows: [{ object_type: values[0], object_id: values[1] }] };
      }
      if (/INSERT INTO task_template/i.test(sql)) {
        return { rows: [{ task_template_id: '33333333-3333-5333-8333-333333333333' }] };
      }
      if (/INSERT INTO rule_set/i.test(sql)) {
        return { rows: [{ rule_id: '44444444-4444-5444-8444-444444444444' }] };
      }
      throw new Error('unexpected sql');
    }
  };

  const result = await upsertCanonicalCoreObject({
    objectType: 'task_template',
    objectId: 'journey_us_v1__onboarding__ssn_apply',
    eventType: 'upsert',
    canonicalPayload: {
      taskTemplate: {
        canonicalKey: 'task_template:journey_us_v1__onboarding__ssn_apply',
        taskCode: 'journey_us_v1__onboarding__ssn_apply',
        title: 'SSN申請',
        domain: 'banking',
        topic: 'ssn_apply',
        countryCode: 'US',
        scopeKey: 'US_ASSIGNMENT',
        triggerExpr: '{"eventKey":"assignment_created"}',
        completionExpr: '{"taskStatus":"done"}',
        reviewerStatus: 'approved',
        activeFlag: true,
        metadata: {}
      },
      ruleSet: {
        canonicalKey: 'rule_set:journey_us_v1__onboarding__ssn_apply',
        ruleCode: 'journey_us_v1__onboarding__ssn_apply',
        ruleScope: 'US_ASSIGNMENT',
        exprLang: 'member_step_rule_v1',
        exprBody: { trigger: { eventKey: 'assignment_created' } },
        outputPayload: { taskTemplateCanonicalKey: 'task_template:journey_us_v1__onboarding__ssn_apply' },
        reviewerStatus: 'approved',
        activeFlag: true,
        metadata: {}
      }
    },
    materializationHints: { targetTables: ['task_template', 'rule_set'] }
  }, { pool });

  assert.equal(result.skipped, false);
  assert.ok(calls.some((row) => /INSERT INTO task_template/i.test(row.sql)));
  assert.ok(calls.some((row) => /INSERT INTO rule_set/i.test(row.sql)));
  assert.deepEqual(
    result.typedMaterialization.tables.map((row) => row.table),
    ['task_template', 'rule_set']
  );
});
