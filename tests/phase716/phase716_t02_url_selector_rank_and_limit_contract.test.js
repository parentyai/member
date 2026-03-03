'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { selectUrls } = require('../../src/domain/llm/urlRanker');

test('phase716: Mode B rejects R2/R3 and blocks short URLs/denylist/suspicious TLD', () => {
  const candidates = [
    { url: 'https://www.uscis.gov/forms', sourceType: 'official', source: 'stored' },
    { url: 'https://www.reuters.com/world', sourceType: 'other', source: 'web_search' },
    { url: 'https://bit.ly/abc123', sourceType: 'other', source: 'web_search' },
    { url: 'https://malicious.example.xyz/path', sourceType: 'other', source: 'web_search' },
    { url: 'https://blocked.example.com/path', sourceType: 'official', source: 'stored' }
  ];

  const { selected, decisions } = selectUrls(candidates, {
    maxUrls: 3,
    allowedRanks: ['R0', 'R1']
  }, {
    denylist: ['blocked.example.com']
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].domain, 'www.uscis.gov');

  const reasonSet = new Set(decisions.map((row) => row.reason));
  assert.ok(reasonSet.has('rank_not_allowed'));
  assert.ok(reasonSet.has('short_url_blocked'));
  assert.ok(reasonSet.has('suspicious_tld_blocked'));
  assert.ok(reasonSet.has('denylist_blocked'));
});

test('phase716: selected URLs never exceed max 3 and duplicates are suppressed', () => {
  const candidates = [
    { url: 'https://a.gov/path1', sourceType: 'official', source: 'stored' },
    { url: 'https://b.gov/path2', sourceType: 'official', source: 'stored' },
    { url: 'https://c.gov/path3', sourceType: 'official', source: 'stored' },
    { url: 'https://d.gov/path4', sourceType: 'official', source: 'stored' },
    { url: 'https://a.gov/path1', sourceType: 'official', source: 'stored' }
  ];

  const { selected, decisions } = selectUrls(candidates, {
    maxUrls: 3,
    allowedRanks: ['R0', 'R1', 'R2']
  }, {
    denylist: []
  });

  assert.equal(selected.length, 3);
  assert.equal(selected[0].domain, 'a.gov');
  assert.equal(selected[1].domain, 'b.gov');
  assert.equal(selected[2].domain, 'c.gov');
  assert.ok(decisions.some((row) => row.reason === 'duplicate_url'));
});
