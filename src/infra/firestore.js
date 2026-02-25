'use strict';

const { execFileSync } = require('node:child_process');

let adminCache = null;
let testDb = null;
let serverTimestampOverride = null;
const PROJECT_ID_ENV_KEYS = Object.freeze([
  'FIRESTORE_PROJECT_ID',
  'GOOGLE_CLOUD_PROJECT',
  'GCLOUD_PROJECT',
  'GCP_PROJECT'
]);

function getAdmin() {
  if (adminCache) return adminCache;
  adminCache = require('firebase-admin');
  return adminCache;
}

function resolveFirestoreProjectId(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const envSource = opts.env && typeof opts.env === 'object' ? opts.env : process.env;
  const allowGcloud = opts.allowGcloud !== false;
  const execFile = typeof opts.execFileSync === 'function' ? opts.execFileSync : execFileSync;

  for (const key of PROJECT_ID_ENV_KEYS) {
    const raw = typeof envSource[key] === 'string' ? envSource[key].trim() : '';
    if (raw) {
      return { projectId: raw, source: `env:${key}` };
    }
  }

  if (allowGcloud) {
    try {
      const raw = String(execFile('gcloud', ['config', 'get-value', 'project', '--quiet'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }) || '').trim();
      if (raw && raw !== '(unset)') {
        return { projectId: raw, source: 'gcloud:config.project' };
      }
    } catch (_err) {
      // ignore gcloud resolution errors and continue with unresolved state
    }
  }

  return { projectId: null, source: 'unresolved' };
}

function getDb() {
  if (testDb) return testDb;
  const admin = getAdmin();
  if (admin.apps.length === 0) {
    const resolved = resolveFirestoreProjectId();
    if (resolved.projectId) admin.initializeApp({ projectId: resolved.projectId });
    else admin.initializeApp();
  }
  return admin.firestore();
}

function serverTimestamp() {
  if (serverTimestampOverride !== null) return serverTimestampOverride;
  const admin = getAdmin();
  return admin.firestore.FieldValue.serverTimestamp();
}

function setDbForTest(db) {
  testDb = db;
}

function clearDbForTest() {
  testDb = null;
}

function setServerTimestampForTest(value) {
  serverTimestampOverride = value;
}

function clearServerTimestampForTest() {
  serverTimestampOverride = null;
}

module.exports = {
  getDb,
  resolveFirestoreProjectId,
  serverTimestamp,
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
};
