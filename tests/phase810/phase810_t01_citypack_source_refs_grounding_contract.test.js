'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { resolveRuntimeCityPackSignals } = require('../../src/domain/llm/quality/resolveRuntimeCityPackSignals');
const { runAnswerReadinessGateV2 } = require('../../src/domain/llm/quality/runAnswerReadinessGateV2');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase810: runtime city pack signals ground official fresh pack candidates', async () => {
  const signals = await resolveRuntimeCityPackSignals({
    lineUserId: 'U-city-1',
    messageText: 'ニューヨークで住まい探しを進めたいです',
    domainIntent: 'housing',
    intentRiskTier: 'medium',
    locale: 'ja'
  }, {
    searchCityPackCandidates: async () => ({
      candidates: [{ sourceId: 'city-pack-nyc' }]
    }),
    getCityPack: async () => ({
      packClass: 'housing',
      regionKey: 'NY::new-york',
      regionCity: 'ニューヨーク',
      regionState: 'NY',
      sourceRefs: ['ref-1']
    }),
    validateCityPackSources: async () => ({
      blocked: false,
      blockingInvalidSourceRefs: [],
      optionalInvalidSourceRefs: [],
      sourceRefs: [
        {
          ref: {
            sourceType: 'official',
            authorityLevel: 'state',
            status: 'active',
            validUntil: '2026-08-01T00:00:00.000Z',
            requiredLevel: 'required',
            domainClass: 'housing'
          }
        }
      ]
    })
  });

  assert.equal(signals.cityPackContext, true);
  assert.equal(signals.cityPackGrounded, true);
  assert.equal(signals.cityPackPackId, 'city-pack-nyc');
  assert.equal(signals.cityPackSourceReadinessDecision, 'allow');
  assert.equal(signals.requestedCityKey, 'new-york');
  assert.equal(signals.matchedCityKey, 'new-york');
  assert.equal(signals.citySpecificitySatisfied, true);
  assert.equal(signals.citySpecificityReason, 'city_exact_match');
  assert.ok(Number(signals.cityPackFreshnessScore) >= 0.8);
  assert.ok(Number(signals.cityPackAuthorityScore) >= 0.8);
});

test('phase810: runtime city pack signals keep city packs ungrounded when exact city match is missing', async () => {
  const signals = await resolveRuntimeCityPackSignals({
    lineUserId: 'U-city-3',
    messageText: 'ニューヨークで学校手続きを進めたいです',
    domainIntent: 'school',
    intentRiskTier: 'medium',
    locale: 'ja'
  }, {
    searchCityPackCandidates: async () => ({
      candidates: [{ sourceId: 'city-pack-boston' }]
    }),
    getCityPack: async () => ({
      packClass: 'school',
      regionKey: 'MA::boston',
      regionCity: 'Boston',
      regionState: 'MA',
      sourceRefs: ['ref-2']
    }),
    validateCityPackSources: async () => ({
      blocked: false,
      blockingInvalidSourceRefs: [],
      optionalInvalidSourceRefs: [],
      sourceRefs: [
        {
          ref: {
            sourceType: 'official',
            authorityLevel: 'state',
            status: 'active',
            validUntil: '2026-08-01T00:00:00.000Z',
            requiredLevel: 'required',
            domainClass: 'school'
          }
        }
      ]
    })
  });

  assert.equal(signals.cityPackContext, true);
  assert.equal(signals.cityPackGrounded, false);
  assert.equal(signals.requestedCityKey, 'new-york');
  assert.equal(signals.matchedCityKey, 'boston');
  assert.equal(signals.citySpecificitySatisfied, false);
  assert.equal(signals.citySpecificityReason, 'city_mismatch');
});

test('phase810: required blocked city pack source shadow-refuses high-risk answers', async () => {
  const signals = await resolveRuntimeCityPackSignals({
    lineUserId: 'U-city-2',
    domainIntent: 'school',
    intentRiskTier: 'high',
    locale: 'ja'
  }, {
    searchCityPackCandidates: async () => ({
      candidates: [{ sourceId: 'city-pack-bad' }]
    }),
    getCityPack: async () => ({
      packClass: 'school',
      sourceRefs: ['ref-blocked']
    }),
    validateCityPackSources: async () => ({
      blocked: true,
      blockingInvalidSourceRefs: ['ref-blocked'],
      optionalInvalidSourceRefs: [],
      sourceRefs: [
        {
          ref: {
            sourceType: 'official',
            authorityLevel: 'state',
            status: 'blocked',
            validUntil: '2026-08-01T00:00:00.000Z',
            requiredLevel: 'required',
            domainClass: 'school'
          }
        }
      ]
    })
  });

  assert.equal(signals.cityPackGrounded, false);
  assert.equal(signals.cityPackSourceReadinessDecision, 'refuse');
  assert.ok(signals.cityPackSourceReadinessReasons.includes('required_source_blocked'));

  const gate = runAnswerReadinessGateV2({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.92,
    sourceFreshnessScore: 0.94,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    evidenceCoverage: 0.92,
    cityPackContext: signals.cityPackContext,
    cityPackGrounded: signals.cityPackGrounded,
    cityPackFreshnessScore: signals.cityPackFreshnessScore,
    cityPackAuthorityScore: signals.cityPackAuthorityScore,
    cityPackValidation: signals.cityPackValidation,
    enforceV2: false
  });

  assert.equal(gate.readiness.decision, 'allow');
  assert.equal(gate.readinessV2.decision, 'refuse');
  assert.ok(gate.readinessV2.reasonCodes.includes('city_pack_required_source_blocked'));
});

test('phase810: webhook and orchestrator wire runtime city pack grounding helpers', () => {
  const webhookRoute = read('src/routes/webhookLine.js');
  const orchestrator = read('src/domain/llm/orchestrator/runPaidConversationOrchestrator.js');
  const concierge = read('src/usecases/assistant/concierge/composeConciergeReply.js');

  assert.ok(webhookRoute.includes('resolveRuntimeCityPackSignals'));
  assert.ok(webhookRoute.includes('cityPackGrounded: cityPackSignals.cityPackGrounded'));
  assert.ok(webhookRoute.includes('cityPackFreshnessScore: cityPackSignals.cityPackFreshnessScore'));

  assert.ok(orchestrator.includes('resolveRuntimeCityPackSignals'));
  assert.ok(orchestrator.includes('cityPackGrounded: cityPackSignals.cityPackGrounded'));

  assert.ok(concierge.includes('cityPackGrounded: cityPackCandidatePresent'));
});
