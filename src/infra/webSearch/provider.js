'use strict';

const DEFAULT_TIMEOUT_MS = 2000;
const MAX_REDIRECT_HOPS = 3;

const SHORTENER_HOSTS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly'
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeHost(value) {
  return normalizeText(value).toLowerCase();
}

function resolveTimeoutMs(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.floor(n), 10000);
}

function parseHttpUrl(value) {
  const text = normalizeText(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed;
  } catch (_err) {
    return null;
  }
}

function isShortenerHost(host) {
  const normalized = normalizeHost(host);
  return SHORTENER_HOSTS.has(normalized);
}

function isIpLiteral(hostname) {
  const host = normalizeHost(hostname);
  if (!host) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(':')) return true;
  return false;
}

function hasAuthInfo(parsedUrl) {
  if (!parsedUrl) return false;
  return Boolean(parsedUrl.username || parsedUrl.password);
}

async function fetchWithTimeout(url, init, timeoutMs, fetchFn) {
  const executor = typeof fetchFn === 'function' ? fetchFn : fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const mergedInit = Object.assign({}, init || {}, { signal: controller.signal });
    const res = await executor(url, mergedInit);
    return { ok: true, response: res };
  } catch (err) {
    return {
      ok: false,
      error: err && err.name === 'AbortError' ? 'timeout' : 'fetch_error'
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeRedirectStep(url, timeoutMs, fetchFn) {
  const head = await fetchWithTimeout(url, {
    method: 'HEAD',
    redirect: 'manual',
    headers: {
      accept: 'text/html,application/json;q=0.9,*/*;q=0.8'
    }
  }, timeoutMs, fetchFn);
  if (!head.ok) return head;

  if (head.response && head.response.status === 405) {
    return fetchWithTimeout(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8'
      }
    }, timeoutMs, fetchFn);
  }

  return head;
}

function resolveRedirectLocation(currentUrl, locationValue) {
  const location = normalizeText(locationValue);
  if (!location) return null;
  try {
    return new URL(location, currentUrl).toString();
  } catch (_err) {
    return null;
  }
}

async function resolveFinalUrl(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const timeoutMs = resolveTimeoutMs(payload.timeoutMs);
  const fetchFn = payload.fetchFn;

  const startParsed = parseHttpUrl(payload.url);
  if (!startParsed) return { ok: false, reason: 'final_url_invalid', finalUrl: '' };
  if (isShortenerHost(startParsed.hostname)) {
    return { ok: false, reason: 'short_url_blocked', finalUrl: startParsed.toString() };
  }
  if (hasAuthInfo(startParsed)) {
    return { ok: false, reason: 'auth_url_blocked', finalUrl: startParsed.toString() };
  }
  if (isIpLiteral(startParsed.hostname)) {
    return { ok: false, reason: 'ip_literal_blocked', finalUrl: startParsed.toString() };
  }

  let current = startParsed.toString();
  const visited = new Set([current]);

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const parsedCurrent = parseHttpUrl(current);
    if (!parsedCurrent) return { ok: false, reason: 'final_url_invalid', finalUrl: current };
    if (isShortenerHost(parsedCurrent.hostname)) {
      return { ok: false, reason: 'short_url_blocked', finalUrl: parsedCurrent.toString() };
    }
    if (hasAuthInfo(parsedCurrent)) {
      return { ok: false, reason: 'auth_url_blocked', finalUrl: parsedCurrent.toString() };
    }
    if (isIpLiteral(parsedCurrent.hostname)) {
      return { ok: false, reason: 'ip_literal_blocked', finalUrl: parsedCurrent.toString() };
    }

    const probed = await probeRedirectStep(parsedCurrent.toString(), timeoutMs, fetchFn);
    if (!probed.ok) {
      return { ok: false, reason: 'provider_error', finalUrl: parsedCurrent.toString() };
    }

    const status = Number(probed.response && probed.response.status);
    if (status >= 300 && status < 400) {
      const next = resolveRedirectLocation(parsedCurrent.toString(), probed.response.headers.get('location'));
      if (!next) {
        return { ok: false, reason: 'provider_error', finalUrl: parsedCurrent.toString() };
      }
      if (visited.has(next)) {
        return { ok: false, reason: 'provider_error', finalUrl: parsedCurrent.toString() };
      }
      visited.add(next);
      current = next;
      continue;
    }

    return {
      ok: true,
      reason: null,
      finalUrl: parsedCurrent.toString(),
      finalHost: normalizeHost(parsedCurrent.hostname),
      finalPath: parsedCurrent.pathname || '/',
      redirectHops: hop
    };
  }

  return { ok: false, reason: 'provider_error', finalUrl: current };
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

async function fetchJson(url, options, fetchFn) {
  const executor = typeof fetchFn === 'function' ? fetchFn : fetch;
  const res = await executor(url, options);
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
    }, payload.fetchFn);

    if (!response.ok || !response.body || !Array.isArray(response.body.items)) {
      return { ok: false, reason: 'provider_error', candidates: [] };
    }

    const blockedReasons = [];
    const normalizedItems = response.body.items
      .map((item) => normalizeProviderItem(item))
      .filter(Boolean)
      .slice(0, reqBody.limit);

    const withFinal = [];
    for (const item of normalizedItems) {
      const resolved = await resolveFinalUrl({
        url: item.url,
        timeoutMs,
        fetchFn: payload.fetchFn
      });
      if (!resolved.ok) {
        blockedReasons.push(resolved.reason || 'provider_error');
        continue;
      }
      withFinal.push(Object.assign({}, item, {
        finalUrl: resolved.finalUrl,
        finalHost: resolved.finalHost,
        finalPath: resolved.finalPath,
        redirectHops: resolved.redirectHops
      }));
    }

    return {
      ok: true,
      reason: null,
      candidates: withFinal,
      blockedReasons: Array.from(new Set(blockedReasons.filter(Boolean)))
    };
  } catch (_err) {
    return { ok: false, reason: 'provider_exception', candidates: [] };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  searchWebCandidates,
  resolveFinalUrl,
  isIpLiteral,
  isShortenerHost
};
