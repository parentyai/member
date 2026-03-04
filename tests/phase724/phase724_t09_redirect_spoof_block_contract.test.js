'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveFinalUrl } = require('../../src/infra/webSearch/provider');
const { selectUrls } = require('../../src/domain/llm/urlRanker');

test('phase724: short URL is rejected before redirect resolution', async () => {
  const resolved = await resolveFinalUrl({ url: 'https://bit.ly/abc123' });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.reason, 'short_url_blocked');
});

test('phase724: redirect to spoofed authority domain is blocked by ranker', async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(String(url));
    if (String(url) === 'https://safe.example/start') {
      return new Response('', { status: 302, headers: { location: 'https://example.gov.evil.com/final' } });
    }
    return new Response('ok', { status: 200 });
  };

  const resolved = await resolveFinalUrl({
    url: 'https://safe.example/start',
    timeoutMs: 2000,
    fetchFn
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.finalHost, 'example.gov.evil.com');
  assert.equal(calls.length >= 2, true);

  const ranked = selectUrls([
    {
      url: 'https://safe.example/start',
      finalUrl: resolved.finalUrl,
      source: 'web_search',
      sourceType: 'official'
    }
  ], {
    maxUrls: 3,
    allowedRanks: ['R0', 'R1', 'R2']
  }, {
    denylist: []
  });

  assert.equal(ranked.selected.length, 0);
  assert.equal(ranked.decisions[0].reason, 'spoofed_domain_blocked');
});

test('phase724: redirect final host in suspicious TLD is blocked', async () => {
  const resolved = await resolveFinalUrl({
    url: 'https://safe.example/start',
    fetchFn: async (url) => {
      if (String(url) === 'https://safe.example/start') {
        return new Response('', { status: 302, headers: { location: 'https://landing.bad.xyz/offer' } });
      }
      return new Response('ok', { status: 200 });
    }
  });

  assert.equal(resolved.ok, true);

  const ranked = selectUrls([
    {
      url: 'https://safe.example/start',
      finalUrl: resolved.finalUrl,
      source: 'web_search',
      sourceType: 'other'
    }
  ], {
    maxUrls: 3,
    allowedRanks: ['R0', 'R1', 'R2']
  }, {
    denylist: []
  });

  assert.equal(ranked.selected.length, 0);
  assert.equal(ranked.decisions[0].reason, 'suspicious_tld_blocked');
});
