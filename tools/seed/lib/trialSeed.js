'use strict';

const { getDb, serverTimestamp } = require('../../../src/infra/firestore');

const PROD_ENV_NAMES = new Set(['prod', 'production']);
const SEED_RUNS_COLLECTION = 'seed_runs';
const CONFIRM_DELETE_TOKEN = 'SEED_DELETE';
const DEFAULT_SEED_KIND = 'trial';
const DEFAULT_USERS = 200;
const DEFAULT_LINK_COUNT = 12;
const DEFAULT_VENDOR_COUNT = 6;
const MAX_USERS = 5000;
const MAX_VENDORS = 100;
const BATCH_CHUNK_SIZE = 450;

const SCENARIO_ROTATION = Object.freeze(['A', 'C']);
const STEP_ROTATION = Object.freeze(['3mo', '1mo', 'week', 'after1w']);

const GENERAL_LINK_BLUEPRINTS = Object.freeze([
  { key: 'general-handbook', label: 'General Handbook', url: 'https://www.usa.gov/' },
  { key: 'immigration', label: 'Immigration Basics', url: 'https://www.uscis.gov/' },
  { key: 'finance', label: 'Financial Literacy', url: 'https://www.consumerfinance.gov/' },
  { key: 'tax', label: 'Tax Basics', url: 'https://www.irs.gov/' },
  { key: 'health', label: 'Health Guidance', url: 'https://www.cdc.gov/' },
  { key: 'education', label: 'Education Resources', url: 'https://www.ed.gov/' },
  { key: 'labor', label: 'Labor Resources', url: 'https://www.dol.gov/' },
  { key: 'benefits', label: 'Benefits Finder', url: 'https://www.benefits.gov/' },
  { key: 'housing', label: 'Housing Support', url: 'https://www.hud.gov/' },
  { key: 'social-security', label: 'Social Security', url: 'https://www.ssa.gov/' },
  { key: 'transport', label: 'Transport Guide', url: 'https://www.transportation.gov/' },
  { key: 'small-business', label: 'Small Business', url: 'https://www.sba.gov/' }
]);

const VENDOR_BLUEPRINTS = Object.freeze([
  {
    vendorKey: 'insurance',
    vendorLabel: 'Insurance',
    vendorCategory: 'insurance',
    title: 'Insurance setup',
    url: 'https://www.healthcare.gov/'
  },
  {
    vendorKey: 'mobile',
    vendorLabel: 'Mobile Carrier',
    vendorCategory: 'communications',
    title: 'Mobile setup',
    url: 'https://www.fcc.gov/'
  },
  {
    vendorKey: 'banking',
    vendorLabel: 'Banking',
    vendorCategory: 'finance',
    title: 'Bank account setup',
    url: 'https://www.consumerfinance.gov/'
  },
  {
    vendorKey: 'utilities',
    vendorLabel: 'Utilities',
    vendorCategory: 'utilities',
    title: 'Utilities setup',
    url: 'https://www.usa.gov/state-consumer'
  },
  {
    vendorKey: 'transport',
    vendorLabel: 'Transport',
    vendorCategory: 'transport',
    title: 'Transport setup',
    url: 'https://www.transportation.gov/'
  },
  {
    vendorKey: 'school',
    vendorLabel: 'School District',
    vendorCategory: 'education',
    title: 'School enrollment',
    url: 'https://www2.ed.gov/about/contacts/gen/index.html'
  }
]);

const CITY_PACK_BLUEPRINTS = Object.freeze([
  {
    cityPackKey: 'nyc',
    displayName: 'NYC',
    region: 'Northeast',
    state: 'NY',
    sourceUrl: 'https://www.nyc.gov/'
  },
  {
    cityPackKey: 'westchester',
    displayName: 'Westchester',
    region: 'Northeast',
    state: 'NY',
    sourceUrl: 'https://www.westchestergov.com/'
  },
  {
    cityPackKey: 'long-island',
    displayName: 'Long Island',
    region: 'Northeast',
    state: 'NY',
    sourceUrl: 'https://www.nassaucountyny.gov/'
  },
  {
    cityPackKey: 'northern-nj',
    displayName: 'Northern NJ',
    region: 'Northeast',
    state: 'NJ',
    sourceUrl: 'https://www.nj.gov/'
  },
  {
    cityPackKey: 'boston',
    displayName: 'Boston',
    region: 'Northeast',
    state: 'MA',
    sourceUrl: 'https://www.boston.gov/'
  },
  {
    cityPackKey: 'la',
    displayName: 'LA',
    region: 'West',
    state: 'CA',
    sourceUrl: 'https://www.lacity.gov/'
  },
  {
    cityPackKey: 'sf',
    displayName: 'SF',
    region: 'West',
    state: 'CA',
    sourceUrl: 'https://sf.gov/'
  },
  {
    cityPackKey: 'sj',
    displayName: 'SJ',
    region: 'West',
    state: 'CA',
    sourceUrl: 'https://www.sanjoseca.gov/'
  },
  {
    cityPackKey: 'detroit',
    displayName: 'Detroit',
    region: 'Midwest',
    state: 'MI',
    sourceUrl: 'https://detroitmi.gov/'
  },
  {
    cityPackKey: 'chicago',
    displayName: 'Chicago',
    region: 'Midwest',
    state: 'IL',
    sourceUrl: 'https://www.chicago.gov/'
  },
  {
    cityPackKey: 'houston',
    displayName: 'Houston',
    region: 'South',
    state: 'TX',
    sourceUrl: 'https://www.houstontx.gov/'
  },
  {
    cityPackKey: 'dallas',
    displayName: 'Dallas',
    region: 'South',
    state: 'TX',
    sourceUrl: 'https://dallascityhall.com/'
  }
]);

