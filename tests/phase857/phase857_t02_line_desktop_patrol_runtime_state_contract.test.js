'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRuntimeState } = require('../../tools/line_desktop_patrol/read_repo_runtime_state');

test('phase857: runtime state bridge returns normalized read-only snapshot', async () => {
  const state = await buildRuntimeState({
    cwd: '/tmp/member',
    routeKey: 'line-desktop-patrol'
  }, {
    now: () => new Date('2026-03-25T12:00:00.000Z'),
    env: { SERVICE_MODE: 'member', FIRESTORE_PROJECT_ID: 'member-dev' },
    execFileSync: () => 'abc123def456\n',
    resolveFirestoreProjectId: () => ({ projectId: 'member-dev', source: 'env:FIRESTORE_PROJECT_ID' }),
    systemFlagsRepo: {
      async getPublicWriteSafetySnapshot() {
        return {
          killSwitchOn: false,
          failCloseMode: 'enforce',
          trackAuditWriteMode: 'best_effort',
          readError: false,
          source: 'live'
        };
      },
      async getKillSwitch() {
        return false;
      },
      async getNotificationCaps() {
        return {
          perUserWeeklyCap: null,
          perUserDailyCap: null,
          perCategoryWeeklyCap: null,
          quietHours: null
        };
      },
      async getLlmEnabled() {
        return false;
      }
    },
    async getAutomationConfig() {
      return {
        ok: true,
        config: {
          enabled: false,
          mode: 'OFF',
          allowScenarios: [],
          allowSteps: [],
          allowNextActions: [],
          updatedAt: null
        }
      };
    }
  });

  assert.equal(state.ok, true);
  assert.equal(state.degraded, false);
  assert.equal(state.gitSha, 'abc123def456');
  assert.equal(state.serviceMode, 'member');
  assert.equal(state.firestoreProjectId, 'member-dev');
  assert.equal(state.global.killSwitch, false);
  assert.equal(state.global.publicWriteSafety.failCloseMode, 'enforce');
  assert.equal(state.global.automationConfig.mode, 'OFF');
  assert.deepEqual(state.readErrors, []);
});

test('phase857: runtime state bridge degrades instead of throwing when reads fail', async () => {
  const state = await buildRuntimeState({}, {
    now: () => new Date('2026-03-25T12:00:00.000Z'),
    env: {},
    execFileSync() {
      throw new Error('git unavailable');
    },
    resolveFirestoreProjectId: () => ({ projectId: null, source: 'unresolved' }),
    systemFlagsRepo: {
      async getPublicWriteSafetySnapshot() {
        throw new Error('firestore unavailable');
      },
      async getKillSwitch() {
        throw new Error('kill switch unavailable');
      },
      async getNotificationCaps() {
        throw new Error('caps unavailable');
      },
      async getLlmEnabled() {
        throw new Error('llm unavailable');
      }
    },
    async getAutomationConfig() {
      throw new Error('automation unavailable');
    }
  });

  assert.equal(state.ok, true);
  assert.equal(state.degraded, true);
  assert.equal(state.gitSha, null);
  assert.equal(state.global.killSwitch, null);
  assert.equal(state.global.automationConfig.mode, 'OFF');
  assert.equal(state.readErrors.length, 5);
});
