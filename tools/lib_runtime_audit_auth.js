'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { resolveFirestoreProjectId } = require('../src/infra/firestore');
const { runLocalPreflight } = require('./admin_local_preflight');

const IMPERSONATION_ENV_KEYS = Object.freeze([
  'FIRESTORE_IMPERSONATE_SERVICE_ACCOUNT',
  'GOOGLE_IMPERSONATE_SERVICE_ACCOUNT',
  'GCLOUD_IMPERSONATE_SERVICE_ACCOUNT'
]);

function readCredentialType(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && typeof parsed.type === 'string'
      ? parsed.type.trim()
      : null;
  } catch (_error) {
    return null;
  }
}

function readGcloudConfigValue(key) {
  if (typeof key !== 'string' || !key.trim()) return null;
  try {
    const raw = String(execFileSync('gcloud', ['config', 'get-value', key, '--quiet'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }) || '').trim();
    if (!raw || raw === '(unset)' || raw === 'CURRENT_PROJECT') return raw || null;
    return raw;
  } catch (_error) {
    return null;
  }
}

function resolveImpersonationTarget(envSource) {
  const env = envSource && typeof envSource === 'object' ? envSource : process.env;
  for (const key of IMPERSONATION_ENV_KEYS) {
    const value = typeof env[key] === 'string' ? env[key].trim() : '';
    if (value) {
      return {
        envKey: key,
        value
      };
    }
  }
  return null;
}

function buildAuthPathMap(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const env = payload.env && typeof payload.env === 'object' ? payload.env : process.env;
  const credentialsPath = typeof env.GOOGLE_APPLICATION_CREDENTIALS === 'string'
    ? env.GOOGLE_APPLICATION_CREDENTIALS.trim()
    : '';
  const credentialType = credentialsPath ? readCredentialType(credentialsPath) : null;
  const resolvedProject = resolveFirestoreProjectId({ env, allowGcloud: true });
  const quotaProject = readGcloudConfigValue('billing/quota_project');
  const gcloudAccount = readGcloudConfigValue('account');
  const localSaCandidatePath = typeof env.HOME === 'string' && env.HOME.trim()
    ? path.join(env.HOME.trim(), '.secrets', 'member-dev-sa.json')
    : null;

  return {
    credentialsPath: credentialsPath || null,
    credentialType,
    projectId: resolvedProject.projectId || null,
    projectIdSource: resolvedProject.source || 'unresolved',
    gcloudAccount: gcloudAccount || null,
    quotaProject: quotaProject || null,
    impersonationTarget: resolveImpersonationTarget(env),
    localSaCandidatePath,
    localSaCandidateType: localSaCandidatePath ? readCredentialType(localSaCandidatePath) : null
  };
}

function resolveAuthMode(authPathMap) {
  const snapshot = authPathMap && typeof authPathMap === 'object' ? authPathMap : {};
  if (snapshot.credentialType === 'service_account') return 'service_account_key';
  if (snapshot.impersonationTarget && snapshot.impersonationTarget.value) return 'service_account_impersonation';
  return 'adc_user';
}

async function resolveRuntimeAuditAuth(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const env = payload.env && typeof payload.env === 'object' ? payload.env : process.env;
  const authPathMap = buildAuthPathMap({ env });
  const authMode = resolveAuthMode(authPathMap);
  const preflight = await runLocalPreflight({
    env,
    allowGcloudProjectIdDetect: true
  });
  const summary = preflight && preflight.summary && typeof preflight.summary === 'object'
    ? preflight.summary
    : {};

  if (preflight && preflight.ready === true) {
    return {
      ok: true,
      authMode,
      authPathMap,
      preflight
    };
  }

  return {
    ok: false,
    authMode,
    authPathMap,
    preflight,
    runtimeFetchStatus: 'unavailable',
    runtimeFetchErrorCode: summary.code || 'runtime_audit_auth_unavailable',
    runtimeFetchErrorMessage: summary.cause || summary.rawHint || 'Runtime audit authentication unavailable.',
    recoveryActionCode: summary.recoveryActionCode || null,
    recoveryCommands: Array.isArray(summary.recoveryCommands) ? summary.recoveryCommands.slice() : []
  };
}

module.exports = {
  IMPERSONATION_ENV_KEYS,
  buildAuthPathMap,
  resolveAuthMode,
  resolveRuntimeAuditAuth
};