function normalizeEnvName(value) {
  if (typeof value !== 'string' || !value.trim()) return 'local';
  return value.trim();
}

function isProdEnv(envName) {
  return PROD_ENV_NAMES.has(String(envName || '').trim().toLowerCase());
}

function assertNonProdEnv(envName) {
  if (isProdEnv(envName)) {
    throw new Error('seed setup/purge is blocked when ENV_NAME is prod or production');
  }
}

function readArgValue(argv, index, label) {
  if (index >= argv.length) throw new Error(`${label} value required`);
  return argv[index];
}

function parseBooleanValue(raw, label) {
  const value = String(raw || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off'].includes(value)) return false;
  throw new Error(`${label} must be true or false`);
}

function parseIntegerValue(raw, label, min, max) {
  const num = Number(raw);
  if (!Number.isInteger(num)) throw new Error(`${label} must be integer`);
  if (num < min || num > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return num;
}

function sanitizeToken(value, fallback) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function normalizeDocToken(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'seed';
}

function toUtcCompact(value) {
  const now = value instanceof Date ? value : new Date(value);
  const iso = Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();
  return iso.replace(/[-:TZ.]/g, '').slice(0, 14);
}

function buildDefaultSeedRunId(seedKind, envName, now) {
  return `seed_${sanitizeToken(seedKind, DEFAULT_SEED_KIND)}_${sanitizeToken(envName, 'local')}_${toUtcCompact(now)}`;
}

function parseTrialSeedSetupArgs(argv, env) {
  const sourceEnv = env || process.env;
  const envName = normalizeEnvName(sourceEnv.ENV_NAME || sourceEnv.NODE_ENV || 'local');
  const opts = {
    seedRunId: '',
    kind: DEFAULT_SEED_KIND,
    dryRun: false,
    planOnly: false,
    users: DEFAULT_USERS,
    templates: true,
    cityPacks: true,
    links: true,
    vendors: DEFAULT_VENDOR_COUNT,
    envName
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (arg === '--planOnly') {
      opts.planOnly = true;
      continue;
    }
    if (arg === '--seedRunId') {
      opts.seedRunId = readArgValue(argv, ++i, '--seedRunId').trim();
      continue;
    }
    if (arg === '--kind') {
      opts.kind = readArgValue(argv, ++i, '--kind').trim() || DEFAULT_SEED_KIND;
      continue;
    }
    if (arg === '--users') {
      opts.users = parseIntegerValue(readArgValue(argv, ++i, '--users'), '--users', 0, MAX_USERS);
      continue;
    }
    if (arg === '--templates') {
      opts.templates = parseBooleanValue(readArgValue(argv, ++i, '--templates'), '--templates');
      continue;
    }
    if (arg === '--cityPacks') {
      opts.cityPacks = parseBooleanValue(readArgValue(argv, ++i, '--cityPacks'), '--cityPacks');
      continue;
    }
    if (arg === '--links') {
      opts.links = parseBooleanValue(readArgValue(argv, ++i, '--links'), '--links');
      continue;
    }
    if (arg === '--vendors') {
      opts.vendors = parseIntegerValue(readArgValue(argv, ++i, '--vendors'), '--vendors', 0, MAX_VENDORS);
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }

  assertNonProdEnv(opts.envName);

  if (!opts.seedRunId) {
    opts.seedRunId = buildDefaultSeedRunId(opts.kind, opts.envName, new Date());
  }

  if (opts.templates && !opts.links) {
    throw new Error('--templates true requires --links true');
  }
  if (opts.vendors > 0 && !opts.links) {
    throw new Error('--vendors requires --links true');
  }

  return opts;
}

function parseTrialSeedPurgeArgs(argv, env) {
  const sourceEnv = env || process.env;
  const envName = normalizeEnvName(sourceEnv.ENV_NAME || sourceEnv.NODE_ENV || 'local');
  const opts = {
    seedRunId: '',
    confirm: '',
    dryRun: false,
    envName
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (arg === '--seedRunId') {
      opts.seedRunId = readArgValue(argv, ++i, '--seedRunId').trim();
      continue;
    }
    if (arg === '--confirm') {
      opts.confirm = readArgValue(argv, ++i, '--confirm').trim();
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }

  if (!opts.seedRunId) throw new Error('--seedRunId required');
  if (opts.confirm !== CONFIRM_DELETE_TOKEN) throw new Error('purge requires --confirm SEED_DELETE');

  assertNonProdEnv(opts.envName);

  return opts;
}

function parseOptionalBoolean(value, fallback, label) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return parseBooleanValue(value, label);
}

function parseOptionalInt(value, fallback, label, min, max) {
  if (value === undefined || value === null || value === '') return fallback;
  return parseIntegerValue(value, label, min, max);
}

function normalizeSetupOptions(raw, deps) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const env = deps && deps.env ? deps.env : process.env;
  const envName = normalizeEnvName(payload.envName || env.ENV_NAME || env.NODE_ENV || 'local');
  assertNonProdEnv(envName);

  const seedKind = typeof payload.seedKind === 'string' && payload.seedKind.trim()
    ? payload.seedKind.trim()
    : (typeof payload.kind === 'string' && payload.kind.trim() ? payload.kind.trim() : DEFAULT_SEED_KIND);

  const seedRunId = typeof payload.seedRunId === 'string' && payload.seedRunId.trim()
    ? payload.seedRunId.trim()
    : buildDefaultSeedRunId(seedKind, envName, deps && deps.now ? deps.now : new Date());

  const users = parseOptionalInt(payload.users, DEFAULT_USERS, '--users', 0, MAX_USERS);
  const templates = parseOptionalBoolean(payload.templates, true, '--templates');
  const cityPacks = parseOptionalBoolean(payload.cityPacks, true, '--cityPacks');
  const links = parseOptionalBoolean(payload.links, true, '--links');
  const vendors = parseOptionalInt(
    payload.vendors !== undefined ? payload.vendors : payload.vendorCount,
    DEFAULT_VENDOR_COUNT,
    '--vendors',
    0,
    MAX_VENDORS
  );

  if (templates && !links) throw new Error('--templates true requires --links true');
  if (vendors > 0 && !links) throw new Error('--vendors requires --links true');

  return {
    seedRunId,
    seedKind,
    envName,
    dryRun: Boolean(payload.dryRun),
    planOnly: Boolean(payload.planOnly),
    users,
    templates,
    cityPacks,
    links,
    vendors
  };
}

function normalizePurgeOptions(raw, deps) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const env = deps && deps.env ? deps.env : process.env;
  const envName = normalizeEnvName(payload.envName || env.ENV_NAME || env.NODE_ENV || 'local');
  assertNonProdEnv(envName);

  const seedRunId = typeof payload.seedRunId === 'string' ? payload.seedRunId.trim() : '';
  if (!seedRunId) throw new Error('--seedRunId required');

  const confirm = typeof payload.confirm === 'string' ? payload.confirm.trim() : '';
  if (confirm !== CONFIRM_DELETE_TOKEN) throw new Error('purge requires --confirm SEED_DELETE');

  return {
    seedRunId,
    confirm,
    envName,
    dryRun: Boolean(payload.dryRun)
  };
}

function buildSeedMetadata(ctx) {
  return {
    isSeed: true,
    seedRunId: ctx.seedRunId,
    seedKind: ctx.seedKind,
    envName: ctx.envName
  };
}

function addDays(baseDate, days) {
  const base = baseDate instanceof Date ? baseDate : new Date();
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + Number(days || 0));
  return next;
}

