#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getDb, serverTimestamp, resolveFirestoreProjectId } = require('../src/infra/firestore');
const usersRepo = require('../src/repos/firestore/usersRepo');
const cityPackRequestsRepo = require('../src/repos/firestore/cityPackRequestsRepo');
const cityPacksRepo = require('../src/repos/firestore/cityPacksRepo');
const sourceRefsRepo = require('../src/repos/firestore/sourceRefsRepo');
const linkRegistryRepo = require('../src/repos/firestore/linkRegistryRepo');
const emergencyProvidersRepo = require('../src/repos/firestore/emergencyProvidersRepo');
const emergencyRulesRepo = require('../src/repos/firestore/emergencyRulesRepo');
const emergencyDiffsRepo = require('../src/repos/firestore/emergencyDiffsRepo');
const emergencyEventsRepo = require('../src/repos/firestore/emergencyEventsRepo');
const emergencyBulletinsRepo = require('../src/repos/firestore/emergencyBulletinsRepo');
const userCityPackPreferencesRepo = require('../src/repos/firestore/userCityPackPreferencesRepo');
const { runCityPackDraftJob } = require('../src/usecases/cityPack/runCityPackDraftJob');
const { activateCityPack } = require('../src/usecases/cityPack/activateCityPack');
const { composeCityAndNationwidePacks } = require('../src/usecases/nationwidePack/composeCityAndNationwidePacks');
const { ensureEmergencyProviders } = require('../src/usecases/emergency/ensureEmergencyProviders');
const { runEmergencySync } = require('../src/usecases/emergency/runEmergencySync');
const { resolveEmergencyRecipientsForFanout } = require('../src/usecases/emergency/resolveEmergencyRecipients');
const { previewEmergencyRule } = require('../src/usecases/emergency/previewEmergencyRule');
const { DEFAULT_PROVIDER_SETTINGS } = require('../src/usecases/emergency/constants');

const PRESERVE_USER_ID = 'U3037952f2f6531a3d8b24fd13ca3c680';
const REGION_KEY = 'NY::new-york';
const REGION_KEY_LOWER = 'ny::new-york';
const REGION_STATE = 'NY';
const REGION_CITY = 'New York';
const CONFIRM_TOKEN = 'REBUILD_CITY_EMERGENCY';
const ACTOR = 'admin_bootstrap_city_emergency';
const REQUEST_ID = 'bootstrap_cpr_ny_new_york';
const RULE_ID = 'emr_bootstrap_ny_new_york';
const WEATHER_RULE_ID = 'emr_bootstrap_ny_weather_watch';
const EARTHQUAKE_RULE_ID = 'emr_bootstrap_ny_earthquake_watch';
const SLOT_SCHEMA_VERSION = 'v1_fixed_8_slots';
const CITY_PACK_NAME = 'NYC生活スタートパック';
const CITY_PACK_DESCRIPTION = 'ニューヨークで暮らし始める家庭が、学校・医療・交通・生活インフラ・緊急対応の公式導線を、最初の判断順に並べてすぐ開けるように整理した地域パックです。';

const CITY_SOURCE_SPECS = Object.freeze([
  {
    url: 'https://www.nyc.gov/',
    sourceType: 'official',
    requiredLevel: 'required',
    authorityLevel: 'local',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    riskLevel: 'low',
    confidenceScore: 95,
    slotKeys: ['admin', 'utilities', 'helpdesk', 'culture']
  },
  {
    url: 'https://www.nyc.gov/site/em/index.page',
    sourceType: 'official',
    requiredLevel: 'required',
    authorityLevel: 'local',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    riskLevel: 'low',
    confidenceScore: 96,
    slotKeys: ['emergency']
  },
  {
    url: 'https://www.schools.nyc.gov/calendar',
    sourceType: 'official',
    requiredLevel: 'required',
    authorityLevel: 'local',
    domainClass: 'school_public',
    schoolType: 'public',
    eduScope: 'calendar',
    riskLevel: 'low',
    confidenceScore: 94,
    slotKeys: ['school']
  },
  {
    url: 'https://new.mta.info/',
    sourceType: 'official',
    requiredLevel: 'required',
    authorityLevel: 'local',
    domainClass: 'unknown',
    schoolType: 'unknown',
    eduScope: null,
    riskLevel: 'low',
    confidenceScore: 90,
    slotKeys: ['transport']
  },
  {
    url: 'https://www.nyc.gov/site/doh/index.page',
    sourceType: 'official',
    requiredLevel: 'required',
    authorityLevel: 'local',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    riskLevel: 'low',
    confidenceScore: 93,
    slotKeys: ['health_entry']
  },
  {
    url: 'https://portal.311.nyc.gov/',
    sourceType: 'official',
    requiredLevel: 'optional',
    authorityLevel: 'local',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    riskLevel: 'low',
    confidenceScore: 89,
    slotKeys: ['helpdesk', 'utilities']
  },
  {
    url: 'https://www.nycgovparks.org/',
    sourceType: 'official',
    requiredLevel: 'optional',
    authorityLevel: 'local',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    riskLevel: 'low',
    confidenceScore: 87,
    slotKeys: ['culture']
  }
]);

