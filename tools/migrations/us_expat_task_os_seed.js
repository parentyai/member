'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { getDb, serverTimestamp } = require('../../src/infra/firestore');
const stepRulesRepo = require('../../src/repos/firestore/stepRulesRepo');
const taskContentsRepo = require('../../src/repos/firestore/taskContentsRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const cityPacksRepo = require('../../src/repos/firestore/cityPacksRepo');
const richMenuTemplatesRepo = require('../../src/repos/firestore/richMenuTemplatesRepo');
const richMenuAssignmentRulesRepo = require('../../src/repos/firestore/richMenuAssignmentRulesRepo');
const richMenuPolicyRepo = require('../../src/repos/firestore/richMenuPolicyRepo');
const { TASK_CATEGORY_VALUES, CITY_PACK_MODULE_VALUES } = require('../../src/domain/tasks/usExpatTaxonomy');

const DEFAULT_DATASET_PATH = path.join(__dirname, 'data', 'us_expat_task_os_seed.json');
const DEFAULT_MODE = 'dry-run';
const ALLOWED_MODE = new Set(['dry-run', 'validate', 'apply', 'rollback']);
const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeMode(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return DEFAULT_MODE;
  if (!ALLOWED_MODE.has(normalized)) throw new Error(`unsupported mode: ${value}`);
  return normalized;
}

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`invalid boolean: ${value}`);
}

function parseArgs(argv) {
  const opts = {
    mode: DEFAULT_MODE,
    dataset: DEFAULT_DATASET_PATH,
    seedRunId: '',
    actor: 'task_os_seed',
    allowProd: false,
    enableRichMenu: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      opts.mode = normalizeMode(argv[++i]);
      continue;
    }
    if (arg === '--dataset') {
      opts.dataset = path.resolve(process.cwd(), argv[++i]);
      continue;
    }
    if (arg === '--seedRunId') {
      opts.seedRunId = normalizeText(argv[++i]);
      continue;
    }
    if (arg === '--actor') {
      opts.actor = normalizeText(argv[++i]) || 'task_os_seed';
      continue;
    }
    if (arg === '--allow-prod') {
      opts.allowProd = true;
      continue;
    }
    if (arg === '--enable-rich-menu') {
      opts.enableRichMenu = parseBool(argv[++i], false);
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }
  if (!opts.seedRunId) {
    const now = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    opts.seedRunId = `seed_usx_${now}`;
  }
  return opts;
}

function ensureSafeEnv(opts) {
  const envName = normalizeText(process.env.ENV_NAME || process.env.NODE_ENV || 'local').toLowerCase();
  const prodLike = envName === 'prod' || envName === 'production';
  if ((opts.mode === 'apply' || opts.mode === 'rollback') && prodLike && !opts.allowProd) {
    throw new Error('prod apply/rollback requires --allow-prod');
  }
  return { envName, prodLike };
}

function readDataset(datasetPath) {
  const text = fs.readFileSync(datasetPath, 'utf8');
  return JSON.parse(text);
}

function detectCycles(ruleMap) {
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];
  const stack = [];

  function walk(ruleId) {
    if (visiting.has(ruleId)) {
      const idx = stack.indexOf(ruleId);
      const cycle = idx >= 0 ? stack.slice(idx).concat(ruleId) : [ruleId, ruleId];
      cycles.push(cycle);
      return;
    }
    if (visited.has(ruleId)) return;
    visiting.add(ruleId);
    stack.push(ruleId);
    const row = ruleMap.get(ruleId);
    const deps = Array.isArray(row && row.dependsOn) ? row.dependsOn : [];
    deps.forEach((dep) => {
      if (!ruleMap.has(dep)) return;
      walk(dep);
    });
    stack.pop();
    visiting.delete(ruleId);
    visited.add(ruleId);
  }

  Array.from(ruleMap.keys()).forEach((ruleId) => walk(ruleId));
  return cycles;
}

function collectRuleIds(dataset) {
  return new Set((Array.isArray(dataset.rules) ? dataset.rules : []).map((item) => normalizeText(item && item.ruleId)).filter(Boolean));
}