function addMinutes(baseDate, minutes) {
  const base = baseDate instanceof Date ? baseDate : new Date();
  return new Date(base.getTime() + (Number(minutes || 0) * 60 * 1000));
}

function buildDocId(prefix, safeSeedRunId, index, width) {
  return `${prefix}_${safeSeedRunId}_${String(index).padStart(width, '0')}`;
}

function buildUserRecords(ctx, userCount) {
  const records = [];
  const userIds = [];
  const count = Number(userCount) || 0;

  for (let i = 0; i < count; i += 1) {
    const scenarioKey = SCENARIO_ROTATION[i % SCENARIO_ROTATION.length];
    const stepKey = STEP_ROTATION[i % STEP_ROTATION.length];
    const city = CITY_PACK_BLUEPRINTS[i % CITY_PACK_BLUEPRINTS.length];
    const docId = buildDocId('seed_usr', ctx.safeSeedRunId, i + 1, 4);
    const hasMemberNumber = i % 2 === 0;
    const checklistDone = i % 3 === 0 ? { onboarding: true, documents: true } : {};

    records.push({
      collection: 'users',
      docId,
      data: {
        lineUserId: docId,
        scenarioKey,
        stepKey,
        scenario: scenarioKey,
        step: stepKey,
        region: city.cityPackKey,
        memberNumber: hasMemberNumber ? `M-${String(100000 + i).padStart(6, '0')}` : null,
        memberCardAsset: null,
        checklistDone,
        createdAt: ctx.timestamp(),
        seed: ctx.seedMetadata
      }
    });

    userIds.push(docId);
  }

  return {
    records,
    userIds,
    count: records.length
  };
}

