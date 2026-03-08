'use strict';

const path = require('path');
const {
  KG_DIR,
  ensureDir,
  writeJson,
  runCommand,
  getGitMeta
} = require('./knowledge_graph_common');

const OUTPUT_PATH = path.join(KG_DIR, 'runtime_probe.json');

function nowIso() {
  return new Date().toISOString();
}

function runtimeEvidence(command, atIso) {
  return `runtime:${command}@${atIso}`;
}

function parseJsonOrFallback(text, fallbackValue) {
  if (!text || typeof text !== 'string') return fallbackValue;
  try {
    return JSON.parse(text);
  } catch (_err) {
    return fallbackValue;
  }
}

function summarizeRunService(row) {
  const template = row && row.spec && row.spec.template ? row.spec.template : {};
  const metadata = template.metadata || {};
  const annotations = metadata.annotations || {};
  const container = template.spec && Array.isArray(template.spec.containers) && template.spec.containers[0]
    ? template.spec.containers[0]
    : {};
  const env = Array.isArray(container.env) ? container.env : [];

  const envVars = env
    .map((entry) => entry && entry.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const secretRefs = env
    .map((entry) => entry && entry.valueFrom && entry.valueFrom.secretKeyRef && entry.valueFrom.secretKeyRef.secret)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return {
    name: row && row.metadata && row.metadata.name ? row.metadata.name : null,
    region: row && row.metadata && row.metadata.labels ? (row.metadata.labels['cloud.googleapis.com/location'] || null) : null,
    url: row && row.status && row.status.url ? row.status.url : null,
    ingress: row && row.spec ? row.spec.ingress || null : null,
    serviceAccount: template.spec ? template.spec.serviceAccountName || null : null,
    image: container.image || null,
    envVars,
    secretRefs,
    maxScale: annotations['autoscaling.knative.dev/maxScale'] || null,
    minScale: annotations['autoscaling.knative.dev/minScale'] || null
  };
}

async function probeFirestore(projectId, atIso) {
  const command = 'firebase-admin firestore listCollections';
  const evidence = runtimeEvidence(command, atIso);
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const appConfig = {};
      if (projectId) appConfig.projectId = projectId;
      admin.initializeApp(appConfig);
    }

    const db = admin.firestore();
    const collections = await db.listCollections();
    const names = collections
      .map((row) => row && row.id)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const sample = [];
    const collectionSummaries = [];
    for (const colRef of collections) {
      try {
        const snapshot = await colRef.limit(1).get();
        const firstDoc = snapshot.empty ? null : snapshot.docs[0];
        const firstData = firstDoc ? firstDoc.data() : null;
        const fieldCount = firstData && typeof firstData === 'object'
          ? Object.keys(firstData).length
          : 0;

        sample.push({
          collection: colRef.id,
          observed: true,
          sampleDocExists: !snapshot.empty
        });
        collectionSummaries.push({
          collection: colRef.id,
          fieldCount,
          sampleDoc: firstDoc ? firstDoc.id : null,
          sampleDocExists: !snapshot.empty
        });
      } catch (err) {
        sample.push({
          collection: colRef.id,
          observed: false,
          reason: String((err && err.message) || err || 'UNKNOWN_ERROR').slice(0, 240)
        });
        collectionSummaries.push({
          collection: colRef.id,
          fieldCount: 'UNOBSERVED_RUNTIME',
          sampleDoc: 'UNOBSERVED_RUNTIME',
          sampleDocExists: false,
          reason: String((err && err.message) || err || 'UNKNOWN_ERROR').slice(0, 240)
        });
      }
    }

    collectionSummaries.sort((a, b) => String(a.collection || '').localeCompare(String(b.collection || '')));

    return {
      observed: true,
      status: 'OBSERVED_RUNTIME',
      reason: null,
      collectionCount: names.length,
      collections: names,
      samples: sample,
      collectionSummaries,
      evidence
    };
  } catch (err) {
    return {
      observed: false,
      status: 'UNOBSERVED_RUNTIME',
      reason: String((err && err.message) || err || 'UNKNOWN_ERROR').slice(0, 400),
      errorCode: err && err.code ? String(err.code) : null,
      collectionCount: 0,
      collections: [],
      samples: [],
      collectionSummaries: [],
      evidence
    };
  }
}

