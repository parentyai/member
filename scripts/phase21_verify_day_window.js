#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const { execFileSync } = require('child_process');

let notificationsRepo = null;
let testSendNotification = null;

function runGcloud(args) {
  return execFileSync('gcloud', args, { encoding: 'utf8' }).trim();
}

function resolveProjectId() {
  if (process.env.FIRESTORE_PROJECT_ID && process.env.FIRESTORE_PROJECT_ID.trim()) {
    return process.env.FIRESTORE_PROJECT_ID.trim();
  }
  const value = runGcloud(['config', 'get-value', 'project']);
  if (!value || value === '(unset)') throw new Error('project id required');
  return value;
}

function getAccessToken() {
  return runGcloud(['auth', 'print-access-token']);
}

function usage() {
  console.error('Usage: node scripts/phase21_verify_day_window.js --track-base-url "<url>" --linkRegistryId "<id>" [--fromUtc "<utc>"] [--toUtc "<utc>"] [--deliveryIdA "<id>"] [--deliveryIdB "<id>"]');
}

function loadFirestoreDeps() {
  if (notificationsRepo && testSendNotification) return;
  try {
    notificationsRepo = require('../src/repos/firestore/notificationsRepo');
    ({ testSendNotification } = require('../src/usecases/notifications/testSendNotification'));
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (err && err.code === 'MODULE_NOT_FOUND' && message.includes('firebase-admin')) {
      const error = new Error('VERIFY_ENV_ERROR: firebase-admin missing');
      error.code = 'VERIFY_ENV_ERROR';
      throw error;
    }
    throw err;
  }
}

async function withFirebaseAdmin(fn) {
  try {
    return await fn();
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (err && err.code === 'MODULE_NOT_FOUND' && message.includes('firebase-admin')) {
      const error = new Error('VERIFY_ENV_ERROR: firebase-admin missing');
      error.code = 'VERIFY_ENV_ERROR';
      throw error;
    }
    throw err;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const entry = argv[i];
    if (!entry.startsWith('--')) continue;
    const eq = entry.indexOf('=');
    if (eq !== -1) {
      args[entry.slice(2, eq)] = entry.slice(eq + 1);
      continue;
    }
    const key = entry.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  if (args['track-base-url'] && !args.trackBaseUrl) {
    args.trackBaseUrl = args['track-base-url'];
  }
  if (args['allow-gac'] && !args.allowGac) {
    args.allowGac = true;
  }
  return args;
}

function isGacBlocked(args, env) {
  return Boolean(env && env.GOOGLE_APPLICATION_CREDENTIALS) && !args.allowGac;
}

function isAdcReauthError(message) {
  const text = (message || '').toLowerCase();
  return text.includes('invalid_rapt')
    || text.includes('reauth related error')
    || text.includes('invalid_grant')
    || text.includes('getting metadata from plugin failed');
}

function utcRangeDefaults() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { fromUtc: from.toISOString(), toUtc: to.toISOString() };
}

function timestampTag() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
}

async function canUseFirebaseAdmin() {
  try {
    loadFirestoreDeps();
    if (!notificationsRepo || typeof notificationsRepo.getNotification !== 'function') {
      return true;
    }
    await withFirebaseAdmin(() => notificationsRepo.getNotification('phase21_verify_probe'));
    return true;
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (message.includes('Invalid contents in the credentials file')) return false;
    throw err;
  }
}

function postJson(url, payload) {
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body,
          httpVersion: res.httpVersion
        });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function formatHttpResponse(response) {
  const lines = [`HTTP/${response.httpVersion || '1.1'} ${response.statusCode || ''} ${response.statusMessage || ''}`.trim()];
  const headers = response.headers || {};
  Object.keys(headers).forEach((key) => {
    const value = headers[key];
    const rendered = Array.isArray(value) ? value.join(', ') : value;
    lines.push(`${key}: ${rendered}`);
  });
  lines.push('');
  if (response.body) lines.push(response.body);
  return lines.join('\n');
}