const CITY_SLOT_LINK_SPECS = Object.freeze({
  emergency: {
    id: 'bootstrap_lnk_city_pack_nyc_emergency',
    title: 'NYC Emergency Management',
    url: 'https://www.nyc.gov/site/em/index.page',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    regionScope: 'city'
  },
  admin: {
    id: 'bootstrap_lnk_city_pack_nyc_admin',
    title: 'NYC Official Portal',
    url: 'https://www.nyc.gov/',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    regionScope: 'city'
  },
  utilities: {
    id: 'bootstrap_lnk_city_pack_nyc_utilities',
    title: 'NYC 311',
    url: 'https://portal.311.nyc.gov/',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    regionScope: 'city'
  },
  school: {
    id: 'bootstrap_lnk_city_pack_nyc_school',
    title: 'NYC Public School Calendar',
    url: 'https://www.schools.nyc.gov/calendar',
    domainClass: 'school_public',
    schoolType: 'public',
    eduScope: 'calendar',
    regionScope: 'city'
  },
  transport: {
    id: 'bootstrap_lnk_city_pack_nyc_transport',
    title: 'MTA Service Status',
    url: 'https://new.mta.info/',
    domainClass: 'unknown',
    schoolType: 'unknown',
    eduScope: null,
    regionScope: 'city'
  },
  health_entry: {
    id: 'bootstrap_lnk_city_pack_nyc_health',
    title: 'NYC Health',
    url: 'https://www.nyc.gov/site/doh/index.page',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    regionScope: 'city'
  },
  helpdesk: {
    id: 'bootstrap_lnk_city_pack_nyc_helpdesk',
    title: 'NYC Help Desk',
    url: 'https://portal.311.nyc.gov/',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    regionScope: 'city'
  },
  culture: {
    id: 'bootstrap_lnk_city_pack_nyc_culture',
    title: 'NYC Parks',
    url: 'https://www.nycgovparks.org/',
    domainClass: 'gov',
    schoolType: 'unknown',
    eduScope: null,
    regionScope: 'city'
  }
});

const EMERGENCY_LINK_SPECS = Object.freeze({
  nws_alerts: {
    id: 'bootstrap_lnk_emergency_nws_alerts',
    title: 'National Weather Service Alerts',
    url: 'https://www.weather.gov/'
  },
  usgs_earthquakes: {
    id: 'bootstrap_lnk_emergency_usgs_earthquakes',
    title: 'USGS Earthquakes',
    url: 'https://earthquake.usgs.gov/'
  },
  fema_ipaws: {
    id: 'bootstrap_lnk_emergency_fema_ipaws',
    title: 'FEMA IPAWS',
    url: 'https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system'
  },
  openfema_declarations: {
    id: 'bootstrap_lnk_emergency_openfema_declarations',
    title: 'OpenFEMA Declarations',
    url: 'https://www.fema.gov/openfema-data-page/disaster-declarations-summaries-v2'
  },
  openfda_recalls: {
    id: 'bootstrap_lnk_emergency_openfda_recalls',
    title: 'OpenFDA Recalls',
    url: 'https://open.fda.gov/apis/drug/enforcement/'
  },
  airnow_aqi: {
    id: 'bootstrap_lnk_emergency_airnow_aqi',
    title: 'AirNow AQI',
    url: 'https://www.airnow.gov/'
  }
});

const CITY_SLOT_CONTENT = Object.freeze({
  emergency: {
    description: '災害・回収情報・急な行動変更が必要な時の一次確認先です。まず市の危機管理と公式速報を確認します。',
    ctaText: '緊急情報を確認'
  },
  admin: {
    description: '住所・行政手続き・家族向け公的案内の入口です。引っ越し直後に最初に開く行政導線として使います。',
    ctaText: '行政窓口を開く'
  },
  utilities: {
    description: '停電・水道・ごみ・生活インフラの相談導線です。暮らしのトラブルは 311 を起点に切り分けます。',
    ctaText: '生活インフラを確認'
  },
  school: {
    description: '公立学校の日程・休校・年度切替の入口です。家庭の朝判断で最初に確認する学校導線です。',
    ctaText: '学校日程を確認'
  },
  transport: {
    description: '地下鉄・バス・鉄道の運行状況を確認します。通学・通勤前に止まっていないかを確認する導線です。',
    ctaText: '交通状況を確認'
  },
  health_entry: {
    description: '公的な保健・医療情報の入口です。受診先検索、保健情報、予防接種確認の起点に使います。',
    ctaText: '医療情報を確認'
  },
  helpdesk: {
    description: 'どこに相談すべきか迷った時の一次窓口です。困りごとを部局別に振り分ける前の総合入口です。',
    ctaText: '相談窓口を開く'
  },
  culture: {
    description: '公園と公共施設の案内です。子どもの居場所や地域サービスの確認導線として使います。',
    ctaText: '地域施設を見る'
  }
});