function collectReferencedLinkIds(dataset) {
  const ids = new Set();
  (Array.isArray(dataset.rules) ? dataset.rules : []).forEach((rule) => {
    const nudgeLink = normalizeText(rule && rule.nudgeTemplate && rule.nudgeTemplate.linkRegistryId);
    if (nudgeLink) ids.add(nudgeLink);
    const helpLinks = Array.isArray(rule && rule.meaning && rule.meaning.helpLinkRegistryIds)
      ? rule.meaning.helpLinkRegistryIds
      : [];
    helpLinks.forEach((id) => {
      const normalized = normalizeText(id);
      if (normalized) ids.add(normalized);
    });
    const vendors = Array.isArray(rule && rule.recommendedVendorLinkIds) ? rule.recommendedVendorLinkIds : [];
    vendors.forEach((id) => {
      const normalized = normalizeText(id);
      if (normalized) ids.add(normalized);
    });
  });
  (Array.isArray(dataset.taskContents) ? dataset.taskContents : []).forEach((item) => {
    ['videoLinkId', 'actionLinkId'].forEach((field) => {
      const normalized = normalizeText(item && item[field]);
      if (normalized) ids.add(normalized);
    });
    const vendors = Array.isArray(item && item.recommendedVendorLinkIds) ? item.recommendedVendorLinkIds : [];
    vendors.forEach((id) => {
      const normalized = normalizeText(id);
      if (normalized) ids.add(normalized);
    });
  });
  return ids;
}

