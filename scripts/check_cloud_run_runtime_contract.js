'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function splitCsv(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    serviceName: '',
    projectId: '',
    region: '',
    requiredEnv: [],
    requiredSecretEnv: [],
    serviceJsonPath: ''
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--service-name' && next) {
      args.serviceName = String(next).trim();
      i += 1;
      continue;
    }
    if (key === '--project-id' && next) {
      args.projectId = String(next).trim();
      i += 1;
      continue;
    }
    if (key === '--region' && next) {
      args.region = String(next).trim();
      i += 1;
      continue;
    }
    if (key === '--required-env' && next) {
      args.requiredEnv = splitCsv(next);
      i += 1;
      continue;
    }
    if (key === '--required-secret-env' && next) {
      args.requiredSecretEnv = splitCsv(next);
      i += 1;
      continue;
    }
    if (key === '--service-json' && next) {
      args.serviceJsonPath = String(next).trim();
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${key}`);
  }

  if (!args.serviceJsonPath) {
    if (!args.serviceName) throw new Error('--service-name is required');
    if (!args.projectId) throw new Error('--project-id is required');
    if (!args.region) throw new Error('--region is required');
  }

  return args;
}

function loadServiceJson(args) {
  if (args.serviceJsonPath) {
    return JSON.parse(fs.readFileSync(args.serviceJsonPath, 'utf8'));
  }
  const raw = execFileSync('gcloud', [
    'run',
    'services',
    'describe',
    args.serviceName,
    '--project',
    args.projectId,
    '--region',
    args.region,
    '--format=json'
  ], { encoding: 'utf8' });
  return JSON.parse(raw || '{}');
}

function extractRuntimeContract(serviceJson) {
  const spec = serviceJson
    && serviceJson.spec
    && serviceJson.spec.template
    && serviceJson.spec.template.spec
    && Array.isArray(serviceJson.spec.template.spec.containers)
    ? serviceJson.spec.template.spec
    : {};
  const container = spec.containers && spec.containers[0] && typeof spec.containers[0] === 'object'
    ? spec.containers[0]
    : {};
  const envList = Array.isArray(container.env) ? container.env : [];

  const env = Object.create(null);
  const secretEnv = Object.create(null);
  envList.forEach((item) => {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string') return;
    const key = item.name.trim();
    if (!key) return;
    if (Object.prototype.hasOwnProperty.call(item, 'value')) {
      env[key] = String(item.value);
      return;
    }
    const secretRef = item.valueFrom && item.valueFrom.secretKeyRef && typeof item.valueFrom.secretKeyRef === 'object'
      ? item.valueFrom.secretKeyRef
      : null;
    if (!secretRef) return;
    secretEnv[key] = {
      name: typeof secretRef.name === 'string' ? secretRef.name : '',
      key: typeof secretRef.key === 'string' ? secretRef.key : ''
    };
  });

  return { env, secretEnv };
}

function verifyRuntimeContract(contract, args) {
  const payload = contract && typeof contract === 'object' ? contract : { env: {}, secretEnv: {} };
  const env = payload.env && typeof payload.env === 'object' ? payload.env : {};
  const secretEnv = payload.secretEnv && typeof payload.secretEnv === 'object' ? payload.secretEnv : {};

  const missingEnv = args.requiredEnv.filter((name) => !(name in env));
  const missingSecretEnv = args.requiredSecretEnv.filter((name) => !(name in secretEnv));
  const secretNameMismatch = args.requiredSecretEnv
    .filter((name) => name in secretEnv)
    .filter((name) => {
      const ref = secretEnv[name];
      return !ref || ref.name !== name;
    });

  return {
    ok: missingEnv.length === 0 && missingSecretEnv.length === 0 && secretNameMismatch.length === 0,
    missingEnv,
    missingSecretEnv,
    secretNameMismatch
  };
}

function runCli() {
  const args = parseArgs(process.argv);
  const serviceJson = loadServiceJson(args);
  const contract = extractRuntimeContract(serviceJson);
  const check = verifyRuntimeContract(contract, args);
  const output = {
    ok: check.ok,
    serviceName: args.serviceName || '(fixture)',
    requiredEnv: args.requiredEnv,
    requiredSecretEnv: args.requiredSecretEnv,
    missingEnv: check.missingEnv,
    missingSecretEnv: check.missingSecretEnv,
    secretNameMismatch: check.secretNameMismatch
  };
  const text = `${JSON.stringify(output, null, 2)}\n`;
  if (!check.ok) {
    process.stderr.write(text);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(text);
}

if (require.main === module) {
  runCli();
}

module.exports = {
  parseArgs,
  extractRuntimeContract,
  verifyRuntimeContract
};
