'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { resolveFirestoreProjectId } = require('../../src/infra/firestore');
const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');
const { getAutomationConfig } = require('../../src/usecases/phase48/getAutomationConfig');

const DEFAULT_NOTIFICATION_CAPS = Object.freeze({
  perUserWeeklyCap: null,
  perUserDailyCap: null,
  perCategoryWeeklyCap: null,
  quietHours: null
});

const DEFAULT_AUTOMATION_CONFIG = Object.freeze({
  enabled: false,
  mode: 'OFF',
  allowScenarios: [],
  allowSteps: [],
  allowNextActions: [],
  updatedAt: null
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeErrorLabel(label, error) {
  const message = error && error.message ? error.message : String(error);
  return `${label}: ${message}`;
}

function resolveGitSha(execImpl, cwd) {
  try {
    return String(execImpl('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }) || '').trim() || null;
  } catch (_error) {
    return null;
  }
}

async function buildRuntimeState(options, deps) {
  const payload = options && typeof options === 'object' ? options : {};
  const explicitDeps = deps && typeof deps === 'object' ? deps : {};
  const cwd = payload.cwd ? path.resolve(payload.cwd) : path.resolve(__dirname, '..', '..');
  const routeKey = typeof payload.routeKey === 'string' && payload.routeKey.trim()
    ? payload.routeKey.trim()
    : 'line-desktop-patrol';
  const now = typeof explicitDeps.now === 'function' ? explicitDeps.now() : new Date();
  const env = explicitDeps.env && typeof explicitDeps.env === 'object' ? explicitDeps.env : process.env;
  const execImpl = typeof explicitDeps.execFileSync === 'function' ? explicitDeps.execFileSync : execFileSync;
  const resolveProjectId = typeof explicitDeps.resolveFirestoreProjectId === 'function'
    ? explicitDeps.resolveFirestoreProjectId
    : resolveFirestoreProjectId;
  const repoSystemFlags = explicitDeps.systemFlagsRepo || systemFlagsRepo;
  const getAutomationConfigFn = typeof explicitDeps.getAutomationConfig === 'function'
    ? explicitDeps.getAutomationConfig
    : getAutomationConfig;
  const readErrors = [];

  const firestoreResolution = resolveProjectId({
    env,
    execFileSync: execImpl
  });

  let publicWriteSafety = {
    killSwitchOn: null,
    failCloseMode: null,
    trackAuditWriteMode: null,
    readError: true,
    source: 'unavailable'
  };
  if (repoSystemFlags && typeof repoSystemFlags.getPublicWriteSafetySnapshot === 'function') {
    try {
      publicWriteSafety = await repoSystemFlags.getPublicWriteSafetySnapshot(routeKey);
    } catch (error) {
      readErrors.push(normalizeErrorLabel('publicWriteSafety', error));
    }
  }

  let killSwitch = null;
  if (repoSystemFlags && typeof repoSystemFlags.getKillSwitch === 'function') {
    try {
      killSwitch = await repoSystemFlags.getKillSwitch();
    } catch (error) {
      readErrors.push(normalizeErrorLabel('killSwitch', error));
    }
  }

  let notificationCaps = cloneJson(DEFAULT_NOTIFICATION_CAPS);
  if (repoSystemFlags && typeof repoSystemFlags.getNotificationCaps === 'function') {
    try {
      notificationCaps = await repoSystemFlags.getNotificationCaps();
    } catch (error) {
      readErrors.push(normalizeErrorLabel('notificationCaps', error));
    }
  }

  let llmEnabled = null;
  if (repoSystemFlags && typeof repoSystemFlags.getLlmEnabled === 'function') {
    try {
      llmEnabled = await repoSystemFlags.getLlmEnabled();
    } catch (error) {
      readErrors.push(normalizeErrorLabel('llmEnabled', error));
    }
  }

  let automationConfig = cloneJson(DEFAULT_AUTOMATION_CONFIG);
  try {
    const result = await getAutomationConfigFn();
    if (result && result.ok === true && result.config && typeof result.config === 'object') {
      automationConfig = Object.assign(cloneJson(DEFAULT_AUTOMATION_CONFIG), result.config);
    }
  } catch (error) {
    readErrors.push(normalizeErrorLabel('automationConfig', error));
  }

  return {
    ok: true,
    degraded: readErrors.length > 0 || publicWriteSafety.readError === true,
    generatedAt: now.toISOString(),
    repoRoot: cwd,
    routeKey,
    gitSha: resolveGitSha(execImpl, cwd),
    serviceMode: typeof env.SERVICE_MODE === 'string' && env.SERVICE_MODE.trim() ? env.SERVICE_MODE.trim() : 'member',
    firestoreProjectId: firestoreResolution.projectId,
    firestoreProjectIdSource: firestoreResolution.source,
    global: {
      killSwitch,
      publicWriteSafety,
      notificationCaps,
      llmEnabled,
      automationConfig
    },
    readErrors
  };
}

async function main() {
  const result = await buildRuntimeState();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: error && error.message ? error.message : String(error)
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildRuntimeState,
  main
};
