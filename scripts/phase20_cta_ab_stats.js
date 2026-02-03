#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const { execFileSync } = require('child_process');

function usage() {
  console.error('Usage: node scripts/phase20_cta_ab_stats.js "CTA_TEXT_A" "CTA_TEXT_B"');
}

function buildGcloudEnv() {
  const env = Object.assign({}, process.env);
  if (env.GOOGLE_APPLICATION_CREDENTIALS && !fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  return env;
}

function runGcloud(args) {
  return execFileSync('gcloud', args, { encoding: 'utf8', env: buildGcloudEnv() }).trim();
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

function readFieldString(field) {
  if (!field) return null;
  if (typeof field.stringValue === 'string') return field.stringValue;
  return null;
}

function readFieldNumber(field) {
  if (!field) return 0;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return Number(field.doubleValue);
  return 0;
}

function fetchJson(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    usage();
    process.exit(1);
  }
  const ctaTextA = args[0];
  const ctaTextB = args[1];

  const projectId = resolveProjectId();
  const token = getAccessToken();
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/phase18_cta_stats`;

  let pageToken = '';
  let sentA = 0;
  let clickA = 0;
  let sentB = 0;
  let clickB = 0;
  let totalDocs = 0;

  while (true) {
    const url = pageToken ? `${baseUrl}?pageSize=1000&pageToken=${encodeURIComponent(pageToken)}` : `${baseUrl}?pageSize=1000`;
    const data = await fetchJson(url, token);
    const docs = Array.isArray(data.documents) ? data.documents : [];
    docs.forEach((doc) => {
      totalDocs += 1;
      const fields = doc.fields || {};
      const ctaText = readFieldString(fields.ctaText);
      const sent = readFieldNumber(fields.sentCount);
      const click = readFieldNumber(fields.clickCount);
      if (ctaText === ctaTextA) {
        sentA += sent;
        clickA += click;
      }
      if (ctaText === ctaTextB) {
        sentB += sent;
        clickB += click;
      }
    });
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  const result = {
    utc: new Date().toISOString(),
    projectId,
    ctaTextA,
    ctaTextB,
    sentCountA: sentA,
    clickCountA: clickA,
    sentCountB: sentB,
    clickCountB: clickB,
    scannedDocs: totalDocs
  };

  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