const EMERGENCY_RULE_SPECS = Object.freeze([
  {
    ruleId: RULE_ID,
    providerKey: 'openfda_recalls',
    eventType: null,
    severity: 'CRITICAL',
    priority: 'standard',
    maxRecipients: 20,
    displayLabel: 'NYC リコール確認',
    policySummary: '商品回収は誤配信コストが高いため、対象商品と購入有無を手動確認してから送ります。',
    operatorAction: '商品名・購入有無・対象ロットを確認してから承認'
  },
  {
    ruleId: WEATHER_RULE_ID,
    providerKey: 'nws_alerts',
    eventType: null,
    severity: 'WARN+',
    priority: 'emergency',
    maxRecipients: 200,
    displayLabel: 'NYC 気象警報確認',
    policySummary: '気象警報は通学・移動判断に直結するため、警報級以上を優先確認して送ります。',
    operatorAction: '警報種別と交通・学校影響を確認してから承認'
  },
  {
    ruleId: EARTHQUAKE_RULE_ID,
    providerKey: 'usgs_earthquakes',
    eventType: null,
    severity: 'WARN+',
    priority: 'emergency',
    maxRecipients: 100,
    displayLabel: 'NYC 地震情報確認',
    policySummary: '有感地震や交通影響が想定される地震だけを優先確認して送ります。',
    operatorAction: '揺れの規模・交通影響・避難指示の有無を確認してから承認'
  }
]);

function collectEmergencySyncProviderKeys(ruleSpecs) {
  const rows = Array.isArray(ruleSpecs) && ruleSpecs.length ? ruleSpecs : EMERGENCY_RULE_SPECS;
  return Array.from(new Set(rows
    .map((spec) => (spec && typeof spec.providerKey === 'string' ? spec.providerKey.trim().toLowerCase() : ''))
    .filter(Boolean)));
}

const PROVIDER_STATUS_OVERRIDES = Object.freeze({
  airnow_aqi: 'disabled',
  fema_ipaws: 'disabled'
});

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {
    dryRun: args.includes('--dry-run') || !args.includes('--apply'),
    apply: args.includes('--apply'),
    confirm: null
  };
  const confirmIndex = args.indexOf('--confirm');
  if (confirmIndex >= 0 && args[confirmIndex + 1]) out.confirm = args[confirmIndex + 1];
  return out;
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function collectDetachedCityPackDrafts(cityPacks, requests) {
  const packs = Array.isArray(cityPacks) ? cityPacks : [];
  const reqs = Array.isArray(requests) ? requests : [];
  const referencedDraftIds = new Set();
  const requestIds = new Set();

  reqs.forEach((request) => {
    if (request && typeof request.id === 'string' && request.id.trim()) requestIds.add(request.id.trim());
    const draftIds = Array.isArray(request && request.draftCityPackIds) ? request.draftCityPackIds : [];
    draftIds.forEach((id) => {
      if (typeof id === 'string' && id.trim()) referencedDraftIds.add(id.trim());
    });
  });

  return packs
    .filter((pack) => pack && pack.status === 'draft')
    .filter((pack) => {
      const packId = typeof pack.id === 'string' ? pack.id.trim() : '';
      const requestId = typeof pack.requestId === 'string' ? pack.requestId.trim() : '';
      if (!packId) return false;
      if (referencedDraftIds.has(packId)) return false;
      if (requestId && requestIds.has(requestId)) return false;
      return true;
    })
    .map((pack) => ({
      id: pack.id,
      name: typeof pack.name === 'string' ? pack.name : null,
      requestId: typeof pack.requestId === 'string' ? pack.requestId : null,
      packClass: typeof pack.packClass === 'string' ? pack.packClass : null,
      language: typeof pack.language === 'string' ? pack.language : null,
      status: pack.status,
      recommendedAction: 'retire',
      reason: 'detached_draft'
    }));
}

async function listDetachedCityPackDrafts(deps) {
  const cityPackRepo = deps && deps.cityPacksRepo ? deps.cityPacksRepo : cityPacksRepo;
  const requestRepo = deps && deps.cityPackRequestsRepo ? deps.cityPackRequestsRepo : cityPackRequestsRepo;
  const packs = await cityPackRepo.listCityPacks({ limit: 200 });
  const requests = await requestRepo.listRequests({ limit: 200 });
  return collectDetachedCityPackDrafts(packs, requests);
}

function getBootstrapDb() {
  return getDb();
}