function firestoreFieldString(value) {
  return { stringValue: String(value) };
}

function firestoreFieldBool(value) {
  return { booleanValue: Boolean(value) };
}

function firestoreFieldTimestamp(value) {
  return { timestampValue: value };
}

function firestoreFieldNumber(value) {
  if (Number.isInteger(value)) return { integerValue: String(value) };
  return { doubleValue: Number(value) };
}

function firestoreReadNumber(field) {
  if (!field) return 0;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return Number(field.doubleValue);
  return 0;
}

function firestoreBaseUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function firestoreParseId(docName) {
  if (!docName) return null;
  const parts = String(docName).split('/');
  return parts[parts.length - 1] || null;
}

function firestoreRequest(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(data || '')
      }
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch (err) {
          return reject(err);
        }
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function firestoreCreateDoc(collection, fields) {
  const projectId = resolveProjectId();
  const token = getAccessToken();
  const url = `${firestoreBaseUrl(projectId)}/${collection}`;
  const res = await firestoreRequest('POST', url, token, { fields });
  if (!res || res.statusCode >= 300) {
    throw new Error('firestore create failed');
  }
  const id = firestoreParseId(res.body && res.body.name);
  return { id, fields: res.body && res.body.fields ? res.body.fields : null };
}

async function firestoreGetDoc(collection, id) {
  const projectId = resolveProjectId();
  const token = getAccessToken();
  const url = `${firestoreBaseUrl(projectId)}/${collection}/${id}`;
  const res = await firestoreRequest('GET', url, token);
  if (res && res.statusCode === 404) return null;
  if (!res || res.statusCode >= 300) {
    throw new Error('firestore get failed');
  }
  return res.body || null;
}

function buildUpdateMask(fields) {
  const keys = Object.keys(fields);
  return keys.map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&');
}

async function firestorePatchDoc(collection, id, fields) {
  const projectId = resolveProjectId();
  const token = getAccessToken();
  const mask = buildUpdateMask(fields);
  const url = `${firestoreBaseUrl(projectId)}/${collection}/${id}?${mask}`;
  const res = await firestoreRequest('PATCH', url, token, { fields });
  if (!res || res.statusCode >= 300) {
    throw new Error('firestore patch failed');
  }
  return res.body || null;
}

async function firestoreCreateDocWithId(collection, id, fields) {
  const projectId = resolveProjectId();
  const token = getAccessToken();
  const url = `${firestoreBaseUrl(projectId)}/${collection}?documentId=${encodeURIComponent(id)}`;
  const res = await firestoreRequest('POST', url, token, { fields });
  if (!res || res.statusCode >= 300) {
    throw new Error('firestore create with id failed');
  }
  return res.body || null;
}

async function createNotificationWithCta(ctaText, linkRegistryId) {
  loadFirestoreDeps();
  return withFirebaseAdmin(() => notificationsRepo.createNotification({
    title: `phase21 verify ${ctaText}`,
    body: 'click: https://example.com',
    ctaText,
    linkRegistryId,
    scenarioKey: 'A',
    stepKey: '3mo'
  }));
}

async function createNotificationWithCtaRest(ctaText, linkRegistryId) {
  const createdAt = new Date().toISOString();
  const fields = {
    title: firestoreFieldString(`phase21 verify ${ctaText}`),
    body: firestoreFieldString('click: https://example.com'),
    ctaText: firestoreFieldString(ctaText),
    linkRegistryId: firestoreFieldString(linkRegistryId),
    scenarioKey: firestoreFieldString('A'),
    stepKey: firestoreFieldString('3mo'),
    createdAt: firestoreFieldTimestamp(createdAt)
  };
  const result = await firestoreCreateDoc('notifications', fields);
  return { id: result.id, createdAt };
}

