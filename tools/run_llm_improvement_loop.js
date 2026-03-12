'use strict';

const path = require('node:path');
const { parseArgs, writeJson } = require('./llm_quality/lib');
const { buildRepoScanReport } = require('./run_llm_repo_scan');
const { loadRuntimeAuditInputs, buildRuntimeAuditReport, buildUnavailableAuditReport } = require('./run_llm_runtime_audit');
const { buildFailureClusters } = require('./run_llm_failure_cluster');
const { buildPlanFromClusters } = require('./generate_llm_improvement_plan');

async function runImprovementLoop(options, deps) {
  const payload = options && typeof options === 'object' ? options : {};
  const rootDir = payload.rootDir ? path.resolve(payload.rootDir) : process.cwd();
  const outputDir = payload.outputDir ? path.resolve(rootDir, payload.outputDir) : path.join(rootDir, 'tmp');
  const resolvedDeps = Object.assign({
    buildRepoScanReport,
    loadRuntimeAuditInputs,
    buildRuntimeAuditReport,
    buildUnavailableAuditReport,
    buildFailureClusters,
    buildPlanFromClusters
  }, deps || {});

  const repoScanReport = resolvedDeps.buildRepoScanReport({ rootDir, baselineRef: payload.baselineRef || null });
  let qualityAuditReport;
  try {
    const runtimeInputs = await resolvedDeps.loadRuntimeAuditInputs({
      fromAt: payload.fromAt || null,
      toAt: payload.toAt || null,
      limit: payload.limit || null
    });
    qualityAuditReport = resolvedDeps.buildRuntimeAuditReport(Object.assign({}, runtimeInputs, {
      fromAt: payload.fromAt || null,
      toAt: payload.toAt || null,
      limit: payload.limit || null
    }));
  } catch (error) {
    qualityAuditReport = resolvedDeps.buildUnavailableAuditReport({
      fromAt: payload.fromAt || null,
      toAt: payload.toAt || null,
      limit: payload.limit || null,
      error
    });
  }
  const failureClusters = resolvedDeps.buildFailureClusters({
    rootDir,
    audit: qualityAuditReport,
    scan: repoScanReport
  });
  const improvementPlan = resolvedDeps.buildPlanFromClusters(failureClusters, {
    clustersPath: path.join(outputDir, 'failure_clusters.json')
  });

  const outputs = {
    repoScanReport: path.join(outputDir, 'repo_scan_report.json'),
    qualityAuditReport: path.join(outputDir, 'quality_audit_report.json'),
    failureClusters: path.join(outputDir, 'failure_clusters.json'),
    improvementPlan: path.join(outputDir, 'improvement_plan.json')
  };

  writeJson(outputs.repoScanReport, repoScanReport);
  writeJson(outputs.qualityAuditReport, qualityAuditReport);
  writeJson(outputs.failureClusters, failureClusters);
  writeJson(outputs.improvementPlan, improvementPlan);

  return {
    outputs,
    repoScanReport,
    qualityAuditReport,
    failureClusters,
    improvementPlan
  };
}

async function main(argv) {
  const args = parseArgs(argv);
  const result = await runImprovementLoop({
    rootDir: process.cwd(),
    fromAt: args.fromAt || null,
    toAt: args.toAt || null,
    limit: args.limit || null,
    outputDir: args.outputDir || 'tmp'
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    degraded: result.qualityAuditReport.source && result.qualityAuditReport.source.runtimeFetchStatus === 'unavailable',
    outputs: result.outputs,
    blockerCount: result.qualityAuditReport.releaseBlockers.length,
    clusterCount: result.failureClusters.clusters.length,
    backlogCount: Array.isArray(result.improvementPlan.backlog) ? result.improvementPlan.backlog.length : 0
  }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  main(process.argv)
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
      process.exit(1);
    });
}

module.exports = {
  runImprovementLoop,
  main
};
