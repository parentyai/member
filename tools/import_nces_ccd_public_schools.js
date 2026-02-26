'use strict';

const fs = require('fs');

function parseArgs(argv, env) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const sourceEnv = env && typeof env === 'object' ? env : process.env;
  const out = {
    serviceUrl: sourceEnv.CITY_PACK_SERVICE_URL || sourceEnv.SERVICE_URL || '',
    jobToken: sourceEnv.CITY_PACK_JOB_TOKEN || '',
    sourceUrl: '',
    csvPath: '',
    dryRun: false,
    regionKey: '',
    traceId: '',
    requestId: '',
    timeoutMs: 20000
  };

  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const next = i + 1 < args.length ? args[i + 1] : '';
    if (key === '--service-url') {
      out.serviceUrl = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--job-token') {
      out.jobToken = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--source-url') {
      out.sourceUrl = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--csv-path') {
      out.csvPath = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--region-key') {
      out.regionKey = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--trace-id') {
      out.traceId = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--request-id') {
      out.requestId = String(next || '').trim();
      i += 1;
      continue;
    }
    if (key === '--timeout-ms') {
      const ms = Number(next);
      if (Number.isFinite(ms) && ms > 0) out.timeoutMs = Math.floor(ms);
      i += 1;
      continue;
    }
    if (key === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    throw new Error(`unknown arg: ${key}`);
  }

  if (!out.serviceUrl) throw new Error('serviceUrl required');
  if (!out.jobToken) throw new Error('jobToken required');
  if (!out.sourceUrl && !out.csvPath) throw new Error('sourceUrl or csvPath required');
  out.serviceUrl = out.serviceUrl.replace(/\/+$/, '');
  if (!out.traceId) out.traceId = `trace-city-pack-municipality-schools-${Date.now()}`;
  return out;
}

async function loadCsv(options, deps) {
  if (options.csvPath) return fs.readFileSync(options.csvPath, 'utf8');
  const impl = deps && typeof deps === 'object' ? deps : {};
  const fetchFn = typeof impl.fetchFn === 'function' ? impl.fetchFn : (typeof fetch === 'function' ? fetch : null);
  if (!fetchFn) throw new Error('fetch unavailable');
  const response = await fetchFn(options.sourceUrl, {
    method: 'GET',
    headers: { 'user-agent': 'Member-NCES-CCD-Import/1.0' }
  });
  if (!response.ok) throw new Error(`source fetch failed: ${response.status}`);
  return response.text();
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quote && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quote = !quote;
      }
      continue;
    }
    if (ch === ',' && !quote) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeSchoolType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'public' || raw.includes('public')) return 'public';
  if (raw === 'private' || raw.includes('private')) return 'private';
  return raw;
}

function toRows(csvText, options) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((item) => item.toLowerCase());
  const indexOf = (names) => names
    .map((name) => headers.indexOf(name))
    .find((index) => index >= 0);

  const regionKeyIndex = indexOf(['regionkey', 'region_key']);
  const nameIndex = indexOf(['name', 'school_name', 'schoolname']);
  const districtIndex = indexOf(['district', 'district_name', 'lea_name', 'leaname']);
  const sourceUrlIndex = indexOf(['sourceurl', 'source_url', 'website', 'school_url']);
  const sourceLinkRegistryIdIndex = indexOf(['sourcelinkregistryid', 'source_link_registry_id']);
  const schoolTypeIndex = indexOf(['schooltype', 'school_type', 'type']);
  const fallbackRegionKey = options.regionKey ? options.regionKey.toLowerCase() : null;

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const regionKey = regionKeyIndex >= 0 ? String(cells[regionKeyIndex] || '').trim().toLowerCase() : fallbackRegionKey;
    const name = nameIndex >= 0 ? String(cells[nameIndex] || '').trim() : '';
    const district = districtIndex >= 0 ? String(cells[districtIndex] || '').trim() : '';
    const sourceUrl = sourceUrlIndex >= 0 ? String(cells[sourceUrlIndex] || '').trim() : '';
    const sourceLinkRegistryId = sourceLinkRegistryIdIndex >= 0 ? String(cells[sourceLinkRegistryIdIndex] || '').trim() : '';
    const schoolType = schoolTypeIndex >= 0 ? normalizeSchoolType(cells[schoolTypeIndex]) : null;
    return {
      regionKey,
      name,
      district,
      sourceUrl: sourceUrl || null,
      sourceLinkRegistryId: sourceLinkRegistryId || null,
      schoolType
    };
  }).filter((row) => {
    if (!row.regionKey || !row.name || !row.district || !(row.sourceUrl || row.sourceLinkRegistryId)) return false;
    if (row.schoolType && row.schoolType === 'private') return false;
    return true;
  });
}

async function invokeImportJob(options, rows, deps) {
  const impl = deps && typeof deps === 'object' ? deps : {};
  const fetchFn = typeof impl.fetchFn === 'function' ? impl.fetchFn : (typeof fetch === 'function' ? fetch : null);
  if (!fetchFn) throw new Error('fetch unavailable');
  const endpoint = `${options.serviceUrl}/internal/jobs/municipality-schools-import`;
  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': options.jobToken,
      'x-trace-id': options.traceId
    },
    body: JSON.stringify({
      rows,
      dryRun: options.dryRun,
      regionKey: options.regionKey || null,
      traceId: options.traceId,
      requestId: options.requestId || null
    })
  });
  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (_err) {
    parsed = { ok: false, error: 'invalid_json_response', raw: text };
  }
  return {
    ok: response.ok && parsed && parsed.ok === true,
    status: response.status,
    endpoint,
    sentRows: rows.length,
    response: parsed
  };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2), process.env);
    const csvText = await loadCsv(options);
    const rows = toRows(csvText, options);
    if (!rows.length) throw new Error('no valid rows parsed');
    const result = await invokeImportJob(options, rows);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error: err && err.message ? err.message : 'runner_error'
    })}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  splitCsvLine,
  toRows,
  invokeImportJob
};
