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
const richMenuPolicyRepo = require('../../src/repos/firestore/richMenuPolicyRepo');
const richMenuTemplatesRepo = require('../../src/repos/firestore/richMenuTemplatesRepo');
const richMenuPhaseProfilesRepo = require('../../src/repos/firestore/richMenuPhaseProfilesRepo');
const richMenuAssignmentRulesRepo = require('../../src/repos/firestore/richMenuAssignmentRulesRepo');
const richMenuBindingsRepo = require('../../src/repos/firestore/richMenuBindingsRepo');
const { resolveRichMenuTemplate } = require('../../src/usecases/journey/resolveRichMenuTemplate');
const { applyRichMenuAssignment } = require('../../src/usecases/journey/applyRichMenuAssignment');

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

function buildTemplate(templateId, target, richMenuId) {
  return {
    templateId,
    kind: 'default',
    status: 'active',
    target: Object.assign({ planTier: null, phaseId: null, locale: 'ja' }, target || {}),
    layout: {
      size: 'large',
      areas: [
        {
          label: 'today',
          bounds: { x: 0, y: 0, width: 2500, height: 843 },
          actionType: 'postback',
          actionPayload: { data: `open:${templateId}` }
        }
      ]
    },
    lineMeta: { richMenuId, aliasId: null }
  };
}

test('phase663: resolver applies priority per-user > combined > plan > phase > default and apply enforces cooldown', async () => {
  const restoreEnv = withEnv({
    ENABLE_RICH_MENU_DYNAMIC: '1'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await richMenuPolicyRepo.setRichMenuPolicy({
      enabled: true,
      updateEnabled: true,
      defaultTemplateId: 'default_ja',
      fallbackTemplateId: 'default_ja',
      cooldownSeconds: 3600,
      maxAppliesPerMinute: 120,
      maxTargetsPerApply: 200,
      allowLegacyJourneyPolicyFallback: false
    }, 'phase663_test');

    await richMenuPhaseProfilesRepo.upsertRichMenuPhaseProfile({
      phaseId: 'arrival',
      status: 'active',
      label: 'arrival',
      journeyStageMatchers: ['arrived']
    }, 'phase663_test');

    await richMenuTemplatesRepo.upsertRichMenuTemplate(
      buildTemplate('default_ja', { planTier: null, phaseId: null, locale: 'ja' }, 'richmenu_default_ja'),
      'phase663_test'
    );
    await richMenuTemplatesRepo.upsertRichMenuTemplate(
      buildTemplate('combined_paid_arrival_ja', { planTier: 'paid', phaseId: 'arrival', locale: 'ja' }, 'richmenu_combined'),
      'phase663_test'
    );
    await richMenuTemplatesRepo.upsertRichMenuTemplate(
      buildTemplate('plan_paid_ja', { planTier: 'paid', phaseId: null, locale: 'ja' }, 'richmenu_plan'),
      'phase663_test'
    );
    await richMenuTemplatesRepo.upsertRichMenuTemplate(
      buildTemplate('phase_arrival_ja', { planTier: null, phaseId: 'arrival', locale: 'ja' }, 'richmenu_phase'),
      'phase663_test'
    );
    await richMenuTemplatesRepo.upsertRichMenuTemplate(
      buildTemplate('override_ja', { planTier: null, phaseId: null, locale: 'ja' }, 'richmenu_override'),
      'phase663_test'
    );

    await richMenuAssignmentRulesRepo.upsertRichMenuAssignmentRule({
      ruleId: 'plan_paid_rule',
      kind: 'plan',
      status: 'active',
      templateId: 'plan_paid_ja',
      priority: 9999,
      target: { planTier: 'paid', phaseId: null, locale: 'ja' }
    }, 'phase663_test');
    await richMenuAssignmentRulesRepo.upsertRichMenuAssignmentRule({
      ruleId: 'phase_arrival_rule',
      kind: 'phase',
      status: 'active',
      templateId: 'phase_arrival_ja',
      priority: 9999,
      target: { planTier: null, phaseId: 'arrival', locale: 'ja' }
    }, 'phase663_test');
    await richMenuAssignmentRulesRepo.upsertRichMenuAssignmentRule({
      ruleId: 'combined_paid_arrival_rule',
      kind: 'combined',
      status: 'active',
      templateId: 'combined_paid_arrival_ja',
      priority: 10,
      target: { planTier: 'paid', phaseId: 'arrival', locale: 'ja' }
    }, 'phase663_test');

    await richMenuBindingsRepo.upsertRichMenuBinding('U_PHASE663_PRIORITY', {
      manualOverrideTemplateId: 'override_ja'
    });
    const overrideResolution = await resolveRichMenuTemplate({
      lineUserId: 'U_PHASE663_PRIORITY',
      planTier: 'paid',
      journeyStage: 'arrived',
      locale: 'ja'
    });
    assert.equal(overrideResolution.ok, true);
    assert.equal(overrideResolution.source, 'per_user_override');
    assert.equal(overrideResolution.templateId, 'override_ja');
    assert.equal(overrideResolution.richMenuId, 'richmenu_override');

    await richMenuBindingsRepo.upsertRichMenuBinding('U_PHASE663_PRIORITY', {
      manualOverrideTemplateId: null
    });
    const combinedResolution = await resolveRichMenuTemplate({
      lineUserId: 'U_PHASE663_PRIORITY',
      planTier: 'paid',
      journeyStage: 'arrived',
      locale: 'ja'
    });
    assert.equal(combinedResolution.ok, true);
    assert.equal(combinedResolution.source, 'rule_4');
    assert.equal(combinedResolution.templateId, 'combined_paid_arrival_ja');
    assert.equal(combinedResolution.richMenuId, 'richmenu_combined');

    const now = new Date('2026-02-25T10:00:00.000Z');
    await richMenuBindingsRepo.upsertRichMenuBinding('U_PHASE663_COOLDOWN', {
      currentTemplateId: 'combined_paid_arrival_ja',
      currentRichMenuId: 'richmenu_combined',
      appliedAt: now.toISOString(),
      nextEligibleAt: '2026-02-25T11:00:00.000Z'
    });

    const cooldownResult = await applyRichMenuAssignment({
      lineUserId: 'U_PHASE663_COOLDOWN',
      planTier: 'paid',
      journeyStage: 'arrived',
      locale: 'ja',
      dryRun: false,
      now
    });
    assert.equal(cooldownResult.ok, true);
    assert.equal(cooldownResult.status, 'cooldown');

    const dryRunResult = await applyRichMenuAssignment({
      lineUserId: 'U_PHASE663_COOLDOWN',
      planTier: 'paid',
      journeyStage: 'arrived',
      locale: 'ja',
      dryRun: true,
      now
    });
    assert.equal(dryRunResult.ok, true);
    assert.equal(dryRunResult.status, 'dry_run');
    assert.equal(dryRunResult.richMenuId, 'richmenu_combined');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

