'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEmergencyMessageDraft } = require('../../src/usecases/emergency/messageTemplates');

test('phase674: emergency message copy gives actionable recall guidance', () => {
  const text = buildEmergencyMessageDraft({
    providerKey: 'openfda_recalls',
    severity: 'CRITICAL',
    category: 'recall',
    regionKey: 'NY::new-york',
    headline: 'Products contain onions purchased from ProSource.'
  });
  assert.match(text, /要確認 \/ リコール/);
  assert.match(text, /対象地域: New York, NY/);
  assert.match(text, /商品名・購入有無/);
});

test('phase674: emergency message copy gives weather-specific action line', () => {
  const text = buildEmergencyMessageDraft({
    providerKey: 'nws_alerts',
    severity: 'CRITICAL',
    category: 'weather',
    regionKey: 'CA::statewide',
    headline: 'Flood Warning'
  });
  assert.match(text, /至急確認 \/ 気象警報/);
  assert.match(text, /対象地域: CA statewide/);
  assert.match(text, /外出・通学前に警報と交通状況/);
});
