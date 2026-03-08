'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { handleJourneyLineCommand } = require('../../src/usecases/journey/handleJourneyLineCommand');

function buildDeps(calls) {
  return {
    tasksRepo: {
      getTask: async (taskId) => {
        if (taskId !== 'U_PHASE250_VENDOR__bank_open') return null;
        return {
          taskId,
          ruleId: 'bank_open',
          category: 'HOUSING',
          meaning: { title: '口座開設' }
        };
      },
      listTasksByUser: async () => []
    },
    stepRulesRepo: {
      getStepRule: async (ruleId) => {
        if (ruleId !== 'bank_open') return null;
        return {
          ruleId,
          category: 'HOUSING',
          recommendedVendorLinkIds: ['vendor_b', 'vendor_a']
        };
      }
    },
    taskContentsRepo: {
      getTaskContent: async (taskKey) => {
        if (taskKey !== 'bank_open') return null;
        return {
          taskKey,
          category: 'HOUSING',
          recommendedVendorLinkIds: ['vendor_b', 'vendor_a']
        };
      }
    },
    linkRegistryRepo: {
      getLink: async (id) => {
        if (id === 'vendor_a') {
          return {
            id,
            title: 'Vendor A',
            url: 'https://example.com/vendor-a',
            enabled: true,
            regionKey: 'us-ca-sanfrancisco',
            regionScope: 'city',
            intentTag: 'vendor',
            tags: ['housing'],
            audienceTag: 'solo',
            lastHealth: { state: 'OK' }
          };
        }
        if (id === 'vendor_b') {
          return {
            id,
            title: 'Vendor B',
            url: 'https://example.com/vendor-b',
            enabled: true,
            regionKey: 'us-ny-newyork',
            regionScope: 'city',
            intentTag: 'vendor',
            tags: ['banking'],
            audienceTag: 'family',
            lastHealth: { state: 'OK' }
          };
        }
        return null;
      }
    },
    usersRepo: {
      getUser: async () => ({ regionKey: 'us-ca-sanfrancisco' })
    },
    userCityPackPreferencesRepo: {
      getUserCityPackPreference: async () => ({ modulesSubscribed: ['housing'] })
    },
    userJourneyProfilesRepo: {
      getUserJourneyProfile: async () => ({ householdType: 'single' })
    },
    userJourneySchedulesRepo: {
      getUserJourneySchedule: async () => ({
        departureDate: '2026-04-01',
        assignmentDate: '2026-04-10'
      })
    },
    eventsRepo: {
      createEvent: async (event) => {
        calls.events.push(event);
        return { id: `evt_${calls.events.length}` };
      }
    },
    appendAuditLog: async (entry) => {
      calls.audits.push(entry);
      return { id: `audit_${calls.audits.length}` };
    }
  };
}

