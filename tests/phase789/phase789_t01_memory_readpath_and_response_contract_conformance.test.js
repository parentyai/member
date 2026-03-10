'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');

const { getUserContextSnapshot } = require('../../src/usecases/context/getUserContextSnapshot');
const { evaluateResponseContractConformance } = require('../../src/v1/semantic/responseContractConformance');

test('phase789: context snapshot read path prefers memory_fabric when lane records exist', async () => {
  const result = await getUserContextSnapshot(
    {
      lineUserId: 'U_PHASE789',
      nowMs: Date.parse('2026-03-10T12:00:00.000Z'),
      maxAgeHours: 24
    },
    {
      taskMemoryRepo: {
        getTaskMemory: async () => ({
          data: {
            current_goal: 'SSN手続きを進める',
            current_selected_options: ['ssn_docs'],
            current_constraints: ['deadline_soon']
          },
          updatedAt: '2026-03-10T11:30:00.000Z'
        })
      },
      sessionMemoryRepo: {
        getSessionMemory: async () => ({
          data: {
            user_decisions: ['speed'],
            unresolved_items: ['ssn_docs']
          },
          updatedAt: '2026-03-10T11:20:00.000Z'
        })
      },
      profileMemoryRepo: {
        getProfileMemory: async () => ({
          data: {
            family_structure: 'with_spouse',
            recurring_destinations: ['New York', 'NY']
          },
          updatedAt: '2026-03-10T11:10:00.000Z'
        })
      },
      complianceMemoryRepo: {
        getComplianceMemory: async () => ({
          data: {
            journey_phase: 'arrival',
            effective_dates: { sourceUpdatedAt: '2026-03-10T10:30:00.000Z' }
          },
          updatedAt: '2026-03-10T11:40:00.000Z'
        })
      },
      userContextSnapshotsRepo: {
        getUserContextSnapshot: async () => ({
          phase: 'return',
          shortSummary: 'legacy_snapshot'
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.readPath, 'memory_fabric');
  assert.equal(result.stale, false);
  assert.equal(result.snapshot.phase, 'arrival');
  assert.equal(result.snapshot.location.city, 'New York');
  assert.equal(result.snapshot.location.state, 'NY');
  assert.equal(result.snapshot.shortSummary, 'SSN手続きを進める');
  assert.equal(Array.isArray(result.snapshot.topOpenTasks), true);
  assert.equal(result.snapshot.topOpenTasks.length, 1);
});

test('phase789: context snapshot read path falls back to legacy snapshot when memory lanes are absent', async () => {
  const result = await getUserContextSnapshot(
    {
      lineUserId: 'U_PHASE789_LEGACY',
      nowMs: Date.parse('2026-03-10T12:00:00.000Z'),
      maxAgeHours: 24
    },
    {
      taskMemoryRepo: { getTaskMemory: async () => null },
      sessionMemoryRepo: { getSessionMemory: async () => null },
      profileMemoryRepo: { getProfileMemory: async () => null },
      complianceMemoryRepo: { getComplianceMemory: async () => null },
      userContextSnapshotsRepo: {
        getUserContextSnapshot: async () => ({
          phase: 'pre',
          shortSummary: 'legacy ok',
          updatedAt: '2026-03-10T11:00:00.000Z'
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.readPath, 'legacy_snapshot');
  assert.equal(result.snapshot.shortSummary, 'legacy ok');
  assert.equal(result.stale, false);
});

test('phase789: response contract conformance checker normalizes concise line reply', () => {
  const evaluated = evaluateResponseContractConformance({
    replyText: 'SSNの必要書類は3点です。\n1. パスポート\n2. I-94\n予約はオンラインですると早いですか？',
    domainIntent: 'ssn',
    conversationMode: 'concierge',
    nextSteps: ['パスポートを用意', 'I-94を控える']
  });
  assert.equal(evaluated.conformant, true);
  assert.equal(evaluated.errorCount, 0);
  assert.ok(evaluated.semanticResponseObject);
  assert.equal(evaluated.semanticResponseObject.response_contract.intent, 'ssn');
  assert.equal(Array.isArray(evaluated.semanticResponseObject.response_contract.next_steps), true);
  assert.ok(evaluated.responseMarkdown.includes('SSNの必要書類は3点です。'));
});

test('phase789: registry keeps V2-C-06 and YAML-C-03 aligned after read-path and conformance rollout', () => {
  const registry = JSON.parse(fs.readFileSync('contracts/llm_spec_contract_registry.v2.json', 'utf8'));
  const memoryRow = registry.requirements.find((row) => row && row.requirementId === 'V2-C-06');
  const contractRow = registry.requirements.find((row) => row && row.requirementId === 'YAML-C-03');
  assert.ok(memoryRow, 'V2-C-06 must exist');
  assert.ok(contractRow, 'YAML-C-03 must exist');
  assert.equal(memoryRow.status, 'aligned');
  assert.equal(contractRow.status, 'aligned');
});

test('phase789: runtime logs include response contract conformance telemetry keys', () => {
  const gateWriter = fs.readFileSync('src/usecases/llm/appendLlmGateDecision.js', 'utf8');
  const actionRepo = fs.readFileSync('src/repos/firestore/llmActionLogsRepo.js', 'utf8');
  [
    'responseContractConformant',
    'responseContractErrorCount',
    'responseContractErrors',
    'responseContractFallbackApplied'
  ].forEach((token) => {
    assert.ok(gateWriter.includes(token), `gate writer missing ${token}`);
    assert.ok(actionRepo.includes(token), `action repo missing ${token}`);
  });
});
