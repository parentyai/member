'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function createResCapture() {
  const stagedHeaders = {};
  const result = { statusCode: null, headers: null, body: '' };
  return {
    setHeader(name, value) {
      if (!name) return;
      stagedHeaders[String(name).toLowerCase()] = value;
    },
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      const normalized = {};
      Object.keys(headers || {}).forEach((key) => {
        normalized[String(key).toLowerCase()] = headers[key];
      });
      result.headers = Object.assign({}, stagedHeaders, normalized);
    },
    end(chunk) {
      if (chunk) result.body += String(chunk);
    },
    readJson() {
      return JSON.parse(result.body || '{}');
    },
    result
  };
}

async function withTaskRulesHandlers(overrides, run) {
  const stepRulesRepoPath = require.resolve('../../src/repos/firestore/stepRulesRepo');
  const stepRuleChangeLogsRepoPath = require.resolve('../../src/repos/firestore/stepRuleChangeLogsRepo');
  const journeyTemplatesRepoPath = require.resolve('../../src/repos/firestore/journeyTemplatesRepo');
  const taskContentsRepoPath = require.resolve('../../src/repos/firestore/taskContentsRepo');
  const computeUserTasksPath = require.resolve('../../src/usecases/tasks/computeUserTasks');
  const planTemplateSetPath = require.resolve('../../src/usecases/tasks/planTaskRulesTemplateSet');
  const applyTemplateSetPath = require.resolve('../../src/usecases/tasks/applyTaskRulesTemplateSet');
  const planApplyPath = require.resolve('../../src/usecases/tasks/planTaskRulesApply');
  const applyForUserPath = require.resolve('../../src/usecases/tasks/applyTaskRulesForUser');
  const validateTaskContentPath = require.resolve('../../src/usecases/tasks/validateTaskContent');
  const featureFlagsPath = require.resolve('../../src/domain/tasks/featureFlags');
  const managedFlowGuardPath = require.resolve('../../src/routes/admin/managedFlowGuard');
  const appendAuditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const routePath = require.resolve('../../src/routes/admin/taskRulesConfig');

  const originals = new Map();
  [
    stepRulesRepoPath,
    stepRuleChangeLogsRepoPath,
    journeyTemplatesRepoPath,
    taskContentsRepoPath,
    computeUserTasksPath,
    planTemplateSetPath,
    applyTemplateSetPath,
    planApplyPath,
    applyForUserPath,
    validateTaskContentPath,
    featureFlagsPath,
    managedFlowGuardPath,
    appendAuditPath,
    routePath
  ].forEach((modulePath) => {
    originals.set(modulePath, require.cache[modulePath]);
  });

  require.cache[stepRulesRepoPath] = {
    id: stepRulesRepoPath,
    filename: stepRulesRepoPath,
    loaded: true,
    exports: Object.assign({
      listStepRules: async () => ([]),
      normalizeStepRule: () => null
    }, overrides && overrides.stepRulesRepo || {})
  };
  require.cache[stepRuleChangeLogsRepoPath] = {
    id: stepRuleChangeLogsRepoPath,
    filename: stepRuleChangeLogsRepoPath,
    loaded: true,
    exports: Object.assign({
      appendStepRuleChangeLog: async () => ({ id: 'change_log_phase900_t46' }),
      listStepRuleChangeLogs: async () => ([])
    }, overrides && overrides.stepRuleChangeLogsRepo || {})
  };
  require.cache[journeyTemplatesRepoPath] = {
    id: journeyTemplatesRepoPath,
    filename: journeyTemplatesRepoPath,
    loaded: true,
    exports: Object.assign({
      listJourneyTemplates: async () => ([])
    }, overrides && overrides.journeyTemplatesRepo || {})
  };
  require.cache[taskContentsRepoPath] = {
    id: taskContentsRepoPath,
    filename: taskContentsRepoPath,
    loaded: true,
    exports: Object.assign({
      listTaskContents: async () => ([])
    }, overrides && overrides.taskContentsRepo || {})
  };
  require.cache[computeUserTasksPath] = {
    id: computeUserTasksPath,
    filename: computeUserTasksPath,
    loaded: true,
    exports: Object.assign({
      computeUserTasks: async () => ({ tasks: [], blocked: [], now: new Date().toISOString() })
    }, overrides && overrides.computeUserTasks || {})
  };
  require.cache[planTemplateSetPath] = {
    id: planTemplateSetPath,
    filename: planTemplateSetPath,
    loaded: true,
    exports: Object.assign({ planTaskRulesTemplateSet: async () => ({ ok: true }) }, overrides && overrides.planTaskRulesTemplateSet || {})
  };
  require.cache[applyTemplateSetPath] = {
    id: applyTemplateSetPath,
    filename: applyTemplateSetPath,
    loaded: true,
    exports: Object.assign({ applyTaskRulesTemplateSet: async () => ({ ok: true }) }, overrides && overrides.applyTaskRulesTemplateSet || {})
  };
  require.cache[planApplyPath] = {
    id: planApplyPath,
    filename: planApplyPath,
    loaded: true,
    exports: Object.assign({ planTaskRulesApply: async () => ({ ok: true }) }, overrides && overrides.planTaskRulesApply || {})
  };
  require.cache[applyForUserPath] = {
    id: applyForUserPath,
    filename: applyForUserPath,
    loaded: true,
    exports: Object.assign({ applyTaskRulesForUser: async () => ({ ok: true }) }, overrides && overrides.applyTaskRulesForUser || {})
  };
  require.cache[validateTaskContentPath] = {
    id: validateTaskContentPath,
    filename: validateTaskContentPath,
    loaded: true,
    exports: Object.assign({
      validateTaskContent: () => ({ ok: true, warnings: [] }),
      resolveTaskContentLinks: () => ({ ok: true, warnings: [] }),
      resolveTaskKeyWarnings: () => ([])
    }, overrides && overrides.validateTaskContent || {})
  };
  require.cache[featureFlagsPath] = {
    id: featureFlagsPath,
    filename: featureFlagsPath,
    loaded: true,
    exports: Object.assign({
      isTaskEngineEnabled: () => false,
      isTaskNudgeEnabled: () => false,
      isTaskEventsEnabled: () => false,
      isJourneyTemplateEnabled: () => false,
      isJourneyUnifiedViewEnabled: () => false,
      isLegacyTodoDeriveFromTemplatesEnabled: () => false,
      isLegacyTodoEmitDisabled: () => false,
      isTaskContentAdminEditorEnabled: () => false,
      getTaskNudgeLinkPolicy: () => 'deny_all'
    }, overrides && overrides.featureFlags || {})
  };
  require.cache[managedFlowGuardPath] = {
    id: managedFlowGuardPath,
    filename: managedFlowGuardPath,
    loaded: true,
    exports: Object.assign({
      enforceManagedFlowGuard: async () => ({ ok: true, actor: 'phase900_actor', traceId: 'trace_phase900_t46_guard' })
    }, overrides && overrides.managedFlowGuard || {})
  };
  require.cache[appendAuditPath] = {
    id: appendAuditPath,
    filename: appendAuditPath,
    loaded: true,
    exports: Object.assign({
      appendAuditLog: async () => ({ id: 'audit_phase900_t46' })
    }, overrides && overrides.appendAuditLog || {})
  };
  delete require.cache[routePath];

  try {
    const route = require('../../src/routes/admin/taskRulesConfig');
    await run(route);
  } finally {
    originals.forEach((entry, modulePath) => {
      if (entry) require.cache[modulePath] = entry;
      else delete require.cache[modulePath];
    });
  }
}