function run() {
  return (async () => {
    ensureDir(KG_DIR);
    const atIso = nowIso();

    const git = getGitMeta();

    const projectRes = runCommand('gcloud', ['config', 'get-value', 'project']);
    const projectId = projectRes.status === 0 && projectRes.stdout && projectRes.stdout !== '(unset)'
      ? projectRes.stdout.trim()
      : null;

    const authRes = runCommand('gcloud', ['auth', 'list', '--filter=status:ACTIVE', '--format=json']);
    const authRows = parseJsonOrFallback(authRes.stdout, []);
    const activeAccount = Array.isArray(authRows) && authRows[0] && authRows[0].account
      ? authRows[0].account
      : null;

    const runArgs = ['run', 'services', 'list', '--format=json'];
    if (projectId) {
      runArgs.push('--project', projectId);
    }
    const runServicesRes = runCommand('gcloud', runArgs);
    const runRows = parseJsonOrFallback(runServicesRes.stdout, []);
    const runServices = Array.isArray(runRows)
      ? runRows.map(summarizeRunService).filter((row) => row && row.name)
      : [];

    const secretsArgs = ['secrets', 'list', '--format=json'];
    if (projectId) {
      secretsArgs.push('--project', projectId);
    }
    const secretsRes = runCommand('gcloud', secretsArgs);
    const secretRows = parseJsonOrFallback(secretsRes.stdout, []);
    const secretNames = Array.isArray(secretRows)
      ? secretRows
        .map((row) => row && row.name)
        .filter(Boolean)
        .map((value) => String(value).split('/').pop())
        .sort((a, b) => a.localeCompare(b))
      : [];

    const firestore = await probeFirestore(projectId, atIso);

    const payload = {
      generatedAt: atIso,
      gitCommit: git.commit,
      branch: git.branch,
      projectId: projectId || 'UNOBSERVED_RUNTIME',
      activeAccount: activeAccount || 'UNOBSERVED_RUNTIME',
      commands: [
        {
          name: 'gcloud_project',
          command: projectRes.command,
          status: projectRes.status,
          evidence: runtimeEvidence(projectRes.command, atIso),
          stderr: projectRes.stderr || null
        },
        {
          name: 'gcloud_auth_list',
          command: authRes.command,
          status: authRes.status,
          evidence: runtimeEvidence(authRes.command, atIso),
          stderr: authRes.stderr || null
        },
        {
          name: 'cloud_run_services',
          command: runServicesRes.command,
          status: runServicesRes.status,
          evidence: runtimeEvidence(runServicesRes.command, atIso),
          stderr: runServicesRes.stderr || null
        },
        {
          name: 'secret_manager_list',
          command: secretsRes.command,
          status: secretsRes.status,
          evidence: runtimeEvidence(secretsRes.command, atIso),
          stderr: secretsRes.stderr || null
        }
      ],
      cloudRun: {
        observed: runServicesRes.status === 0,
        status: runServicesRes.status === 0 ? 'OBSERVED_RUNTIME' : 'UNOBSERVED_RUNTIME',
        serviceCount: runServices.length,
        services: runServices,
        evidence: runtimeEvidence(runServicesRes.command, atIso),
        reason: runServicesRes.status === 0 ? null : (runServicesRes.stderr || 'gcloud run services list failed')
      },
      secretManager: {
        observed: secretsRes.status === 0,
        status: secretsRes.status === 0 ? 'OBSERVED_RUNTIME' : 'UNOBSERVED_RUNTIME',
        secretCount: secretNames.length,
        secretNames,
        evidence: runtimeEvidence(secretsRes.command, atIso),
        reason: secretsRes.status === 0 ? null : (secretsRes.stderr || 'gcloud secrets list failed')
      },
      firestore
    };

    writeJson(OUTPUT_PATH, payload);

    const firestoreStatus = payload.firestore && payload.firestore.status
      ? payload.firestore.status
      : 'UNOBSERVED_RUNTIME';
    console.log(`[knowledge-graph] runtime probe written: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
    console.log(`[knowledge-graph] cloudRun=${payload.cloudRun.serviceCount} secretNames=${payload.secretManager.secretCount} firestore=${firestoreStatus}`);
  })();
}

run().catch((err) => {
  console.error('[knowledge-graph] runtime probe failed');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
