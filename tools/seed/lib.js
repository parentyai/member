'use strict';

const { getDb, serverTimestamp } = require('../../src/infra/firestore');

const PROD_ENV_NAMES = new Set(['prod', 'production']);
const SEED_RUNS_COLLECTION = 'seed_runs';
const CONFIRM_DELETE_TOKEN = 'SEED_DELETE';
const DEFAULT_SEED_KIND = 'demo';

const LINK_BLUEPRINTS = Object.freeze([
  { key: 'general-handbook', label: 'General Handbook', url: 'https://www.usa.gov/' },
  { key: 'immigration', label: 'Immigration Basics', url: 'https://www.uscis.gov/' },
  { key: 'finance', label: 'Financial Literacy', url: 'https://www.consumerfinance.gov/' },
  { key: 'tax', label: 'Tax Basics', url: 'https://www.irs.gov/' },
  { key: 'social-security', label: 'Social Security', url: 'https://www.ssa.gov/' },
  { key: 'health', label: 'Health Guidance', url: 'https://www.cdc.gov/' },
  { key: 'transport', label: 'Transport Guide', url: 'https://www.transportation.gov/' },
  { key: 'benefits', label: 'Benefits Finder', url: 'https://www.benefits.gov/' },
  { key: 'housing', label: 'Housing Support', url: 'https://www.hud.gov/' },
  { key: 'education', label: 'Education Resources', url: 'https://www.ed.gov/' },
  { key: 'labor', label: 'Labor Resources', url: 'https://www.dol.gov/' },
  { key: 'small-business', label: 'Small Business', url: 'https://www.sba.gov/' }
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

const STEP_LABELS = Object.freeze([
  {
    stepKey: '3mo',
    titlePrefix: '[SEED][STEP][3MO]',
    body: 'Three-month planning reminder for key setup tasks.',
    ctaText: 'Review 3 month checklist'
  },
  {
    stepKey: '1mo',
    titlePrefix: '[SEED][STEP][1MO]',
    body: 'One-month planning reminder for preparation tasks.',
    ctaText: 'Review 1 month checklist'
  },
  {
    stepKey: 'week',
    titlePrefix: '[SEED][STEP][WEEK]',
    body: 'Weekly planning reminder for critical actions.',
    ctaText: 'Review week checklist'
  },
  {
    stepKey: 'after1w',
    titlePrefix: '[SEED][STEP][AFTER1W]',
    body: 'After one week reminder for stabilization tasks.',
    ctaText: 'Review after 1 week checklist'
  }
]);

const VENDOR_BLUEPRINTS = Object.freeze([
  { vendorKey: 'insurance', vendorId: 'vendor-insurance', title: 'Insurance setup options' },
  { vendorKey: 'phone', vendorId: 'vendor-phone', title: 'Mobile carrier onboarding' },
  { vendorKey: 'bank', vendorId: 'vendor-bank', title: 'Bank account starter guide' },
  { vendorKey: 'utilities', vendorId: 'vendor-utilities', title: 'Utilities onboarding guide' },
  { vendorKey: 'transport', vendorId: 'vendor-transport', title: 'Transport pass onboarding' },
  { vendorKey: 'school', vendorId: 'vendor-school', title: 'School district onboarding' }
]);

function normalizeEnvName(value) {
  if (typeof value !== 'string' || !value.trim()) return 'local';
  return value.trim();
}

function isProdEnv(envName) {
  const normalized = String(envName || '').trim().toLowerCase();
  return PROD_ENV_NAMES.has(normalized);
}

function assertNonProdEnv(envName) {
  if (isProdEnv(envName)) {
    throw new Error('seed setup/purge is blocked when ENV_NAME is prod or production');
  }
}

function readArgValue(argv, index, label) {
  if (index >= argv.length) {
    throw new Error(`${label} value required`);
  }
  return argv[index];
}

function sanitizeToken(value, fallback) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function toUtcCompact(value) {
  const now = value instanceof Date ? value : new Date(value);
  const iso = Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();
  return iso.replace(/[-:TZ.]/g, '').slice(0, 14);
}

function buildDefaultSeedRunId(seedKind, envName, now) {
  const kindPart = sanitizeToken(seedKind, DEFAULT_SEED_KIND);
  const envPart = sanitizeToken(envName, 'local');
  return `seed_${kindPart}_${envPart}_${toUtcCompact(now || new Date())}`;
}

function parseSeedSetupArgs(argv, env) {
  const sourceEnv = env || process.env;
  const envName = normalizeEnvName(sourceEnv.ENV_NAME || sourceEnv.NODE_ENV || 'local');
  const opts = {
    seedRunId: '',
    kind: DEFAULT_SEED_KIND,
    dryRun: false,
    templatesOnly: false,
    cityPacksOnly: false,
    envName
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (arg === '--templatesOnly') {
      opts.templatesOnly = true;
      continue;
    }
    if (arg === '--cityPacksOnly') {
      opts.cityPacksOnly = true;
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
    throw new Error(`unknown option: ${arg}`);
  }

  if (opts.templatesOnly && opts.cityPacksOnly) {
    throw new Error('--templatesOnly and --cityPacksOnly cannot be used together');
  }

  assertNonProdEnv(opts.envName);

  if (!opts.seedRunId) {
    opts.seedRunId = buildDefaultSeedRunId(opts.kind, opts.envName, new Date());
  }

  return opts;
}

function parseSeedPurgeArgs(argv, env) {
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

  if (!opts.seedRunId) {
    throw new Error('--seedRunId required');
  }
  if (opts.confirm !== CONFIRM_DELETE_TOKEN) {
    throw new Error('purge requires --confirm SEED_DELETE');
  }

  assertNonProdEnv(opts.envName);

  return opts;
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
  const date = baseDate instanceof Date ? baseDate : new Date();
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + Number(days || 0));
  return next;
}

function buildLinkDocId(seedRunId, index) {
  return `seed_link_${seedRunId}_${String(index + 1).padStart(2, '0')}`;
}

function buildTemplateDocId(seedRunId, index) {
  return `seed_ntf_${seedRunId}_${String(index + 1).padStart(3, '0')}`;
}

function buildSourceRefDocId(seedRunId, cityPackKey) {
  return `seed_sr_${seedRunId}_${cityPackKey.replace(/-/g, '_')}`;
}

function buildCityPackDocId(seedRunId, cityPackKey) {
  return `seed_cp_${seedRunId}_${cityPackKey.replace(/-/g, '_')}`;
}

function buildLinkSeedRecords(ctx) {
  const records = LINK_BLUEPRINTS.map((item, index) => {
    const docId = buildLinkDocId(ctx.seedRunId, index);
    return {
      collection: 'link_registry',
      docId,
      data: {
        title: `[SEED][LINK] ${item.label}`,
        url: item.url,
        lastHealth: {
          state: 'OK',
          statusCode: 200,
          checkedAt: ctx.timestamp()
        },
        createdAt: ctx.timestamp(),
        seed: ctx.seedMetadata
      }
    };
  });
  return {
    records,
    linkDocIds: records.map((row) => row.docId)
  };
}

function buildNotificationRecord(ctx, index, payload) {
  return {
    collection: 'notifications',
    docId: buildTemplateDocId(ctx.seedRunId, index),
    data: {
      title: payload.title,
      body: payload.body,
      ctaText: payload.ctaText,
      linkRegistryId: payload.linkRegistryId,
      scenarioKey: payload.scenarioKey,
      stepKey: payload.stepKey,
      target: null,
      sourceRefs: [],
      notificationCategory: null,
      notificationType: payload.notificationType,
      notificationMeta: payload.notificationMeta || null,
      cityPackFallback: null,
      status: 'draft',
      scheduledAt: null,
      sentAt: null,
      createdBy: 'seed:setup',
      createdAt: ctx.timestamp(),
      seed: ctx.seedMetadata
    }
  };
}

function buildTemplateSeedRecords(ctx) {
  const records = [];
  let index = 0;

  const linkAt = (i) => ctx.linkDocIds[i % ctx.linkDocIds.length];
  const scenarioAt = (i) => (i % 2 === 0 ? 'A' : 'C');

  const generalTemplates = [
    {
      title: '[SEED][GENERAL] Welcome and orientation',
      body: 'Overview guidance for first-time setup and key navigation.',
      ctaText: 'Open orientation guide'
    },
    {
      title: '[SEED][GENERAL] Priority checklist',
      body: 'A compact checklist of common setup priorities for new members.',
      ctaText: 'View priority checklist'
    },
    {
      title: '[SEED][GENERAL] Document readiness',
      body: 'Prepare your documents and IDs before next admin tasks.',
      ctaText: 'Check document list'
    },
    {
      title: '[SEED][GENERAL] Support channels',
      body: 'Where to get support when you need direct help.',
      ctaText: 'See support options'
    }
  ];

  generalTemplates.forEach((row, localIndex) => {
    records.push(buildNotificationRecord(ctx, index++, {
      title: row.title,
      body: row.body,
      ctaText: row.ctaText,
      linkRegistryId: linkAt(localIndex),
      scenarioKey: scenarioAt(localIndex),
      stepKey: 'week',
      notificationType: 'GENERAL',
      notificationMeta: {
        seedCategory: 'general',
        templateOrder: localIndex + 1
      }
    }));
  });

  const announceTemplates = [
    {
      title: '[SEED][ANNOUNCE] Service update bulletin',
      body: 'Operations bulletin for upcoming service windows and changes.',
      ctaText: 'Read service bulletin'
    },
    {
      title: '[SEED][ANNOUNCE] Policy update notice',
      body: 'Notice about policy updates affecting routine procedures.',
      ctaText: 'Read policy notice'
    },
    {
      title: '[SEED][ANNOUNCE] Schedule reminder',
      body: 'Reminder about scheduled deadlines and recommended preparation.',
      ctaText: 'Review schedule'
    },
    {
      title: '[SEED][ANNOUNCE] System maintenance notice',
      body: 'Announcement for maintenance timing and expected impact.',
      ctaText: 'View maintenance info'
    }
  ];

  announceTemplates.forEach((row, localIndex) => {
    records.push(buildNotificationRecord(ctx, index++, {
      title: row.title,
      body: row.body,
      ctaText: row.ctaText,
      linkRegistryId: linkAt(4 + localIndex),
      scenarioKey: scenarioAt(4 + localIndex),
      stepKey: 'week',
      notificationType: 'ANNOUNCEMENT',
      notificationMeta: {
        seedCategory: 'announce',
        templateOrder: localIndex + 1
      }
    }));
  });

  STEP_LABELS.forEach((stepLabel, stepIndex) => {
    for (let i = 0; i < 2; i += 1) {
      const order = (stepIndex * 2) + i + 1;
      records.push(buildNotificationRecord(ctx, index++, {
        title: `${stepLabel.titlePrefix} #${i + 1}`,
        body: stepLabel.body,
        ctaText: stepLabel.ctaText,
        linkRegistryId: linkAt(8 + order),
        scenarioKey: scenarioAt(8 + order),
        stepKey: stepLabel.stepKey,
        notificationType: 'STEP',
        notificationMeta: {
          seedCategory: 'step',
          stepKey: stepLabel.stepKey,
          templateOrder: order
        }
      }));
    }
  });

  VENDOR_BLUEPRINTS.forEach((vendor, vendorIndex) => {
    const order = vendorIndex + 1;
    records.push(buildNotificationRecord(ctx, index++, {
      title: `[SEED][VENDOR] ${vendor.title}`,
      body: 'Vendor onboarding reference prepared for admin review and reuse.',
      ctaText: 'Open vendor guidance',
      linkRegistryId: linkAt(order),
      scenarioKey: scenarioAt(order),
      stepKey: 'week',
      notificationType: 'VENDOR',
      notificationMeta: {
        seedCategory: 'vendor',
        vendorKey: vendor.vendorKey,
        vendorId: vendor.vendorId,
        templateOrder: order
      }
    }));
  });

  return {
    records,
    counts: {
      templates: records.length,
      general: 4,
      announce: 4,
      step: 8,
      vendor: 6
    }
  };
}

function buildCityPackSeedRecords(ctx) {
  const records = [];
  const now = ctx.now instanceof Date ? ctx.now : new Date();
  const validUntil = addDays(now, 180);

  CITY_PACK_BLUEPRINTS.forEach((city, index) => {
    const sourceRefId = buildSourceRefDocId(ctx.seedRunId, city.cityPackKey);
    const cityPackId = buildCityPackDocId(ctx.seedRunId, city.cityPackKey);

    records.push({
      collection: 'source_refs',
      docId: sourceRefId,
      data: {
        url: city.sourceUrl,
        status: 'active',
        validFrom: now,
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
        usedByCityPackIds: [],
        createdAt: ctx.timestamp(),
        updatedAt: ctx.timestamp(),
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
          notes: ['createdBySeed', 'initialScope:city-pack-bootstrap']
        },
        requestId: null,
        basePackId: null,
        overrides: null,
        slotContents: {},
        slotSchemaVersion: 'city_pack_slot_v1',
        packClass: 'regional',
        language: 'en',
        nationwidePolicy: null,
        createdAt: ctx.timestamp(),
        updatedAt: ctx.timestamp(),
        seed: ctx.seedMetadata
      }
    });

    // Keep source ref to city pack relationship observable immediately for review screens.
    records[records.length - 2].data.usedByCityPackIds = [cityPackId];
    records[records.length - 2].data.seedOrder = index + 1;
  });

  return {
    records,
    counts: {
      cityPacks: CITY_PACK_BLUEPRINTS.length,
      sourceRefs: CITY_PACK_BLUEPRINTS.length
    }
  };
}

function buildManifestPayload(ctx, targets, summary, status) {
  return {
    seedRunId: ctx.seedRunId,
    seedKind: ctx.seedKind,
    envName: ctx.envName,
    createdAt: ctx.timestamp(),
    status,
    targets: targets.map((row) => ({
      collection: row.collection,
      docId: row.docId
    })),
    summary,
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

async function writeRecords(db, records, deps) {
  const writer = resolveBulkWriter(db, deps);
  if (writer && typeof writer.set === 'function') {
    records.forEach((row) => {
      writer.set(db.collection(row.collection).doc(row.docId), row.data, { merge: false });
    });
    await closeBulkWriter(writer);
    return { mode: 'bulkWriter', fallbackReason: null };
  }

  if (db && typeof db.batch === 'function') {
    const batch = db.batch();
    records.forEach((row) => {
      batch.set(db.collection(row.collection).doc(row.docId), row.data, { merge: false });
    });
    await batch.commit();
    return { mode: 'batch', fallbackReason: 'bulkWriter_unavailable' };
  }

  for (const row of records) {
    await db.collection(row.collection).doc(row.docId).set(row.data, { merge: false });
  }
  return { mode: 'sequential', fallbackReason: 'bulkWriter_and_batch_unavailable' };
}

async function deleteRecords(db, targets, deps) {
  const writer = resolveBulkWriter(db, deps);
  if (writer && typeof writer.delete === 'function') {
    targets.forEach((row) => {
      writer.delete(db.collection(row.collection).doc(row.docId));
    });
    await closeBulkWriter(writer);
    return { mode: 'bulkWriter', fallbackReason: null };
  }

  if (db && typeof db.batch === 'function') {
    const batch = db.batch();
    targets.forEach((row) => {
      batch.delete(db.collection(row.collection).doc(row.docId));
    });
    await batch.commit();
    return { mode: 'batch', fallbackReason: 'bulkWriter_unavailable' };
  }

  for (const row of targets) {
    await db.collection(row.collection).doc(row.docId).delete();
  }
  return { mode: 'sequential', fallbackReason: 'bulkWriter_and_batch_unavailable' };
}

async function ensureTargetsDoNotExist(db, targets) {
  for (const row of targets) {
    const snap = await db.collection(row.collection).doc(row.docId).get();
    if (snap && snap.exists) {
      throw new Error(`target already exists: ${row.collection}/${row.docId}`);
    }
  }
}

function normalizeSetupOptions(raw, deps) {
  const env = deps && deps.env ? deps.env : process.env;
  const envName = normalizeEnvName(raw && raw.envName ? raw.envName : (env.ENV_NAME || env.NODE_ENV || 'local'));
  assertNonProdEnv(envName);

  const seedKind = typeof (raw && raw.seedKind) === 'string' && raw.seedKind.trim()
    ? raw.seedKind.trim()
    : (typeof (raw && raw.kind) === 'string' && raw.kind.trim() ? raw.kind.trim() : DEFAULT_SEED_KIND);

  const seedRunId = typeof (raw && raw.seedRunId) === 'string' && raw.seedRunId.trim()
    ? raw.seedRunId.trim()
    : buildDefaultSeedRunId(seedKind, envName, deps && deps.now ? deps.now : new Date());

  const templatesOnly = Boolean(raw && raw.templatesOnly);
  const cityPacksOnly = Boolean(raw && raw.cityPacksOnly);
  if (templatesOnly && cityPacksOnly) {
    throw new Error('--templatesOnly and --cityPacksOnly cannot be used together');
  }

  return {
    seedRunId,
    seedKind,
    envName,
    dryRun: Boolean(raw && raw.dryRun),
    templatesOnly,
    cityPacksOnly
  };
}

function normalizePurgeOptions(raw, deps) {
  const env = deps && deps.env ? deps.env : process.env;
  const envName = normalizeEnvName(raw && raw.envName ? raw.envName : (env.ENV_NAME || env.NODE_ENV || 'local'));
  assertNonProdEnv(envName);

  const seedRunId = typeof (raw && raw.seedRunId) === 'string' ? raw.seedRunId.trim() : '';
  if (!seedRunId) throw new Error('--seedRunId required');

  const confirm = typeof (raw && raw.confirm) === 'string' ? raw.confirm.trim() : '';
  if (confirm !== CONFIRM_DELETE_TOKEN) {
    throw new Error('purge requires --confirm SEED_DELETE');
  }

  return {
    seedRunId,
    confirm,
    envName,
    dryRun: Boolean(raw && raw.dryRun)
  };
}

function buildSetupSummary(parts) {
  return {
    templates: parts.templateCounts.templates,
    links: parts.linkCount,
    cityPacks: parts.cityCounts.cityPacks,
    sourceRefs: parts.cityCounts.sourceRefs,
    targets: parts.targetCount
  };
}

async function runSeedSetup(rawOptions, deps) {
  const opts = normalizeSetupOptions(rawOptions, deps);
  const db = deps && deps.db ? deps.db : getDb();
  const now = deps && deps.now ? deps.now : new Date();
  const timestamp = deps && typeof deps.serverTimestamp === 'function' ? deps.serverTimestamp : serverTimestamp;

  const seedMetadata = buildSeedMetadata({
    seedRunId: opts.seedRunId,
    seedKind: opts.seedKind,
    envName: opts.envName
  });

  const ctx = {
    seedRunId: opts.seedRunId,
    seedKind: opts.seedKind,
    envName: opts.envName,
    seedMetadata,
    now,
    timestamp
  };

  const includeTemplates = opts.templatesOnly || !opts.cityPacksOnly;
  const includeCityPacks = opts.cityPacksOnly || !opts.templatesOnly;

  const links = includeTemplates
    ? buildLinkSeedRecords(ctx)
    : { records: [], linkDocIds: [] };

  const templates = includeTemplates
    ? buildTemplateSeedRecords(Object.assign({}, ctx, { linkDocIds: links.linkDocIds }))
    : { records: [], counts: { templates: 0, general: 0, announce: 0, step: 0, vendor: 0 } };

  const cityPacks = includeCityPacks
    ? buildCityPackSeedRecords(ctx)
    : { records: [], counts: { cityPacks: 0, sourceRefs: 0 } };

  const targets = [].concat(links.records, templates.records, cityPacks.records);
  const summary = buildSetupSummary({
    templateCounts: templates.counts,
    linkCount: links.records.length,
    cityCounts: cityPacks.counts,
    targetCount: targets.length
  });

  const manifestRef = db.collection(SEED_RUNS_COLLECTION).doc(opts.seedRunId);
  const manifestSnap = await manifestRef.get();
  if (manifestSnap && manifestSnap.exists) {
    throw new Error(`seed run already exists: ${opts.seedRunId}`);
  }

  await ensureTargetsDoNotExist(db, targets);

  const output = {
    ok: true,
    seedRunId: opts.seedRunId,
    created: {
      templates: summary.templates,
      cityPacks: summary.cityPacks,
      links: summary.links,
      sourceRefs: summary.sourceRefs
    },
    dryRun: opts.dryRun,
    summary
  };

  if (opts.dryRun) {
    return output;
  }

  const runningManifest = buildManifestPayload(ctx, targets, summary, 'running');
  await manifestRef.set(runningManifest, { merge: false });

  try {
    const writeInfo = await writeRecords(db, targets, deps);
    await manifestRef.set({
      status: 'completed',
      completedAt: timestamp(),
      writeMode: writeInfo.mode,
      writeFallbackReason: writeInfo.fallbackReason,
      summary
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

async function runSeedPurge(rawOptions, deps) {
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

  const output = {
    ok: true,
    seedRunId: opts.seedRunId,
    deleted: {
      targets: targets.length,
      manifest: 1
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
    const deleteInfo = await deleteRecords(db, targets, deps);
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
  parseSeedSetupArgs,
  parseSeedPurgeArgs,
  buildTemplateSeedRecords,
  buildCityPackSeedRecords,
  runSeedSetup,
  runSeedPurge
};
