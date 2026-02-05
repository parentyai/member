#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const { execFileSync } = require('child_process');

let notificationsRepo = null;
let testSendNotification = null;

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

  if (!deliveryIdA || !deliveryIdB) {
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
