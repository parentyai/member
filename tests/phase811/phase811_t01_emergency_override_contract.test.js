'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { resolveRuntimeEmergencySignals } = require('../../src/domain/llm/quality/resolveRuntimeEmergencySignals');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase811: runtime emergency signals choose highest severity active event with official link', async () => {
  const signals = await resolveRuntimeEmergencySignals({
    lineUserId: 'U-emergency-1',
    contextSnapshot: {
      location: {
        state: 'ca'
      }
    }
  }, {
    getUser: async () => ({ regionKey: 'ignored-user-region' }),
    listEventsByRegion: async (regionKey) => {
      assert.equal(regionKey, 'ca');
      return [
        {
          id: 'event-warn',
          isActive: true,
          severity: 'WARN',
          updatedAt: '2026-03-12T12:00:00.000Z',
          officialLinkRegistryId: 'link-warn'
        },
        {
          id: 'event-critical',
          isActive: true,
          severity: 'CRITICAL',
          updatedAt: '2026-03-12T11:00:00.000Z',
          officialLinkRegistryId: 'link-critical'
        }
      ];
    },
    getLink: async (id) => ({
      id,
      url: `https://${id}.gov/example`,
      domainClass: 'gov'
    })
  });

  assert.equal(signals.emergencyContext, true);
  assert.equal(signals.emergencySeverity, 'CRITICAL');
  assert.equal(signals.emergencyOfficialSourceSatisfied, true);
  assert.equal(signals.emergencyRegionKey, 'ca');
  assert.equal(signals.emergencyEventId, 'event-critical');
});

test('phase811: explicit emergency context short-circuits runtime lookup', async () => {
  const signals = await resolveRuntimeEmergencySignals({
    emergencyContext: {
      active: true,
      severity: 'warn',
      officialSourceSatisfied: false
    },
    regionKey: 'ny'
  }, {
    listEventsByRegion: async () => {
      throw new Error('should not query events when explicit emergency context is present');
    }
  });

  assert.equal(signals.emergencyContext, true);
  assert.equal(signals.emergencySeverity, 'WARN');
  assert.equal(signals.emergencyOfficialSourceSatisfied, false);
  assert.equal(signals.emergencyRegionKey, 'ny');
});

test('phase811: webhook and orchestrator wire runtime emergency helpers and telemetry', () => {
  const webhookRoute = read('src/routes/webhookLine.js');
  const orchestrator = read('src/domain/llm/orchestrator/runPaidConversationOrchestrator.js');

  assert.ok(webhookRoute.includes('resolveRuntimeEmergencySignals'));
  assert.ok(webhookRoute.includes('emergencyOfficialSourceSatisfied: emergencySignals.emergencyOfficialSourceSatisfied'));
  assert.ok(webhookRoute.includes('emergencySeverity: emergencySignals.emergencySeverity'));

  assert.ok(orchestrator.includes('resolveRuntimeEmergencySignals'));
  assert.ok(orchestrator.includes('emergencyContext: emergencySignals.emergencyContext'));
  assert.ok(orchestrator.includes('emergencyOfficialSourceSatisfied: emergencySignals.emergencyOfficialSourceSatisfied'));
});