async function validateDataset(dataset, options) {
  const errors = [];
  const warnings = [];
  const links = Array.isArray(dataset.links) ? dataset.links : [];
  const rules = Array.isArray(dataset.rules) ? dataset.rules : [];
  const taskContents = Array.isArray(dataset.taskContents) ? dataset.taskContents : [];

  if (!rules.length) errors.push('rules is empty');
  if (!taskContents.length) errors.push('taskContents is empty');

  const ruleMap = new Map();
  rules.forEach((rule) => {
    const ruleId = normalizeText(rule && rule.ruleId);
    if (!ruleId) {
      errors.push('ruleId missing');
      return;
    }
    if (ruleMap.has(ruleId)) errors.push(`duplicate ruleId: ${ruleId}`);
    ruleMap.set(ruleId, rule);

    const category = normalizeText(rule.category).toUpperCase();
    if (!TASK_CATEGORY_VALUES.includes(category)) {
      errors.push(`rule ${ruleId} category invalid: ${rule.category}`);
    }
    const deps = Array.isArray(rule.dependsOn) ? rule.dependsOn : [];
    if (deps.length > 10) errors.push(`rule ${ruleId} dependsOn > 10`);
    deps.forEach((dep) => {
      if (!ruleMap.has(dep) && !rules.find((row) => normalizeText(row.ruleId) === normalizeText(dep))) {
        errors.push(`rule ${ruleId} dependsOn missing rule: ${dep}`);
      }
    });
  });

  const cycles = detectCycles(ruleMap);
  if (cycles.length) {
    cycles.forEach((cycle) => errors.push(`cycle detected: ${cycle.join(' -> ')}`));
  }

  const contentMap = new Map();
  taskContents.forEach((content) => {
    const taskKey = normalizeText(content && content.taskKey);
    if (!taskKey) {
      errors.push('taskContents.taskKey missing');
      return;
    }
    if (contentMap.has(taskKey)) errors.push(`duplicate taskContents.taskKey: ${taskKey}`);
    contentMap.set(taskKey, content);
    if (!ruleMap.has(taskKey)) {
      errors.push(`taskContents.taskKey not found in rules: ${taskKey}`);
    }
    const category = normalizeText(content.category).toUpperCase();
    if (category && !TASK_CATEGORY_VALUES.includes(category)) {
      errors.push(`taskContent ${taskKey} category invalid: ${content.category}`);
    }
  });

  const linkSeedIds = new Set(links.map((item) => normalizeText(item && item.id)).filter(Boolean));
  const referencedLinkIds = collectReferencedLinkIds(dataset);
  for (const linkId of referencedLinkIds) {
    if (linkSeedIds.has(linkId)) continue;
    // eslint-disable-next-line no-await-in-loop
    const existing = await linkRegistryRepo.getLink(linkId).catch(() => null);
    if (!existing) errors.push(`referenced link not found: ${linkId}`);
  }

  links.forEach((link) => {
    const id = normalizeText(link && link.id);
    if (!id) errors.push('links.id missing');
    const url = normalizeText(link && link.url);
    if (!/^https?:\/\//i.test(url)) errors.push(`link url invalid: ${id}`);
  });

  const cpRec = dataset.cityPackRecommendations && typeof dataset.cityPackRecommendations === 'object'
    ? dataset.cityPackRecommendations
    : {};
  const allRecEntries = [];
  if (cpRec.default && Array.isArray(cpRec.default.recommendedTasks)) {
    allRecEntries.push(...cpRec.default.recommendedTasks);
  }
  if (cpRec.byRegionKey && typeof cpRec.byRegionKey === 'object') {
    Object.values(cpRec.byRegionKey).forEach((row) => {
      if (row && Array.isArray(row.recommendedTasks)) allRecEntries.push(...row.recommendedTasks);
    });
  }
  allRecEntries.forEach((entry) => {
    const ruleId = normalizeText(entry && entry.ruleId);
    if (!ruleMap.has(ruleId)) {
      errors.push(`cityPack recommendedTasks missing rule: ${ruleId}`);
    }
    const module = normalizeText(entry && entry.module).toLowerCase();
    if (module && !CITY_PACK_MODULE_VALUES.includes(module)) {
      errors.push(`cityPack module invalid: ${module}`);
    }
  });

  if (options && options.mode === 'validate') {
    const db = getDb();
    const richMenuTemplate = dataset.richMenuTemplate && typeof dataset.richMenuTemplate === 'object'
      ? dataset.richMenuTemplate
      : null;
    if (richMenuTemplate) {
      const existing = await db.collection('rich_menu_templates').doc(normalizeText(richMenuTemplate.templateId)).get();
      if (existing.exists) warnings.push(`rich menu template already exists: ${richMenuTemplate.templateId}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      links: links.length,
      rules: rules.length,
      taskContents: taskContents.length,
      cycles: cycles.length
    }
  };
}

function normalizeRegionCandidates(cityPack) {
  const row = cityPack && typeof cityPack === 'object' ? cityPack : {};
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const set = new Set();
  [row.id, row.regionKey, metadata.regionKey, row.name].forEach((item) => {
    const normalized = normalizeText(item).toLowerCase();
    if (normalized) set.add(normalized);
  });
  if (Array.isArray(metadata.regionKeys)) {
    metadata.regionKeys.forEach((item) => {
      const normalized = normalizeText(item).toLowerCase();
      if (normalized) set.add(normalized);
    });
  }
  return set;
}

function mergeRecommendedTasks(existing, additions) {
  const out = [];
  const seen = new Set();
  const input = [];
  if (Array.isArray(existing)) input.push(...existing);
  if (Array.isArray(additions)) input.push(...additions);
  input.forEach((entry) => {
    const ruleId = normalizeText(entry && entry.ruleId);
    if (!ruleId) return;
    const module = normalizeText(entry && entry.module).toLowerCase() || null;
    const priorityBoost = Number.isFinite(Number(entry && entry.priorityBoost)) ? Math.floor(Number(entry.priorityBoost)) : null;
    const key = `${ruleId}::${module || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ruleId, module, priorityBoost });
  });
  return out;
}

function mergeModules(existing, additions) {
  const out = new Set();
  (Array.isArray(existing) ? existing : []).forEach((item) => {
    const normalized = normalizeText(item).toLowerCase();
    if (normalized) out.add(normalized);
  });
  (Array.isArray(additions) ? additions : []).forEach((item) => {
    const normalized = normalizeText(item).toLowerCase();
    if (normalized) out.add(normalized);
  });
  return Array.from(out.values());
}

function toRichMenuTemplateInput(raw) {
  const payload = raw && typeof raw === 'object' ? raw : null;
  if (!payload) return null;
  const areas = Array.isArray(payload.areas) ? payload.areas : [];
  return {
    templateId: normalizeText(payload.templateId),
    kind: 'default',
    status: 'active',
    target: { planTier: null, phaseId: null, locale: 'ja' },
    layout: {
      size: 'large',
      areas: areas.map((area, index) => ({
        label: `slot_${index + 1}`,
        bounds: {
          x: Number(area && area.x) || 0,
          y: Number(area && area.y) || 0,
          width: Number(area && area.width) || 833,
          height: Number(area && area.height) || 281
        },
        actionType: normalizeText(area && area.action && area.action.type).toLowerCase() || 'message',
        actionPayload: (() => {
          const type = normalizeText(area && area.action && area.action.type).toLowerCase();
          if (type === 'message') return { text: normalizeText(area && area.action && area.action.text) };
          if (type === 'postback') return { data: normalizeText(area && area.action && area.action.data) };
          if (type === 'uri') {
            const uri = normalizeText(area && area.action && area.action.uri);
            if (/^https?:\/\//i.test(uri)) return { uri };
            return { linkRegistryId: normalizeText(area && area.action && area.action.linkRegistryId) };
          }
          return { text: 'TODO一覧' };
        })()
      }))
    },
    lineMeta: {
      richMenuId: '',
      aliasId: null,
      imageAssetPath: null
    },
    version: 1,
    archived: false,
    description: normalizeText(payload.name) || 'US Expat Task OS default rich menu',
    labels: ['us_expat', 'task_os']
  };
}

async function applySeed(dataset, opts, context) {
  const db = getDb();
  const links = Array.isArray(dataset.links) ? dataset.links : [];
  const rules = Array.isArray(dataset.rules) ? dataset.rules : [];
  const taskContents = Array.isArray(dataset.taskContents) ? dataset.taskContents : [];

  let linksUpserted = 0;
  for (const link of links) {
    const id = normalizeText(link.id);
    if (!id) continue;
    // eslint-disable-next-line no-await-in-loop
    await db.collection('link_registry').doc(id).set(Object.assign({}, link, {
      seedRunId: opts.seedRunId,
      seedKind: 'us_expat_task_os',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }), { merge: true });
    linksUpserted += 1;
  }

  let rulesUpserted = 0;
  for (const rule of rules) {
    const ruleId = normalizeText(rule.ruleId);
    if (!ruleId) continue;
    const patch = Object.assign({}, rule, {
      ruleId,
      [FIELD_SCK]: normalizeText(rule.scenarioKey) || null,
      seedRunId: opts.seedRunId,
      seedKind: 'us_expat_task_os'
    });
    delete patch.scenarioKey;
    // eslint-disable-next-line no-await-in-loop
    await stepRulesRepo.upsertStepRule(ruleId, patch, opts.actor);
    rulesUpserted += 1;
  }

  let taskContentsUpserted = 0;
  for (const content of taskContents) {
    const taskKey = normalizeText(content.taskKey);
    if (!taskKey) continue;
    // eslint-disable-next-line no-await-in-loop
    await taskContentsRepo.upsertTaskContent(taskKey, Object.assign({}, content, {
      taskKey,
      seedRunId: opts.seedRunId,
      seedKind: 'us_expat_task_os'
    }), opts.actor);
    taskContentsUpserted += 1;
  }

  const cityPackRecommendations = dataset.cityPackRecommendations && typeof dataset.cityPackRecommendations === 'object'
    ? dataset.cityPackRecommendations
    : {};
  const defaultRec = cityPackRecommendations.default && typeof cityPackRecommendations.default === 'object'
    ? cityPackRecommendations.default
    : { modules: [], recommendedTasks: [] };
  const byRegion = cityPackRecommendations.byRegionKey && typeof cityPackRecommendations.byRegionKey === 'object'
    ? cityPackRecommendations.byRegionKey
    : {};

  const cityPacks = await cityPacksRepo.listCityPacks({ limit: 500 }).catch(() => []);
  let cityPacksUpdated = 0;
  for (const pack of cityPacks) {
    const candidates = normalizeRegionCandidates(pack);
    let rec = {
      modules: Array.isArray(defaultRec.modules) ? defaultRec.modules : [],
      recommendedTasks: Array.isArray(defaultRec.recommendedTasks) ? defaultRec.recommendedTasks : []
    };
    Object.keys(byRegion).forEach((regionKey) => {
      if (!candidates.has(String(regionKey).toLowerCase())) return;
      const entry = byRegion[regionKey] && typeof byRegion[regionKey] === 'object' ? byRegion[regionKey] : {};
      rec = {
        modules: mergeModules(rec.modules, Array.isArray(entry.modules) ? entry.modules : []),
        recommendedTasks: mergeRecommendedTasks(rec.recommendedTasks, Array.isArray(entry.recommendedTasks) ? entry.recommendedTasks : [])
      };
    });
    const nextModules = mergeModules(pack.modules, rec.modules);
    const nextRecommended = mergeRecommendedTasks(pack.recommendedTasks, rec.recommendedTasks);
    // eslint-disable-next-line no-await-in-loop
    await cityPacksRepo.updateCityPack(pack.id, {
      modules: nextModules,
      recommendedTasks: nextRecommended,
      seedRunId: opts.seedRunId,
      seedKind: 'us_expat_task_os',
      updatedBy: opts.actor
    });
    cityPacksUpdated += 1;
  }

  const templateInput = toRichMenuTemplateInput(dataset.richMenuTemplate);
  let richMenuTemplateId = null;
  let richMenuRuleId = null;
  if (templateInput && templateInput.templateId) {
    const template = await richMenuTemplatesRepo.upsertRichMenuTemplate(templateInput, opts.actor);
    richMenuTemplateId = template && template.templateId ? template.templateId : null;
    const ruleId = `seed_${templateInput.templateId}_default`;
    await richMenuAssignmentRulesRepo.upsertRichMenuAssignmentRule({
      ruleId,
      kind: 'default',
      status: 'active',
      templateId: templateInput.templateId,
      priority: 100,
      target: { planTier: null, phaseId: null, locale: 'ja' },
      description: 'Seeded default assignment for US Expat Task OS'
    }, opts.actor);
    richMenuRuleId = ruleId;

    const currentPolicy = await richMenuPolicyRepo.getRichMenuPolicy().catch(() => null);
    const policyPatch = Object.assign({}, currentPolicy || {}, {
      defaultTemplateId: templateInput.templateId,
      fallbackTemplateId: templateInput.templateId,
      enabled: opts.enableRichMenu === true,
      updateEnabled: true
    });
    await richMenuPolicyRepo.setRichMenuPolicy(policyPatch, opts.actor);
  }

  await db.collection('seed_runs').doc(opts.seedRunId).set({
    seedRunId: opts.seedRunId,
    seedKind: 'us_expat_task_os',
    actor: opts.actor,
    mode: 'apply',
    envName: context.envName,
    richMenuEnabled: opts.enableRichMenu === true,
    stats: {
      linksUpserted,
      rulesUpserted,
      taskContentsUpserted,
      cityPacksUpdated,
      richMenuTemplateId,
      richMenuRuleId
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    rollbackState: 'active'
  }, { merge: true });

  return {
    linksUpserted,
    rulesUpserted,
    taskContentsUpserted,
    cityPacksUpdated,
    richMenuTemplateId,
    richMenuRuleId
  };
}

async function rollbackSeed(dataset, opts) {
  const db = getDb();
  const rules = Array.isArray(dataset.rules) ? dataset.rules : [];
  const taskContents = Array.isArray(dataset.taskContents) ? dataset.taskContents : [];
  const template = dataset.richMenuTemplate && typeof dataset.richMenuTemplate === 'object'
    ? dataset.richMenuTemplate
    : null;

  let rulesDisabled = 0;
  for (const rule of rules) {
    const ruleId = normalizeText(rule && rule.ruleId);
    if (!ruleId) continue;
    // eslint-disable-next-line no-await-in-loop
    await stepRulesRepo.upsertStepRule(ruleId, { enabled: false }, opts.actor).catch(() => null);
    rulesDisabled += 1;
  }

  let taskContentsArchived = 0;
  for (const content of taskContents) {
    const taskKey = normalizeText(content && content.taskKey);
    if (!taskKey) continue;
    // eslint-disable-next-line no-await-in-loop
    await taskContentsRepo.upsertTaskContent(taskKey, { archived: true }, opts.actor).catch(() => null);
    taskContentsArchived += 1;
  }

  if (template && template.templateId) {
    const ruleId = `seed_${template.templateId}_default`;
    await richMenuAssignmentRulesRepo.upsertRichMenuAssignmentRule({
      ruleId,
      kind: 'default',
      status: 'deprecated',
      templateId: template.templateId,
      priority: 1,
      target: { planTier: null, phaseId: null, locale: 'ja' },
      description: 'deprecated by seed rollback'
    }, opts.actor).catch(() => null);
  }

  await db.collection('seed_runs').doc(opts.seedRunId).set({
    rollbackState: 'rolled_back',
    rolledBackAt: serverTimestamp(),
    rolledBackBy: opts.actor,
    updatedAt: serverTimestamp()
  }, { merge: true });

  return {
    rulesDisabled,
    taskContentsArchived
  };
}

async function run(opts) {
  const context = ensureSafeEnv(opts);
  const dataset = readDataset(opts.dataset);
  const validation = await validateDataset(dataset, { mode: opts.mode });

  const summary = {
    ok: validation.ok,
    mode: opts.mode,
    seedRunId: opts.seedRunId,
    envName: context.envName,
    dataset: path.relative(process.cwd(), opts.dataset),
    validation
  };

  if (opts.mode === 'dry-run' || opts.mode === 'validate') {
    return summary;
  }

  if (!validation.ok) {
    throw new Error(`validation failed: ${validation.errors.join('; ')}`);
  }

  if (opts.mode === 'apply') {
    const result = await applySeed(dataset, opts, context);
    return Object.assign({}, summary, { apply: result, ok: true });
  }

  if (opts.mode === 'rollback') {
    const result = await rollbackSeed(dataset, opts);
    return Object.assign({}, summary, { rollback: result, ok: true });
  }

  throw new Error(`unsupported mode: ${opts.mode}`);
}

async function main(argv) {
  const opts = parseArgs(argv || process.argv);
  const output = await run(opts);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  validateDataset,
  run,
  main
};
