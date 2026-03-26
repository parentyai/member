'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { resolveAudienceView } = require('../../domain/qualityPatrol/query/resolveAudienceView');

const QUERY_VERSION = 'line_desktop_patrol_summary_v1';

function resolveArtifactRoot(deps) {
  const fromDeps = deps && typeof deps.artifactRoot === 'string' ? deps.artifactRoot.trim() : '';
  const fromEnv = typeof process.env.LINE_DESKTOP_PATROL_ARTIFACT_ROOT === 'string'
    ? process.env.LINE_DESKTOP_PATROL_ARTIFACT_ROOT.trim()
    : '';
  const base = fromDeps || fromEnv || path.resolve(__dirname, '..', '..', '..', 'artifacts', 'line_desktop_patrol');
  return path.resolve(base);
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readJsonLinesIfExists(filePath) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function readDirIfExists(dirPath) {
  try {
    return await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function statIfExists(targetPath) {
  try {
    return await fs.promises.stat(targetPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function parseDateMs(value) {
  if (!value) return 0;
  const numeric = Date.parse(String(value));
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolveSortKey(trace, stat) {
  if (trace && typeof trace === 'object') {
    const fromTrace = parseDateMs(
      trace.finished_at
      || trace.finishedAt
      || trace.started_at
      || trace.startedAt
      || null
    );
    if (fromTrace > 0) return fromTrace;
  }
  return stat ? Number(stat.mtimeMs || 0) : 0;
}

function normalizeText(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function compactDisplayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }
  return filePath.split(path.sep).join('/');
}

function redactedDisplayPath(filePath) {
  const normalized = compactDisplayPath(filePath).split('/').filter(Boolean);
  if (normalized.length <= 3) return normalized.join('/');
  return `.../${normalized.slice(-3).join('/')}`;
}

function toArtifactRef(kind, filePath, audience) {
  return {
    kind,
    displayPath: audience === 'operator' ? compactDisplayPath(filePath) : redactedDisplayPath(filePath),
    path: audience === 'operator' ? filePath : null
  };
}

function normalizeLatestRun(run) {
  if (!run || !run.trace || typeof run.trace !== 'object') return null;
  const trace = run.trace;
  return {
    runId: normalizeText(trace.run_id, run.runId),
    scenarioId: normalizeText(trace.scenario_id, null),
    targetId: normalizeText(trace.target_id, null),
    finishedAt: normalizeText(trace.finished_at || trace.finishedAt || trace.started_at || trace.startedAt, null),
    failureReason: normalizeText(trace.failure_reason || trace.failureReason, null)
  };
}

function summarizeLatestProposalIds(linkage, queueEntries) {
  const ids = [];
  const add = (value) => {
    if (typeof value !== 'string') return;
    const text = value.trim();
    if (!text || ids.includes(text)) return;
    ids.push(text);
  };

  if (linkage && typeof linkage === 'object') {
    (Array.isArray(linkage.queued_proposal_ids) ? linkage.queued_proposal_ids : []).forEach(add);
    (Array.isArray(linkage.duplicate_proposal_ids) ? linkage.duplicate_proposal_ids : []).forEach(add);
  }

  queueEntries.slice(-3).forEach((entry) => {
    if (entry && typeof entry === 'object') add(entry.proposal_id);
  });

  return ids;
}

function buildSummary(status, stage, latestRun, queueCount) {
  if (status === 'error') {
    return 'LINE Desktop Patrol の local artifact 読み込みに失敗しました。';
  }
  if (status === 'unavailable') {
    return 'このホストでは LINE Desktop Patrol の local artifact がまだ観測されていません。';
  }
  if (stage === 'trace_only') {
    return `latest run ${latestRun && latestRun.runId ? latestRun.runId : '-'} の trace はありますが、evaluation と proposal queue はまだありません。`;
  }
  if (stage === 'evaluated') {
    return `latest run ${latestRun && latestRun.runId ? latestRun.runId : '-'} は評価済みです。proposal queue はまだ空です。`;
  }
  if (stage === 'queued') {
    return `latest run ${latestRun && latestRun.runId ? latestRun.runId : '-'} から ${queueCount} 件の proposal が local queue に入っています。`;
  }
  return 'LINE Desktop Patrol の local state を確認してください。';
}

async function listRuns(artifactRoot) {
  const runsRoot = path.join(artifactRoot, 'runs');
  const entries = await readDirIfExists(runsRoot);
  const runs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runId = entry.name;
    const runRoot = path.join(runsRoot, runId);
    const tracePath = path.join(runRoot, 'trace.json');
    const trace = await readJsonIfExists(tracePath);
    if (!trace || typeof trace !== 'object') continue;
    const linkagePath = path.join(runRoot, 'proposal_linkage.json');
    const evalPath = path.join(artifactRoot, 'evals', runId, 'desktop_patrol_eval.json');
    const stat = await statIfExists(runRoot);
    runs.push({
      runId,
      runRoot,
      sortKey: resolveSortKey(trace, stat),
      tracePath,
      trace,
      linkagePath,
      linkage: await readJsonIfExists(linkagePath),
      evalPath,
      evaluation: await readJsonIfExists(evalPath)
    });
  }

  runs.sort((left, right) => {
    if (right.sortKey !== left.sortKey) return right.sortKey - left.sortKey;
    return String(right.runId).localeCompare(String(left.runId), 'ja');
  });
  return runs;
}

async function listPacketPaths(packetRoot) {
  const entries = await readDirIfExists(packetRoot);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.codex.json'))
    .map((entry) => path.join(packetRoot, entry.name))
    .sort((left, right) => left.localeCompare(right, 'ja'));
}

async function queryLatestDesktopPatrolSummary(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const artifactRoot = resolveArtifactRoot(deps);

  try {
    const runs = await listRuns(artifactRoot);
    const latestRunRecord = runs[0] || null;
    const latestRun = normalizeLatestRun(latestRunRecord);
    const queuePath = path.join(artifactRoot, 'proposals', 'queue.jsonl');
    const queueEntries = await readJsonLinesIfExists(queuePath);
    const latestQueueEntry = queueEntries.length ? queueEntries[queueEntries.length - 1] : null;
    const packetRoot = path.join(artifactRoot, 'proposals', 'packets');
    const packetPaths = await listPacketPaths(packetRoot);
    const latestProposalIds = summarizeLatestProposalIds(
      latestRunRecord ? latestRunRecord.linkage : null,
      queueEntries
    );
    const queueCount = queueEntries.length;
    const hasEvaluation = Boolean(latestRunRecord && latestRunRecord.evaluation);

    let status = 'unavailable';
    let stage = 'not_observed';
    if (queueCount > 0) {
      status = 'ready';
      stage = 'queued';
    } else if (hasEvaluation) {
      status = 'ready';
      stage = 'evaluated';
    } else if (latestRun) {
      status = 'insufficient_evidence';
      stage = 'trace_only';
    }

    const artifactRefs = [];
    if (latestRunRecord && latestRunRecord.tracePath) artifactRefs.push(toArtifactRef('trace', latestRunRecord.tracePath, audience));
    if (latestRunRecord && latestRunRecord.evalPath && latestRunRecord.evaluation) {
      artifactRefs.push(toArtifactRef('evaluation', latestRunRecord.evalPath, audience));
    }
    if (latestRunRecord && latestRunRecord.linkagePath && latestRunRecord.linkage) {
      artifactRefs.push(toArtifactRef('proposal_linkage', latestRunRecord.linkagePath, audience));
    }
    if (queueCount > 0) artifactRefs.push(toArtifactRef('proposal_queue', queuePath, audience));
    if (packetPaths.length > 0) artifactRefs.push(toArtifactRef('codex_packet', packetPaths[packetPaths.length - 1], audience));

    const evaluation = latestRunRecord && latestRunRecord.evaluation && typeof latestRunRecord.evaluation === 'object'
      ? {
        planningStatus: normalizeText(latestRunRecord.evaluation.planningStatus, 'unavailable'),
        analysisStatus: normalizeText(latestRunRecord.evaluation.analysisStatus, 'unavailable'),
        observationStatus: normalizeText(latestRunRecord.evaluation.observationStatus, 'unavailable')
      }
      : {
        planningStatus: 'unavailable',
        analysisStatus: 'unavailable',
        observationStatus: 'unavailable'
      };

    return {
      ok: true,
      queryVersion: QUERY_VERSION,
      audience,
      generatedAt: new Date().toISOString(),
      artifactRoot: audience === 'operator' ? artifactRoot : null,
      status,
      stage,
      summary: buildSummary(status, stage, latestRun, queueCount),
      latestRun,
      evaluation,
      queue: {
        totalCount: queueCount,
        latestProposalId: latestQueueEntry && typeof latestQueueEntry === 'object'
          ? normalizeText(latestQueueEntry.proposal_id, null)
          : null,
        packetCount: packetPaths.length
      },
      latestProposalIds,
      artifactRefs
    };
  } catch (error) {
    return {
      ok: false,
      queryVersion: QUERY_VERSION,
      audience,
      generatedAt: new Date().toISOString(),
      artifactRoot: audience === 'operator' ? artifactRoot : null,
      status: 'error',
      stage: 'error',
      summary: buildSummary('error', 'error', null, 0),
      error: error && error.message ? error.message : String(error),
      latestRun: null,
      evaluation: {
        planningStatus: 'error',
        analysisStatus: 'error',
        observationStatus: 'error'
      },
      queue: {
        totalCount: 0,
        latestProposalId: null,
        packetCount: 0
      },
      latestProposalIds: [],
      artifactRefs: []
    };
  }
}

module.exports = {
  queryLatestDesktopPatrolSummary
};
