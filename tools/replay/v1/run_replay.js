'use strict';

const fs = require('fs');
const path = require('path');
const { filterWebhookEvents } = require('../../../src/v1/channel_edge/line/receiver');
const { InMemoryWebhookDedupeStore } = require('../../../src/v1/channel_edge/line/dedupeStore');

function loadFixture(name) {
  const filePath = path.join(__dirname, 'fixtures', `${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runOne(name) {
  const payload = loadFixture(name);
  const events = Array.isArray(payload.events) ? payload.events : [];
  const filtered = filterWebhookEvents(events, { dedupeStore: new InMemoryWebhookDedupeStore(24 * 60 * 60 * 1000), skewToleranceMs: 20000 });
  return {
    name,
    input: events.length,
    accepted: filtered.accepted.length,
    dropped: filtered.dropped.length,
    droppedReasons: Array.from(new Set(filtered.dropped.map((row) => row.reason))).sort()
  };
}

function main() {
  const names = ['webhook', 'liff_silent', 'stale_source', 'contradictory_source', 'group_privacy', 'minority_persona'];
  const results = names.map(runOne);
  const failed = results.filter((row) => row.accepted <= 0);
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  if (failed.length > 0) process.exit(1);
}

main();
