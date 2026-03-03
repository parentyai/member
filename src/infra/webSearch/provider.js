'use strict';

const DEFAULT_TIMEOUT_MS = 2000;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveTimeoutMs(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.floor(n), 10000);
}

function normalizeProviderItem(item) {
  const row = item && typeof item === 'object' ? item : {};
  const url = normalizeText(row.url);
  if (!url) return null;
  return {
    url,
    title: normalizeText(row.title),
    snippet: normalizeText(row.snippet),
    source: 'web_search',
    sourceType: normalizeText(row.sourceType).toLowerCase() || 'other',
    domainClass: normalizeText(row.domainClass).toLowerCase() || 'unknown'
  };
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    return { ok: false, status: res.status, body: null };
  }
  try {
    const body = await res.json();
    return { ok: true, status: res.status, body };
  } catch (_err) {
    return { ok: false, status: res.status, body: null };
  }
}

async function searchWebCandidates(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const env = payload.env && typeof payload.env === 'object' ? payload.env : process.env;
  const provider = normalizeText(env.WEB_SEARCH_PROVIDER || payload.provider).toLowerCase();
  if (!provider || provider === 'none' || provider === 'disabled') {
    return { ok: false, reason: 'provider_unconfigured', candidates: [] };
  }

  if (provider !== 'http_json') {
    return { ok: false, reason: 'provider_not_supported', candidates: [] };
  }

  const endpoint = normalizeText(env.WEB_SEARCH_ENDPOINT || payload.endpoint);
  if (!endpoint) {
    return { ok: false, reason: 'endpoint_missing', candidates: [] };
  }

  const query = normalizeText(payload.query);
  if (!query) {
    return { ok: false, reason: 'query_missing', candidates: [] };
  }

  const timeoutMs = resolveTimeoutMs(env.WEB_SEARCH_TIMEOUT_MS || payload.timeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const reqBody = {
      query,
      locale: normalizeText(payload.locale) || 'ja',
      limit: Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(10, Math.floor(Number(payload.limit)))) : 5
    };
    const response = await fetchJson(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(reqBody),
      signal: controller.signal
    });

    if (!response.ok || !response.body || !Array.isArray(response.body.items)) {
      return { ok: false, reason: 'provider_error', candidates: [] };
    }

    const items = response.body.items
      .map((item) => normalizeProviderItem(item))
      .filter(Boolean)
      .slice(0, reqBody.limit);

    return {
      ok: true,
      reason: null,
      candidates: items
    };
  } catch (_err) {
    return { ok: false, reason: 'provider_exception', candidates: [] };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  searchWebCandidates
};
