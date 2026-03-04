'use strict';

const SHORTENER_HOSTS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly'
]);

const MAJOR_MEDIA_HOSTS = new Set([
  'nytimes.com',
  'cnn.com',
  'bbc.com',
  'bbc.co.uk',
  'reuters.com',
  'apnews.com',
  'wsj.com',
  'npr.org'
]);

const NON_PROFIT_ORG_HOSTS = new Set([
  'who.int',
  'cdc.gov',
  'nih.gov',
  'redcross.org',
  'un.org',
  'oecd.org'
]);

const SUSPICIOUS_TLDS = new Set([
  'zip',
  'click',
  'work',
  'top',
  'xyz',
  'gq',
  'tk',
  'cf',
  'ml',
  'ga'
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeHost(hostname) {
  return normalizeText(hostname).toLowerCase();
}

function hostEndsWith(host, suffix) {
  return host === suffix || host.endsWith(`.${suffix}`);
}

function isKnownShortener(host) {
  return SHORTENER_HOSTS.has(host);
}

function isIpLiteral(host) {
  if (!host) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(':')) return true;
  return false;
}

function isSpoofedAuthorityHost(host) {
  if (!host) return false;
  if (hostEndsWith(host, 'gov') || hostEndsWith(host, 'mil') || hostEndsWith(host, 'edu')) return false;
  return /(?:^|\.)(?:gov|mil|edu)\./.test(host);
}

function parseUrl(url) {
  const text = normalizeText(url);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const host = normalizeHost(parsed.hostname);
    if (!host) return null;
    return {
      url: parsed.toString(),
      protocol: parsed.protocol,
      host,
      path: parsed.pathname || '/',
      username: normalizeText(parsed.username),
      password: normalizeText(parsed.password)
    };
  } catch (_err) {
    return null;
  }
}

function rankBySource(candidate, host) {
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const domainClass = normalizeText(payload.domainClass).toLowerCase();
  const sourceType = normalizeText(payload.sourceType).toLowerCase();

  if (['gov', 'k12_district', 'school_public'].includes(domainClass)) return 'R0';
  if (hostEndsWith(host, 'gov') || hostEndsWith(host, 'mil') || hostEndsWith(host, 'edu')) return 'R0';

  if (sourceType === 'semi_official') return 'R1';
  if (sourceType === 'official') return 'R1';
  if (NON_PROFIT_ORG_HOSTS.has(host)) return 'R1';
  if (MAJOR_MEDIA_HOSTS.has(host)) return 'R2';

  return 'R3';
}

function rejectDecision(base, reason) {
  return Object.assign({}, base, {
    ok: false,
    allowed: false,
    rank: 'R3',
    reason
  });
}

function evaluateCandidate(candidate, options) {
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const source = normalizeText(payload.source || payload.sourceType || 'unknown') || 'unknown';
  const denylist = Array.isArray(options && options.denylist)
    ? options.denylist.map((item) => normalizeText(item).toLowerCase()).filter(Boolean)
    : [];

  const finalRaw = normalizeText(payload.finalUrl || payload.resolvedUrl);
  const parseTarget = finalRaw || normalizeText(payload.url);
  const parsed = parseUrl(parseTarget);

  if (!parsed) {
    return rejectDecision({
      domain: null,
      path: null,
      url: parseTarget,
      source,
      title: normalizeText(payload.title),
      snippet: normalizeText(payload.snippet)
    }, 'url_invalid');
  }

  const host = parsed.host;
  const base = {
    domain: host,
    path: parsed.path,
    url: parsed.url,
    originalUrl: normalizeText(payload.url),
    finalUrl: finalRaw || parsed.url,
    source,
    title: normalizeText(payload.title),
    snippet: normalizeText(payload.snippet)
  };

  if (isKnownShortener(host)) return rejectDecision(base, 'short_url_blocked');
  if (parsed.username || parsed.password) return rejectDecision(base, 'auth_url_blocked');
  if (isIpLiteral(host)) return rejectDecision(base, 'ip_literal_blocked');
  if (isSpoofedAuthorityHost(host)) return rejectDecision(base, 'spoofed_domain_blocked');

  const suffix = host.includes('.') ? host.split('.').pop() : '';
  if (SUSPICIOUS_TLDS.has(suffix)) return rejectDecision(base, 'suspicious_tld_blocked');

  if (denylist.some((entry) => host === entry || host.endsWith(`.${entry}`))) {
    return rejectDecision(base, 'denylist_blocked');
  }

  const rank = rankBySource(payload, host);
  return Object.assign({}, base, {
    ok: true,
    allowed: true,
    rank,
    reason: 'accepted'
  });
}

function selectUrls(candidates, policy, options) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const allowedRanks = Array.isArray(policy && policy.allowedRanks) ? policy.allowedRanks : [];
  const maxUrls = Number.isFinite(Number(policy && policy.maxUrls)) ? Math.max(0, Math.floor(Number(policy.maxUrls))) : 0;

  const decisions = [];
  const selected = [];
  const dedupe = new Set();

  rows.forEach((row) => {
    const evaluated = evaluateCandidate(row, options);
    let allowed = evaluated.allowed;
    let reason = evaluated.reason;

    if (allowed && !allowedRanks.includes(evaluated.rank)) {
      allowed = false;
      reason = 'rank_not_allowed';
    }

    if (allowed) {
      const key = `${evaluated.domain || ''}${evaluated.path || ''}`.toLowerCase();
      if (dedupe.has(key)) {
        allowed = false;
        reason = 'duplicate_url';
      } else {
        dedupe.add(key);
      }
    }

    const decision = Object.assign({}, evaluated, {
      allowed,
      reason
    });
    decisions.push(decision);

    if (allowed && selected.length < maxUrls) {
      selected.push(decision);
    }
  });

  return {
    selected,
    decisions
  };
}

module.exports = {
  evaluateCandidate,
  selectUrls,
  isIpLiteral,
  isSpoofedAuthorityHost
};
