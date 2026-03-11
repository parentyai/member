'use strict';

const REQUIRED_HEADERS = Object.freeze([
  'row_id',
  'row_type',
  'canonical_key',
  'status',
  'source_ids_json',
  'city_pack_module_key'
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields.map((value) => value.trim());
}

function parseCsvText(csvText) {
  const text = String(csvText || '');
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
  return { headers, rows };
}

function ensureRequiredHeaders(headers) {
  const normalizedHeaders = Array.isArray(headers) ? headers.map((header) => normalizeText(header)).filter(Boolean) : [];
  const missing = REQUIRED_HEADERS.filter((header) => !normalizedHeaders.includes(header));
  if (missing.length) throw new Error(`singleSheet headers missing: ${missing.join(',')}`);
  return normalizedHeaders;
}

function normalizeRowType(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeViewType(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeStatus(value) {
  const status = normalizeText(value).toLowerCase();
  return status || 'draft';
}

function normalizeModule(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeSingleSheetRows(singleSheet) {
  const payload = singleSheet && typeof singleSheet === 'object' ? singleSheet : null;
  if (!payload) throw new Error('singleSheet required');
  if (typeof payload.csvText === 'string' && payload.csvText.trim()) {
    return parseCsvText(payload.csvText);
  }
  const headers = Array.isArray(payload.headers) ? payload.headers.slice() : [];
  const rows = Array.isArray(payload.rows) ? payload.rows.map((row) => (row && typeof row === 'object' ? row : {})) : [];
  return { headers, rows };
}

function adaptSingleSheetCityPackTemplate(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const parsed = normalizeSingleSheetRows(payload.singleSheet);
  const headers = ensureRequiredHeaders(parsed.headers);
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  if (!rows.length) throw new Error('singleSheet rows required');

  const cityPackViewRows = rows.filter((row) => (
    normalizeRowType(row.row_type) === 'VIEW'
    && normalizeViewType(row.view_type) === 'city_pack'
  ));
  if (!cityPackViewRows.length) throw new Error('singleSheet requires VIEW row with view_type=city_pack');

  const taskRows = rows.filter((row) => normalizeRowType(row.row_type) === 'TASK');
  const sourceRefs = [];
  const templateRefs = [];
  const modules = [];
  const recommendedTasks = [];
  const seenSourceRefs = new Set();
  const seenTemplateRefs = new Set();
  const seenModules = new Set();
  const seenRecommendedTaskSignatures = new Set();

  cityPackViewRows.forEach((row) => {
    const status = normalizeStatus(row.status);
    if (status === 'retired' || status === 'archived') return;
    const canonicalKey = normalizeText(row.canonical_key);
    if (canonicalKey && !seenTemplateRefs.has(canonicalKey)) {
      seenTemplateRefs.add(canonicalKey);
      templateRefs.push(canonicalKey);
    }
    const moduleKey = normalizeModule(row.city_pack_module_key);
    if (moduleKey && !seenModules.has(moduleKey)) {
      seenModules.add(moduleKey);
      modules.push(moduleKey);
    }
    const sourceIds = parseJsonArray(row.source_ids_json);
    sourceIds.forEach((sourceId) => {
      const normalized = normalizeText(String(sourceId || ''));
      if (!normalized || seenSourceRefs.has(normalized)) return;
      seenSourceRefs.add(normalized);
      sourceRefs.push(normalized);
    });
  });

  taskRows.forEach((row) => {
    const ruleId = normalizeText(row.canonical_key);
    if (!ruleId) return;
    const moduleKey = normalizeModule(row.city_pack_module_key) || null;
    const signature = `${ruleId}::${moduleKey || '-'}`;
    if (seenRecommendedTaskSignatures.has(signature)) return;
    seenRecommendedTaskSignatures.add(signature);
    recommendedTasks.push({ ruleId, module: moduleKey, priorityBoost: null });
  });

  const firstRow = cityPackViewRows[0] || {};
  const name = normalizeText(payload.templateName || payload.name || firstRow.title_short || firstRow.canonical_key);
  if (!name) throw new Error('singleSheet templateName required');

  const description = normalizeText(payload.description || firstRow.summary_md || '');
  return {
    template: {
      name,
      description,
      sourceRefs,
      validUntil: payload.validUntil || null,
      allowedIntents: ['CITY_PACK'],
      rules: [],
      targetingRules: [],
      slots: [],
      metadata: Object.assign({}, payload.metadata || {}, {
        importSource: 'single_sheet_v1',
        rowCount: rows.length,
        cityPackViewRowCount: cityPackViewRows.length,
        headerCount: headers.length
      }),
      templateRefs,
      modules,
      recommendedTasks,
      packClass: payload.packClass || 'regional',
      language: payload.language || 'ja',
      nationwidePolicy: payload.nationwidePolicy || null
    },
    importMeta: {
      rowCount: rows.length,
      cityPackViewRowCount: cityPackViewRows.length,
      taskRowCount: taskRows.length,
      headerCount: headers.length
    }
  };
}

module.exports = {
  REQUIRED_HEADERS,
  parseCsvLine,
  parseCsvText,
  adaptSingleSheetCityPackTemplate
};
