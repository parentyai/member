'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveCityPackQualityContext } = require('../../src/domain/llm/quality/resolveCityPackQualityContext');

test('phase831: city pack quality context blocks required sources and explains grounding reason', () => {
  const result = resolveCityPackQualityContext({
    cityPackContext: true,
    cityPackPackId: 'city-pack-nyc',
    cityPackFreshnessScore: 0.42,
    cityPackAuthorityScore: 0.83,
    cityPackSourceReadinessDecision: 'clarify',
    cityPackValidation: {
      blocked: true,
      blockingInvalidSourceRefs: [{ sourceRefId: 'ref-required-1' }],
      optionalInvalidSourceRefs: [],
      sourceRefs: [{ sourceRefId: 'ref-required-1' }]
    }
  });

  assert.equal(result.context, true);
  assert.equal(result.grounded, false);
  assert.equal(result.requiredSourcesSatisfied, false);
  assert.equal(result.groundingReason, 'required_sources_blocked');
  assert.equal(result.packId, 'city-pack-nyc');
  assert.ok(result.reasonCodes.includes('city_pack_context_active'));
  assert.ok(result.reasonCodes.includes('city_pack_required_source_blocked'));
  assert.equal(result.sourceSnapshot.blockingInvalidSourceRefs.length, 1);
});
