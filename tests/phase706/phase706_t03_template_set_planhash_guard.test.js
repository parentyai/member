'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { applyTaskRulesTemplateSet } = require('../../src/usecases/tasks/applyTaskRulesTemplateSet');

test('phase706: applyTaskRulesTemplateSet rejects mismatched planHash with 409', async () => {
  const template = {
    templateId: 'journey_us_v1',
    version: 1,
    country: 'US',
    enabled: true,
    phases: [
      {
        phaseKey: 'onboarding',
        steps: [
          {
            stepKey: 'visa_precheck',
            trigger: { eventKey: 'assignment_created', source: 'admin' },
            leadTime: { kind: 'after', days: 1 },
            dependsOn: [],
            constraints: { maxActions: 3, planLimit: 10 },
            priority: 100,
            riskLevel: 'medium'
          }
        ]
      }
    ]
  };

  await assert.rejects(
    () => applyTaskRulesTemplateSet({
      templateId: 'journey_us_v1',
      template,
      planHash: 'taskrules_tpl_invalid'
    }),
    (err) => {
      assert.equal(err && err.code, 'plan_hash_mismatch');
      assert.equal(err && err.statusCode, 409);
      assert.ok(err && err.details && typeof err.details.expectedPlanHash === 'string');
      return true;
    }
  );
});