function buildLinkRecords(ctx, includeLinks, vendorCount) {
  if (!includeLinks) {
    return {
      records: [],
      linkIds: [],
      generalLinkIds: [],
      vendorLinkIds: [],
      linkCount: 0,
      vendorCatalogCount: 0
    };
  }

  const records = [];
  const linkIds = [];
  const generalLinkIds = [];
  const vendorLinkIds = [];
  const desiredVendorCount = Math.max(0, Number(vendorCount) || 0);
  const totalLinks = Math.max(DEFAULT_LINK_COUNT, desiredVendorCount);

  for (let i = 0; i < totalLinks; i += 1) {
    const docId = buildDocId('seed_lnk', ctx.safeSeedRunId, i + 1, 3);
    const isVendor = i < desiredVendorCount;
    const general = GENERAL_LINK_BLUEPRINTS[i % GENERAL_LINK_BLUEPRINTS.length];
    const vendor = VENDOR_BLUEPRINTS[i % VENDOR_BLUEPRINTS.length];

    const data = {
      title: isVendor
        ? `[SEED][VENDOR_LINK] ${vendor.title}`
        : `[SEED][LINK] ${general.label}`,
      url: isVendor ? vendor.url : general.url,
      lastHealth: {
        state: 'OK',
        statusCode: 200,
        checkedAt: ctx.timestamp()
      },
      createdAt: ctx.timestamp(),
      seed: ctx.seedMetadata
    };

    if (isVendor) {
      const suffix = i >= VENDOR_BLUEPRINTS.length ? `_${Math.floor(i / VENDOR_BLUEPRINTS.length) + 1}` : '';
      data.vendorKey = `${vendor.vendorKey}${suffix}`;
      data.vendorLabel = suffix ? `${vendor.vendorLabel} ${suffix.slice(1)}` : vendor.vendorLabel;
      data.vendorCategory = vendor.vendorCategory;
      vendorLinkIds.push(docId);
    } else {
      generalLinkIds.push(docId);
    }

    records.push({ collection: 'link_registry', docId, data });
    linkIds.push(docId);
  }

  return {
    records,
    linkIds,
    generalLinkIds,
    vendorLinkIds,
    linkCount: records.length,
    vendorCatalogCount: vendorLinkIds.length
  };
}

function buildNotificationRow(ctx, index, payload) {
  return {
    collection: 'notifications',
    docId: buildDocId('seed_ntf', ctx.safeSeedRunId, index + 1, 4),
    data: {
      title: payload.title,
      body: payload.body,
      ctaText: payload.ctaText,
      linkRegistryId: payload.linkRegistryId,
      scenarioKey: payload.scenarioKey,
      stepKey: payload.stepKey,
      target: {
        limit: 200,
        region: payload.region || null,
        membersOnly: false
      },
      sourceRefs: [],
      notificationCategory: payload.notificationCategory,
      notificationType: payload.notificationType,
      notificationMeta: payload.notificationMeta || null,
      cityPackFallback: null,
      status: payload.status || 'active',
      scheduledAt: null,
      sentAt: null,
      createdBy: 'seed:trial',
      createdAt: ctx.timestamp(),
      seed: ctx.seedMetadata
    }
  };
}

