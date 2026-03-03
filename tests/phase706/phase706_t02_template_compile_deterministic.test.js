'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { planTaskRulesTemplateSet } = require('../../src/usecases/tasks/planTaskRulesTemplateSet');

test('phase706: template compile generates deterministic rule set and stable planHash', () => {
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
            title: 'ビザ要件の再確認',
            trigger: { eventKey: 'assignment_created', source: 'admin' },
            leadTime: { kind: 'after', days: 1 },
            dependsOn: [],
            constraints: { maxActions: 3, planLimit: 10 },
            priority: 100,
            riskLevel: 'high'
          }
        ]
      },
      {
        phaseKey: 'in_assignment',
        steps: [
          {
            stepKey: 'monthly_compliance_check',
            title: '月次チェック',
            trigger: { eventKey: 'assignment_monthly_tick', source: 'system' },
            leadTime: { kind: 'after', days: 0 },
            dependsOn: ['visa_precheck'],
            constraints: { maxActions: 3, planLimit: 10 },
            priority: 80,
            riskLevel: 'medium'
          }
        ]
      },
      {
        phaseKey: 'offboarding',
        steps: [
          {
            stepKey: 'return_flight_booking',
            title: '帰任便の手配',
            trigger: { eventKey: 'assignment_return_window_opened', source: 'admin' },
            leadTime: { kind: 'before_deadline', days: 30 },
            dependsOn: [],
            constraints: { maxActions: 3, planLimit: 10 },
            priority: 120,
            riskLevel: 'high'
          }
        ]
      }
    ]
  };

  const first = planTaskRulesTemplateSet({ templateId: template.templateId, template });
  const second = planTaskRulesTemplateSet({ templateId: template.templateId, template });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.planHash, second.planHash, 'planHash must be stable');

  const ids = first.compiledRules.map((rule) => rule.ruleId);
  assert.deepEqual(ids, [
    'journey_us_v1__onboarding__visa_precheck',
    'journey_us_v1__in_assignment__monthly_compliance_check',
    'journey_us_v1__offboarding__return_flight_booking'
  ]);

  const monthly = first.compiledRules.find((rule) => rule.stepKey === 'monthly_compliance_check');
  assert.ok(monthly);
  assert.equal(monthly.scenarioKey, 'US_ASSIGNMENT');
  assert.deepEqual(monthly.dependsOn, ['journey_us_v1__onboarding__visa_precheck']);
});
