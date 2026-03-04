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
const emergencyRulesRepo = require('../../src/repos/firestore/emergencyRulesRepo');
const {
  matchEmergencyRule,
  selectBestEmergencyRule,
  resolveEmergencyEventType
} = require('../../src/usecases/emergency/emergencyRuleEngine');

test('phase669: emergency rules repo upsert/list and engine match are deterministic', async (t) => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const specific = await emergencyRulesRepo.upsertRule('emr_specific', {
    providerKey: 'nws_alerts',
    eventType: 'weather.new',
    severity: 'CRITICAL',
    region: { regionKey: 'TX::statewide' },
    autoSend: true,
    enabled: true,
    priority: 'emergency',
    maxRecipients: 250
  }, 'phase669_test');

  const broad = await emergencyRulesRepo.upsertRule('emr_broad', {
    providerKey: 'nws_alerts',
    eventType: null,
    severity: 'ANY',
    region: null,
    autoSend: true,
    enabled: true,
    priority: 'standard',
    maxRecipients: 500
  }, 'phase669_test');

  const listed = await emergencyRulesRepo.listEnabledRulesNow({ providerKey: 'nws_alerts', limit: 20 });
  assert.equal(Array.isArray(listed), true);
  assert.equal(listed.length, 2);

  const ruleInput = {
    providerKey: 'nws_alerts',
    category: 'weather',
    diffType: 'new',
    severity: 'CRITICAL',
    regionKey: 'TX::statewide',
    eventType: resolveEmergencyEventType({ category: 'weather', diffType: 'new' })
  };
  const matched = matchEmergencyRule(specific, ruleInput);
  assert.equal(matched.ok, true);

  const unsupported = matchEmergencyRule(Object.assign({}, specific, {
    region: { county: 'Travis' }
  }), ruleInput);
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.reason, 'unsupported_target_dimension');

  const selected = selectBestEmergencyRule([broad, specific], ruleInput);
  assert.ok(selected.rule);
  assert.equal(selected.rule.id, 'emr_specific');
});