function buildNotificationRecords(ctx, opts) {
  if (!opts.includeTemplates) {
    return {
      records: [],
      count: 0,
      byType: { GENERAL: 0, ANNOUNCEMENT: 0, STEP: 0, VENDOR: 0 },
      notificationRows: []
    };
  }

  if (!opts.linkIds.length) {
    throw new Error('templates require link registry records');
  }

  const rows = [];
  const allLinks = opts.linkIds;
  const vendorLinks = opts.vendorLinkIds;
  let index = 0;

  const linkAt = (n) => allLinks[n % allLinks.length];
  const scenarioAt = (n) => SCENARIO_ROTATION[n % SCENARIO_ROTATION.length];
  const stepAt = (n) => STEP_ROTATION[n % STEP_ROTATION.length];

  const generalTemplates = [
    { title: '[SEED][GENERAL] Welcome orientation', body: 'Orientation flow for new member operations.', ctaText: 'Open orientation guide' },
    { title: '[SEED][GENERAL] Document checklist', body: 'Prepare required documents for onboarding tasks.', ctaText: 'Review document checklist' },
    { title: '[SEED][GENERAL] Service map', body: 'Service map for common questions and support channels.', ctaText: 'Open service map' },
    { title: '[SEED][GENERAL] Schedule overview', body: 'Timeline overview for next administrative actions.', ctaText: 'Review schedule overview' },
    { title: '[SEED][GENERAL] Safety tips', body: 'Basic safety tips for the first weeks.', ctaText: 'View safety tips' },
    { title: '[SEED][GENERAL] Support contacts', body: 'Support contact references and escalation flow.', ctaText: 'View support contacts' }
  ];

  generalTemplates.forEach((template, localIndex) => {
    rows.push(buildNotificationRow(ctx, index++, {
      title: template.title,
      body: template.body,
      ctaText: template.ctaText,
      linkRegistryId: linkAt(localIndex),
      scenarioKey: scenarioAt(localIndex),
      stepKey: stepAt(localIndex),
      notificationCategory: 'SEQUENCE_GUIDANCE',
      notificationType: 'GENERAL',
      notificationMeta: {
        seedCategory: 'general',
        order: localIndex + 1
      }
    }));
  });

  const announceTemplates = [
    { title: '[SEED][ANNOUNCE] Policy update', body: 'Policy update bulletin for this week.', ctaText: 'Read policy update' },
    { title: '[SEED][ANNOUNCE] Operations bulletin', body: 'Operations bulletin and known constraints.', ctaText: 'Read ops bulletin' },
    { title: '[SEED][ANNOUNCE] Deadline reminder', body: 'Reminder for upcoming required deadlines.', ctaText: 'Review deadline details' },
    { title: '[SEED][ANNOUNCE] Service maintenance', body: 'Maintenance window and expected impact.', ctaText: 'Review maintenance details' },
    { title: '[SEED][ANNOUNCE] Process change', body: 'Process change summary and next actions.', ctaText: 'Review process change' },
    { title: '[SEED][ANNOUNCE] Compliance notice', body: 'Compliance notice for current quarter.', ctaText: 'Review compliance notice' }
  ];

  announceTemplates.forEach((template, localIndex) => {
    rows.push(buildNotificationRow(ctx, index++, {
      title: template.title,
      body: template.body,
      ctaText: template.ctaText,
      linkRegistryId: linkAt(20 + localIndex),
      scenarioKey: scenarioAt(20 + localIndex),
      stepKey: stepAt(20 + localIndex),
      notificationCategory: localIndex % 2 === 0 ? 'DEADLINE_REQUIRED' : 'IMMEDIATE_ACTION',
      notificationType: 'ANNOUNCEMENT',
      notificationMeta: {
        seedCategory: 'announce',
        order: localIndex + 1
      }
    }));
  });

  STEP_ROTATION.forEach((stepKey, stepIndex) => {
    SCENARIO_ROTATION.forEach((scenarioKey, scenarioIndex) => {
      const order = (stepIndex * SCENARIO_ROTATION.length) + scenarioIndex + 1;
      rows.push(buildNotificationRow(ctx, index++, {
        title: `[SEED][STEP][${stepKey.toUpperCase()}] #${scenarioIndex + 1}`,
        body: `Step guidance for ${stepKey} (${scenarioKey}) in trial environment.`,
        ctaText: `Open ${stepKey} checklist`,
        linkRegistryId: linkAt(50 + order),
        scenarioKey,
        stepKey,
        notificationCategory: 'SEQUENCE_GUIDANCE',
        notificationType: 'STEP',
        notificationMeta: {
          seedCategory: 'step',
          order,
          stepKey,
          scenarioKey
        }
      }));
    });
  });

  vendorLinks.forEach((linkId, vendorIndex) => {
    rows.push(buildNotificationRow(ctx, index++, {
      title: `[SEED][VENDOR] Catalog template ${vendorIndex + 1}`,
      body: 'Vendor guidance template for catalog workflows.',
      ctaText: 'Open vendor guidance',
      linkRegistryId: linkId,
      scenarioKey: scenarioAt(80 + vendorIndex),
      stepKey: stepAt(80 + vendorIndex),
      notificationCategory: 'TARGETED_ONLY',
      notificationType: 'VENDOR',
      notificationMeta: {
        seedCategory: 'vendor',
        order: vendorIndex + 1
      }
    }));
  });

  const byType = rows.reduce((acc, row) => {
    const key = row && row.data ? row.data.notificationType : 'UNKNOWN';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    records: rows,
    count: rows.length,
    byType: {
      GENERAL: Number(byType.GENERAL || 0),
      ANNOUNCEMENT: Number(byType.ANNOUNCEMENT || 0),
      STEP: Number(byType.STEP || 0),
      VENDOR: Number(byType.VENDOR || 0)
    },
    notificationRows: rows
  };
}

function buildChecklistRecords(ctx, linkIds) {
  if (!Array.isArray(linkIds) || linkIds.length === 0) {
    return {
      records: [],
      count: 0
    };
  }

  const records = [];
  let index = 0;

  SCENARIO_ROTATION.forEach((scenarioKey) => {
    STEP_ROTATION.forEach((stepKey) => {
      const items = [];
      for (let i = 0; i < 4; i += 1) {
        const itemOrder = i + 1;
        items.push({
          itemId: `${stepKey}_item_${itemOrder}`,
          title: `[SEED] ${stepKey} task ${itemOrder}`,
          linkRegistryId: linkIds[(index + i) % linkIds.length],
          order: itemOrder
        });
      }

      records.push({
        collection: 'checklists',
        docId: buildDocId('seed_chk', ctx.safeSeedRunId, index + 1, 3),
        data: {
          scenario: scenarioKey,
          step: stepKey,
          scenarioKey,
          stepKey,
          title: `[SEED] ${scenarioKey}/${stepKey} checklist`,
          items,
          createdAt: ctx.timestamp(),
          seed: ctx.seedMetadata
        }
      });

      index += 1;
    });
  });

  return {
    records,
    count: records.length
  };
}

function buildSourceRefDocId(ctx, cityPackKey) {
  return `seed_sr_${ctx.safeSeedRunId}_${cityPackKey.replace(/-/g, '_')}`;
}

function buildCityPackDocId(ctx, cityPackKey) {
  return `seed_cp_${ctx.safeSeedRunId}_${cityPackKey.replace(/-/g, '_')}`;
}

function buildCityPackAndSourceRecords(ctx, includeCityPacks) {
  if (!includeCityPacks) {
    return {
      records: [],
      cityPackCount: 0,
      sourceRefCount: 0,
      cityPackIds: [],
      sourceRefIds: []
    };
  }

  const records = [];
  const cityPackIds = [];
  const sourceRefIds = [];
  const validFrom = ctx.now instanceof Date ? ctx.now : new Date();
  const validUntil = addDays(validFrom, 180);

  CITY_PACK_BLUEPRINTS.forEach((city, index) => {
    const sourceRefId = buildSourceRefDocId(ctx, city.cityPackKey);
    const cityPackId = buildCityPackDocId(ctx, city.cityPackKey);

    records.push({
      collection: 'source_refs',
      docId: sourceRefId,
      data: {
        url: city.sourceUrl,
        status: 'active',
        validFrom,
        validUntil,
        lastResult: 'seed_initialized',
        lastCheckAt: ctx.timestamp(),
        contentHash: null,
        riskLevel: 'low',
        sourceType: 'official',
        requiredLevel: 'required',
        authorityLevel: city.state === 'NY' || city.state === 'NJ' || city.state === 'MA' || city.state === 'CA' || city.state === 'MI' || city.state === 'IL' || city.state === 'TX'
          ? 'state'
          : 'local',
        confidenceScore: 95,
        lastAuditStage: 'light',
        evidenceLatestId: null,
        usedByCityPackIds: [cityPackId],
        createdAt: ctx.timestamp(),
        updatedAt: ctx.timestamp(),
        seedOrder: index + 1,
        seed: ctx.seedMetadata
      }
    });

    records.push({
      collection: 'city_packs',
      docId: cityPackId,
      data: {
        cityPackKey: city.cityPackKey,
        region: city.region,
        state: city.state,
        name: city.displayName,
        status: 'draft',
        sourceRefs: [sourceRefId],
        templateRefs: [],
        validUntil,
        allowedIntents: ['CITY_PACK'],
        rules: [],
        targetingRules: [
          {
            field: 'regionKey',
            op: '==',
            value: city.cityPackKey,
            effect: 'include'
          }
        ],
        slots: [],
        description: `[SEED] ${city.displayName} city pack bootstrap`,
        metadata: {
          displayName: city.displayName,
          region: city.region,
          state: city.state,
          sources: [city.sourceUrl],
          notes: ['createdBySeed', 'initialScope:trial-bootstrap']
        },
        requestId: null,
        basePackId: null,
        overrides: null,
        slotContents: {},
        slotSchemaVersion: 'v1_fixed_8_slots',
        packClass: 'regional',
        language: 'ja',
        nationwidePolicy: null,
        createdAt: ctx.timestamp(),
        updatedAt: ctx.timestamp(),
        seed: ctx.seedMetadata
      }
    });

    cityPackIds.push(cityPackId);
    sourceRefIds.push(sourceRefId);
  });

  return {
    records,
    cityPackCount: cityPackIds.length,
    sourceRefCount: sourceRefIds.length,
    cityPackIds,
    sourceRefIds
  };
}

function buildDeliveryAndEventRecords(ctx, options) {
  const userIds = Array.isArray(options && options.userIds) ? options.userIds : [];
  const notifications = Array.isArray(options && options.notificationRows) ? options.notificationRows : [];
  if (!userIds.length || !notifications.length) {
    return {
      records: [],
      deliveryCount: 0,
      eventCount: 0
    };
  }

  const records = [];
  let eventIndex = 0;

  userIds.forEach((lineUserId, index) => {
    const notification = notifications[index % notifications.length];
    const deliveryId = buildDocId('seed_dlv', ctx.safeSeedRunId, index + 1, 5);
    const sentAt = addMinutes(addDays(ctx.now, -(index % 14)), index % 60);
    const readAt = index % 2 === 0 ? addMinutes(sentAt, 15) : null;
    const clickAt = index % 3 === 0 ? addMinutes(sentAt, 45) : null;

    records.push({
      collection: 'notification_deliveries',
      docId: deliveryId,
      data: {
        notificationId: notification.docId,
        lineUserId,
        notificationCategory: notification.data.notificationCategory || null,
        sentAt,
        delivered: true,
        state: 'delivered',
        deliveredAt: sentAt,
        readAt,
        clickAt,
        sealed: false,
        seed: ctx.seedMetadata
      }
    });

    const openEventId = buildDocId('seed_evt', ctx.safeSeedRunId, eventIndex + 1, 6);
    records.push({
      collection: 'events',
      docId: openEventId,
      data: {
        lineUserId,
        type: 'open',
        ref: {
          notificationId: notification.docId,
          deliveryId
        },
        createdAt: addMinutes(sentAt, 2),
        seed: ctx.seedMetadata
      }
    });
    eventIndex += 1;

    if (clickAt) {
      const clickEventId = buildDocId('seed_evt', ctx.safeSeedRunId, eventIndex + 1, 6);
      records.push({
        collection: 'events',
        docId: clickEventId,
        data: {
          lineUserId,
          type: 'click',
          ref: {
            notificationId: notification.docId,
            deliveryId
          },
          createdAt: clickAt,
          seed: ctx.seedMetadata
        }
      });
      eventIndex += 1;
    }
  });

  const deliveryCount = records.filter((row) => row.collection === 'notification_deliveries').length;
  const eventCount = records.filter((row) => row.collection === 'events').length;

  return {
    records,
    deliveryCount,
    eventCount
  };
}

function buildTrialSeedPlan(options, ctxOverrides) {
  const opts = options && typeof options === 'object' ? options : {};
  const now = ctxOverrides && ctxOverrides.now ? ctxOverrides.now : new Date();
  const context = {
    seedRunId: opts.seedRunId,
    seedKind: opts.seedKind,
    envName: opts.envName,
    safeSeedRunId: normalizeDocToken(opts.seedRunId),
    seedMetadata: buildSeedMetadata({
      seedRunId: opts.seedRunId,
      seedKind: opts.seedKind,
      envName: opts.envName
    }),
    now,
    timestamp: ctxOverrides && typeof ctxOverrides.timestamp === 'function' ? ctxOverrides.timestamp : serverTimestamp
  };

  const links = buildLinkRecords(context, opts.links, opts.vendors);
  const users = buildUserRecords(context, opts.users);
  const checklists = buildChecklistRecords(context, links.linkIds);
  const notifications = buildNotificationRecords(context, {
    includeTemplates: opts.templates,
    linkIds: links.linkIds,
    vendorLinkIds: links.vendorLinkIds
  });
  const city = buildCityPackAndSourceRecords(context, opts.cityPacks);
  const deliveriesAndEvents = buildDeliveryAndEventRecords(context, {
    userIds: users.userIds,
    notificationRows: notifications.notificationRows
  });

  const targets = []
    .concat(links.records)
    .concat(users.records)
    .concat(checklists.records)
    .concat(notifications.records)
    .concat(city.records)
    .concat(deliveriesAndEvents.records);

  const summary = {
    users: users.count,
    notifications: notifications.count,
    links: links.linkCount,
    vendors: links.vendorCatalogCount,
    cityPacks: city.cityPackCount,
    sourceRefs: city.sourceRefCount,
    checklists: checklists.count,
    notificationDeliveries: deliveriesAndEvents.deliveryCount,
    events: deliveriesAndEvents.eventCount,
    targets: targets.length
  };

  return {
    ctx: context,
    targets,
    summary,
    created: {
      users: summary.users,
      notifications: summary.notifications,
      links: summary.links,
      cityPacks: summary.cityPacks,
      vendors: summary.vendors,
      checklists: summary.checklists,
      notificationDeliveries: summary.notificationDeliveries,
      events: summary.events,
      sourceRefs: summary.sourceRefs
    }
  };
}

function buildManifestPayload(ctx, targets, summary, status) {
  return {
    seedRunId: ctx.seedRunId,
    seedKind: ctx.seedKind,
    envName: ctx.envName,
    createdAt: ctx.timestamp(),
    summary,
    targets: targets.map((row) => ({ collection: row.collection, docId: row.docId })),
    status,
    seed: ctx.seedMetadata
  };
}

function resolveBulkWriter(db, deps) {
  if (deps && typeof deps.createBulkWriter === 'function') {
    return deps.createBulkWriter(db);
  }
  if (db && typeof db.bulkWriter === 'function') {
    return db.bulkWriter();
  }
  return null;
}

async function closeBulkWriter(writer) {
  if (!writer) return;
  if (typeof writer.close === 'function') {
    await writer.close();
    return;
  }
  if (typeof writer.flush === 'function') {
    await writer.flush();
  }
}

function chunkRows(rows, size) {
  const chunkSize = Math.max(1, Number(size) || BATCH_CHUNK_SIZE);
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }
  return chunks;
}

