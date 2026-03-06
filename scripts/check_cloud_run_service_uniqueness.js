'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function parseArgs(argv) {
  const args = {
    serviceName: '',
    projectId: '',
    expectedRegion: '',
    servicesJsonPath: '',
    allowMissing: false
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
    if (key === '--expected-region' && next) {
      args.expectedRegion = String(next).trim();
      i += 1;
      continue;
    }
    if (key === '--services-json' && next) {
      args.servicesJsonPath = String(next).trim();
      i += 1;
      continue;
    }
    if (key === '--allow-missing') {
      args.allowMissing = true;
      continue;
    }
    throw new Error(`unknown argument: ${key}`);
  }

  if (!args.serviceName) throw new Error('--service-name is required');
  if (!args.expectedRegion) throw new Error('--expected-region is required');
  if (!args.servicesJsonPath && !args.projectId) throw new Error('--project-id is required when --services-json is not provided');

  return args;
}

function loadServices(args) {
  if (args.servicesJsonPath) {
    return JSON.parse(fs.readFileSync(args.servicesJsonPath, 'utf8'));
  }
  const raw = execFileSync('gcloud', [
    'run',
    'services',
    'list',
    '--project',
    args.projectId,
    '--format=json'
  ], { encoding: 'utf8' });
  return JSON.parse(raw || '[]');
}

function getServiceName(service) {
  if (!service || typeof service !== 'object') return '';
  if (typeof service.name === 'string' && service.name.trim()) return service.name.trim();
  const metadata = service.metadata && typeof service.metadata === 'object' ? service.metadata : {};
  if (typeof metadata.name === 'string' && metadata.name.trim()) return metadata.name.trim();
  return '';
}

function getServiceRegion(service) {
  if (!service || typeof service !== 'object') return '';
  if (typeof service.location === 'string' && service.location.trim()) return service.location.trim();
  if (typeof service.region === 'string' && service.region.trim()) return service.region.trim();
  const metadata = service.metadata && typeof service.metadata === 'object' ? service.metadata : {};
  const labels = metadata.labels && typeof metadata.labels === 'object' ? metadata.labels : {};
  const fromLabel = labels['cloud.googleapis.com/location']
    || labels['run.googleapis.com/location']
    || labels['run.googleapis.com/region'];
  if (typeof fromLabel === 'string' && fromLabel.trim()) return fromLabel.trim();
  return '';
}

function getServiceUrl(service) {
  if (!service || typeof service !== 'object') return '';
  const status = service.status && typeof service.status === 'object' ? service.status : {};
  if (typeof status.url === 'string' && status.url.trim()) return status.url.trim();
  const address = status.address && typeof status.address === 'object' ? status.address : {};
  if (typeof address.url === 'string' && address.url.trim()) return address.url.trim();
  return '';
}

function evaluateServiceUniqueness(services, args) {
  const input = Array.isArray(services) ? services : [];
  const matching = input.filter((service) => getServiceName(service) === args.serviceName);
  const foundRegions = [...new Set(matching.map((service) => getServiceRegion(service)).filter(Boolean))].sort();
  const foundUrls = [...new Set(matching.map((service) => getServiceUrl(service)).filter(Boolean))].sort();

  const reasons = [];
  if (matching.length === 0 && !args.allowMissing) reasons.push('service_missing');
  if (matching.length > 0 && foundRegions.length === 0) reasons.push('service_region_unknown');
  if (foundRegions.length > 1) reasons.push('duplicate_regions_detected');
  if (foundRegions.length === 1 && foundRegions[0] !== args.expectedRegion) reasons.push('region_mismatch');

  return {
    ok: reasons.length === 0,
    serviceName: args.serviceName,
    expectedRegion: args.expectedRegion,
    allowMissing: args.allowMissing,
    matchCount: matching.length,
    foundRegions,
    foundUrls,
    reasons
  };
}

function runCli() {
  const args = parseArgs(process.argv);
  const services = loadServices(args);
  const result = evaluateServiceUniqueness(services, args);
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (!result.ok) {
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
  getServiceName,
  getServiceRegion,
  evaluateServiceUniqueness
};