function buildReq(url, traceId) {
  return {
    method: 'POST',
    url,
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': traceId,
      'x-request-id': traceId
    }
  };
}

test('phase900: task rules status success emits completed outcome metadata', async () => {
  await withTaskRulesHandlers({}, async ({ handleStatus }) => {
    const res = createResCapture();
    await handleStatus({
      method: 'GET',
      url: '/api/admin/os/task-rules/status',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t46_status',
        'x-request-id': 'req_phase900_t46_status'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.task_rules');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: task rules plan invalid json emits normalized error outcome metadata', async () => {
  await withTaskRulesHandlers({}, async ({ handlePlan }) => {
    const res = createResCapture();
    await handlePlan(buildReq('/api/admin/os/task-rules/plan', 'trace_phase900_t46_invalid_json'), res, '{');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'invalid json');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.task_rules');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
  });
});

test('phase900: task rules status internal error emits normalized error outcome metadata', async () => {
  await withTaskRulesHandlers({
    stepRulesRepo: {
      listStepRules: async () => {
        throw new Error('boom');
      }
    }
  }, async ({ handleStatus }) => {
    const res = createResCapture();
    await handleStatus({
      method: 'GET',
      url: '/api/admin/os/task-rules/status',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t46_error',
        'x-request-id': 'req_phase900_t46_error'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.task_rules');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