function isoAfterDays(days) {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

async function countCollection(name) {
  const snap = await getBootstrapDb().collection(name).count().get();
  return snap.data().count || 0;
}

async function collectCounts() {
  const names = [
    'users',
    'city_packs',
    'city_pack_requests',
    'source_refs',
    'user_city_pack_preferences',
    'emergency_providers',
    'emergency_rules',
    'emergency_snapshots',
    'emergency_events_normalized',
    'emergency_diffs',
    'emergency_bulletins',
    'user_journey_profiles',
    'user_journey_schedules',
    'journey_todo_stats'
  ];
  const out = {};
  for (const name of names) out[name] = await countCollection(name);
  return out;
}

async function getPreserveUser() {
  return usersRepo.getUser(PRESERVE_USER_ID);
}

function inferSourceSpecByUrl(url) {
  return CITY_SOURCE_SPECS.find((item) => item.url === url) || CITY_SOURCE_SPECS[0];
}

function buildCityPackSlots(slotLinkIds) {
  return Object.keys(CITY_SLOT_LINK_SPECS).map((slotKey, index) => ({
    slotId: slotKey,
    status: 'active',
    templateRefId: null,
    fallbackLinkRegistryId: slotLinkIds[slotKey],
    fallbackCtaText: CITY_SLOT_CONTENT[slotKey].ctaText,
    order: index + 1
  }));
}

function buildCityPackMetadata(runId) {
  return {
    regionKey: REGION_KEY_LOWER,
    bootstrapRunId: runId,
    bindingLevel: 'REFERENCE',
    authorityTier: 'T1_OFFICIAL_OPERATION',
    contentProfile: 'family_relocation_v1',
    editorialPolicy: {
      audience: 'family_relocation',
      promise: '迷った時に最初に開く公式導線だけを残す',
      tone: 'next_action_first'
    },
    sourceQualityPolicy: {
      officialOnlyRequired: true,
      schoolSlotMustBePublic: true,
      reviewCadenceDays: 30,
      maxSourceAgeDays: 180,
      fallbackPolicy: 'official_link_required'
    },
    sourceQualityChecklist: [
      '公式機関または公式委託導線だけを残す',
      'school slot は公立学校または教育委員会の案内に限定する',
      '原則30日以内に確認し、180日超の古い source は差し替える',
      '各 slot は最初の一手が1行で分かる文面にする'
    ]
  };
}

function humanizeRegionKey(value) {
  if (typeof value !== 'string' || !value.trim()) return '-';
  const raw = value.trim();
  if (!raw.includes('::')) return raw;
  const parts = raw.split('::');
  if (parts.length !== 2) return raw;
  const state = String(parts[0]).trim().toUpperCase();
  const scope = String(parts[1]).trim().split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  if (!scope) return raw;
  if (scope.toLowerCase() === 'statewide') return `${state} statewide`;
  return `${scope}, ${state}`;
}

function buildEmergencyMessageDraftForBootstrap(bulletin) {
  const providerKey = String(bulletin && bulletin.providerKey || '').trim().toLowerCase();
  const category = String(bulletin && bulletin.category || '').trim().toLowerCase();
  const headline = String(bulletin && bulletin.headline || '').trim() || '緊急情報を確認してください。';
  const regionLabel = humanizeRegionKey(bulletin && bulletin.regionKey);
  if (category === 'recall' || providerKey === 'openfda_recalls') {
    return `【要確認 / リコール】 ${headline}\n対象地域: ${regionLabel}\nまず商品名・購入有無を公式情報で確認し、該当品は使用停止してください。`;
  }
  if (category === 'weather' || providerKey === 'nws_alerts') {
    return `【至急確認 / 気象警報】 ${headline}\n対象地域: ${regionLabel}\n外出・通学前に警報と交通状況を確認し、危険時は行動を切り替えてください。`;
  }
  if (providerKey === 'usgs_earthquakes') {
    return `【至急確認 / 地震情報】 ${headline}\n対象地域: ${regionLabel}\n安全確保を優先し、交通影響と避難情報を確認してください。`;
  }
  return `【確認 / 緊急情報】 ${headline}\n対象地域: ${regionLabel}\nまず公式情報で対象地域と影響範囲を確認してください。`;
}

function buildEmergencySummaryForBootstrap(bulletin) {
  const providerKey = String(bulletin && bulletin.providerKey || '').trim().toLowerCase();
  const category = String(bulletin && bulletin.category || '').trim().toLowerCase();
  if (category === 'recall' || providerKey === 'openfda_recalls') {
    return '対象商品と購入有無を確認し、該当品は使用停止してください。';
  }
  if (category === 'weather' || providerKey === 'nws_alerts') {
    return '移動・通学・避難判断に影響する可能性があります。';
  }
  if (providerKey === 'usgs_earthquakes') {
    return '揺れの規模と交通・避難影響を確認してください。';
  }
  return '対象地域と影響範囲を確認してください。';
}

function buildEmergencyTitleForBootstrap(bulletin) {
  const providerKey = String(bulletin && bulletin.providerKey || '').trim().toLowerCase();
  const category = String(bulletin && bulletin.category || '').trim().toLowerCase();
  if (category === 'recall' || providerKey === 'openfda_recalls') {
    return 'NYC リコール確認';
  }
  if (category === 'weather' || providerKey === 'nws_alerts') {
    return 'NYC 気象警報確認';
  }
  if (providerKey === 'usgs_earthquakes') {
    return 'NYC 地震情報確認';
  }
  return 'NYC 緊急情報確認';
}

function buildCityPackSlotContents(slotLinkIds, sourceRefIdsBySlot) {
  const out = {};
  Object.keys(CITY_SLOT_LINK_SPECS).forEach((slotKey) => {
    out[slotKey] = {
      description: CITY_SLOT_CONTENT[slotKey].description,
      ctaText: CITY_SLOT_CONTENT[slotKey].ctaText,
      linkRegistryId: slotLinkIds[slotKey],
      sourceRefs: Array.from(new Set(sourceRefIdsBySlot[slotKey] || []))
    };
  });
  return out;
}

async function upsertStableLink(id, payload, dryRun, actions) {
  const existing = await linkRegistryRepo.getLink(id).catch(() => null);
  const normalized = Object.assign({}, payload, {
    title: payload.title,
    label: payload.title,
    kind: payload.kind || 'web',
    enabled: payload.enabled !== false,
    domainClass: payload.domainClass || 'gov',
    schoolType: payload.schoolType || 'unknown',
    eduScope: payload.eduScope || null,
    regionKey: payload.regionKey || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    intentTag: payload.intentTag || null,
    audienceTag: payload.audienceTag || null,
    regionScope: payload.regionScope || null,
    riskLevel: payload.riskLevel || null,
    createdAt: existing && existing.createdAt ? existing.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  actions.push({ type: 'upsert_link_registry', id, url: normalized.url, title: normalized.title });
  if (dryRun) return { id, existed: Boolean(existing) };
  await getBootstrapDb().collection('link_registry').doc(id).set(normalized, { merge: true });
  return { id, existed: Boolean(existing) };
}

async function ensurePreserveUserRegion(dryRun, actions) {
  const patch = {
    regionKey: REGION_KEY,
    region: REGION_KEY,
    regionState: REGION_STATE,
    regionCity: REGION_CITY,
    dummyUser: false,
    dummyUserExempt: true
  };
  actions.push({ type: 'patch_user_region', lineUserId: PRESERVE_USER_ID, patch });
  if (dryRun) return patch;
  await usersRepo.updateUser(PRESERVE_USER_ID, patch);
  return patch;
}

async function ensureCityPackRequest(traceId, dryRun, actions) {
  const payload = {
    id: REQUEST_ID,
    status: 'queued',
    lineUserId: PRESERVE_USER_ID,
    regionCity: REGION_CITY,
    regionState: REGION_STATE,
    regionKey: REGION_KEY,
    requestClass: 'regional',
    requestedLanguage: 'ja',
    traceId,
    draftSourceCandidates: CITY_SOURCE_SPECS.map((item) => item.url),
    experienceStage: 'queued'
  };
  const existing = await cityPackRequestsRepo.getRequest(REQUEST_ID).catch(() => null);
  actions.push({ type: existing ? 'update_city_pack_request' : 'create_city_pack_request', requestId: REQUEST_ID });
  if (dryRun) return existing || payload;
  if (existing) {
    await cityPackRequestsRepo.updateRequest(REQUEST_ID, {
      lineUserId: payload.lineUserId,
      regionCity: payload.regionCity,
      regionState: payload.regionState,
      regionKey: payload.regionKey,
      requestClass: payload.requestClass,
      requestedLanguage: payload.requestedLanguage,
      traceId,
      draftSourceCandidates: payload.draftSourceCandidates,
      error: null
    });
    return cityPackRequestsRepo.getRequest(REQUEST_ID);
  }
  await cityPackRequestsRepo.createRequest(payload);
  return cityPackRequestsRepo.getRequest(REQUEST_ID);
}

async function bootstrapCityPack(ctx) {
  const { dryRun, traceId, runId, summary } = ctx;
  const actions = summary.actions;
  const slotLinkIds = {};
  for (const [slotKey, spec] of Object.entries(CITY_SLOT_LINK_SPECS)) {
    slotLinkIds[slotKey] = spec.id;
    await upsertStableLink(spec.id, {
      title: spec.title,
      url: spec.url,
      domainClass: spec.domainClass,
      schoolType: spec.schoolType,
      eduScope: spec.eduScope,
      regionKey: REGION_KEY_LOWER,
      tags: ['city-pack', slotKey, 'bootstrap'],
      intentTag: 'city_pack',
      audienceTag: 'family',
      regionScope: spec.regionScope,
      riskLevel: 'safe'
    }, dryRun, actions);
  }

  await ensurePreserveUserRegion(dryRun, actions);
  const request = await ensureCityPackRequest(traceId, dryRun, actions);

  if (dryRun) {
    summary.cityPack = {
      requestId: REQUEST_ID,
      slotLinkIds,
      sourceCandidates: CITY_SOURCE_SPECS.map((item) => item.url),
      dryRun: true
    };
    return;
  }

  const draftResult = await runCityPackDraftJob({
    requestId: REQUEST_ID,
    traceId,
    runId: `${runId}_citypack`,
    actor: ACTOR,
    sourceUrls: CITY_SOURCE_SPECS.map((item) => item.url)
  });

  const latestRequest = await cityPackRequestsRepo.getRequest(REQUEST_ID);
  const cityPackId = Array.isArray(latestRequest && latestRequest.draftCityPackIds) ? latestRequest.draftCityPackIds[0] : null;
  if (!cityPackId) throw new Error('city pack draft was not created');
  const cityPack = await cityPacksRepo.getCityPack(cityPackId);
  if (!cityPack) throw new Error(`city pack not found: ${cityPackId}`);

  const sourceRefIds = Array.isArray(latestRequest && latestRequest.draftSourceRefIds) && latestRequest.draftSourceRefIds.length
    ? latestRequest.draftSourceRefIds.slice()
    : (Array.isArray(cityPack.sourceRefs) ? cityPack.sourceRefs.slice() : []);
  const sourceRefIdsByUrl = new Map();
  const sourceRefIdsBySlot = {};
  Object.keys(CITY_SLOT_LINK_SPECS).forEach((slotKey) => { sourceRefIdsBySlot[slotKey] = []; });

  for (const sourceRefId of sourceRefIds) {
    const current = await sourceRefsRepo.getSourceRef(sourceRefId);
    if (!current || !current.url) continue;
    const spec = inferSourceSpecByUrl(current.url);
    sourceRefIdsByUrl.set(spec.url, sourceRefId);
    spec.slotKeys.forEach((slotKey) => {
      if (!sourceRefIdsBySlot[slotKey]) sourceRefIdsBySlot[slotKey] = [];
      sourceRefIdsBySlot[slotKey].push(sourceRefId);
    });
    await sourceRefsRepo.updateSourceRef(sourceRefId, {
      status: 'active',
      validUntil: isoAfterDays(180),
      riskLevel: spec.riskLevel,
      sourceType: spec.sourceType,
      requiredLevel: spec.requiredLevel,
      authorityLevel: spec.authorityLevel,
      confidenceScore: spec.confidenceScore,
      domainClass: spec.domainClass,
      schoolType: spec.schoolType,
      eduScope: spec.eduScope,
      regionKey: REGION_KEY_LOWER,
      lastResult: 'bootstrap_verified',
      lastAuditStage: 'heavy',
      lastCheckAt: new Date().toISOString(),
      usedByCityPackIds: [cityPackId]
    });
  }

  const slotContents = buildCityPackSlotContents(slotLinkIds, sourceRefIdsBySlot);
  await cityPacksRepo.updateCityPack(cityPackId, {
    name: CITY_PACK_NAME,
    description: CITY_PACK_DESCRIPTION,
    targetingRules: [{ field: 'regionKey', op: 'eq', value: REGION_KEY_LOWER, effect: 'include' }],
    slots: buildCityPackSlots(slotLinkIds),
    slotContents,
    slotSchemaVersion: SLOT_SCHEMA_VERSION,
    packClass: 'regional',
    language: 'ja',
    allowedIntents: ['CITY_PACK'],
    modules: cityPacksRepo.ALLOWED_MODULES,
    metadata: buildCityPackMetadata(runId)
  });

  const activation = await activateCityPack({
    cityPackId,
    actor: ACTOR,
    traceId,
    requestId: REQUEST_ID
  });
  if (!activation.ok) throw new Error(`city pack activation failed: ${activation.reason}`);

  await cityPackRequestsRepo.updateRequest(REQUEST_ID, {
    status: 'active',
    experienceStage: 'active',
    draftCityPackIds: [cityPackId],
    draftSourceRefIds: sourceRefIds,
    draftLinkRegistryIds: Object.values(slotLinkIds),
    error: null
  });

  await userCityPackPreferencesRepo.upsertUserCityPackPreference(PRESERVE_USER_ID, {
    modulesSubscribed: cityPacksRepo.ALLOWED_MODULES,
    source: 'bootstrap_city_emergency'
  }, ACTOR);

  const composed = await composeCityAndNationwidePacks({ regionKey: REGION_KEY_LOWER, language: 'ja', limit: 10 });
  const updatedRequest = await cityPackRequestsRepo.getRequest(REQUEST_ID);
  const pref = await userCityPackPreferencesRepo.getUserCityPackPreference(PRESERVE_USER_ID);
  const detachedDrafts = await listDetachedCityPackDrafts();

  summary.cityPack = {
    requestId: REQUEST_ID,
    draftResult,
    cityPackId,
    sourceRefIds,
    slotLinkIds,
    requestStatus: updatedRequest && updatedRequest.status,
    composeSummary: composed && composed.summary ? composed.summary : null,
    composeItemIds: Array.isArray(composed && composed.items) ? composed.items.map((item) => item.cityPackId) : [],
    modulesSubscribed: pref && pref.modulesSubscribed ? pref.modulesSubscribed : [],
    detachedDraftCount: detachedDrafts.length,
    detachedDraftRecommendation: detachedDrafts.length > 0 ? 'retire' : 'none',
    detachedDrafts
  };
}

async function bootstrapEmergency(ctx) {
  const { dryRun, traceId, runId, summary } = ctx;
  const actions = summary.actions;
  const providerLinkIds = {};
  for (const [providerKey, spec] of Object.entries(EMERGENCY_LINK_SPECS)) {
    providerLinkIds[providerKey] = spec.id;
    await upsertStableLink(spec.id, {
      title: spec.title,
      url: spec.url,
      domainClass: 'gov',
      schoolType: 'unknown',
      eduScope: null,
      regionKey: null,
      tags: ['emergency', providerKey, 'bootstrap'],
      intentTag: 'support',
      audienceTag: 'family',
      regionScope: 'nationwide',
      riskLevel: 'safe'
    }, dryRun, actions);
  }

  actions.push({ type: 'ensure_emergency_providers' });
  actions.push(...EMERGENCY_RULE_SPECS.map((spec) => ({
    type: 'upsert_emergency_rule',
    ruleId: spec.ruleId,
    regionKey: REGION_KEY,
    providerKey: spec.providerKey,
    severity: spec.severity
  })));
  actions.push({
    type: 'run_emergency_sync',
    forceRefresh: true,
    skipSummarize: true,
    providerKeys: collectEmergencySyncProviderKeys(EMERGENCY_RULE_SPECS)
  });

  if (dryRun) {
    summary.emergency = {
      providerLinkIds,
      ruleId: RULE_ID,
      rules: EMERGENCY_RULE_SPECS,
      providerKeys: collectEmergencySyncProviderKeys(EMERGENCY_RULE_SPECS),
      dryRun: true
    };
    return;
  }

  await ensureEmergencyProviders({ traceId });

  for (const config of DEFAULT_PROVIDER_SETTINGS) {
    const providerKey = config.providerKey;
    await emergencyProvidersRepo.upsertProvider(providerKey, {
      status: PROVIDER_STATUS_OVERRIDES[providerKey] || config.status,
      scheduleMinutes: config.scheduleMinutes,
      officialLinkRegistryId: providerLinkIds[providerKey],
      traceId
    });
  }

  let rule = null;
  for (const spec of EMERGENCY_RULE_SPECS) {
    const upserted = await emergencyRulesRepo.upsertRule(spec.ruleId, {
      providerKey: spec.providerKey,
      eventType: spec.eventType,
      severity: spec.severity,
      region: { regionKey: REGION_KEY },
      membersOnly: false,
      role: null,
      autoSend: false,
      enabled: true,
      priority: spec.priority,
      maxRecipients: spec.maxRecipients,
      displayLabel: spec.displayLabel,
      policySummary: spec.policySummary,
      operatorAction: spec.operatorAction,
      traceId
    }, ACTOR);
    if (spec.ruleId === RULE_ID) rule = upserted;
  }

  const syncResult = await runEmergencySyncInChunks({
    traceId,
    runId: `${runId}_emergency`,
    actor: ACTOR,
    forceRefresh: true,
    skipSummarize: true,
    dryRun: false,
    ruleSpecs: EMERGENCY_RULE_SPECS
  });

  let bulletins = await emergencyBulletinsRepo.listBulletins({ limit: 20 });
  let fallbackBulletin = null;
  if (!bulletins.length) {
    const diffIds = [];
    for (const providerResult of (syncResult.providerResults || [])) {
      const normalizeResult = providerResult && providerResult.normalizeResult ? providerResult.normalizeResult : null;
      const ids = normalizeResult && Array.isArray(normalizeResult.diffIds) ? normalizeResult.diffIds : [];
      diffIds.push(...ids);
    }
    let fallbackDiff = null;
    for (const diffId of diffIds) {
      const diff = await emergencyDiffsRepo.getDiff(diffId).catch(() => null);
      if (!diff) continue;
      if (String(diff.regionKey || '') === REGION_KEY) {
        fallbackDiff = diff;
        break;
      }
      if (!fallbackDiff) fallbackDiff = diff;
    }
    if (fallbackDiff) {
      const eventRow = fallbackDiff.eventDocId ? await emergencyEventsRepo.getEvent(fallbackDiff.eventDocId).catch(() => null) : null;
      fallbackBulletin = await emergencyBulletinsRepo.ensureDraftByDiff(fallbackDiff.id, {
        providerKey: fallbackDiff.providerKey,
        regionKey: fallbackDiff.regionKey || REGION_KEY,
        category: fallbackDiff.category || (eventRow && eventRow.category) || 'alert',
        severity: fallbackDiff.severity || (eventRow && eventRow.severity) || 'INFO',
        linkRegistryId: providerLinkIds[fallbackDiff.providerKey] || providerLinkIds.nws_alerts,
        headline: (eventRow && eventRow.headline) || 'Emergency update detected',
        messageDraft: (eventRow && eventRow.headline)
          ? `【注意】${eventRow.headline}`
          : '【注意】Emergency update detected',
        evidenceRefs: {
          snapshotId: fallbackDiff.snapshotId,
          eventDocId: fallbackDiff.eventDocId,
          diffId: fallbackDiff.id
        },
        traceId
      });
      bulletins = await emergencyBulletinsRepo.listBulletins({ limit: 20 });
    }
  }

  const recipientPreview = await resolveEmergencyRecipientsForFanout({
    region: REGION_KEY,
    regionKey: REGION_KEY,
    membersOnly: false,
    maxRecipients: 50
  });

  let rulePreview = null;
  let nyBulletins = await emergencyBulletinsRepo.listBulletins({
    regionKey: REGION_KEY,
    limit: 20
  });
  for (const bulletin of nyBulletins) {
    await emergencyBulletinsRepo.updateBulletin(bulletin.id, {
      title: buildEmergencyTitleForBootstrap(bulletin),
      summary: buildEmergencySummaryForBootstrap(bulletin),
      bodyText: buildEmergencyMessageDraftForBootstrap(bulletin),
      messageDraft: buildEmergencyMessageDraftForBootstrap(bulletin),
      regionKey: REGION_KEY
    });
  }
  nyBulletins = await emergencyBulletinsRepo.listBulletins({
    regionKey: REGION_KEY,
    limit: 20
  });
  const nyBulletin = nyBulletins[0] || null;
  if (nyBulletin && nyBulletin.id) {
    rulePreview = await previewEmergencyRule({ ruleId: RULE_ID, bulletinId: nyBulletin.id });
  } else if (Array.isArray(bulletins) && bulletins[0] && bulletins[0].id) {
    rulePreview = await previewEmergencyRule({ ruleId: RULE_ID, bulletinId: bulletins[0].id });
  }

  const providers = await emergencyProvidersRepo.listProviders(20);
  summary.emergency = {
    providerLinkIds,
    ruleId: RULE_ID,
    rule,
    rules: EMERGENCY_RULE_SPECS,
    providerKeys: collectEmergencySyncProviderKeys(EMERGENCY_RULE_SPECS),
    syncChunkCount: syncResult.syncChunkCount,
    syncChunks: syncResult.syncChunks,
    providerCount: providers.length,
    syncResult: {
      ok: syncResult.ok,
      providerCount: Array.isArray(syncResult.providerResults) ? syncResult.providerResults.length : 0,
      autoDispatchPlanCount: Array.isArray(syncResult.autoDispatchPlan) ? syncResult.autoDispatchPlan.length : 0,
      providerKeys: Array.isArray(syncResult.providerResults) ? syncResult.providerResults.map((item) => item.providerKey) : []
    },
    fallbackBulletin,
    bulletinCount: Array.isArray(bulletins) ? bulletins.length : 0,
    nyBulletinCount: nyBulletins.length,
    nyBulletinIds: nyBulletins.map((item) => item.id),
    recipientPreview,
    rulePreview
  };
}

async function runEmergencySyncInChunks(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const runner = deps && typeof deps.runEmergencySync === 'function'
    ? deps.runEmergencySync
    : runEmergencySync;
  const providerKeys = collectEmergencySyncProviderKeys(payload.ruleSpecs);
  const syncChunks = [];
  const providerResults = [];
  const autoDispatchPlan = [];
  const autoDispatchResults = [];

  for (const providerKey of providerKeys) {
    const chunkRunIdBase = typeof payload.runId === 'string' && payload.runId.trim()
      ? payload.runId.trim()
      : `bootstrap_emergency_chunk_${Date.now()}`;
    const result = await runner({
      traceId: payload.traceId,
      runId: `${chunkRunIdBase}__${providerKey}`,
      actor: payload.actor,
      providerKey,
      forceRefresh: payload.forceRefresh === true,
      skipSummarize: payload.skipSummarize === true,
      maxRecipientsPerRun: payload.maxRecipientsPerRun
    }, deps);

    syncChunks.push({
      providerKey,
      ok: result && result.ok === true,
      providerCount: result && Number.isFinite(Number(result.providerCount)) ? Number(result.providerCount) : 0,
      autoDispatchPlanCount: Array.isArray(result && result.autoDispatchPlan) ? result.autoDispatchPlan.length : 0,
      autoDispatchAttemptedCount: Array.isArray(result && result.autoDispatchResults) ? result.autoDispatchResults.length : 0,
      reason: result && result.reason ? result.reason : null,
      runId: result && result.runId ? result.runId : null
    });

    if (!result || result.ok !== true) {
      throw new Error(`emergency sync chunk failed for provider=${providerKey} reason=${result && result.reason ? result.reason : 'unknown'}`);
    }

    if (Array.isArray(result.providerResults)) providerResults.push(...result.providerResults);
    if (Array.isArray(result.autoDispatchPlan)) autoDispatchPlan.push(...result.autoDispatchPlan);
    if (Array.isArray(result.autoDispatchResults)) autoDispatchResults.push(...result.autoDispatchResults);
  }

  return {
    ok: true,
    providerKeys,
    syncChunkCount: syncChunks.length,
    syncChunks,
    providerResults,
    autoDispatchPlan,
    autoDispatchResults
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.apply && args.confirm !== CONFIRM_TOKEN) {
    throw new Error(`--confirm ${CONFIRM_TOKEN} required for --apply`);
  }

  const runId = `bootstrap_city_emergency_${Date.now()}`;
  const traceId = `trace_bootstrap_city_emergency_${Date.now()}`;
  const artifactDir = path.join(__dirname, '..', 'artifacts', 'nonprod-bootstrap', runId);
  ensureDir(artifactDir);

  const project = resolveFirestoreProjectId();
  const before = await collectCounts();
  const preserveBefore = await getPreserveUser();
  if (!preserveBefore) throw new Error(`preserve user not found: ${PRESERVE_USER_ID}`);

  const summary = {
    ok: false,
    mode: args.dryRun ? 'dry-run' : 'apply',
    confirmTokenRequired: CONFIRM_TOKEN,
    runId,
    traceId,
    actor: ACTOR,
    project,
    preserveUserId: PRESERVE_USER_ID,
    artifactDir,
    before,
    preserveBefore,
    actions: [],
    cityPack: null,
    emergency: null,
    after: null,
    preserveAfter: null
  };

  writeJson(path.join(artifactDir, 'summary.initial.json'), summary);

  await bootstrapCityPack({ dryRun: args.dryRun, traceId, runId, summary });
  await bootstrapEmergency({ dryRun: args.dryRun, traceId, runId, summary });

  if (!args.dryRun) {
    summary.after = await collectCounts();
    summary.preserveAfter = await getPreserveUser();
  }
  summary.ok = true;

  const outputPath = path.join(artifactDir, 'summary.json');
  writeJson(outputPath, summary);
  console.log(JSON.stringify({
    ok: true,
    mode: summary.mode,
    runId,
    traceId,
    project: project.projectId,
    summaryPath: outputPath,
    cityPack: summary.cityPack && {
      cityPackId: summary.cityPack.cityPackId || null,
      requestId: summary.cityPack.requestId || null,
      composeSummary: summary.cityPack.composeSummary || null,
      detachedDraftCount: Number(summary.cityPack.detachedDraftCount) || 0,
      detachedDraftRecommendation: summary.cityPack.detachedDraftRecommendation || 'none'
    },
    emergency: summary.emergency && {
      providerCount: summary.emergency.providerCount || 0,
      bulletinCount: summary.emergency.bulletinCount || 0,
      recipientTotal: summary.emergency.recipientPreview ? summary.emergency.recipientPreview.totalRecipientCount : 0
    }
  }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = {
  collectDetachedCityPackDrafts,
  listDetachedCityPackDrafts,
  collectEmergencySyncProviderKeys,
  runEmergencySyncInChunks,
  buildEmergencyMessageDraftForBootstrap,
  buildEmergencySummaryForBootstrap,
  buildEmergencyTitleForBootstrap,
  buildCityPackMetadata,
  main
};
