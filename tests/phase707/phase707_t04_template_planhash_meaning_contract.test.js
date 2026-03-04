'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { planTaskRulesTemplateSet } = require('../../src/usecases/tasks/planTaskRulesTemplateSet');

test('phase707: template planHash changes when meaning content changes', () => {
  const baseTemplate = {
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
            title: 'ビザ確認',
            meaning: {
              meaningKey: 'visa_precheck',
              title: 'ビザ確認',
              whyNow: '期限遅延を防止',
              doneDefinition: '必要書類を確認'
            },
            trigger: { eventKey: 'assignment_created', source: 'admin' },
            leadTime: { kind: 'after', days: 1 },
            dependsOn: [],
            constraints: { maxActions: 3, planLimit: 10 },
            priority: 100,
            riskLevel: 'high'
          }
        ]
      }
    ]
  };

  const variantTemplate = JSON.parse(JSON.stringify(baseTemplate));
  variantTemplate.phases[0].steps[0].meaning.whyNow = '差戻しを防止';

  const first = planTaskRulesTemplateSet({ templateId: baseTemplate.templateId, template: baseTemplate });
  const second = planTaskRulesTemplateSet({ templateId: variantTemplate.templateId, template: variantTemplate });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.planHash, second.planHash);
});