async function createDelivery(notificationId, lineUserId) {
  loadFirestoreDeps();
  const result = await withFirebaseAdmin(() => testSendNotification({
    lineUserId,
    text: 'phase21 verify send',
    notificationId,
    pushFn: async () => {}
  }));
  return result.id;
}

async function createDeliveryRest(notificationId, lineUserId) {
  const sentAt = new Date().toISOString();
  const fields = {
    notificationId: firestoreFieldString(notificationId),
    lineUserId: firestoreFieldString(lineUserId),
    sentAt: firestoreFieldTimestamp(sentAt),
    delivered: firestoreFieldBool(true)
  };
  const result = await firestoreCreateDoc('notification_deliveries', fields);
  return result.id;
}

async function recordSentRest(notificationId, ctaText, linkRegistryId, createdAt) {
  const existing = await firestoreGetDoc('phase18_cta_stats', notificationId);
  const existingFields = existing && existing.fields ? existing.fields : {};
  const prevSent = firestoreReadNumber(existingFields.sentCount);
  const prevClick = firestoreReadNumber(existingFields.clickCount);
  const updatedAt = new Date().toISOString();
  const fields = {
    notificationId: firestoreFieldString(notificationId),
    ctaText: firestoreFieldString(ctaText),
    linkRegistryId: firestoreFieldString(linkRegistryId),
    sentCount: firestoreFieldNumber(prevSent + 1),
    clickCount: firestoreFieldNumber(prevClick),
    updatedAt: firestoreFieldTimestamp(updatedAt)
  };
  const created = existingFields.createdAt ? existingFields.createdAt : firestoreFieldTimestamp(createdAt);
  if (created) fields.createdAt = created;
  if (existing) {
    await firestorePatchDoc('phase18_cta_stats', notificationId, fields);
    return;
  }
  await firestoreCreateDocWithId('phase18_cta_stats', notificationId, fields);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (isGacBlocked(args, process.env)) {
    console.error('VERIFY_ENV_ERROR: GOOGLE_APPLICATION_CREDENTIALS is set; unset it or use --allow-gac');
    process.exit(2);
  }
  const defaults = utcRangeDefaults();

  const fromUtc = args.fromUtc || defaults.fromUtc;
  const toUtc = args.toUtc || defaults.toUtc;
  const trackBaseUrl = args.trackBaseUrl || process.env.TRACK_BASE_URL;
  const linkRegistryId = args.linkRegistryId;

  if (!trackBaseUrl) {
    usage();
    console.error('trackBaseUrl required');
    console.error('exitCode=2 reason=trackBaseUrl_required');
    process.exit(2);
  }
  if (!linkRegistryId) {
    usage();
    console.error('linkRegistryId required');
    console.error('exitCode=2 reason=linkRegistryId_required');
    process.exit(2);
  }

  console.log(JSON.stringify({ trackBaseUrl, fromUtc, toUtc, linkRegistryId }));

  const tag = timestampTag();
  let deliveryIdA = args.deliveryIdA || null;
  let deliveryIdB = args.deliveryIdB || null;
  let notificationIdA = null;
  let notificationIdB = null;
  let createdAtA = null;
  let createdAtB = null;

  let restMode = process.env.PHASE21_VERIFY_REST === '1';
  if (!restMode) {
    restMode = !(await canUseFirebaseAdmin());
  }

  if (!deliveryIdA || !deliveryIdB) {
    if (restMode) {
      const notifA = await createNotificationWithCtaRest('openA', linkRegistryId);
      const notifB = await createNotificationWithCtaRest('openB', linkRegistryId);
      notificationIdA = notifA.id;
      notificationIdB = notifB.id;
      createdAtA = notifA.createdAt;
      createdAtB = notifB.createdAt;

      if (!deliveryIdA) {
        deliveryIdA = await createDeliveryRest(notificationIdA, 'U1');
      }
      if (!deliveryIdB) {
        deliveryIdB = await createDeliveryRest(notificationIdB, 'U2');
      }

      await recordSentRest(notificationIdA, 'openA', linkRegistryId, createdAtA);
      await recordSentRest(notificationIdB, 'openB', linkRegistryId, createdAtB);
    } else {
      loadFirestoreDeps();
      const notifA = await createNotificationWithCta('openA', linkRegistryId);
      const notifB = await createNotificationWithCta('openB', linkRegistryId);
      notificationIdA = notifA.id;
      notificationIdB = notifB.id;

      if (!deliveryIdA) {
        deliveryIdA = await createDelivery(notificationIdA, 'U1');
      }
      if (!deliveryIdB) {
        deliveryIdB = await createDelivery(notificationIdB, 'U2');
      }
    }

    const ids = {
      notificationIdA,
      deliveryIdA,
      ctaTextA: 'openA',
      notificationIdB,
      deliveryIdB,
      ctaTextB: 'openB',
      linkRegistryId
    };
    const idsPath = `/tmp/phase21_verify_ids_${tag}.json`;
    fs.writeFileSync(idsPath, JSON.stringify(ids));
    console.log(JSON.stringify({ created: ids, idsPath }));
  }

  const clickUrl = `${trackBaseUrl.replace(/\/$/, '')}/track/click`;

  const clickA = await postJson(clickUrl, { deliveryId: deliveryIdA, linkRegistryId });
  const clickAPath = `/tmp/phase21_verify_click_A_${tag}.txt`;
  fs.writeFileSync(clickAPath, formatHttpResponse(clickA));

  const clickB = await postJson(clickUrl, { deliveryId: deliveryIdB, linkRegistryId });
  const clickBPath = `/tmp/phase21_verify_click_B_${tag}.txt`;
  fs.writeFileSync(clickBPath, formatHttpResponse(clickB));

  const statsOutput = execFileSync(process.execPath, [
    'scripts/phase20_cta_ab_stats.js',
    'openA',
    'openB',
    fromUtc,
    toUtc
  ], { encoding: 'utf8' }).trim();

  const statsPath = `/tmp/phase21_verify_stats_${tag}.json`;
  fs.writeFileSync(statsPath, statsOutput);

  let stats = null;
  try {
    stats = JSON.parse(statsOutput);
  } catch (err) {
    console.error('STOP: stats parse error');
    console.error('exitCode=2 reason=stats_parse_error');
    process.exit(2);
  }

  const pass = Number(stats.sentCountA) >= 1
    && Number(stats.sentCountB) >= 1
    && Number(stats.clickCountA) >= 1
    && Number(stats.clickCountB) >= 1;

  if (!pass) {
    console.log(`STOP: sentCountA=${stats.sentCountA} sentCountB=${stats.sentCountB} clickCountA=${stats.clickCountA} clickCountB=${stats.clickCountB}`);
    console.error('exitCode=1 reason=thresholds_not_met');
    console.log('Phase21 VERIFY day-window FAIL');
    process.exit(1);
  }

  console.log('Phase21 VERIFY day-window PASS');
}

function handleMainError(err) {
  const message = err && err.message ? err.message : String(err);
  if (err && err.code === 'VERIFY_ENV_ERROR') {
    console.error(message);
    console.error('exitCode=2 reason=VERIFY_ENV_ERROR');
    process.exit(2);
  }
  if (isAdcReauthError(message)) {
    console.error('VERIFY_ENV_ERROR: ADC reauth required. Run: gcloud auth application-default login. If blocked, try a different account or service account.');
    console.error('exitCode=2 reason=VERIFY_ENV_ERROR');
    process.exit(2);
  }
  console.error(message);
  console.error('exitCode=1 reason=runtime_error');
  process.exit(1);
}

if (require.main === module) {
  main().catch(handleMainError);
}

module.exports = {
  loadFirestoreDeps,
  isGacBlocked,
  isAdcReauthError,
  main,
  handleMainError
};