test('phase250: vendor shadow relevance writes traceable evidence while preserving order when sort flag is off', async () => {
  const prevEntry = process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1;
  const prevShadow = process.env.ENABLE_VENDOR_RELEVANCE_SHADOW_V1;
  const prevSort = process.env.ENABLE_VENDOR_RELEVANCE_SORT_V1;
  process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1 = '1';
  process.env.ENABLE_VENDOR_RELEVANCE_SHADOW_V1 = '1';
  process.env.ENABLE_VENDOR_RELEVANCE_SORT_V1 = '0';

  try {
    const calls = { events: [], audits: [] };
    const result = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE250_VENDOR',
      text: 'TODO業者:bank_open',
      traceId: 'trace_phase250_vendor_shadow_off',
      requestId: 'req_phase250_vendor_shadow_off',
      actor: 'phase250_vendor_test'
    }, buildDeps(calls));

    assert.strictEqual(result.handled, true);
    assert.match(result.replyText, /Vendor B/);
    assert.match(result.replyText, /Vendor A/);
    assert.ok(result.replyText.indexOf('Vendor B') < result.replyText.indexOf('Vendor A'));

    const shadowEvent = calls.events.find((event) => event && event.type === 'todo_vendor_shadow_scored');
    assert.ok(shadowEvent);
    assert.strictEqual(shadowEvent.traceId, 'trace_phase250_vendor_shadow_off');
    assert.strictEqual(shadowEvent.requestId, 'req_phase250_vendor_shadow_off');
    assert.strictEqual(shadowEvent.ref.todoKey, 'bank_open');
    assert.ok(Array.isArray(shadowEvent.shadow && shadowEvent.shadow.currentOrderLinkIds));
    assert.ok(Array.isArray(shadowEvent.shadow && shadowEvent.shadow.rankedLinkIds));

    const shadowAudit = calls.audits.find((entry) => entry && entry.action === 'journey.todo_vendor.shadow_scored');
    assert.ok(shadowAudit);
    assert.strictEqual(shadowAudit.traceId, 'trace_phase250_vendor_shadow_off');
    assert.strictEqual(shadowAudit.requestId, 'req_phase250_vendor_shadow_off');
  } finally {
    if (prevEntry === undefined) delete process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1;
    else process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1 = prevEntry;
    if (prevShadow === undefined) delete process.env.ENABLE_VENDOR_RELEVANCE_SHADOW_V1;
    else process.env.ENABLE_VENDOR_RELEVANCE_SHADOW_V1 = prevShadow;
    if (prevSort === undefined) delete process.env.ENABLE_VENDOR_RELEVANCE_SORT_V1;
    else process.env.ENABLE_VENDOR_RELEVANCE_SORT_V1 = prevSort;
  }
});

test('phase250: vendor relevance sorting applies only when flag is on', async () => {
  const prevEntry = process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1;
  const prevShadow = process.env.ENABLE_VENDOR_RELEVANCE_SHADOW_V1;
  const prevSort = process.env.ENABLE_VENDOR_RELEVANCE_SORT_V1;
  process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1 = '1';
  process.env.ENABLE_VENDOR_RELEVANCE_SHADOW_V1 = '1';
  process.env.ENABLE_VENDOR_RELEVANCE_SORT_V1 = '1';

  try {
    const calls = { events: [], audits: [] };
    const result = await handleJourneyLineCommand({
      lineUserId: 'U_PHASE250_VENDOR',
      text: 'TODO業者:bank_open',
      traceId: 'trace_phase250_vendor_shadow_on',
      requestId: 'req_phase250_vendor_shadow_on',
      actor: 'phase250_vendor_test'
    }, buildDeps(calls));

    assert.strictEqual(result.handled, true);
    assert.match(result.replyText, /Vendor A/);
    assert.match(result.replyText, /Vendor B/);
    assert.ok(result.replyText.indexOf('Vendor A') < result.replyText.indexOf('Vendor B'));

    const sortAudit = calls.audits.find((entry) => entry && entry.action === 'journey.todo_vendor.shadow_scored.sort_applied');
    assert.ok(sortAudit);
    assert.strictEqual(sortAudit.traceId, 'trace_phase250_vendor_shadow_on');
    const top = Array.isArray(sortAudit.payloadSummary && sortAudit.payloadSummary.topCandidates)
      ? sortAudit.payloadSummary.topCandidates[0]
      : null;
    assert.ok(top && top.linkId === 'vendor_a');
  } finally {
    if (prevEntry === undefined) delete process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1;
    else process.env.ENABLE_RICH_MENU_TASK_OS_ENTRY_V1 = prevEntry;
    if (prevShadow === undefined) delete process.env.ENABLE_VENDOR_RELEVANCE_SHADOW_V1;
    else process.env.ENABLE_VENDOR_RELEVANCE_SHADOW_V1 = prevShadow;
    if (prevSort === undefined) delete process.env.ENABLE_VENDOR_RELEVANCE_SORT_V1;
    else process.env.ENABLE_VENDOR_RELEVANCE_SORT_V1 = prevSort;
  }
});