async function writeRecordsWithBulkWriterFallback(db, targets, deps) {
  const rows = Array.isArray(targets) ? targets : [];
  if (rows.length === 0) return { mode: 'none', fallbackReason: null };

  const writer = resolveBulkWriter(db, deps);
  if (writer && typeof writer.set === 'function') {
    rows.forEach((row) => {
      writer.set(db.collection(row.collection).doc(row.docId), row.data, { merge: false });
    });
    await closeBulkWriter(writer);
    return { mode: 'bulkWriter', fallbackReason: null };
  }

  if (db && typeof db.batch === 'function') {
    const chunks = chunkRows(rows, BATCH_CHUNK_SIZE);
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((row) => {
        batch.set(db.collection(row.collection).doc(row.docId), row.data, { merge: false });
      });
      await batch.commit();
    }
    return { mode: 'batch', fallbackReason: 'bulkWriter_unavailable' };
  }

  for (const row of rows) {
    await db.collection(row.collection).doc(row.docId).set(row.data, { merge: false });
  }
  return { mode: 'sequential', fallbackReason: 'bulkWriter_and_batch_unavailable' };
}

async function deleteRecordsWithBulkWriterFallback(db, targets, deps) {
  const rows = Array.isArray(targets) ? targets : [];
  if (rows.length === 0) return { mode: 'none', fallbackReason: null };

  const writer = resolveBulkWriter(db, deps);
  if (writer && typeof writer.delete === 'function') {
    rows.forEach((row) => {
      writer.delete(db.collection(row.collection).doc(row.docId));
    });
    await closeBulkWriter(writer);
    return { mode: 'bulkWriter', fallbackReason: null };
  }

  if (db && typeof db.batch === 'function') {
    const chunks = chunkRows(rows, BATCH_CHUNK_SIZE);
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((row) => {
        batch.delete(db.collection(row.collection).doc(row.docId));
      });
      await batch.commit();
    }
    return { mode: 'batch', fallbackReason: 'bulkWriter_unavailable' };
  }

  for (const row of rows) {
    await db.collection(row.collection).doc(row.docId).delete();
  }
  return { mode: 'sequential', fallbackReason: 'bulkWriter_and_batch_unavailable' };
}

