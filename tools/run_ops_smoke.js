#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { execSync } = require('child_process');

function envString(name, fallback) {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return fallback;
}

function envBool(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return Boolean(fallback);
  return value === '1' || value === 'true' || value === 'yes';
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function resolveHeadSha() {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
  } catch (_err) {
    return null;
  }
}

async function runOpsSmoke(options) {
  const opts = options || {};
  const mode = opts.mode || envString('OPS_SMOKE_MODE', 'stub');
  if (mode !== 'stub' && mode !== 'emulator') {
    throw new Error(`invalid OPS_SMOKE_MODE: ${mode}`);
  }

  // Hard safety guard: if any LINE push is attempted, it should throw.
  process.env.LINE_CHANNEL_ACCESS_TOKEN = '';

  let cleanupDb = null;
  try {
    if (mode === 'stub') {
      const { createDbStub } = require('../tests/phase0/firestoreStub');
      const {
        setDbForTest,
        clearDbForTest,
        setServerTimestampForTest,
        clearServerTimestampForTest
      } = require('../src/infra/firestore');
      const db = createDbStub();
      setDbForTest(db);
      setServerTimestampForTest('SERVER_TIMESTAMP');
      cleanupDb = () => {
        clearDbForTest();
        clearServerTimestampForTest();
      };
    }

    const lineUserId = envString('OPS_SMOKE_LINE_USER_ID', 'OPS_SMOKE_U1');
    const actor = envString('OPS_SMOKE_ACTOR', 'ops_smoke');
    const traceId = envString('OPS_SMOKE_TRACE_ID', uniqueId('ops-smoke-trace'));

    const usersRepo = require('../src/repos/firestore/usersRepo');
    await usersRepo.createUser(lineUserId, {
      memberNumber: envString('OPS_SMOKE_MEMBER_NUMBER', 'OPS_SMOKE_0001'),
      createdAt: '2000-01-01T00:00:00Z'
    });

    // Seed unhealthy notifications so that mitigationSuggestion is produced.
    const notificationsRepo = require('../src/repos/firestore/notificationsRepo');
    const deliveriesRepo = require('../src/repos/firestore/deliveriesRepo');
    const notification = await notificationsRepo.createNotification({
      title: 'OPS_SMOKE_NOTIFICATION',
      body: 'OPS_SMOKE_BODY',
      ctaText: 'Open',
      linkRegistryId: 'OPS_SMOKE_LINK',
      scenarioKey: 'ops_smoke',
      stepKey: 'ops_smoke',
      status: 'sent',
      createdAt: '2026-02-09T00:00:00Z'
    });
    const sentAt = '2026-02-09T00:00:00Z';
    const deliveryCount = Number(envString('OPS_SMOKE_SENT', '40'));
    for (let idx = 0; idx < deliveryCount; idx += 1) {
      await deliveriesRepo.createDelivery({
        notificationId: notification.id,
        lineUserId: `OPS_SMOKE_TARGET_${idx}`,
        delivered: true,
        sentAt,
        clickAt: idx === 0 ? '2026-02-09T00:00:01Z' : undefined
      });
    }

    const { getOpsConsole } = require('../src/usecases/phase25/getOpsConsole');
    const view = await getOpsConsole({
      lineUserId,
      auditView: true,
      actor,
      requestId: uniqueId('ops-smoke-view'),
      traceId
    });
    assert.strictEqual(view.ok, true);
    assert.strictEqual(view.traceId, traceId);
    assert.ok(view.mitigationSuggestion, 'mitigationSuggestion required');

    const { submitOpsDecision } = require('../src/usecases/phase25/submitOpsDecision');
    const submit = await submitOpsDecision({
      lineUserId,
      actor,
      requestId: uniqueId('ops-smoke-submit'),
      traceId,
      decision: {
        nextAction: 'STOP_AND_ESCALATE',
        failure_class: 'UNKNOWN',
        note: 'ops_smoke'
      },
      safetySnapshot: {
        consoleServerTime: view.serverTime,
        maxConsoleAgeMs: 5 * 60 * 1000,
        reason: 'ops_smoke'
      },
      notificationMitigationDecision: {
        decision: 'ADOPT',
        note: 'pause and review',
        actionType: view.mitigationSuggestion.actionType || null,
        targetNotificationId: notification.id
      }
    });
    assert.strictEqual(submit.ok, true);
    assert.strictEqual(submit.traceId, traceId);
    assert.ok(submit.decisionLogId);

    const { executeOpsNextAction } = require('../src/usecases/phase33/executeOpsNextAction');
    const decisionTimelineRepo = require('../src/repos/firestore/decisionTimelineRepo');
    const exec = await executeOpsNextAction({
      lineUserId,
      decisionLogId: submit.decisionLogId,
      action: 'STOP_AND_ESCALATE',
      actor,
      requestId: uniqueId('ops-smoke-exec'),
      consoleServerTime: view.serverTime,
      maxConsoleAgeMs: 5 * 60 * 1000
      // intentionally omit traceId: Phase132 guarantees fallback from decision audit
    }, {
      getOpsConsole: async () => ({
        readiness: { status: 'READY', blocking: [] },
        allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
        opsState: { failure_class: 'UNKNOWN', reasonCode: null, stage: null, note: 'ops_smoke' }
      }),
      getKillSwitch: async () => true,
      decisionTimelineRepo,
      nowFn: () => new Date('2026-02-09T00:00:10.000Z')
    });
    assert.strictEqual(exec.killSwitch, true);
    assert.strictEqual(exec.blocked, true);

    const { getTraceBundle } = require('../src/usecases/admin/getTraceBundle');
    const bundle = await getTraceBundle({ traceId, limit: 50 });
    assert.strictEqual(bundle.ok, true);
    const auditActions = bundle.audits.map((a) => a && a.action).filter(Boolean);
    const timelineActions = bundle.timeline.map((e) => e && e.action).filter(Boolean);
    assert.ok(auditActions.includes('ops_console.view'));
    assert.ok(auditActions.includes('notification_mitigation.suggest'));
    assert.ok(auditActions.includes('ops_decision.submit'));
    assert.ok(auditActions.includes('notification_mitigation.decision'));
    assert.ok(auditActions.includes('ops_decision.execute'));
    assert.ok(timelineActions.includes('DECIDE'));
    assert.ok(timelineActions.includes('EXECUTE'));

    const utc = new Date().toISOString();
    return {
      ok: true,
      utc,
      headSha: resolveHeadSha(),
      mode,
      actor,
      lineUserId,
      traceId,
      counts: {
        audits: bundle.audits.length,
        decisions: bundle.decisions.length,
        timeline: bundle.timeline.length
      },
      sample: {
        auditActions: auditActions.slice(0, 8),
        timelineActions: timelineActions.slice(0, 8)
      },
      execution: {
        ok: Boolean(exec.ok),
        blocked: Boolean(exec.blocked),
        killSwitch: Boolean(exec.killSwitch)
      }
    };
  } finally {
    if (cleanupDb) cleanupDb();
  }
}

async function main() {
  try {
    const result = await runOpsSmoke();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

module.exports = {
  runOpsSmoke
};

if (require.main === module) {
  main().then((code) => process.exit(code));
}
