#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const { execFileSync } = require('child_process');

function usage() {
  console.error('Usage: node scripts/phase21_dump_cta_stat_doc.js FROM_UTC TO_UTC');
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

function fetchJson(url, token, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '[]');
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return Boolean(value.booleanValue);
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.mapValue && value.mapValue.fields) {
    const out = {};
    for (const [key, entry] of Object.entries(value.mapValue.fields)) {
      out[key] = decodeValue(entry);
    }
    return out;
  }
  if (value.arrayValue && Array.isArray(value.arrayValue.values)) {
    return value.arrayValue.values.map((entry) => decodeValue(entry));
  }
  return null;
}

function decodeFields(fields) {
  const out = {};
  const source = fields || {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = decodeValue(value);
  }
  return out;
}

function readFieldString(fields, name) {
  if (!fields || !fields[name] || fields[name].stringValue === undefined) return null;
  return fields[name].stringValue;
}

function readFieldNumber(fields, name) {
  if (!fields || !fields[name]) return null;
  if (fields[name].integerValue !== undefined) return Number(fields[name].integerValue);
  if (fields[name].doubleValue !== undefined) return Number(fields[name].doubleValue);
  return null;
}

function readFieldTimestamp(fields, name) {
  if (!fields || !fields[name] || !fields[name].timestampValue) return null;
  return fields[name].timestampValue;
}

function extractDocId(name) {
  if (!name) return null;
  const parts = String(name).split('/');
  return parts[parts.length - 1] || null;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    usage();
    process.exit(1);
  }
  const fromUtc = args[0];
  const toUtc = args[1];

  const projectId = resolveProjectId();
  const token = getAccessToken();

  const body = {
    structuredQuery: {
      from: [{ collectionId: 'phase18_cta_stats' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'createdAt' },
                op: 'GREATER_THAN_OR_EQUAL',
                value: { timestampValue: fromUtc }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: 'createdAt' },
                op: 'LESS_THAN_OR_EQUAL',
                value: { timestampValue: toUtc }
              }
            }
          ]
        }
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }],
      limit: 5
    }
  };

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const results = await fetchJson(url, token, body);

  const docs = [];
  for (const entry of results) {
    if (!entry || !entry.document) continue;
    const doc = entry.document;
    const fields = doc.fields || {};
    const derivedCounts = {};
    for (const key of Object.keys(fields)) {
      if (/^(sentCount|clickCount)(A|B)$/.test(key)) {
        derivedCounts[key] = decodeValue(fields[key]);
      }
    }
    docs.push({
      id: extractDocId(doc.name),
      notificationId: readFieldString(fields, 'notificationId'),
      createdAt: readFieldTimestamp(fields, 'createdAt'),
      ctaText: readFieldString(fields, 'ctaText'),
      linkRegistryId: readFieldString(fields, 'linkRegistryId'),
      sentCount: readFieldNumber(fields, 'sentCount'),
      clickCount: readFieldNumber(fields, 'clickCount'),
      derivedCounts,
      raw: decodeFields(fields)
    });
  }

  const result = {
    utc: new Date().toISOString(),
    projectId,
    fromUtc,
    toUtc,
    filterField: 'createdAt',
    count: docs.length,
    docs
  };

  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
