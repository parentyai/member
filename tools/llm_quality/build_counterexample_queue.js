'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('./lib');

const DEFAULT_LIMIT = 30;

function classifyCounterexample(entry) {
  const signal = String((entry && entry.signal) || '').toLowerCase();
  const category = String((entry && entry.category) || '').toLowerCase();
  if (signal.includes('default_casual') || category.includes('loop')) {
    return {
      counterexampleId: 'CE-06',
      owner: 'conversation_orchestrator',
      remediation: 'reduce generic clarify loops and prioritize contextual direct answers'
    };
  }
  if (signal.includes('legacytemplate') || signal.includes('japanese_service')) {
    return {
      counterexampleId: 'CE-04',
      owner: 'style_engine',
      remediation: 'enforce Japanese service style guard and concise natural phrasing'
    };
  }
  if (signal.includes('minority') || signal.includes('cultural')) {
    return {
      counterexampleId: 'CE-03',
      owner: 'quality_eval',
      remediation: 'extend minority/cultural fixtures and reweight slice checks'
    };
  }
  if (signal.includes('profile') || signal.includes('memory') || category.includes('context_loss')) {
    return {
      counterexampleId: 'CE-01',
      owner: 'memory_policy',
      remediation: 'prioritize current turn and contextual lane over stale profile memory'
    };
  }
  if (signal.includes('freshness') || signal.includes('source') || signal.includes('retrieve')) {
    return {
      counterexampleId: 'CE-08',
      owner: 'retrieval_verification',
      remediation: 'tighten source freshness/authority checks and downgrade stale evidence'
    };
  }
  return {
    counterexampleId: 'CE-02',
    owner: 'audit_traceability',
    remediation: 'improve trace completeness and action-level evidence references'
  };
}

function severityRank(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'high') return 0;
  if (v === 'medium') return 1;
  return 2;
}

function buildQueue(registerPayload, limit) {
  const register = registerPayload && typeof registerPayload === 'object' ? registerPayload : {};
  const latest = register.latest && typeof register.latest === 'object' ? register.latest : {};
  const entries = Array.isArray(latest.entries) ? latest.entries : [];
  const max = Math.max(1, Math.floor(Number(limit) || DEFAULT_LIMIT));

  const queue = [];
  const seen = new Set();
  entries
    .slice()
    .sort((a, b) => {
      const severityCmp = severityRank(a && a.severity) - severityRank(b && b.severity);
      if (severityCmp !== 0) return severityCmp;
      return Number((a && a.rank) || 99) - Number((b && b.rank) || 99);
    })
    .forEach((entry) => {
      const mapping = classifyCounterexample(entry);
      const signal = String((entry && entry.signal) || 'unknown');
      const key = `${mapping.counterexampleId}:${signal}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push({
        counterexampleId: mapping.counterexampleId,
        signal,
        category: entry && entry.category ? String(entry.category) : 'unknown',
        severity: entry && entry.severity ? String(entry.severity) : 'low',
        owner: mapping.owner,
        remediation: mapping.remediation,
        status: 'open'
      });
    });

  return queue.slice(0, max);
}

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const registerPath = args.register
    ? path.resolve(root, args.register)
    : path.join(root, 'tmp', 'llm_quality_failure_register.json');
  const outPath = args.output
    ? path.resolve(root, args.output)
    : path.join(root, 'tmp', 'llm_quality_counterexample_queue.json');
  const limit = Math.max(1, Math.floor(Number(args.limit) || DEFAULT_LIMIT));

  const register = readJson(registerPath);
  const queue = buildQueue(register, limit);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: registerPath,
    latestFailureSnapshotId: register && register.latest ? register.latest.id : null,
    queue
  };
  writeJson(outPath, payload);
  process.stdout.write(`${JSON.stringify({ ok: true, outPath, queueSize: queue.length }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  classifyCounterexample,
  buildQueue,
  main
};