async function ensureTargetsDoNotExist(db, targets) {
  for (const row of targets || []) {
    const snap = await db.collection(row.collection).doc(row.docId).get();
    if (snap && snap.exists) {
      throw new Error(`target already exists: ${row.collection}/${row.docId}`);
    }
  }
}

function normalizeManifestTargets(manifest) {
  const rawTargets = Array.isArray(manifest && manifest.targets) ? manifest.targets : [];
  const dedup = new Set();
  const targets = [];
  rawTargets.forEach((row) => {
    const collection = typeof (row && row.collection) === 'string' ? row.collection.trim() : '';
    const docId = typeof (row && row.docId) === 'string' ? row.docId.trim() : '';
    if (!collection || !docId) return;
    const key = `${collection}/${docId}`;
    if (dedup.has(key)) return;
    dedup.add(key);
    targets.push({ collection, docId });
  });
  return targets;
}

function buildDeleteSummaryByCollection(targets) {
  return (targets || []).reduce((acc, row) => {
    const key = row.collection;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function runTrialSeedSetup(rawOptions, deps) {
  const opts = normalizeSetupOptions(rawOptions, deps);
  const db = deps && deps.db ? deps.db : getDb();
  const now = deps && deps.now ? deps.now : new Date();
  const timestamp = deps && typeof deps.serverTimestamp === 'function' ? deps.serverTimestamp : serverTimestamp;

  const plan = buildTrialSeedPlan(opts, {
    now,
    timestamp
  });

  const output = {
    ok: true,
    seedRunId: opts.seedRunId,
    created: plan.created,
    dryRun: opts.dryRun,
    planOnly: opts.planOnly,
    summary: plan.summary
  };

  if (opts.planOnly) return output;

  const manifestRef = db.collection(SEED_RUNS_COLLECTION).doc(opts.seedRunId);
  const manifestSnap = await manifestRef.get();
  if (manifestSnap && manifestSnap.exists) {
    throw new Error(`seed run already exists: ${opts.seedRunId}`);
  }

  await ensureTargetsDoNotExist(db, plan.targets);

  if (opts.dryRun) {
    return output;
  }

  const runningManifest = buildManifestPayload(plan.ctx, plan.targets, plan.summary, 'running');
  await manifestRef.set(runningManifest, { merge: false });

  try {
    const writeInfo = await writeRecordsWithBulkWriterFallback(db, plan.targets, deps);
    await manifestRef.set({
      status: 'completed',
      completedAt: timestamp(),
      writeMode: writeInfo.mode,
      writeFallbackReason: writeInfo.fallbackReason,
      summary: plan.summary
    }, { merge: true });

    output.writeMode = writeInfo.mode;
    output.writeFallbackReason = writeInfo.fallbackReason;
    return output;
  } catch (err) {
    await manifestRef.set({
      status: 'failed',
      failedAt: timestamp(),
      failureMessage: err && err.message ? err.message : 'unknown_error'
    }, { merge: true });
    throw err;
  }
}

async function runTrialSeedPurge(rawOptions, deps) {
  const opts = normalizePurgeOptions(rawOptions, deps);
  const db = deps && deps.db ? deps.db : getDb();
  const timestamp = deps && typeof deps.serverTimestamp === 'function' ? deps.serverTimestamp : serverTimestamp;

  const manifestRef = db.collection(SEED_RUNS_COLLECTION).doc(opts.seedRunId);
  const manifestSnap = await manifestRef.get();
  if (!manifestSnap || !manifestSnap.exists) {
    throw new Error(`seed run not found: ${opts.seedRunId}`);
  }

  const manifest = manifestSnap.data();
  const targets = normalizeManifestTargets(manifest);
  const byCollection = buildDeleteSummaryByCollection(targets);

  const output = {
    ok: true,
    seedRunId: opts.seedRunId,
    deleted: {
      targets: targets.length,
      manifest: 1,
      byCollection
    },
    dryRun: opts.dryRun
  };

  if (opts.dryRun) {
    return output;
  }

  await manifestRef.set({
    purgeStatus: 'running',
    purgeStartedAt: timestamp()
  }, { merge: true });

  try {
    const deleteInfo = await deleteRecordsWithBulkWriterFallback(db, targets, deps);
    await manifestRef.delete();
    output.deleteMode = deleteInfo.mode;
    output.deleteFallbackReason = deleteInfo.fallbackReason;
    return output;
  } catch (err) {
    await manifestRef.set({
      purgeStatus: 'failed',
      purgeFailedAt: timestamp(),
      purgeFailureMessage: err && err.message ? err.message : 'unknown_error'
    }, { merge: true });
    throw err;
  }
}

module.exports = {
  CONFIRM_DELETE_TOKEN,
  SEED_RUNS_COLLECTION,
  parseTrialSeedSetupArgs,
  parseTrialSeedPurgeArgs,
  buildTrialSeedPlan,
  runTrialSeedSetup,
  runTrialSeedPurge
};
