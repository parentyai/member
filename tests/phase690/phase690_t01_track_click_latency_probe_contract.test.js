'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

const probe = require('../../tools/track_click_latency_probe');

test('phase690: summarizeDurations computes percentile metrics', () => {
  const summary = probe.summarizeDurations([10, 20, 30, 40, 50]);
  assert.strictEqual(summary.min, 10);
  assert.strictEqual(summary.max, 50);
  assert.strictEqual(summary.avg, 30);
  assert.strictEqual(summary.p50, 30);
  assert.strictEqual(summary.p95, 50);
  assert.strictEqual(summary.p99, 50);
});

test('phase690: runProbe passes when status is 302 and p95 threshold is not exceeded', async (t) => {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/track/click') {
      res.writeHead(302, { location: 'https://example.com' });
      res.end();
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const report = await probe.runProbe({
    baseUrl: `http://127.0.0.1:${port}`,
    mode: 'post',
    deliveryId: 'd1',
    linkRegistryId: 'l1',
    count: 5,
    warmup: 1,
    timeoutMs: 3000,
    expectStatus: 302,
    maxP95Ms: 5000,
    tracePrefix: 'trace-phase690',
    bearerToken: null,
    allowStatusMismatch: false
  });

  assert.strictEqual(report.mismatchCount, 0);
  assert.strictEqual(report.statusCounts['302'], 5);
  assert.deepStrictEqual(report.stopReasons, []);
  assert.strictEqual(report.samples.length, 5);
});

test('phase690: runProbe reports stop reason when status mismatches expected code', async (t) => {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/track/click') {
      res.writeHead(302, { location: 'https://example.com' });
      res.end();
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const report = await probe.runProbe({
    baseUrl: `http://127.0.0.1:${port}`,
    mode: 'post',
    deliveryId: 'd1',
    linkRegistryId: 'l1',
    count: 3,
    warmup: 0,
    timeoutMs: 3000,
    expectStatus: 200,
    maxP95Ms: null,
    tracePrefix: 'trace-phase690',
    bearerToken: null,
    allowStatusMismatch: false
  });

  assert.strictEqual(report.mismatchCount, 3);
  assert.ok(report.stopReasons.includes('status_mismatch'));
});

