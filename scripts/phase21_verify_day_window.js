#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const { execFileSync } = require('child_process');

const notificationsRepo = require('../src/repos/firestore/notificationsRepo');
const { testSendNotification } = require('../src/usecases/notifications/testSendNotification');

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
  return args;
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
  return notificationsRepo.createNotification({
    title: `phase21 verify ${ctaText}`,
    body: 'click: https://example.com',
    ctaText,
    linkRegistryId,
    scenarioKey: 'A',
    stepKey: '3mo'
  });
}

async function createDelivery(notificationId, lineUserId) {
  const result = await testSendNotification({
    lineUserId,
    text: 'phase21 verify send',
    notificationId,
    pushFn: async () => {}
  });
  return result.id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const defaults = utcRangeDefaults();

  const fromUtc = args.fromUtc || defaults.fromUtc;
  const toUtc = args.toUtc || defaults.toUtc;
  const trackBaseUrl = args.trackBaseUrl;
  const linkRegistryId = args.linkRegistryId;

  if (!trackBaseUrl) {
    console.error('trackBaseUrl required');
    process.exit(1);
  }
  if (!linkRegistryId) {
    console.error('linkRegistryId required');
    process.exit(1);
  }

  console.log(JSON.stringify({ trackBaseUrl, fromUtc, toUtc, linkRegistryId }));

  const tag = timestampTag();
  let deliveryIdA = args.deliveryIdA || null;
  let deliveryIdB = args.deliveryIdB || null;
  let notificationIdA = null;
  let notificationIdB = null;

  if (!deliveryIdA || !deliveryIdB) {
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
    process.exit(2);
  }

  const pass = Number(stats.sentCountA) >= 1
    && Number(stats.sentCountB) >= 1
    && Number(stats.clickCountA) >= 1
    && Number(stats.clickCountB) >= 1;

  if (!pass) {
    console.log(`STOP: sentCountA=${stats.sentCountA} sentCountB=${stats.sentCountB} clickCountA=${stats.clickCountA} clickCountB=${stats.clickCountB}`);
    console.log('Phase21 VERIFY day-window FAIL');
    process.exit(2);
  }

  console.log('Phase21 VERIFY day-window PASS');
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
