'use strict';

const OPS_ACTOR_HEADERS = { 'x-actor': 'admin_app' };
const TRACE_HEADER_NAME = 'x-trace-id';

const toastEl = document.getElementById('toast');
const appShell = document.getElementById('app-shell');

function resolveAdminTrendUiFlag() {
  if (typeof window === 'undefined') return true;
  const raw = window.ADMIN_TREND_UI_ENABLED;
  if (raw === false || raw === 0) return false;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  }
  return true;
}

const ADMIN_TREND_UI_ENABLED = resolveAdminTrendUiFlag();

function resolveAdminUiFoundationFlag() {
  if (typeof window === 'undefined') return false;
  const raw = window.ADMIN_UI_FOUNDATION_V1;
  if (raw === true || raw === 1) return true;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  }
  return false;
}

const ADMIN_UI_FOUNDATION_V1 = resolveAdminUiFoundationFlag();
const ADMIN_UI_CORE = ADMIN_UI_FOUNDATION_V1
  && typeof globalThis !== 'undefined'
  && globalThis.AdminUiCore
  && typeof globalThis.AdminUiCore === 'object'
  ? globalThis.AdminUiCore
  : null;

function resolveFrontendFeatureFlag(rawValue, defaultValue) {
  if (rawValue === true || rawValue === 1) return true;
  if (rawValue === false || rawValue === 0) return false;
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
    if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  }
  return defaultValue === true;
}

const ADMIN_BUILD_META_ENABLED = resolveFrontendFeatureFlag(
  typeof window !== 'undefined' ? window.ENABLE_ADMIN_BUILD_META : null,
  true
);
const ADMIN_NAV_ROLLOUT_V1 = resolveFrontendFeatureFlag(
  typeof window !== 'undefined' ? window.ADMIN_NAV_ROLLOUT_V1 : null,
  true
);
const ADMIN_ROLE_PERSIST_ENABLED = resolveFrontendFeatureFlag(
  typeof window !== 'undefined' ? window.ADMIN_ROLE_PERSIST_V1 : null,
  true
);
const ADMIN_HISTORY_SYNC_ENABLED = resolveFrontendFeatureFlag(
  typeof window !== 'undefined' ? window.ADMIN_HISTORY_SYNC_V1 : null,
  true
);
const ADMIN_LOCAL_PREFLIGHT_ENABLED = resolveFrontendFeatureFlag(
  typeof window !== 'undefined' ? window.ENABLE_ADMIN_LOCAL_PREFLIGHT_V1 : null,
  true
);
const ADMIN_NO_COLLAPSE_V1 = resolveFrontendFeatureFlag(
  typeof window !== 'undefined' ? window.ENABLE_ADMIN_NO_COLLAPSE_V1 : null,
  true
);
const ADMIN_TOP_SUMMARY_V1 = resolveFrontendFeatureFlag(
  typeof window !== 'undefined' ? window.ENABLE_ADMIN_TOP_SUMMARY_V1 : null,
  false
);
const ADMIN_USERS_STRIPE_LAYOUT_V1 = resolveFrontendFeatureFlag(
  typeof window !== 'undefined' ? window.ENABLE_ADMIN_USERS_STRIPE_LAYOUT_V1 : null,
  true
);
const ADMIN_NAV_ALL_ACCESSIBLE_V1 = resolveFrontendFeatureFlag(
  typeof window !== 'undefined' ? window.ADMIN_NAV_ALL_ACCESSIBLE_V1 : null,
  true
);

const state = {
  dict: {},
  role: 'operator',
  localPreflight: null,
  monitorItems: [],
  monitorUserItems: [],
  monitorInsights: null,
  vendorItems: [],
  selectedVendorLinkId: null,
  selectedVendorRowIndex: null,
  readModelItems: [],
  errorsSummary: null,
  cityPackRequestItems: [],
  cityPackFeedbackItems: [],
  cityPackBulletinItems: [],
  cityPackProposalItems: [],
  cityPackTemplateLibraryItems: [],
  cityPackInboxItems: [],
  cityPackCompositionItems: [],
  cityPackUnifiedItems: [],
  cityPackUnifiedFilteredItems: [],
  cityPackUnifiedSortKey: 'updatedAt',
  cityPackUnifiedSortDir: 'desc',
  cityPackKpi: null,
  cityPackMetrics: null,
  cityPackRuns: [],
  selectedCityPackRunId: null,
  selectedCityPackRunTraceId: null,
  selectedCityPackRunEvidenceId: null,
  selectedCityPackRequestId: null,
  selectedCityPackFeedbackId: null,
  selectedCityPackBulletinId: null,
  selectedCityPackProposalId: null,
  selectedCityPackTemplateLibraryId: null,
  selectedCityPackDraftId: null,
  selectedCityPackSourceRefId: null,
  cityPackTemplateImportPlanHash: null,
  cityPackTemplateImportConfirmToken: null,
  currentComposerStatus: '未取得',
  composerTone: 'unknown',
  composerUpdatedAt: null,
  composerSavedItems: [],
  composerSavedFilteredItems: [],
  composerSavedSortKey: 'createdAt',
  composerSavedSortDir: 'desc',
  composerLinkOptions: [],
  composerSelectedNotificationId: null,
  composerListLoadedAt: null,
  composerLinkPreview: null,
  composerCurrentNotificationId: null,
  composerCurrentPlanHash: null,
  composerCurrentConfirmToken: null,
  composerKillSwitch: false,
  repoMapKillSwitch: null,
  usersSummaryItems: [],
  usersSummaryFilteredItems: [],
  usersSummarySelectedLineUserId: null,
  usersSummaryBillingDetail: null,
  usersSummarySortKey: 'createdAt',
  usersSummarySortDir: 'desc',
  usersSummaryQuickFilter: 'all',
  usersSummaryAnalyze: null,
  usersSummaryVisibleColumns: [
    'createdAt',
    'updatedAt',
    'lineUserId',
    'memberNumber',
    'category',
    'status',
    'plan',
    'subscriptionStatus',
    'billingIntegrity',
    'currentPeriodEnd',
    'llmUsage',
    'todoProgressRate',
    'llmUsageToday',
    'tokensToday',
    'blockedRate',
    'deliveryCount',
    'clickCount',
    'reactionRate'
  ],
  vendorUnifiedFilteredItems: [],
  vendorSortKey: 'updatedAt',
  vendorSortDir: 'desc',
  dashboardKpis: null,
  dashboardCacheByMonths: {},
  dashboardJourneyKpi: null,
  topbarStatus: null,
  alertsSummary: null,
  repoMap: null,
  legacyStatusItems: [],
  topCauses: '-',
  topCausesTip: '',
  topAnomaly: '-',
  structDriftRuns: [],
  structDriftLastResult: null,
  retentionRuns: [],
  snapshotHealthItems: [],
  readPathFallbackSummary: [],
  missingIndexSurfaceItems: [],
  missingIndexSurfaceMeta: null,
  productReadiness: null,
  paneUpdatedAt: {},
  activePane: 'home',
  buildMeta: null,
  navPolicyHashCore: null,
  navPolicyHashApp: null
};

if (!ADMIN_TREND_UI_ENABLED) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.add('trend-ui-disabled');
  }
  state.vendorSortKey = 'createdAt';
}

const COMPOSER_ALLOWED_SCENARIOS = new Set(['A', 'B', 'C', 'D']);
const COMPOSER_ALLOWED_STEPS = new Set(['3mo', '1mo', 'week', 'after1w']);
const COMPOSER_SAVED_SORT_TYPES = Object.freeze({
  createdAt: 'date',
  title: 'string',
  status: 'string',
  notificationCategory: 'string',
  scenarioKey: 'string',
  stepKey: 'string',
  targetCount: 'number',
  ctr: 'number'
});
const USERS_SUMMARY_SORT_TYPES = Object.freeze({
  createdAt: 'date',
  updatedAt: 'date',
  currentPeriodEnd: 'date',
  nextTodoDueAt: 'date',
  lineUserId: 'string',
  memberNumber: 'string',
  category: 'string',
  status: 'string',
  householdType: 'string',
  journeyStage: 'string',
  plan: 'string',
  subscriptionStatus: 'string',
  todoOpenCount: 'number',
  todoOverdueCount: 'number',
  deliveryCount: 'number',
  clickCount: 'number',
  reactionRate: 'number',
  llmUsage: 'number',
  llmUsageToday: 'number',
  todoProgressRate: 'number',
  tokensToday: 'number',
  blockedRate: 'number',
  billingIntegrity: 'string'
});
const CITY_PACK_UNIFIED_SORT_TYPES = Object.freeze({
  createdAt: 'date',
  itemId: 'string',
  lineUserId: 'string',
  cityLabel: 'string',
  recordType: 'string',
  status: 'string',
  assignee: 'string',
  updatedAt: 'date',
  kpiScore: 'number'
});
const VENDOR_UNIFIED_SORT_TYPES = Object.freeze({
  createdAt: 'date',
  linkId: 'string',
  vendorLabel: 'string',
  category: 'string',
  status: 'string',
  updatedAt: 'date',
  relatedCount: 'number'
});
const CITY_PACK_RECORD_TYPE_LABELS = Object.freeze({
  request: 'Request',
  feedback: 'Feedback',
  bulletin: 'Bulletin',
  proposal: 'Proposal',
  review: 'Review',
  template: 'Template'
});
const USER_CATEGORY_LABELS = Object.freeze({
  A: 'A単身',
  B: 'B夫婦',
  C: 'C帯同1',
  D: 'D帯同2'
});
const USERS_QUICK_FILTER_LABELS = Object.freeze({
  all: 'All',
  pro_active: 'Pro(active)',
  free: 'Free',
  trialing: 'Trialing',
  past_due: 'Past_due',
  canceled: 'Canceled',
  unknown: 'Unknown'
});
const USERS_SUMMARY_COLUMN_KEYS = Object.freeze([
  'createdAt',
  'updatedAt',
  'lineUserId',
  'memberNumber',
  'category',
  'status',
  'plan',
  'subscriptionStatus',
  'billingIntegrity',
  'currentPeriodEnd',
  'llmUsage',
  'todoProgressRate',
  'llmUsageToday',
  'tokensToday',
  'blockedRate',
  'deliveryCount',
  'clickCount',
  'reactionRate'
]);
const PANE_HEADER_MAP = Object.freeze({
  home: { titleKey: 'ui.label.nav.dashboard', subtitleKey: 'ui.desc.page.home' },
  alerts: { titleKey: 'ui.label.alerts.title', subtitleKey: 'ui.desc.page.alerts' },
  composer: { titleKey: 'ui.label.page.composer', subtitleKey: 'ui.desc.page.composer' },
  monitor: { titleKey: 'ui.label.page.monitor', subtitleKey: 'ui.desc.page.monitor' },
  errors: { titleKey: 'ui.label.page.errors', subtitleKey: 'ui.desc.page.errors' },
  'read-model': { titleKey: 'ui.label.page.readModel', subtitleKey: 'ui.desc.page.readModel' },
  vendors: { titleKey: 'ui.label.page.vendors', subtitleKey: 'ui.desc.page.vendors' },
  'city-pack': { titleKey: 'ui.label.page.cityPack', subtitleKey: 'ui.desc.page.cityPack' },
  audit: { titleKey: 'ui.label.page.audit', subtitleKey: 'ui.desc.page.audit' },
  'developer-map': { titleKey: 'ui.label.page.developerMap', subtitleKey: 'ui.desc.page.developerMap' },
  'developer-manual-redac': { titleKey: 'ui.label.page.developerManualRedac', subtitleKey: 'ui.desc.page.developerManualRedac' },
  'developer-manual-user': { titleKey: 'ui.label.page.developerManualUser', subtitleKey: 'ui.desc.page.developerManualUser' },
  llm: { titleKey: 'ui.label.page.faq', subtitleKey: 'ui.desc.page.faq' },
  settings: { titleKey: 'ui.label.page.settings', subtitleKey: 'ui.desc.page.settings' },
  maintenance: { titleKey: 'ui.label.page.maintenance', subtitleKey: 'ui.desc.page.maintenance' }
});

const NAV_POLICY = Object.freeze({
  operator: ['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'city-pack', 'audit', 'settings'],
  admin: ['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'city-pack', 'audit', 'settings', 'llm', 'maintenance', 'developer-map', 'developer-manual-redac', 'developer-manual-user'],
  developer: ['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'city-pack', 'audit', 'settings', 'llm', 'maintenance', 'developer-map', 'developer-manual-redac', 'developer-manual-user']
});

const NAV_GROUP_VISIBILITY_POLICY = Object.freeze({
  operator: Object.freeze(['dashboard', 'notifications', 'users', 'catalog']),
  admin: Object.freeze(['dashboard', 'notifications', 'users', 'catalog']),
  developer: Object.freeze(['dashboard', 'notifications', 'users', 'catalog', 'developer'])
});

const NAV_GROUP_ROLLOUT_POLICY = Object.freeze({
  operator: Object.freeze([]),
  admin: Object.freeze(['communication', 'operations']),
  developer: Object.freeze(['communication', 'operations'])
});

const DASHBOARD_ALLOWED_WINDOWS = Object.freeze([1, 3, 6, 12, 36]);
const DASHBOARD_DEFAULT_WINDOW = 1;
const POLICY_INTENT_ALIASES = Object.freeze({
  next_action: 'next_action_generation'
});
const DASHBOARD_CARD_CONFIG = Object.freeze({
  registrations: { kpiKeys: ['registrations'], unit: 'count' },
  membership: { kpiKeys: ['membership'], unit: 'percent' },
  engagement: { kpiKeys: ['engagement'], unit: 'percent' },
  notifications: { kpiKeys: ['notifications', 'stepStates'], unit: 'count' },
  reaction: { kpiKeys: ['reaction', 'churnRate'], unit: 'percent' },
  faq: { kpiKeys: ['faqUsage', 'ctrTrend'], unit: 'count' },
  proRatio: { kpiKeys: ['pro_ratio'], unit: 'percent' },
  proActive: { kpiKeys: ['pro_active_count'], unit: 'count' },
  llmUsage: { kpiKeys: ['llm_daily_usage_count'], unit: 'count' },
  llmBlockRate: { kpiKeys: ['llm_block_rate'], unit: 'percent' },
  avgTaskCompletion: { kpiKeys: ['journey_task_completion_rate'], unit: 'percent' },
  dependencyBlockRate: { kpiKeys: ['journey_dependency_block_rate'], unit: 'percent' }
});

function isFoundationCoreEnabled() {
  return Boolean(ADMIN_UI_FOUNDATION_V1 && ADMIN_UI_CORE);
}

function resolveCoreSlice(name) {
  if (!isFoundationCoreEnabled()) return null;
  const slice = ADMIN_UI_CORE[name];
  return slice && typeof slice === 'object' ? slice : null;
}

function parseRoleAllowList(value) {
  if (!value) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function parseCsvList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeRoleValue(role) {
  const navCore = resolveCoreSlice('navCore');
  if (navCore && typeof navCore.normalizeRole === 'function') return navCore.normalizeRole(role);
  return role === 'admin' || role === 'developer' ? role : 'operator';
}

function resolvePanePolicy() {
  const navCore = resolveCoreSlice('navCore');
  if (navCore && navCore.DEFAULT_NAV_PANE_POLICY && typeof navCore.DEFAULT_NAV_PANE_POLICY === 'object') {
    return navCore.DEFAULT_NAV_PANE_POLICY;
  }
  return NAV_POLICY;
}

function resolveBaseGroupVisibilityPolicy() {
  const navCore = resolveCoreSlice('navCore');
  if (navCore && navCore.DEFAULT_NAV_GROUP_VISIBILITY_POLICY && typeof navCore.DEFAULT_NAV_GROUP_VISIBILITY_POLICY === 'object') {
    return navCore.DEFAULT_NAV_GROUP_VISIBILITY_POLICY;
  }
  return NAV_GROUP_VISIBILITY_POLICY;
}

function resolveNavGroupVisibilityPolicy() {
  const base = resolveBaseGroupVisibilityPolicy();
  const out = {};
  ['operator', 'admin', 'developer'].forEach((role) => {
    const baseList = Array.isArray(base[role]) ? base[role].slice() : [];
    const rolloutList = ADMIN_NAV_ROLLOUT_V1 && Array.isArray(NAV_GROUP_ROLLOUT_POLICY[role]) ? NAV_GROUP_ROLLOUT_POLICY[role] : [];
    const merged = [];
    baseList.concat(rolloutList).forEach((groupKey) => {
      const normalized = String(groupKey || '').trim();
      if (!normalized) return;
      if (!merged.includes(normalized)) merged.push(normalized);
    });
    out[role] = Object.freeze(merged);
  });
  return Object.freeze(out);
}

function resolveNavPolicyHashes() {
  const navCore = resolveCoreSlice('navCore');
  const appPolicyHashSource = { pane: resolvePanePolicy(), group: resolveNavGroupVisibilityPolicy() };
  if (navCore && typeof navCore.resolvePolicyHash === 'function') {
    const corePanePolicy = navCore.DEFAULT_NAV_PANE_POLICY && typeof navCore.DEFAULT_NAV_PANE_POLICY === 'object'
      ? navCore.DEFAULT_NAV_PANE_POLICY
      : NAV_POLICY;
    const coreGroupBase = navCore.DEFAULT_NAV_GROUP_VISIBILITY_POLICY && typeof navCore.DEFAULT_NAV_GROUP_VISIBILITY_POLICY === 'object'
      ? navCore.DEFAULT_NAV_GROUP_VISIBILITY_POLICY
      : NAV_GROUP_VISIBILITY_POLICY;
    const coreRollout = navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY && typeof navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY === 'object'
      ? navCore.DEFAULT_NAV_GROUP_ROLLOUT_POLICY
      : NAV_GROUP_ROLLOUT_POLICY;
    const coreGroupPolicy = {};
    ['operator', 'admin', 'developer'].forEach((role) => {
      const base = Array.isArray(coreGroupBase[role]) ? coreGroupBase[role] : [];
      const rollout = ADMIN_NAV_ROLLOUT_V1 && Array.isArray(coreRollout[role]) ? coreRollout[role] : [];
      coreGroupPolicy[role] = base.concat(rollout);
    });
    const corePolicyHashSource = { pane: corePanePolicy, group: coreGroupPolicy };
    return {
      appHash: navCore.resolvePolicyHash(appPolicyHashSource),
      coreHash: navCore.resolvePolicyHash(corePolicyHashSource)
    };
  }
  const appHash = JSON.stringify(appPolicyHashSource);
  return { appHash, coreHash: appHash };
}

function syncNavPolicyHashSentinel() {
  const hashes = resolveNavPolicyHashes();
  state.navPolicyHashApp = hashes.appHash;
  state.navPolicyHashCore = hashes.coreHash;
}

function getRoleFromQueryFallback() {
  try {
    const currentUrl = new URL(globalThis.location.href);
    const raw = currentUrl.searchParams.get('role');
    if (!raw) return null;
    return normalizeRoleValue(raw);
  } catch (_err) {
    return null;
  }
}

function resolveRoleFromPersistence(defaultRole) {
  const fallbackRole = normalizeRoleValue(defaultRole || 'operator');
  if (!ADMIN_ROLE_PERSIST_ENABLED) return fallbackRole;
  const stateCore = resolveCoreSlice('stateCore');
  if (!stateCore) return fallbackRole;
  const urlRole = typeof stateCore.parseRoleFromQuery === 'function'
    ? stateCore.parseRoleFromQuery(globalThis.location.search)
    : getRoleFromQueryFallback();
  const storedRole = typeof stateCore.loadRoleState === 'function'
    ? stateCore.loadRoleState()
    : null;
  if (typeof stateCore.resolveRoleState === 'function') {
    return normalizeRoleValue(stateCore.resolveRoleState(urlRole, storedRole, fallbackRole));
  }
  return normalizeRoleValue(urlRole || storedRole || fallbackRole);
}

function persistRoleState(nextRole) {
  if (!ADMIN_ROLE_PERSIST_ENABLED) return;
  const normalizedRole = normalizeRoleValue(nextRole);
  const stateCore = resolveCoreSlice('stateCore');
  if (stateCore && typeof stateCore.saveRoleState === 'function') {
    stateCore.saveRoleState(normalizedRole);
  }
}

function buildUrlWithPaneRole(nextPane, nextRole) {
  const stateCore = resolveCoreSlice('stateCore');
  let nextUrl;
  if (ADMIN_ROLE_PERSIST_ENABLED && stateCore && typeof stateCore.applyRoleToUrl === 'function') {
    nextUrl = stateCore.applyRoleToUrl(nextRole, globalThis.location.href);
  } else {
    const url = new URL(globalThis.location.href);
    if (ADMIN_ROLE_PERSIST_ENABLED) url.searchParams.set('role', normalizeRoleValue(nextRole));
    else url.searchParams.delete('role');
    nextUrl = `${url.pathname}?${url.searchParams.toString()}`;
  }
  const urlObj = new URL(nextUrl, globalThis.location.origin);
  if (nextPane) urlObj.searchParams.set('pane', String(nextPane));
  return `${urlObj.pathname}?${urlObj.searchParams.toString()}`.replace(/\?$/, '');
}

function updateHistoryWithPaneRole(nextPane, nextRole, mode) {
  if (!ADMIN_HISTORY_SYNC_ENABLED || !globalThis.history) return;
  const historyMode = mode || 'replace';
  const url = buildUrlWithPaneRole(nextPane, nextRole);
  if (historyMode === 'push' && typeof globalThis.history.pushState === 'function') {
    globalThis.history.pushState({ pane: nextPane, role: nextRole }, '', url);
    return;
  }
  if (typeof globalThis.history.replaceState === 'function') {
    globalThis.history.replaceState({ pane: nextPane, role: nextRole }, '', url);
  }
}

function isRolloutEnabledForGroup(groupEl, role) {
  if (!groupEl) return true;
  const rollout = groupEl.getAttribute('data-nav-rollout');
  const navCore = resolveCoreSlice('navCore');
  if (navCore && typeof navCore.isNavRolloutAllowed === 'function') {
    return navCore.isNavRolloutAllowed(role, rollout, ADMIN_NAV_ROLLOUT_V1);
  }
  const allowList = parseCsvList(rollout);
  if (!allowList.length) return true;
  if (!ADMIN_NAV_ROLLOUT_V1) return false;
  return allowList.includes(normalizeRoleValue(role));
}

function resolveAllowedPaneListForRole(role) {
  const nextRole = normalizeRoleValue(role);
  const panePolicy = resolvePanePolicy();
  const source = Array.isArray(panePolicy[nextRole]) ? panePolicy[nextRole] : [];
  const out = [];
  source.forEach((pane) => {
    const normalized = String(pane || '').trim();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function dedupeNavEntriesByPane(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const grouped = {};
  list.forEach((entry, sourceIndex) => {
    if (!entry || entry.visible !== true) return;
    const pane = String(entry.pane || '').trim();
    if (!pane) return;
    if (!Array.isArray(grouped[pane])) grouped[pane] = [];
    grouped[pane].push(Object.assign({}, entry, { sourceIndex }));
  });
  const keep = {};
  Object.keys(grouped).forEach((pane) => {
    const candidates = grouped[pane].slice().sort((left, right) => {
      const leftPriority = Number.isFinite(Number(left.priority)) ? Number(left.priority) : 0;
      const rightPriority = Number.isFinite(Number(right.priority)) ? Number(right.priority) : 0;
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      return left.sourceIndex - right.sourceIndex;
    });
    if (!candidates.length) return;
    const winner = candidates[0];
    keep[winner.sourceIndex] = true;
    candidates.forEach((candidate) => {
      if (winner.groupKey && candidate.groupKey && winner.groupKey === candidate.groupKey) {
        keep[candidate.sourceIndex] = true;
      }
    });
  });
  return list.map((entry, sourceIndex) => {
    if (!entry || entry.visible !== true) return entry;
    const pane = String(entry.pane || '').trim();
    if (!pane) return entry;
    if (keep[sourceIndex] === true) return entry;
    return Object.assign({}, entry, { visible: false, dedupedByPane: true });
  });
}

function collectNavItemsForCore() {
  const all = Array.from(document.querySelectorAll('.app-nav .nav-item[data-pane-target]'));
  return all.map((element, index) => {
    const parentGroup = element.closest('[data-nav-group]');
    return {
      index,
      element,
      pane: String(element.getAttribute('data-pane-target') || '').trim(),
      groupKey: parentGroup ? String(parentGroup.getAttribute('data-nav-group') || '').trim() : '',
      allowList: parseRoleAllowList(element.getAttribute('data-role-allow')),
      rollout: parentGroup ? parentGroup.getAttribute('data-nav-rollout') : null,
      priority: Number(element.getAttribute('data-nav-priority') || 0)
    };
  });
}

function resolveVisibleNavEntries(role) {
  const navCore = resolveCoreSlice('navCore');
  const nextRole = normalizeRoleValue(role);
  const navItems = collectNavItemsForCore();
  if (ADMIN_NAV_ALL_ACCESSIBLE_V1) {
    let evaluated;
    if (navCore && typeof navCore.resolveVisibleNavItemsByAllowedPanes === 'function') {
      evaluated = navCore.resolveVisibleNavItemsByAllowedPanes(navItems, nextRole, resolvePanePolicy(), {
        useRollout: false,
        rolloutEnabled: ADMIN_NAV_ROLLOUT_V1
      });
    } else {
      const allowedPanes = resolveAllowedPaneListForRole(nextRole);
      evaluated = navItems.map((entry) => {
        const allowList = parseRoleAllowList(entry && entry.element ? entry.element.getAttribute('data-role-allow') : null);
        const roleAllowed = !allowList.length || allowList.includes(nextRole);
        const paneAllowed = allowedPanes.includes(entry.pane);
        return Object.assign({}, entry, {
          roleAllowed,
          paneAllowed,
          rolloutAllowed: true,
          visible: roleAllowed && paneAllowed
        });
      });
    }
    if (navCore && typeof navCore.dedupeVisibleNavItemsByPane === 'function') {
      return navCore.dedupeVisibleNavItemsByPane(evaluated, { preserveSameGroup: true });
    }
    return dedupeNavEntriesByPane(evaluated);
  }
  if (navCore && typeof navCore.resolveVisibleNavItems === 'function') {
    return navCore.resolveVisibleNavItems(navItems, nextRole, {
      groupPolicy: resolveNavGroupVisibilityPolicy(),
      rolloutEnabled: ADMIN_NAV_ROLLOUT_V1
    });
  }
  return navItems.map((entry) => {
    const groupEl = entry.element ? entry.element.closest('.nav-group') : null;
    const hiddenGroup = groupEl && groupEl.getAttribute('data-nav-visible') === 'false';
    const allowList = parseRoleAllowList(entry.element ? entry.element.getAttribute('data-role-allow') : null);
    const roleAllowed = !allowList.length || allowList.includes(nextRole);
    const visible = !hiddenGroup && roleAllowed;
    return Object.assign({}, entry, {
      roleAllowed,
      paneAllowed: true,
      rolloutAllowed: true,
      visible
    });
  });
}

function resolveVisibleGroupKeysFromEntries(role, entries) {
  const navCore = resolveCoreSlice('navCore');
  const nextRole = normalizeRoleValue(role);
  const visible = [];
  if (navCore && typeof navCore.resolveVisibleGroupsFromItems === 'function') {
    visible.push(...navCore.resolveVisibleGroupsFromItems(entries || []));
  } else {
    (entries || []).forEach((entry) => {
      if (!entry || entry.visible !== true) return;
      const groupKey = String(entry.groupKey || '').trim();
      if (!groupKey) return;
      if (!visible.includes(groupKey)) visible.push(groupKey);
    });
  }
  if (ADMIN_NAV_ALL_ACCESSIBLE_V1) {
    const basePolicy = resolveNavGroupVisibilityPolicy();
    const base = Array.isArray(basePolicy[nextRole]) ? basePolicy[nextRole] : [];
    base.forEach((groupKey) => {
      const normalized = String(groupKey || '').trim();
      if (!normalized) return;
      if (!visible.includes(normalized)) visible.push(normalized);
    });
  }
  return visible;
}

function resolvePreferredNavEntry(role, pane, entries) {
  const nextRole = normalizeRoleValue(role);
  const nextPane = String(pane || '').trim();
  if (!nextPane) return null;
  const source = Array.isArray(entries) ? entries : resolveVisibleNavEntries(nextRole);
  const candidates = source
    .filter((entry) => entry && entry.visible === true && String(entry.pane || '').trim() === nextPane)
    .sort((left, right) => {
      const leftPriority = Number.isFinite(Number(left.priority)) ? Number(left.priority) : 0;
      const rightPriority = Number.isFinite(Number(right.priority)) ? Number(right.priority) : 0;
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      const leftIndex = Number.isFinite(Number(left.index)) ? Number(left.index) : 0;
      const rightIndex = Number.isFinite(Number(right.index)) ? Number(right.index) : 0;
      return leftIndex - rightIndex;
    });
  return candidates.length > 0 ? candidates[0] : null;
}

function applyBuildMetaBadge() {
  const badge = document.getElementById('topbar-build-meta');
  const valueEl = document.getElementById('topbar-build-meta-value');
  if (!badge || !valueEl) return;
  if (!ADMIN_BUILD_META_ENABLED) {
    badge.setAttribute('data-build-meta-state', 'hidden');
    valueEl.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    return;
  }
  const meta = window && window.ADMIN_APP_BUILD_META && typeof window.ADMIN_APP_BUILD_META === 'object'
    ? window.ADMIN_APP_BUILD_META
    : null;
  state.buildMeta = meta;
  if (!meta) {
    badge.setAttribute('data-build-meta-state', 'error');
    valueEl.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    return;
  }
  const commit = meta.commit ? String(meta.commit).slice(0, 8) : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
  const branch = meta.branch ? String(meta.branch) : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
  valueEl.textContent = `${commit}@${branch}`;
  syncNavPolicyHashSentinel();
  if (state.navPolicyHashApp && state.navPolicyHashCore && state.navPolicyHashApp !== state.navPolicyHashCore) {
    badge.setAttribute('data-build-meta-state', 'warn');
    return;
  }
  badge.setAttribute('data-build-meta-state', 'ok');
}

function resolveGuardBannerElement() {
  return document.getElementById('admin-guard-banner');
}

function clearGuardBanner() {
  const el = resolveGuardBannerElement();
  if (!el) return;
  el.classList.remove('is-visible', 'is-danger', 'is-warn');
  el.setAttribute('data-admin-guard', 'hidden');
  const cause = el.querySelector('[data-guard-field="cause"]');
  const impact = el.querySelector('[data-guard-field="impact"]');
  const action = el.querySelector('[data-guard-field="action"]');
  if (cause) cause.textContent = '-';
  if (impact) impact.textContent = '-';
  if (action) action.textContent = '-';
}

function renderGuardBanner(rawError) {
  const el = resolveGuardBannerElement();
  if (!el) return;
  const guardCore = resolveCoreSlice('fetchGuardCore');
  const normalized = guardCore && typeof guardCore.normalizeGuardError === 'function'
    ? guardCore.normalizeGuardError(rawError)
    : {
        cause: rawError && rawError.error ? String(rawError.error) : '不明なエラー',
        impact: '操作結果を確定できません',
        action: 'traceIdで監査ログを確認してください',
        tone: 'danger'
      };
  const cause = el.querySelector('[data-guard-field="cause"]');
  const impact = el.querySelector('[data-guard-field="impact"]');
  const action = el.querySelector('[data-guard-field="action"]');
  const recommendedPane = rawError && typeof rawError === 'object' && rawError.recommendedPane
    ? String(rawError.recommendedPane)
    : '';
  const actionText = recommendedPane
    ? `${normalized.action || '-'}（推奨: ${recommendedPane}）`
    : (normalized.action || '-');
  if (cause) cause.textContent = normalized.cause || '-';
  if (impact) impact.textContent = normalized.impact || '-';
  if (action) action.textContent = actionText;
  el.classList.add('is-visible');
  el.classList.remove('is-danger', 'is-warn');
  if (normalized.tone === 'warn') el.classList.add('is-warn');
  else el.classList.add('is-danger');
  el.setAttribute('data-admin-guard', 'visible');
}

function resolveLocalPreflightBannerElement() {
  return document.getElementById('admin-local-preflight-banner');
}

function clearLocalPreflightBanner() {
  const el = resolveLocalPreflightBannerElement();
  if (!el) return;
  el.classList.remove('is-visible', 'is-danger', 'is-warn');
  el.setAttribute('data-admin-local-preflight', 'hidden');
  const cause = el.querySelector('[data-local-preflight-field="cause"]');
  const impact = el.querySelector('[data-local-preflight-field="impact"]');
  const action = el.querySelector('[data-local-preflight-field="action"]');
  if (cause) cause.textContent = '-';
  if (impact) impact.textContent = '-';
  if (action) action.textContent = '-';
}

function normalizeLocalPreflightPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const summary = source.summary && typeof source.summary === 'object' ? source.summary : {};
  const code = summary.code ? String(summary.code) : 'LOCAL_PREFLIGHT_NOT_READY';
  const tone = summary.tone === 'warn' ? 'warn' : (summary.tone === 'ok' ? 'ok' : 'danger');
  const checkedAt = source.checkedAt ? formatDateLabel(source.checkedAt) : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
  const cause = summary.cause
    ? String(summary.cause)
    : t('ui.desc.admin.localPreflight.defaultCause', 'ローカル前提条件を確認できませんでした。');
  const impact = summary.impact
    ? String(summary.impact)
    : t('ui.desc.admin.localPreflight.defaultImpact', 'Firestore依存APIの取得が不安定になります。');
  const actionBase = summary.action
    ? String(summary.action)
    : t('ui.desc.admin.localPreflight.defaultAction', '認証設定を確認して再試行してください。');
  const action = `${actionBase} (${code} / checkedAt=${checkedAt})`;
  return { code, tone, cause, impact, action };
}

function renderLocalPreflightBanner(payload) {
  const el = resolveLocalPreflightBannerElement();
  if (!el) return;
  const normalized = normalizeLocalPreflightPayload(payload);
  const cause = el.querySelector('[data-local-preflight-field="cause"]');
  const impact = el.querySelector('[data-local-preflight-field="impact"]');
  const action = el.querySelector('[data-local-preflight-field="action"]');
  if (cause) cause.textContent = normalized.cause;
  if (impact) impact.textContent = normalized.impact;
  if (action) action.textContent = normalized.action;
  el.classList.add('is-visible');
  el.classList.remove('is-danger', 'is-warn');
  if (normalized.tone === 'warn') el.classList.add('is-warn');
  else el.classList.add('is-danger');
  el.setAttribute('data-admin-local-preflight', 'visible');
}

function renderDataLoadFailureGuard(reasonCode, err) {
  const message = err && err.message ? String(err.message) : String(reasonCode || 'error');
  if (state.localPreflight && state.localPreflight.ready === false) {
    const summary = state.localPreflight.summary && typeof state.localPreflight.summary === 'object'
      ? state.localPreflight.summary
      : {};
    renderLocalPreflightBanner(state.localPreflight);
    renderGuardBanner({ error: summary.code || 'LOCAL_PREFLIGHT_NOT_READY' });
    return;
  }
  renderGuardBanner({ error: `${String(reasonCode || 'load_failed')}:${message}` });
}

async function loadLocalPreflight(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  if (!ADMIN_LOCAL_PREFLIGHT_ENABLED) {
    state.localPreflight = { ready: true, summary: { code: 'LOCAL_PREFLIGHT_DISABLED', tone: 'ok' } };
    clearLocalPreflightBanner();
    return state.localPreflight;
  }
  const traceId = ensureTraceInput('traceId') || newTraceId();
  try {
    const res = await fetch('/api/admin/local-preflight', { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'local preflight failed');
    state.localPreflight = data;
    if (data.ready === true) {
      clearLocalPreflightBanner();
      if (notify) showToast(t('ui.toast.localPreflight.ok', 'ローカル診断は正常です'), 'ok');
      return data;
    }
    renderLocalPreflightBanner(data);
    renderGuardBanner({ error: (data.summary && data.summary.code) || 'LOCAL_PREFLIGHT_NOT_READY' });
    if (notify) showToast(t('ui.toast.localPreflight.notReady', 'ローカル診断で要対応が見つかりました'), 'warn');
    return data;
  } catch (_err) {
    const fallback = {
      ready: false,
      checkedAt: new Date().toISOString(),
      summary: {
        code: 'LOCAL_PREFLIGHT_UNAVAILABLE',
        tone: 'warn',
        cause: t('ui.desc.admin.localPreflight.unavailableCause', 'ローカル診断APIの取得に失敗しました。'),
        impact: t('ui.desc.admin.localPreflight.unavailableImpact', '環境不備と実装不備の切り分けができません。'),
        action: t('ui.desc.admin.localPreflight.unavailableAction', '/api/admin/local-preflight を確認して再試行してください。')
      }
    };
    state.localPreflight = fallback;
    renderLocalPreflightBanner(fallback);
    renderGuardBanner({ error: 'LOCAL_PREFLIGHT_UNAVAILABLE' });
    if (notify) showToast(t('ui.toast.localPreflight.fail', 'ローカル診断の取得に失敗しました'), 'warn');
    return fallback;
  }
}

function runDangerActionGuard(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const message = opts.confirmKey
    ? t(opts.confirmKey, opts.confirmFallback || 'この操作を実行しますか？')
    : (opts.confirmFallback || 'この操作を実行しますか？');
  const approved = window.confirm(message); // eslint-disable-line no-alert
  if (!approved) {
    if (opts.cancelMessage) showToast(opts.cancelMessage, 'warn');
    return null;
  }
  if (!opts.traceInputId) return '';
  return ensureTraceInput(opts.traceInputId);
}

function resolveDomainLabel(kind, key, fallback) {
  if (!isFoundationCoreEnabled()) return fallback;
  const dictionaryCore = resolveCoreSlice('dictionaryCore');
  if (!dictionaryCore || typeof dictionaryCore.resolveDomainLabel !== 'function') return fallback;
  const resolved = dictionaryCore.resolveDomainLabel(kind, key, (dictKey) => t(dictKey, ''));
  if (typeof resolved === 'string' && resolved.trim()) return resolved.trim();
  return fallback;
}

function resolveListStateFromPersistence(listKey, defaults) {
  if (!isFoundationCoreEnabled()) return Object.assign({}, defaults || {});
  const stateCore = resolveCoreSlice('stateCore');
  if (!stateCore) return Object.assign({}, defaults || {});
  const urlState = typeof stateCore.parseListStateFromQuery === 'function'
    ? stateCore.parseListStateFromQuery(listKey, globalThis.location.search)
    : {};
  const storedState = typeof stateCore.loadListState === 'function'
    ? stateCore.loadListState(listKey)
    : {};
  if (typeof stateCore.mergeStatePriority === 'function') {
    return stateCore.mergeStatePriority(urlState, storedState, defaults || {});
  }
  return Object.assign({}, defaults || {}, storedState || {}, urlState || {});
}

function persistListStateToStorage(listKey, nextState) {
  if (!isFoundationCoreEnabled()) return;
  const stateCore = resolveCoreSlice('stateCore');
  if (!stateCore) return;
  try {
    if (typeof stateCore.saveListState === 'function') {
      stateCore.saveListState(listKey, nextState || {});
    }
    if (globalThis.history && typeof globalThis.history.replaceState === 'function' && typeof stateCore.applyListStateToUrl === 'function') {
      const nextUrl = stateCore.applyListStateToUrl(listKey, nextState || {});
      globalThis.history.replaceState({}, '', nextUrl);
    }
  } catch (_err) {
    // best effort only
  }
}

function readComposerSavedListState() {
  return {
    search: getInputValue('composer-saved-search'),
    status: getSelectValue('composer-saved-status'),
    type: getSelectValue('composer-saved-type'),
    category: getSelectValue('composer-saved-category'),
    scenario: getSelectValue('composer-saved-scenario'),
    step: getSelectValue('composer-saved-step'),
    sortKey: state.composerSavedSortKey,
    sortDir: state.composerSavedSortDir
  };
}

function readUsersSummaryListState() {
  return {
    lineUserId: getInputValue('users-filter-line-user-id'),
    createdFrom: getInputValue('users-filter-created-from'),
    createdTo: getInputValue('users-filter-created-to'),
    category: getSelectValue('users-filter-category'),
    status: getSelectValue('users-filter-status'),
    plan: getSelectValue('users-filter-plan'),
    subscriptionStatus: getSelectValue('users-filter-subscription-status'),
    billingIntegrity: getSelectValue('users-filter-billing-integrity'),
    quickFilter: state.usersSummaryQuickFilter || 'all',
    visibleColumns: (Array.isArray(state.usersSummaryVisibleColumns) ? state.usersSummaryVisibleColumns : USERS_SUMMARY_COLUMN_KEYS).join(','),
    limit: getInputValue('users-filter-limit'),
    analyticsLimit: getInputValue('users-filter-analytics-limit'),
    sortKey: state.usersSummarySortKey,
    sortDir: state.usersSummarySortDir
  };
}

function readCityPackUnifiedListState() {
  return {
    idKeyword: getInputValue('city-pack-unified-filter-id'),
    userKeyword: getInputValue('city-pack-unified-filter-user-id'),
    cityKeyword: getInputValue('city-pack-unified-filter-city'),
    status: getSelectValue('city-pack-unified-filter-status'),
    recordType: getSelectValue('city-pack-unified-filter-type'),
    createdFrom: getInputValue('city-pack-unified-filter-date-from'),
    createdTo: getInputValue('city-pack-unified-filter-date-to'),
    sortKey: state.cityPackUnifiedSortKey,
    sortDir: state.cityPackUnifiedSortDir
  };
}

function readVendorUnifiedListState() {
  return {
    idKeyword: getInputValue('vendor-unified-filter-id'),
    nameKeyword: getInputValue('vendor-unified-filter-name'),
    status: getSelectValue('vendor-unified-filter-status'),
    categoryKeyword: getInputValue('vendor-unified-filter-category'),
    createdFrom: getInputValue('vendor-unified-filter-date-from'),
    createdTo: getInputValue('vendor-unified-filter-date-to'),
    sortKey: state.vendorSortKey,
    sortDir: state.vendorSortDir
  };
}

function readDashboardWindowState() {
  const out = {};
  Object.keys(DASHBOARD_CARD_CONFIG).forEach((metricKey) => {
    out[metricKey] = String(getDashboardWindowMonths(metricKey));
  });
  return out;
}

function applyComposerSavedListState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  if (snapshot.sortKey && COMPOSER_SAVED_SORT_TYPES[snapshot.sortKey]) {
    state.composerSavedSortKey = snapshot.sortKey;
  }
  if (snapshot.sortDir === 'asc' || snapshot.sortDir === 'desc') {
    state.composerSavedSortDir = snapshot.sortDir;
  }
  setInputValue('composer-saved-search', snapshot.search || '');
  setSelectValue('composer-saved-status', snapshot.status || '');
  setSelectValue('composer-saved-type', snapshot.type || '');
  setSelectValue('composer-saved-category', snapshot.category || '');
  setSelectValue('composer-saved-scenario', snapshot.scenario || '');
  setSelectValue('composer-saved-step', snapshot.step || '');
}

function applyUsersSummaryListState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  if (snapshot.sortKey && USERS_SUMMARY_SORT_TYPES[snapshot.sortKey]) {
    state.usersSummarySortKey = snapshot.sortKey;
  }
  if (snapshot.sortDir === 'asc' || snapshot.sortDir === 'desc') {
    state.usersSummarySortDir = snapshot.sortDir;
  }
  setInputValue('users-filter-line-user-id', snapshot.lineUserId || '');
  setInputValue('users-filter-created-from', snapshot.createdFrom || '');
  setInputValue('users-filter-created-to', snapshot.createdTo || '');
  setSelectValue('users-filter-category', snapshot.category || '');
  setSelectValue('users-filter-status', snapshot.status || '');
  setSelectValue('users-filter-plan', snapshot.plan || '');
  setSelectValue('users-filter-subscription-status', snapshot.subscriptionStatus || '');
  setSelectValue('users-filter-billing-integrity', snapshot.billingIntegrity || '');
  state.usersSummaryQuickFilter = snapshot.quickFilter && USERS_QUICK_FILTER_LABELS[snapshot.quickFilter]
    ? snapshot.quickFilter
    : 'all';
  if (snapshot.visibleColumns) {
    const parsed = String(snapshot.visibleColumns)
      .split(',')
      .map((item) => item.trim())
      .filter((item) => USERS_SUMMARY_COLUMN_KEYS.includes(item));
    if (parsed.length) {
      state.usersSummaryVisibleColumns = Array.from(new Set(parsed));
    }
  }
  if (snapshot.limit) setInputValue('users-filter-limit', snapshot.limit);
  if (snapshot.analyticsLimit) setInputValue('users-filter-analytics-limit', snapshot.analyticsLimit);
}

function applyCityPackUnifiedListState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  if (snapshot.sortKey && CITY_PACK_UNIFIED_SORT_TYPES[snapshot.sortKey]) {
    state.cityPackUnifiedSortKey = snapshot.sortKey;
  }
  if (snapshot.sortDir === 'asc' || snapshot.sortDir === 'desc') {
    state.cityPackUnifiedSortDir = snapshot.sortDir;
  }
  setInputValue('city-pack-unified-filter-id', snapshot.idKeyword || '');
  setInputValue('city-pack-unified-filter-user-id', snapshot.userKeyword || '');
  setInputValue('city-pack-unified-filter-city', snapshot.cityKeyword || '');
  setSelectValue('city-pack-unified-filter-status', snapshot.status || '');
  setSelectValue('city-pack-unified-filter-type', snapshot.recordType || '');
  setInputValue('city-pack-unified-filter-date-from', snapshot.createdFrom || '');
  setInputValue('city-pack-unified-filter-date-to', snapshot.createdTo || '');
}

function applyVendorUnifiedListState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  if (snapshot.sortKey && VENDOR_UNIFIED_SORT_TYPES[snapshot.sortKey]) {
    state.vendorSortKey = snapshot.sortKey;
  }
  if (snapshot.sortDir === 'asc' || snapshot.sortDir === 'desc') {
    state.vendorSortDir = snapshot.sortDir;
  }
  setInputValue('vendor-unified-filter-id', snapshot.idKeyword || '');
  setInputValue('vendor-unified-filter-name', snapshot.nameKeyword || '');
  setSelectValue('vendor-unified-filter-status', snapshot.status || '');
  setInputValue('vendor-unified-filter-category', snapshot.categoryKeyword || '');
  setInputValue('vendor-unified-filter-date-from', snapshot.createdFrom || '');
  setInputValue('vendor-unified-filter-date-to', snapshot.createdTo || '');
}

function applyDashboardWindowState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  Object.keys(DASHBOARD_CARD_CONFIG).forEach((metricKey) => {
    const value = snapshot[metricKey];
    if (!value) return;
    const select = document.getElementById(`dashboard-window-${metricKey}`);
    if (select) select.value = String(normalizeDashboardWindow(value));
  });
}

function hydrateListState() {
  applyComposerSavedListState(resolveListStateFromPersistence('composerSaved', readComposerSavedListState()));
  applyUsersSummaryListState(resolveListStateFromPersistence('usersSummary', readUsersSummaryListState()));
  applyCityPackUnifiedListState(resolveListStateFromPersistence('cityPackUnified', readCityPackUnifiedListState()));
  applyVendorUnifiedListState(resolveListStateFromPersistence('vendorUnified', readVendorUnifiedListState()));
  applyDashboardWindowState(resolveListStateFromPersistence('dashboardWindow', readDashboardWindowState()));
  state.role = resolveRoleFromPersistence(state.role);
}

function showToast(message, tone) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = `toast ${tone || ''} show`;
  setTimeout(() => {
    toastEl.className = 'toast';
    toastEl.textContent = '';
  }, 2200);
}

function t(key, fallback) {
  if (state.dict && Object.prototype.hasOwnProperty.call(state.dict, key)) {
    return state.dict[key];
  }
  if (typeof fallback === 'string') return fallback;
  return '';
}

function toUnifiedDisplay(value, fallbackValue) {
  const tableCore = resolveCoreSlice('tableCore');
  if (tableCore && typeof tableCore.toDisplayValue === 'function') {
    return tableCore.toDisplayValue(value, fallbackValue || t('ui.value.dashboard.notAvailable', 'NOT AVAILABLE'));
  }
  if (value === null || value === undefined) return fallbackValue || t('ui.value.dashboard.notAvailable', 'NOT AVAILABLE');
  if (typeof value === 'string' && value.trim().length === 0) return fallbackValue || t('ui.value.dashboard.notAvailable', 'NOT AVAILABLE');
  return String(value);
}

function statusLabel(status) {
  if (status === 'DANGER') return t('ui.status.danger', '要対応');
  if (status === 'WARN') return t('ui.status.warn', '注意');
  if (status === 'OK') return t('ui.status.ok', '問題なし');
  return t('ui.status.unknown', '未設定');
}

function decisionStateLabel(stateValue) {
  if (stateValue === 'STOP') return t('ui.label.decision.state.stop', 'STOP');
  if (stateValue === 'ATTENTION') return t('ui.label.decision.state.attention', 'ATTENTION');
  return t('ui.label.decision.state.ready', 'READY');
}

function decisionStateClass(stateValue) {
  if (stateValue === 'STOP') return 'state-stop';
  if (stateValue === 'ATTENTION') return 'state-attention';
  return 'state-ready';
}

function decisionCardClass(stateValue) {
  if (stateValue === 'STOP') return 'is-stop';
  if (stateValue === 'ATTENTION') return 'is-attention';
  return 'is-ready';
}

function buildDecisionReasons(pendingValue, primaryValue) {
  const pendingLabel = t('ui.label.decision.reason.pending', '要対応');
  const primaryLabel = t('ui.label.decision.reason.primary', '主因');
  const pending = pendingValue == null || pendingValue === '' ? '-' : String(pendingValue);
  const primary = primaryValue == null || primaryValue === '' ? '-' : String(primaryValue);
  // Keep contract: 2 fixed lines, no newlines.
  return {
    reason1: `${pendingLabel}: ${pending}`.replace(/\s*\n\s*/g, ' '),
    reason2: `${primaryLabel}: ${primary}`.replace(/\s*\n\s*/g, ' ')
  };
}

function setPaneUpdatedAt(paneKey) {
  state.paneUpdatedAt[paneKey] = new Date().toISOString();
}

function resolvePaneUpdatedAt(paneKey) {
  return state.paneUpdatedAt[paneKey] || '-';
}

function renderDecisionCard(paneKey, vm) {
  if (!paneKey || !vm) return;
  const cardEl = document.getElementById(`${paneKey}-decision-card`);
  const stateEl = document.getElementById(`${paneKey}-decision-state`);
  const reason1El = document.getElementById(`${paneKey}-decision-reason1`);
  const reason2El = document.getElementById(`${paneKey}-decision-reason2`);
  const updatedEl = document.getElementById(`${paneKey}-decision-updated`);
  const detailsEl = document.getElementById(`${paneKey}-pane-details`);

  if (cardEl) {
    cardEl.classList.remove('is-ready', 'is-attention', 'is-stop');
    cardEl.classList.add(decisionCardClass(vm.state));
  }
  if (stateEl) {
    stateEl.classList.remove('state-ready', 'state-attention', 'state-stop');
    stateEl.classList.add(decisionStateClass(vm.state));
    stateEl.textContent = decisionStateLabel(vm.state);
  }
  if (reason1El) reason1El.textContent = (vm.reason1 || '-').replace(/\s*\n\s*/g, ' ');
  if (reason2El) reason2El.textContent = (vm.reason2 || '-').replace(/\s*\n\s*/g, ' ');
  if (updatedEl) updatedEl.textContent = vm.updatedAt || resolvePaneUpdatedAt(paneKey);
  if (detailsEl && (vm.state === 'ATTENTION' || vm.state === 'STOP') && !detailsEl.open) {
    detailsEl.open = true;
    const paneEl = document.querySelector(`.app-pane[data-pane="${paneKey}"]`);
    if (paneEl && paneEl.classList.contains('is-active')) {
      const summaryEl = detailsEl.querySelector('summary');
      if (summaryEl && typeof summaryEl.focus === 'function') {
        summaryEl.focus({ preventScroll: true });
      }
    }
  }
}

function reasonLabel(reason) {
  if (!reason) return t('ui.reason.unknown', '未分類の理由');
  const key = `ui.reason.${reason}`;
  const label = t(key, '');
  if (label && label !== key) return label;
  return t('ui.reason.unknown', '未分類の理由');
}

function scenarioLabel(value) {
  if (!value) return '-';
  const key = `ui.value.scenario.${value}`;
  const label = t(key, '');
  if (label && label !== key) return label;
  const fallback = `${t('ui.label.scenario', 'シナリオ')}${value}`;
  return resolveDomainLabel('scenario', value, fallback);
}

function stepLabel(value) {
  if (!value) return '-';
  const key = `ui.value.step.${value}`;
  const label = t(key, '');
  if (label && label !== key) return label;
  return resolveDomainLabel('step', value, value);
}

function buildTip(prefixKey, value) {
  if (!value) return '';
  const prefix = t(prefixKey, '');
  if (!prefix) return String(value);
  return `${prefix}: ${value}`;
}

function withTip(text, tip) {
  const span = document.createElement('span');
  span.textContent = text;
  if (tip) {
    span.setAttribute('data-tip', tip);
    span.setAttribute('tabindex', '0');
  }
  return span;
}

async function loadDict() {
  try {
    const res = await fetch('/admin/ui-dict');
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data === 'object') {
      state.dict = data;
    }
  } catch (_err) {
    // fall back to inline text
  }
}

function applyDict() {
  document.querySelectorAll('[data-dict-key]').forEach((el) => {
    const key = el.getAttribute('data-dict-key');
    if (!key) return;
    const value = t(key, el.textContent);
    if (value) el.textContent = value;
  });

  document.querySelectorAll('[data-dict-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-dict-placeholder');
    if (!key) return;
    const value = t(key, el.getAttribute('placeholder') || '');
    if (value) el.setAttribute('placeholder', value);
  });

  document.querySelectorAll('[data-dict-tip]').forEach((el) => {
    const key = el.getAttribute('data-dict-tip');
    if (!key) return;
    const value = t(key, el.getAttribute('data-tip') || '');
    if (value) {
      el.setAttribute('data-tip', value);
      el.setAttribute('tabindex', '0');
    }
  });
}

function applyRoleNavPolicy(role) {
  const navCore = resolveCoreSlice('navCore');
  const normalizeRole = navCore && typeof navCore.normalizeRole === 'function'
    ? navCore.normalizeRole
    : (value) => (value === 'admin' || value === 'developer' ? value : 'operator');
  const nextRole = normalizeRole(role);
  const isAllowedByCore = navCore && typeof navCore.isRoleAllowed === 'function'
    ? navCore.isRoleAllowed
    : (targetRole, allowList) => {
        if (!Array.isArray(allowList) || !allowList.length) return true;
        return allowList.includes(targetRole);
      };
  document.querySelectorAll('[data-role-allow]').forEach((el) => {
    const explicitAllow = parseRoleAllowList(el.getAttribute('data-role-allow'));
    const allowList = explicitAllow.length ? explicitAllow : [];
    const allowed = isAllowedByCore(nextRole, allowList);
    el.classList.toggle('role-hidden', !allowed);
    if (!allowed) el.setAttribute('aria-hidden', 'true');
    else el.removeAttribute('aria-hidden');
  });
}

function applyNavGroupVisibilityPolicy(role, entries) {
  const navCore = resolveCoreSlice('navCore');
  const nextRole = normalizeRoleValue(role);
  if (ADMIN_NAV_ALL_ACCESSIBLE_V1) {
    const evaluatedEntries = Array.isArray(entries) ? entries : resolveVisibleNavEntries(nextRole);
    const visibleGroupKeys = resolveVisibleGroupKeysFromEntries(nextRole, evaluatedEntries);
    document.querySelectorAll('.app-nav [data-nav-group]').forEach((groupEl) => {
      const groupKey = String(groupEl.getAttribute('data-nav-group') || '').trim();
      const visible = !groupKey || visibleGroupKeys.includes(groupKey);
      groupEl.setAttribute('data-nav-visible', visible ? 'true' : 'false');
      if (visible) groupEl.removeAttribute('aria-hidden');
      else groupEl.setAttribute('aria-hidden', 'true');
    });
    return;
  }
  const visiblePolicy = resolveNavGroupVisibilityPolicy();
  const isGroupVisibleByCore = navCore && typeof navCore.isGroupVisible === 'function'
    ? navCore.isGroupVisible
    : (targetRole, groupKey, policy) => {
        const source = policy && typeof policy === 'object' ? policy : {};
        const list = Array.isArray(source[targetRole]) ? source[targetRole] : [];
        return list.includes(groupKey);
      };
  document.querySelectorAll('.app-nav [data-nav-group]').forEach((groupEl) => {
    const groupKey = String(groupEl.getAttribute('data-nav-group') || '').trim();
    const visibleByPolicy = groupKey
      ? isGroupVisibleByCore(nextRole, groupKey, visiblePolicy)
      : true;
    const visible = visibleByPolicy && isRolloutEnabledForGroup(groupEl, nextRole);
    groupEl.setAttribute('data-nav-visible', visible ? 'true' : 'false');
    if (visible) groupEl.removeAttribute('aria-hidden');
    else groupEl.setAttribute('aria-hidden', 'true');
  });
}

function applyNavItemVisibilityPolicy(role, entries) {
  const navCore = resolveCoreSlice('navCore');
  const nextRole = normalizeRoleValue(role);
  const evaluated = Array.isArray(entries) ? entries : resolveVisibleNavEntries(nextRole);
  if (Array.isArray(evaluated) && evaluated.length > 0) {
    evaluated.forEach((entry) => {
      if (!entry || !entry.element) return;
      const visible = entry.visible === true;
      entry.element.setAttribute('data-nav-item-visible', visible ? 'true' : 'false');
      if (!visible) entry.element.setAttribute('aria-hidden', 'true');
      else entry.element.removeAttribute('aria-hidden');
    });
    return;
  }
  const navItems = collectNavItemsForCore();
  navItems.forEach((entry) => {
    if (!entry || !entry.element) return;
    const hiddenGroup = entry.element.closest('.nav-group[data-nav-visible="false"]');
    const allowList = parseRoleAllowList(entry.element.getAttribute('data-role-allow'));
    const roleAllowed = !allowList.length || allowList.includes(nextRole);
    const visible = !hiddenGroup && roleAllowed;
    entry.element.setAttribute('data-nav-item-visible', visible ? 'true' : 'false');
    if (!visible) entry.element.setAttribute('aria-hidden', 'true');
    else entry.element.removeAttribute('aria-hidden');
  });
}

function resolveAllowedPaneForRole(role, pane, fallbackPane) {
  const navCore = resolveCoreSlice('navCore');
  const nextRole = normalizeRoleValue(role);
  const panePolicy = resolvePanePolicy();
  if (navCore && typeof navCore.resolveAllowedPane === 'function') {
    return navCore.resolveAllowedPane(nextRole, pane, panePolicy, fallbackPane || 'home');
  }
  const allowList = Array.isArray(panePolicy[nextRole]) ? panePolicy[nextRole] : [];
  if (pane && allowList.includes(pane)) return pane;
  return fallbackPane || 'home';
}

function setRole(role, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const navCore = resolveCoreSlice('navCore');
  const nextRole = normalizeRoleValue(role);
  state.role = nextRole;
  persistRoleState(nextRole);
  if (appShell) appShell.setAttribute('data-role', nextRole);
  document.querySelectorAll('.role-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.roleValue === nextRole);
  });
  applyRoleNavPolicy(nextRole);
  const visibleEntries = resolveVisibleNavEntries(nextRole);
  applyNavGroupVisibilityPolicy(nextRole, visibleEntries);
  applyNavItemVisibilityPolicy(nextRole, visibleEntries);
  const activePane = document.querySelector('.app-pane.is-active');
  const paneKey = activePane && activePane.dataset ? activePane.dataset.pane : (state.activePane || 'home');
  let allowedPane = resolveAllowedPaneForRole(nextRole, paneKey, 'home');
  if (paneKey && ADMIN_NAV_ALL_ACCESSIBLE_V1) {
    const visibleMatch = resolvePreferredNavEntry(nextRole, allowedPane, visibleEntries);
    if (!visibleMatch || visibleMatch.pane !== allowedPane) allowedPane = 'home';
  } else if (paneKey && navCore && typeof navCore.resolveActiveNavItem === 'function') {
    const legacyVisibleMatch = navCore.resolveActiveNavItem(collectNavItemsForCore(), allowedPane, nextRole, {
      groupPolicy: resolveNavGroupVisibilityPolicy(),
      rolloutEnabled: ADMIN_NAV_ROLLOUT_V1,
      fallbackPane: 'home'
    });
    if (!legacyVisibleMatch || legacyVisibleMatch.pane !== allowedPane) allowedPane = 'home';
  }
  if (paneKey && paneKey !== allowedPane) {
    renderGuardBanner({ error: opts.guardReason || 'ROLE_FORBIDDEN', recommendedPane: allowedPane });
    activatePane(allowedPane, { historyMode: 'replace', guardReason: 'ROLE_FORBIDDEN' });
    return;
  }
  if (opts.syncHistory !== false) {
    updateHistoryWithPaneRole(paneKey || 'home', nextRole, opts.historyMode || 'replace');
  }
  applyBuildMetaBadge();
}

function setupRoleSwitch() {
  document.querySelectorAll('.role-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setRole(btn.dataset.roleValue, { historyMode: 'push', syncHistory: true, guardReason: 'ROLE_FORBIDDEN' });
    });
  });
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.paneTarget;
      if (!target) return;
      const scrollTarget = btn.dataset.scrollTarget || null;
      activatePane(target, { scrollTarget, clickedButton: btn, historyMode: 'push' });
    });
  });
}

function updatePageHeader(paneKey) {
  const meta = PANE_HEADER_MAP[paneKey] || PANE_HEADER_MAP.home;
  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  const primaryAction = document.getElementById('page-action-primary');
  const secondaryAction = document.getElementById('page-action-secondary');
  if (titleEl) titleEl.textContent = t(meta.titleKey, titleEl.textContent || '');
  if (subtitleEl) {
    if (paneKey === 'composer' || paneKey === 'monitor' || paneKey === 'read-model' || paneKey === 'city-pack' || paneKey === 'vendors') {
      subtitleEl.textContent = '';
    } else {
      subtitleEl.textContent = t(meta.subtitleKey, subtitleEl.textContent || '');
    }
  }
  if (primaryAction) primaryAction.classList.add('hidden');
  if (secondaryAction) secondaryAction.classList.add('hidden');
}

function expandPaneDetails(paneKey) {
  if (!paneKey) return;
  const paneEl = document.querySelector(`.app-pane[data-pane="${paneKey}"]`);
  if (!paneEl) return;
  paneEl.querySelectorAll('details').forEach((el) => {
    el.open = true;
  });
}

function expandAllDetails() {
  document.querySelectorAll('details').forEach((el) => {
    el.open = true;
  });
}

function enforceNoCollapseUi() {
  if (!ADMIN_NO_COLLAPSE_V1) return;
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.classList.add('admin-no-collapse-v1');
  document.querySelectorAll('details').forEach((el) => {
    el.open = true;
    if (el.dataset.noCollapseBound === '1') return;
    el.dataset.noCollapseBound = '1';
    el.addEventListener('toggle', () => {
      if (!el.open) el.open = true;
    });
    const summaryEl = el.querySelector('summary');
    if (summaryEl) {
      summaryEl.setAttribute('aria-disabled', 'true');
      summaryEl.setAttribute('tabindex', '-1');
    }
  });
}

function applyTopSummaryVisibility() {
  const summaryLine = document.getElementById('topbar-summary-line')
    || document.querySelector('.top-summary-line');
  if (!summaryLine) return;
  if (ADMIN_TOP_SUMMARY_V1) {
    summaryLine.classList.remove('is-hidden-by-flag');
    summaryLine.removeAttribute('aria-hidden');
    return;
  }
  summaryLine.classList.add('is-hidden-by-flag');
  summaryLine.setAttribute('aria-hidden', 'true');
}

function applyUsersStripeLayoutVisibility() {
  const quickFilters = document.getElementById('users-summary-quick-filters');
  const analyzeBtn = document.getElementById('users-summary-analyze');
  const exportBtn = document.getElementById('users-summary-export');
  const editColumnsBtn = document.getElementById('users-summary-edit-columns');
  const columnsPanel = document.getElementById('users-summary-columns-panel');
  const billingIntegritySelect = document.getElementById('users-filter-billing-integrity');
  const billingIntegrityWrap = billingIntegritySelect && billingIntegritySelect.closest('.flex-1');

  if (ADMIN_USERS_STRIPE_LAYOUT_V1) {
    if (quickFilters) quickFilters.classList.remove('is-hidden-by-flag');
    if (analyzeBtn) analyzeBtn.classList.remove('is-hidden-by-flag');
    if (exportBtn) exportBtn.classList.remove('is-hidden-by-flag');
    if (editColumnsBtn) editColumnsBtn.classList.remove('is-hidden-by-flag');
    if (columnsPanel) columnsPanel.classList.remove('is-hidden-by-flag');
    if (billingIntegrityWrap) billingIntegrityWrap.classList.remove('is-hidden-by-flag');
    return;
  }

  state.usersSummaryQuickFilter = 'all';
  if (quickFilters) quickFilters.classList.add('is-hidden-by-flag');
  if (analyzeBtn) analyzeBtn.classList.add('is-hidden-by-flag');
  if (exportBtn) exportBtn.classList.add('is-hidden-by-flag');
  if (editColumnsBtn) editColumnsBtn.classList.add('is-hidden-by-flag');
  if (columnsPanel) columnsPanel.classList.add('is-hidden-by-flag');
  if (billingIntegrityWrap) billingIntegrityWrap.classList.add('is-hidden-by-flag');
}

function scrollToPaneAnchor(targetId) {
  if (!targetId) return;
  const target = document.getElementById(targetId);
  if (!target || typeof target.scrollIntoView !== 'function') return;
  target.scrollIntoView({ block: 'start' });
}

function setupHomeControls() {
  document.querySelectorAll('[data-open-pane]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-open-pane');
      if (!target) return;
      activatePane(target);
    });
  });
  document.getElementById('topbar-open-alerts')?.addEventListener('click', () => {
    activatePane('alerts', { allowHiddenRollout: true, historyMode: 'push' });
    void loadAlertsSummary({ notify: false });
  });
  document.getElementById('home-run-test')?.addEventListener('click', () => {
    runHomeSafeTest();
  });
  document.getElementById('dashboard-reload')?.addEventListener('click', () => {
    void loadDashboardKpis({ notify: true });
  });
  document.getElementById('dashboard-journey-kpi-reload')?.addEventListener('click', () => {
    void loadDashboardJourneyKpi({ notify: true });
  });
  document.querySelectorAll('.dashboard-window-select').forEach((el) => {
    el.addEventListener('change', () => {
      void loadDashboardKpis({ notify: false });
    });
  });
  document.getElementById('dashboard-window-months')?.addEventListener('change', () => {
    void loadDashboardKpis({ notify: false });
  });
  document.getElementById('alerts-reload')?.addEventListener('click', () => {
    void loadAlertsSummary({ notify: true });
  });
}

function setupHeaderActions() {
  const consultBtn = document.getElementById('header-consult-link');
  if (!consultBtn) return;
  consultBtn.addEventListener('click', async () => {
    const traceId = ensureTraceInput('traceId') || newTraceId();
    try {
      await fetch('/api/phase1/events', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, buildHeaders({}, traceId)),
        body: JSON.stringify({
          lineUserId: `admin:${state.role}`,
          type: 'ADMIN_CONSULT_CLICKED',
          ref: 'admin_composer'
        })
      });
    } catch (_err) {
      // best effort only
    }
    activatePane('llm');
    showToast(t('ui.toast.header.consult', '相談導線を開きました'), 'ok');
  });
}

function clearElementChildren(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

function renderStringList(elementId, values, fallbackValue) {
  const root = document.getElementById(elementId);
  if (!root) return;
  clearElementChildren(root);
  const rows = Array.isArray(values) ? values.filter((value) => typeof value === 'string' && value.trim().length > 0) : [];
  if (!rows.length) {
    const li = document.createElement('li');
    li.textContent = fallbackValue || t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    root.appendChild(li);
    return;
  }
  rows.forEach((row) => {
    const li = document.createElement('li');
    li.textContent = row;
    root.appendChild(li);
  });
}

function asText(value, fallback) {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (Number.isFinite(value)) return String(value);
  return fallback || '-';
}

function renderRepoMapFaqRows(rows) {
  const body = document.getElementById('manual-redac-faq-rows');
  if (!body) return;
  clearElementChildren(body);
  const items = Array.isArray(rows) ? rows : [];
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }
  items.forEach((row) => {
    const tr = document.createElement('tr');
    const q = document.createElement('td');
    q.textContent = asText(row && row.q, '-');
    const a = document.createElement('td');
    a.textContent = asText(row && row.a, '-');
    tr.appendChild(q);
    tr.appendChild(a);
    body.appendChild(tr);
  });
}

function renderRepoMapCategories(categories) {
  const root = document.getElementById('repo-map-categories');
  if (!root) return;
  clearElementChildren(root);
  const groups = Array.isArray(categories) ? categories : [];
  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'cell-muted';
    empty.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    root.appendChild(empty);
    return;
  }

  groups.forEach((group) => {
    const section = document.createElement('section');
    section.className = 'repo-map-category';
    const categoryKey = group && typeof group.key === 'string' ? group.key : '';
    const isNotifications = categoryKey === 'notifications';

    const heading = document.createElement('h3');
    heading.className = 'repo-map-category-title';
    heading.textContent = asText(group && group.labelJa, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
    section.appendChild(heading);

    const items = Array.isArray(group && group.items) ? group.items : [];
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'cell-muted';
      empty.textContent = t('ui.label.common.empty', 'データなし');
      section.appendChild(empty);
      root.appendChild(section);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'repo-map-card';

      const cardHeader = document.createElement('div');
      cardHeader.className = 'repo-map-card-header';
      const title = document.createElement('div');
      title.className = 'repo-map-card-title';
      title.textContent = asText(item && item.nameJa, '-');
      const status = document.createElement('span');
      status.className = 'status-pill';
      status.textContent = asText(item && item.status, '-');
      cardHeader.appendChild(title);
      cardHeader.appendChild(status);
      card.appendChild(cardHeader);

      const isNotificationSendCard = isNotifications && (item && (item.id === 'notifications' || item.id === 'osNotifications'));
      const baseCanDo = Array.isArray(item && item.canDo) ? item.canDo : [];
      const canDoValues = isNotificationSendCard
        ? (() => {
            const killSwitch = state.repoMapKillSwitch;
            let verdict = '結論: 判定できません（Kill Switch未取得）';
            if (killSwitch === true) verdict = '結論: 送信できません（Kill SwitchがON）';
            else if (killSwitch === false) verdict = '結論: 送信できます（Kill SwitchはOFF）';
            return [verdict].concat(baseCanDo);
          })()
        : baseCanDo;

      const sections = [
        {
          label: isNotifications
            ? t('ui.label.repoMap.notifications.canDo', t('ui.label.repoMap.canDo', '運用判定'))
            : t('ui.label.repoMap.canDo', '運用判定'),
          values: canDoValues
        },
        {
          label: isNotifications
            ? t('ui.label.repoMap.notifications.cannotDo', t('ui.label.repoMap.cannotDo', 'ブロッカー'))
            : t('ui.label.repoMap.cannotDo', 'ブロッカー'),
          values: item && item.cannotDo
        },
        {
          label: isNotifications
            ? t('ui.label.repoMap.notifications.risks', t('ui.label.repoMap.risks', '注意'))
            : t('ui.label.repoMap.risks', '注意'),
          values: item && item.risks
        },
        {
          label: isNotifications
            ? t('ui.label.repoMap.notifications.nextActions', t('ui.label.repoMap.nextActions', '次の一手'))
            : t('ui.label.repoMap.nextActions', '次の一手'),
          values: item && item.nextActions
        }
      ];
      sections.forEach((entry) => {
        const values = Array.isArray(entry.values) ? entry.values.filter((v) => typeof v === 'string' && v.trim().length > 0) : [];
        if (!values.length) return;
        const label = document.createElement('div');
        label.className = 'repo-map-card-subtitle';
        label.textContent = entry.label;
        card.appendChild(label);
        const list = document.createElement('ul');
        list.className = 'repo-map-list';
        values.slice(0, 3).forEach((value) => {
          const li = document.createElement('li');
          li.textContent = value;
          list.appendChild(li);
        });
        card.appendChild(list);
      });

      const related = Array.isArray(item && item.relatedFiles) ? item.relatedFiles : [];
      const relatedLabel = document.createElement('div');
      relatedLabel.className = 'repo-map-card-subtitle repo-map-related-files-label';
      relatedLabel.textContent = t('ui.label.repoMap.relatedFiles', '関連ファイル');
      card.appendChild(relatedLabel);
      const relatedList = document.createElement('ul');
      relatedList.className = 'repo-map-list mono-list repo-map-related-files-list';
      if (!related.length) {
        const li = document.createElement('li');
        li.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
        relatedList.appendChild(li);
      } else {
        related.slice(0, 8).forEach((filePath) => {
          const li = document.createElement('li');
          li.textContent = filePath;
          relatedList.appendChild(li);
        });
      }
      card.appendChild(relatedList);
      section.appendChild(card);
    });
    root.appendChild(section);
  });
}

function renderRepoMapMatrix(matrix) {
  const head = document.getElementById('repo-map-matrix-head');
  const body = document.getElementById('repo-map-matrix-rows');
  if (!head || !body) return;
  clearElementChildren(head);
  clearElementChildren(body);

  const scenarios = Array.isArray(matrix && matrix.scenarios) ? matrix.scenarios : [];
  const steps = Array.isArray(matrix && matrix.steps) ? matrix.steps : [];
  const cells = Array.isArray(matrix && matrix.cells) ? matrix.cells : [];
  if (!scenarios.length || !steps.length || !cells.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  const headRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.textContent = t('ui.label.repoMap.matrix.scenario', 'シナリオ');
  headRow.appendChild(corner);
  steps.forEach((stepKey) => {
    const th = document.createElement('th');
    th.textContent = stepLabel(stepKey);
    headRow.appendChild(th);
  });
  head.appendChild(headRow);

  scenarios.forEach((scenarioKey) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = scenarioLabel(scenarioKey);
    tr.appendChild(th);
    steps.forEach((stepKey) => {
      const td = document.createElement('td');
      const cell = cells.find((row) => row && row.scenarioKey === scenarioKey && row.stepKey === stepKey);
      if (!cell) {
        td.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
      } else {
        const count = Number.isFinite(Number(cell.notificationCount)) ? Number(cell.notificationCount) : 0;
        const states = cell.states && typeof cell.states === 'object' ? cell.states : {};
        td.textContent = `${t('ui.label.repoMap.matrix.notifications', '通知数')}: ${count} / ${t('ui.label.repoMap.matrix.states', '状態')}: ${Number(states.draft || 0)}/${Number(states.active || 0)}/${Number(states.sent || 0)}`;
      }
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function renderLegacyStatus(payload) {
  const rowsEl = document.getElementById('repo-map-legacy-status-rows');
  const noteEl = document.getElementById('repo-map-legacy-status-note');
  if (!rowsEl) return;
  clearElementChildren(rowsEl);

  const items = Array.isArray(payload && payload.items) ? payload.items : [];
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    tr.appendChild(td);
    rowsEl.appendChild(tr);
    if (noteEl) noteEl.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement('tr');
    const pathTd = document.createElement('td');
    pathTd.textContent = asText(item && item.path, '-');
    const modeTd = document.createElement('td');
    modeTd.textContent = asText(item && item.mode, '-');
    const targetTd = document.createElement('td');
    targetTd.textContent = asText(item && item.target, '-');
    tr.appendChild(pathTd);
    tr.appendChild(modeTd);
    tr.appendChild(targetTd);
    rowsEl.appendChild(tr);
  });

  const summary = payload && payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
  if (noteEl) {
    const legacyHtml = Number.isFinite(Number(summary.legacyHtmlCount)) ? Number(summary.legacyHtmlCount) : 0;
    const redirectCount = Number.isFinite(Number(summary.redirectCount)) ? Number(summary.redirectCount) : 0;
    noteEl.textContent = `${t('ui.label.developer.legacy.summary', 'legacy HTML / redirect')}: ${legacyHtml} / ${redirectCount}`;
  }
}

async function loadLegacyStatus(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const traceId = newTraceId();
  try {
    const res = await fetch('/api/admin/legacy-status', { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'legacy status load failed');
    state.legacyStatusItems = Array.isArray(data.items) ? data.items : [];
    renderLegacyStatus(data);
    if (notify) showToast(t('ui.toast.legacyStatus.reloadOk', 'LEGACY導線を更新しました'), 'ok');
  } catch (_err) {
    state.legacyStatusItems = [];
    renderLegacyStatus({ items: [] });
    if (notify) showToast(t('ui.toast.legacyStatus.reloadFail', 'LEGACY導線の取得に失敗しました'), 'danger');
  }
}

function mergeNotificationMatrixFromItems(baseMatrix, items) {
  const matrix = baseMatrix && typeof baseMatrix === 'object' ? JSON.parse(JSON.stringify(baseMatrix)) : { scenarios: [], steps: [], cells: [] };
  const cells = Array.isArray(matrix.cells) ? matrix.cells : [];
  const index = new Map();
  cells.forEach((cell) => {
    const key = `${cell.scenarioKey || ''}::${cell.stepKey || ''}`;
    index.set(key, cell);
  });
  (items || []).forEach((item) => {
    const scenarioKey = item && typeof item.scenarioKey === 'string' ? item.scenarioKey : null;
    const stepKey = item && typeof item.stepKey === 'string' ? item.stepKey : null;
    if (!scenarioKey || !stepKey) return;
    const key = `${scenarioKey}::${stepKey}`;
    if (!index.has(key)) {
      const next = {
        scenarioKey,
        stepKey,
        notificationCount: 0,
        states: { draft: 0, active: 0, sent: 0 },
        note: 'OK'
      };
      cells.push(next);
      index.set(key, next);
      if (!matrix.scenarios.includes(scenarioKey)) matrix.scenarios.push(scenarioKey);
      if (!matrix.steps.includes(stepKey)) matrix.steps.push(stepKey);
    }
    const target = index.get(key);
    target.notificationCount = Number(target.notificationCount || 0) + 1;
    const status = typeof item.status === 'string' ? item.status : '';
    if (status === 'draft') target.states.draft = Number(target.states.draft || 0) + 1;
    else if (status === 'active') target.states.active = Number(target.states.active || 0) + 1;
    else if (status === 'sent') target.states.sent = Number(target.states.sent || 0) + 1;
    target.note = 'OK';
  });
  matrix.cells = cells;
  return matrix;
}

async function loadNotificationMatrixOverlay() {
  const traceId = newTraceId();
  const res = await fetch('/api/admin/os/notifications/list?limit=500', {
    headers: buildHeaders({}, traceId)
  });
  const data = await readJsonResponse(res);
  if (!data || data.ok !== true) throw new Error((data && data.error) || 'notification matrix load failed');
  const items = Array.isArray(data.items) ? data.items : [];
  return mergeNotificationMatrixFromItems(state.repoMap && state.repoMap.scenarioStepMatrix, items);
}

function renderRepoMapCommunication(layers) {
  const communication = layers && layers.communication && typeof layers.communication === 'object' ? layers.communication : {};
  const redac = communication.redacGuide && typeof communication.redacGuide === 'object' ? communication.redacGuide : {};
  const user = communication.userGuide && typeof communication.userGuide === 'object' ? communication.userGuide : {};
  renderStringList('manual-redac-can-do', redac.whatCanDo, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  renderStringList('manual-redac-safety', redac.safetyDesign, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  renderStringList('manual-redac-flow', redac.operationFlow, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  renderStringList('manual-redac-roadmap', redac.roadmap, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  renderRepoMapFaqRows(redac.faq);
  renderStringList('manual-redac-evidence', redac.evidence, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));

  renderStringList('manual-user-overview', user.serviceOverview, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  renderStringList('manual-user-privacy', user.privacy, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  renderStringList('manual-user-consultation', user.consultation, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  renderStringList('manual-user-evidence', user.evidence, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
}

function renderRepoMapSchemaStatus(validation) {
  const noteEl = document.getElementById('repo-map-schema-note');
  if (!noteEl) return;
  const result = validation && typeof validation === 'object' ? validation : { ok: true, errors: [] };
  if (result.ok) {
    noteEl.textContent = 'Repo Map schema: OK';
    noteEl.classList.remove('admin-guard-text-danger');
    return;
  }
  const errors = Array.isArray(result.errors) ? result.errors.filter(Boolean) : [];
  noteEl.textContent = `Repo Map schema不整合: ${errors.join(' / ') || '-'}`;
  noteEl.classList.add('admin-guard-text-danger');
}

function renderRepoMapTodoCards(cards) {
  const container = document.getElementById('repo-map-todo-cards');
  if (!container) return;
  clearElementChildren(container);
  const list = Array.isArray(cards) ? cards : [];
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'cell-muted';
    empty.textContent = t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    container.appendChild(empty);
    return;
  }
  list.slice(0, 12).forEach((item) => {
    const card = document.createElement('article');
    card.className = 'repo-map-todo-card';
    const urgency = document.createElement('div');
    urgency.className = `repo-map-todo-urgency is-${item && item.urgency === 'high' ? 'high' : 'normal'}`;
    urgency.textContent = `緊急度: ${item && item.urgency === 'high' ? '高' : '通常'}`;
    card.appendChild(urgency);
    const task = document.createElement('div');
    task.className = 'repo-map-todo-title';
    task.textContent = `タスク: ${asText(item && item.task, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'))}`;
    card.appendChild(task);
    const why = document.createElement('div');
    why.className = 'repo-map-todo-line';
    why.textContent = `なぜ: ${asText(item && item.why, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'))}`;
    card.appendChild(why);
    const impact = document.createElement('div');
    impact.className = 'repo-map-todo-line';
    impact.textContent = `影響: ${asText(item && item.impact, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'))}`;
    card.appendChild(impact);
    container.appendChild(card);
  });
}

function renderRepoMap(payload) {
  const data = payload && payload.repoMap ? payload.repoMap : null;
  state.repoMap = data;
  const overview = data && data.systemOverview ? data.systemOverview : {};
  const lines = Array.isArray(overview.what) ? overview.what : [];
  const meta = data && data.meta ? data.meta : {};
  const summary = overview && overview.statusSummary && typeof overview.statusSummary === 'object' ? overview.statusSummary : {};
  const commit = meta && meta.lastCommit && typeof meta.lastCommit === 'object' ? meta.lastCommit : {};

  const setText = (id, value, fallback) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = asText(value, fallback);
  };

  setText('repo-map-overview-line1', lines[0], t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  setText('repo-map-overview-line2', lines[1], t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  setText('repo-map-overview-line3', lines[2], t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  setText('repo-map-version', meta.version, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  setText('repo-map-generated-at', formatDateLabel(meta.generatedAt), t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  setText('repo-map-test-count', Number.isFinite(Number(meta.testCount)) ? Number(meta.testCount) : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  setText('repo-map-implemented-count', Number.isFinite(Number(summary.implemented)) ? Number(summary.implemented) : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));
  setText('repo-map-legacy-count', Number.isFinite(Number(summary.legacy)) ? Number(summary.legacy) : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));

  const commitText = commit && commit.hash
    ? `${String(commit.hash).slice(0, 8)} ${asText(commit.subject, '')}`.trim()
    : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
  setText('repo-map-last-commit', commitText, t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE'));

  renderRepoMapCategories(data && data.categories);
  renderRepoMapMatrix(data && data.scenarioStepMatrix);
  renderRepoMapCommunication(data && data.layers);
  const repoMapCore = resolveCoreSlice('repoMapCore');
  const todoCards = repoMapCore && typeof repoMapCore.buildTodoCards === 'function'
    ? repoMapCore.buildTodoCards(data || {})
    : [];
  renderRepoMapTodoCards(todoCards);
}

async function loadRepoMap(options) {
  const notify = !options || options.notify !== false;
  const traceId = newTraceId();
  try {
    const [repoRes, killRes] = await Promise.all([
      fetch('/api/admin/repo-map', { headers: buildHeaders({}, traceId) }),
      fetch('/api/admin/os/kill-switch/status', { headers: buildHeaders({}, traceId) })
    ]);
    const data = await readJsonResponse(repoRes);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'repo map load failed');

    try {
      const killData = await readJsonResponse(killRes);
      state.repoMapKillSwitch = killData && killData.ok ? Boolean(killData.killSwitch) : null;
    } catch (_err) {
      state.repoMapKillSwitch = null;
    }

    const repoMapCore = resolveCoreSlice('repoMapCore');
    const validation = repoMapCore && typeof repoMapCore.validateSchemaMin === 'function'
      ? repoMapCore.validateSchemaMin(data.repoMap || {})
      : { ok: true, errors: [] };
    renderRepoMapSchemaStatus(validation);
    if (!validation.ok) renderGuardBanner({ error: `repo_map_schema_invalid:${(validation.errors || []).join(',')}` });
    else clearGuardBanner();
    renderRepoMap(data);
    await loadNotificationMatrixOverlay().then((matrix) => {
      renderRepoMapMatrix(matrix);
    }).catch(() => {
      // keep fallback matrix
    });
    await loadLegacyStatus({ notify: false });
    if (notify) showToast(t('ui.toast.repoMap.reloadOk', 'Repo Mapを更新しました'), 'ok');
  } catch (_err) {
    state.repoMapKillSwitch = null;
    renderRepoMapSchemaStatus({ ok: false, errors: ['load_failed'] });
    renderGuardBanner(_err && _err.message ? { error: _err.message } : { error: 'repo map load failed' });
    renderRepoMap({
      repoMap: {
        meta: {},
        systemOverview: { what: [t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE')], statusSummary: {} },
        categories: [],
        scenarioStepMatrix: { scenarios: [], steps: [], cells: [] },
        layers: {}
      }
    });
    renderLegacyStatus({ items: [] });
    if (notify) showToast(t('ui.toast.repoMap.reloadFail', 'Repo Mapの取得に失敗しました'), 'danger');
  }
}

function setupDeveloperMenu() {
  const openMap = document.getElementById('developer-open-map');
  const openSystem = document.getElementById('developer-open-system');
  const openAudit = document.getElementById('developer-open-audit');
  const openImplementation = document.getElementById('developer-open-implementation');
  const openLegacy = document.getElementById('developer-open-legacy');
  const openManualRedac = document.getElementById('developer-open-manual-redac');
  const openManualUser = document.getElementById('developer-open-manual-user');
  const reload = document.getElementById('repo-map-reload');
  const reloadLegacy = document.getElementById('repo-map-load-legacy');
  const paneSystem = document.getElementById('repo-map-open-settings');
  const paneAudit = document.getElementById('repo-map-open-audit');
  const paneLegacyReview = document.getElementById('repo-map-open-legacy-review');
  const paneManualRedac = document.getElementById('repo-map-open-manual-redac');
  const paneManualUser = document.getElementById('repo-map-open-manual-user');
  const redacOpenMap = document.getElementById('manual-redac-open-map');
  const redacOpenUser = document.getElementById('manual-redac-open-user');
  const userOpenMap = document.getElementById('manual-user-open-map');
  const userOpenRedac = document.getElementById('manual-user-open-redac');

  openMap?.addEventListener('click', () => activatePane('developer-map'));
  openSystem?.addEventListener('click', () => activatePane('settings'));
  openAudit?.addEventListener('click', async () => {
    activatePane('audit');
    await loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
  });
  openImplementation?.addEventListener('click', () => {
    activatePane('developer-map', { scrollTarget: 'developer-map-implementation' });
  });
  openLegacy?.addEventListener('click', () => {
    activatePane('developer-map', { scrollTarget: 'developer-map-legacy' });
    void loadLegacyStatus({ notify: false });
  });
  openManualRedac?.addEventListener('click', () => {
    activatePane('developer-manual-redac');
  });
  openManualUser?.addEventListener('click', () => {
    activatePane('developer-manual-user');
  });
  reload?.addEventListener('click', () => {
    void loadRepoMap({ notify: true });
  });
  reloadLegacy?.addEventListener('click', () => {
    void loadLegacyStatus({ notify: true });
  });
  paneSystem?.addEventListener('click', () => activatePane('settings'));
  paneAudit?.addEventListener('click', async () => {
    activatePane('audit');
    await loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
  });
  paneLegacyReview?.addEventListener('click', () => {
    globalThis.location.href = '/admin/review';
  });
  paneManualRedac?.addEventListener('click', () => activatePane('developer-manual-redac'));
  paneManualUser?.addEventListener('click', () => activatePane('developer-manual-user'));
  redacOpenMap?.addEventListener('click', () => activatePane('developer-map'));
  redacOpenUser?.addEventListener('click', () => activatePane('developer-manual-user'));
  userOpenMap?.addEventListener('click', () => activatePane('developer-map'));
  userOpenRedac?.addEventListener('click', () => activatePane('developer-manual-redac'));
}

function normalizePaneTarget(target) {
  const value = typeof target === 'string' ? target : '';
  const allowed = new Set([
    'home',
    'alerts',
    'composer',
    'monitor',
    'errors',
    'read-model',
    'vendors',
    'city-pack',
    'audit',
    'developer-map',
    'developer-manual-redac',
    'developer-manual-user',
    'settings',
    'llm',
    'maintenance'
  ]);
  if (allowed.has(value)) return value;
  return 'home';
}

function activatePane(target, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const normalizedTarget = normalizePaneTarget(target);
  const navCore = resolveCoreSlice('navCore');
  let nextPane = resolveAllowedPaneForRole(state.role, normalizedTarget, 'home');
  let paneBlocked = normalizedTarget !== nextPane;
  let guardReason = opts.guardReason || 'PANE_FORBIDDEN';
  if (!ADMIN_NAV_ALL_ACCESSIBLE_V1 && !paneBlocked && normalizedTarget !== 'home' && opts.allowHiddenRollout !== true) {
    const paneEntries = collectNavItemsForCore().filter((entry) => entry.pane === normalizedTarget);
    if (paneEntries.length) {
      const rolloutVisible = paneEntries.some((entry) => {
        const groupEl = entry.element ? entry.element.closest('[data-nav-group]') : null;
        return isRolloutEnabledForGroup(groupEl, state.role);
      });
      if (!rolloutVisible) {
        paneBlocked = true;
        guardReason = 'ROLLOUT_DISABLED';
        nextPane = resolveAllowedPaneForRole(state.role, 'home', 'home');
      }
    }
  }
  const navItems = Array.from(document.querySelectorAll('.nav-item[data-pane-target]'));
  let activeButton = null;
  if (opts.clickedButton
      && opts.clickedButton.dataset
      && opts.clickedButton.dataset.paneTarget === nextPane
      && opts.clickedButton.getAttribute('data-nav-item-visible') !== 'false') {
    activeButton = opts.clickedButton;
  }
  if (!activeButton && ADMIN_NAV_ALL_ACCESSIBLE_V1) {
    const resolved = resolvePreferredNavEntry(state.role, nextPane);
    if (resolved && resolved.element) activeButton = resolved.element;
  }
  if (!activeButton && navCore && typeof navCore.resolveActiveNavItem === 'function') {
    const legacyResolved = navCore.resolveActiveNavItem(collectNavItemsForCore(), nextPane, state.role, {
      groupPolicy: resolveNavGroupVisibilityPolicy(),
      rolloutEnabled: ADMIN_NAV_ROLLOUT_V1,
      fallbackPane: nextPane
    });
    if (legacyResolved && legacyResolved.element) activeButton = legacyResolved.element;
  }
  if (!activeButton) {
    activeButton = navItems.find((element) => {
      return element.getAttribute('data-nav-item-visible') !== 'false'
        && element.dataset
        && element.dataset.paneTarget === nextPane;
    }) || null;
  }
  navItems.forEach((element) => {
    element.classList.toggle('is-active', Boolean(activeButton && activeButton === element));
  });
  document.querySelectorAll('.app-pane').forEach((pane) => {
    pane.classList.toggle('is-active', pane.dataset.pane === nextPane);
  });
  state.activePane = nextPane;
  if (!opts.skipHistory) {
    const mode = opts.historyMode || 'replace';
    updateHistoryWithPaneRole(nextPane, state.role, mode);
  }
  if (paneBlocked) renderGuardBanner({ error: guardReason, recommendedPane: nextPane });
  updatePageHeader(nextPane);
  expandPaneDetails(nextPane);
  if (opts.scrollTarget) {
    scrollToPaneAnchor(opts.scrollTarget);
  }
}

function activateInitialPane() {
  const currentUrl = new URL(globalThis.location.href);
  const pane = currentUrl.searchParams.get('pane');
  activatePane(pane || 'home', { historyMode: 'replace' });
}

function setupHistorySync() {
  if (!ADMIN_HISTORY_SYNC_ENABLED) return;
  globalThis.addEventListener('popstate', () => {
    const nextRole = resolveRoleFromPersistence(state.role || 'operator');
    setRole(nextRole, { syncHistory: false });
    const currentUrl = new URL(globalThis.location.href);
    const pane = currentUrl.searchParams.get('pane') || 'home';
    activatePane(pane, { skipHistory: true });
  });
}

const PANE_SHORTCUTS = Object.freeze({
  '0': 'home',
  a: 'alerts',
  '1': 'composer',
  '2': 'monitor',
  '3': 'errors',
  '4': 'read-model',
  '5': 'vendors',
  '6': 'city-pack',
  '7': 'audit',
  '8': 'settings',
  '9': 'maintenance'
});

function isTextInputTarget(target) {
  if (!target) return false;
  const name = String(target.tagName || '').toUpperCase();
  if (name === 'INPUT' || name === 'TEXTAREA' || name === 'SELECT') return true;
  return Boolean(target.isContentEditable);
}

function focusPaneDecisionCard(paneKey) {
  const decisionCard = document.getElementById(`${paneKey}-decision-card`);
  if (decisionCard && typeof decisionCard.scrollIntoView === 'function') {
    decisionCard.scrollIntoView({ block: 'start' });
  }
  const primary = decisionCard ? decisionCard.querySelector('button') : null;
  if (primary && typeof primary.focus === 'function') {
    primary.focus({ preventScroll: true });
  }
}

function setupPaneKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (!event || !event.altKey) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isTextInputTarget(event.target)) return;
    const key = String(event.key || '');
    const pane = PANE_SHORTCUTS[key];
    if (!pane) return;
    event.preventDefault();
    activatePane(pane, { historyMode: 'push' });
    focusPaneDecisionCard(pane);
  });
}

function newTraceId() {
  const traceCore = resolveCoreSlice('traceCore');
  if (traceCore && typeof traceCore.newTraceId === 'function') return traceCore.newTraceId();
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `trace-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function ensureTraceInput(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const traceCore = resolveCoreSlice('traceCore');
  if (!el.value) {
    el.value = traceCore && typeof traceCore.newTraceId === 'function'
      ? traceCore.newTraceId()
      : newTraceId();
  }
  return String(el.value || '').trim();
}

function buildHeaders(extra, traceId) {
  const trace = traceId || newTraceId();
  return Object.assign({}, extra || {}, OPS_ACTOR_HEADERS, { [TRACE_HEADER_NAME]: trace });
}

function formatDeltaPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const pct = Math.round(value * 1000) / 10;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
}

function formatDeltaNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value * 10) / 10}`;
}

function getHealthCounts(items) {
  const counts = { OK: 0, WARN: 0, DANGER: 0, UNKNOWN: 0 };
  (items || []).forEach((item) => {
    const health = item && item.notificationHealth ? item.notificationHealth : null;
    if (health === 'DANGER') counts.DANGER += 1;
    else if (health === 'WARN') counts.WARN += 1;
    else if (health === 'OK') counts.OK += 1;
    else counts.UNKNOWN += 1;
  });
  return counts;
}

function updateTopBar() {
  const summary = state.topbarStatus && typeof state.topbarStatus === 'object'
    ? state.topbarStatus
    : {};
  const topRegistered = document.getElementById('topbar-registered-count');
  const topScheduled = document.getElementById('topbar-scheduled-count');
  const topAlerts = document.getElementById('topbar-alerts-count');
  if (topRegistered) topRegistered.textContent = summary.registeredCountLabel || '-';
  if (topScheduled) topScheduled.textContent = summary.scheduledTodayCountLabel || '-';
  if (topAlerts) topAlerts.textContent = summary.openAlertsLabel || '-';

  const counts = getHealthCounts(state.monitorItems);
  const todo = counts.DANGER || 0;
  const topTodo = document.getElementById('top-todo');
  const topHealth = document.getElementById('top-health');
  if (topTodo) topTodo.textContent = String(todo);
  if (topHealth) {
    topHealth.textContent = `${statusLabel('DANGER')} ${counts.DANGER} / ${statusLabel('WARN')} ${counts.WARN} / ${statusLabel('OK')} ${counts.OK} / ${statusLabel('UNKNOWN')} ${counts.UNKNOWN}`;
  }

  const anomaly = document.getElementById('top-anomaly');
  if (anomaly) anomaly.textContent = state.topAnomaly || '-';

  const monitorCauses = document.getElementById('monitor-causes');
  if (monitorCauses) {
    monitorCauses.textContent = state.topCauses || '-';
    const tip = state.topCausesTip || '';
    if (tip) {
      monitorCauses.setAttribute('data-tip', tip);
      monitorCauses.setAttribute('tabindex', '0');
    }
  }
  const monitorAnomaly = document.getElementById('monitor-anomaly');
  if (monitorAnomaly) monitorAnomaly.textContent = state.topAnomaly || '-';
}

function normalizeDashboardWindow(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DASHBOARD_DEFAULT_WINDOW;
  const normalized = Math.floor(num);
  if (!DASHBOARD_ALLOWED_WINDOWS.includes(normalized)) return DASHBOARD_DEFAULT_WINDOW;
  return normalized;
}

function getDashboardWindowMonths(metricKey) {
  const metricSelect = document.getElementById(`dashboard-window-${metricKey}`);
  if (metricSelect) return normalizeDashboardWindow(metricSelect.value);
  const defaultSelect = document.getElementById('dashboard-window-months');
  if (defaultSelect) return normalizeDashboardWindow(defaultSelect.value);
  return DASHBOARD_DEFAULT_WINDOW;
}

function resolveDashboardPayload(windowMonths) {
  const key = String(normalizeDashboardWindow(windowMonths));
  return state.dashboardCacheByMonths && state.dashboardCacheByMonths[key]
    ? state.dashboardCacheByMonths[key]
    : null;
}

function resolveDashboardMetric(payload, metricKey) {
  const config = DASHBOARD_CARD_CONFIG[metricKey];
  if (!config || !payload || !payload.kpis || typeof payload.kpis !== 'object') return null;
  for (const key of config.kpiKeys) {
    if (payload.kpis[key]) return payload.kpis[key];
  }
  return null;
}

function formatDashboardSeriesValue(value, unit) {
  if (!Number.isFinite(Number(value))) return '-';
  if (unit === 'percent') return `${Math.round(Number(value) * 10) / 10}%`;
  return `${Math.round(Number(value) * 10) / 10}`;
}

function parseDashboardNumericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[^0-9.+-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function renderDashboardLineChartSvg(metricKey, series, unit) {
  const chartEl = document.getElementById(`dashboard-kpi-${metricKey}-chart`);
  if (!chartEl) return;
  chartEl.innerHTML = '';
  const numeric = Array.isArray(series)
    ? series.map((value) => (Number.isFinite(Number(value)) ? Number(value) : null))
    : [];
  const values = numeric.filter((value) => value !== null);
  if (!values.length) {
    chartEl.textContent = t('ui.value.dashboard.notAvailable', 'NOT AVAILABLE');
    chartEl.classList.add('is-empty');
    return;
  }
  chartEl.classList.remove('is-empty');
  const width = 280;
  const height = 96;
  const padding = 12;
  const chartCore = resolveCoreSlice('chartCore');
  let chart = chartCore && typeof chartCore.buildLinePath === 'function'
    ? chartCore.buildLinePath(values, { width, height, padding })
    : null;
  if (!chart || !chart.path || !Array.isArray(chart.points) || !chart.points.length) {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = Math.max(max - min, 1);
    const stepX = numeric.length > 1 ? (width - padding * 2) / (numeric.length - 1) : 0;
    const points = numeric.map((value, index) => {
      const safeValue = value === null ? min : value;
      const x = padding + index * stepX;
      const y = height - padding - ((safeValue - min) / span) * (height - padding * 2);
      return { x, y };
    });
    chart = {
      width,
      height,
      padding,
      max,
      min,
      points,
      path: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
    };
  }
  const lastPoint = chart.points[chart.points.length - 1];
  const svg = `
    <svg viewBox="0 0 ${chart.width} ${chart.height}" role="img" aria-label="${metricKey} chart" preserveAspectRatio="none">
      <line x1="${chart.padding}" y1="${chart.height - chart.padding}" x2="${chart.width - chart.padding}" y2="${chart.height - chart.padding}" class="dashboard-chart-axis"></line>
      <path d="${chart.path}" class="dashboard-chart-line"></path>
      <circle cx="${lastPoint.x.toFixed(2)}" cy="${lastPoint.y.toFixed(2)}" r="3" class="dashboard-chart-point"></circle>
      <text x="${chart.width - chart.padding}" y="${chart.padding + 8}" text-anchor="end" class="dashboard-chart-label">${formatDashboardSeriesValue(chart.max, unit)}</text>
      <text x="${chart.width - chart.padding}" y="${chart.height - 2}" text-anchor="end" class="dashboard-chart-label">${formatDashboardSeriesValue(chart.min, unit)}</text>
    </svg>
  `;
  chartEl.insertAdjacentHTML('beforeend', svg);
}

function renderDashboardDelta(metricKey, currentValue, previousValue, unit) {
  const deltaEl = document.getElementById(`dashboard-kpi-${metricKey}-delta`);
  if (!deltaEl) return;
  const current = Number(currentValue);
  const previous = Number(previousValue);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    deltaEl.textContent = '-';
    deltaEl.classList.remove('is-up', 'is-down', 'is-flat');
    return;
  }
  const delta = current - previous;
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const abs = Math.abs(delta);
  const text = unit === 'percent'
    ? `${arrow} ${delta >= 0 ? '+' : '-'}${Math.round(abs * 10) / 10}pt`
    : `${arrow} ${delta >= 0 ? '+' : '-'}${Math.round(abs * 10) / 10}`;
  deltaEl.textContent = text;
  deltaEl.classList.remove('is-up', 'is-down', 'is-flat');
  if (delta > 0) deltaEl.classList.add('is-up');
  else if (delta < 0) deltaEl.classList.add('is-down');
  else deltaEl.classList.add('is-flat');
}

function renderDashboardMetricCard(metricKey, payload) {
  const currentEl = document.getElementById(`dashboard-kpi-${metricKey}-current`);
  const previousEl = document.getElementById(`dashboard-kpi-${metricKey}-previous`);
  const noteEl = document.getElementById(`dashboard-kpi-${metricKey}-note`);
  const config = DASHBOARD_CARD_CONFIG[metricKey];
  if (!currentEl || !previousEl || !noteEl || !config) return;

  const metric = resolveDashboardMetric(payload, metricKey);
  if (!metric || metric.available !== true) {
    currentEl.textContent = t('ui.value.dashboard.notAvailable', 'NOT AVAILABLE');
    previousEl.textContent = '-';
    noteEl.textContent = t('ui.desc.dashboard.notAvailable', '現行データから算出できません');
    renderDashboardLineChartSvg(metricKey, [], config.unit);
    renderDashboardDelta(metricKey, NaN, NaN, config.unit);
    return;
  }

  const series = Array.isArray(metric.series) ? metric.series.filter((value) => Number.isFinite(Number(value))).map(Number) : [];
  const currentSeriesValue = series.length ? series[series.length - 1] : null;
  const previousSeriesValue = series.length > 1 ? series[series.length - 2] : currentSeriesValue;
  const displayCurrent = typeof metric.valueLabel === 'string' && metric.valueLabel.trim()
    ? metric.valueLabel
    : formatDashboardSeriesValue(currentSeriesValue, config.unit);

  currentEl.textContent = displayCurrent || '-';
  previousEl.textContent = formatDashboardSeriesValue(previousSeriesValue, config.unit);
  noteEl.textContent = metric.note || '-';
  renderDashboardLineChartSvg(metricKey, series, config.unit);

  const currentNumeric = parseDashboardNumericValue(displayCurrent);
  if (currentNumeric !== null && currentSeriesValue !== null && config.unit === 'count') {
    renderDashboardDelta(metricKey, currentSeriesValue, previousSeriesValue, config.unit);
  } else {
    renderDashboardDelta(metricKey, currentSeriesValue, previousSeriesValue, config.unit);
  }
}

function resolveTopbarStatusFromState() {
  const registrationPayload = resolveDashboardPayload(getDashboardWindowMonths('registrations'));
  const registrationMetric = resolveDashboardMetric(registrationPayload, 'registrations');
  const registeredCountLabel = registrationMetric && registrationMetric.available === true
    ? (registrationMetric.valueLabel || formatDashboardSeriesValue(
      Array.isArray(registrationMetric.series) && registrationMetric.series.length
        ? registrationMetric.series[registrationMetric.series.length - 1]
        : null,
      'count'
    ))
    : '-';
  const totals = state.alertsSummary && state.alertsSummary.totals ? state.alertsSummary.totals : {};
  const scheduledTodayCount = Number.isFinite(Number(totals.scheduledTodayCount)) ? Number(totals.scheduledTodayCount) : null;
  const openAlerts = Number.isFinite(Number(totals.openAlerts)) ? Number(totals.openAlerts) : null;
  state.topbarStatus = {
    registeredCountLabel: registeredCountLabel || '-',
    scheduledTodayCountLabel: scheduledTodayCount === null ? '-' : String(scheduledTodayCount),
    openAlertsLabel: openAlerts === null ? '-' : String(openAlerts)
  };
}

async function loadTopbarStatus() {
  resolveTopbarStatusFromState();
  updateTopBar();
}

function renderDashboardKpis() {
  Object.keys(DASHBOARD_CARD_CONFIG).forEach((metricKey) => {
    const windowMonths = getDashboardWindowMonths(metricKey);
    const payload = resolveDashboardPayload(windowMonths);
    renderDashboardMetricCard(metricKey, payload);
  });
}

function renderDashboardJourneyKpi() {
  const payload = state.dashboardJourneyKpi && typeof state.dashboardJourneyKpi === 'object'
    ? state.dashboardJourneyKpi
    : null;
  const retentionEl = document.getElementById('dashboard-journey-retention');
  const phaseEl = document.getElementById('dashboard-journey-phase-completion');
  const taskCompletionEl = document.getElementById('dashboard-journey-task-completion');
  const dependencyBlockEl = document.getElementById('dashboard-journey-dependency-block');
  const nextActionEl = document.getElementById('dashboard-journey-next-action-rate');
  const conversionEl = document.getElementById('dashboard-journey-pro-conversion');
  const churnEl = document.getElementById('dashboard-journey-churn');
  const rawEl = document.getElementById('dashboard-journey-kpi-result');

  if (!payload) {
    if (retentionEl) retentionEl.textContent = '-';
    if (phaseEl) phaseEl.textContent = '-';
    if (taskCompletionEl) taskCompletionEl.textContent = '-';
    if (dependencyBlockEl) dependencyBlockEl.textContent = '-';
    if (nextActionEl) nextActionEl.textContent = '-';
    if (conversionEl) conversionEl.textContent = '-';
    if (churnEl) churnEl.textContent = '-';
    if (rawEl) rawEl.textContent = '-';
    return;
  }

  const retention = payload.retention && typeof payload.retention === 'object' ? payload.retention : {};
  if (retentionEl) {
    retentionEl.textContent = [
      `7:${formatRatioPercent(retention.d7)}`,
      `30:${formatRatioPercent(retention.d30)}`,
      `60:${formatRatioPercent(retention.d60)}`,
      `90:${formatRatioPercent(retention.d90)}`
    ].join(' / ');
  }
  if (phaseEl) phaseEl.textContent = formatRatioPercent(payload.phaseCompletionRate);
  if (taskCompletionEl) taskCompletionEl.textContent = formatRatioPercent(payload.taskCompletionRate);
  if (dependencyBlockEl) dependencyBlockEl.textContent = formatRatioPercent(payload.dependencyBlockRate);
  if (nextActionEl) nextActionEl.textContent = formatRatioPercent(payload.nextActionExecutionRate);
  if (conversionEl) conversionEl.textContent = formatRatioPercent(payload.proConversionRate);

  const churn = payload.churnReasonRatio && typeof payload.churnReasonRatio === 'object'
    ? payload.churnReasonRatio
    : {};
  if (churnEl) {
    churnEl.textContent = [
      `blocked:${formatRatioPercent(churn.blocked)}`,
      `dependency_graph_blocked:${formatRatioPercent(churn.dependency_graph_blocked)}`,
      `value_gap:${formatRatioPercent(churn.value_gap)}`,
      `cost:${formatRatioPercent(churn.cost)}`,
      `status_change:${formatRatioPercent(churn.status_change)}`
    ].join(' / ');
  }
  if (rawEl) rawEl.textContent = JSON.stringify(payload, null, 2);
}

async function loadDashboardJourneyKpi(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const traceId = ensureTraceInput('traceId') || newTraceId();
  try {
    const res = await fetch('/api/admin/os/journey-kpi', { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'failed');
    state.dashboardJourneyKpi = data.kpi || null;
    renderDashboardJourneyKpi();
    if (notify) showToast('Journey KPIを更新しました', 'ok');
  } catch (_err) {
    state.dashboardJourneyKpi = null;
    renderDashboardJourneyKpi();
    if (notify) showToast('Journey KPIの取得に失敗しました', 'danger');
  }
}

async function fetchDashboardKpiByMonths(windowMonths, traceId) {
  const key = String(normalizeDashboardWindow(windowMonths));
  if (state.dashboardCacheByMonths[key]) return state.dashboardCacheByMonths[key];
  const res = await fetch(
    `/api/admin/os/dashboard/kpi?windowMonths=${encodeURIComponent(key)}&fallbackMode=block`,
    { headers: buildHeaders({}, traceId) }
  );
  const data = await readJsonResponse(res);
  if (!data || data.ok !== true) throw new Error((data && data.error) || 'kpi load failed');
  state.dashboardCacheByMonths[key] = data;
  return data;
}

function renderAlertsSummary(payload) {
  const body = document.getElementById('alerts-rows');
  const note = document.getElementById('alerts-summary-note');
  if (!body) return;
  body.innerHTML = '';
  const rawRows = payload && Array.isArray(payload.items) ? payload.items : [];
  const alertsCore = resolveCoreSlice('alertsCore');
  const rows = alertsCore && typeof alertsCore.extractActionable === 'function'
    ? alertsCore.extractActionable(rawRows, { operableOnly: true, allowZero: false })
    : rawRows;
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    body.appendChild(tr);
  } else {
    rows.forEach((item) => {
      const tr = document.createElement('tr');
      if (item && item.severity) tr.setAttribute('data-alert-severity', String(item.severity));
      const typeTd = document.createElement('td');
      typeTd.textContent = item && item.typeLabel ? item.typeLabel : '-';
      tr.appendChild(typeTd);
      const countTd = document.createElement('td');
      countTd.className = 'cell-num';
      countTd.textContent = Number.isFinite(Number(item && item.count)) ? String(item.count) : '-';
      tr.appendChild(countTd);
      const impactTd = document.createElement('td');
      impactTd.textContent = item && item.impact ? item.impact : '-';
      tr.appendChild(impactTd);
      const actionTd = document.createElement('td');
      if (item && item.actionPane) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary-btn';
        button.textContent = item.actionLabel || t('ui.label.alerts.action.open', '開く');
        button.addEventListener('click', () => activatePane(String(item.actionPane)));
        actionTd.appendChild(button);
      } else {
        actionTd.textContent = '-';
      }
      tr.appendChild(actionTd);
      body.appendChild(tr);
    });
  }
  const totals = payload && payload.totals ? payload.totals : {};
  if (note) {
    const open = Number.isFinite(Number(totals.openAlerts)) ? Number(totals.openAlerts) : 0;
    const scheduled = Number.isFinite(Number(totals.scheduledTodayCount)) ? Number(totals.scheduledTodayCount) : 0;
    note.textContent = `${t('ui.label.alerts.summary', '要対応合計')}: ${open} / ${t('ui.label.top.todayScheduled', '本日配信予定件数')}: ${scheduled}`;
  }
}

async function loadAlertsSummary(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const traceId = ensureTraceInput('errors-trace') || newTraceId();
  try {
    const res = await fetch('/api/admin/os/alerts/summary?limit=200', { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'alerts load failed');
    const alertsCore = resolveCoreSlice('alertsCore');
    const actionable = alertsCore && typeof alertsCore.extractActionable === 'function'
      ? alertsCore.extractActionable(Array.isArray(data.items) ? data.items : [], { operableOnly: true, allowZero: false })
      : (Array.isArray(data.items) ? data.items : []);
    state.alertsSummary = Object.assign({}, data, { items: actionable });
    renderAlertsSummary(state.alertsSummary);
    clearGuardBanner();
    await loadTopbarStatus();
    if (notify) showToast(t('ui.toast.alerts.reloadOk', '要対応一覧を更新しました'), 'ok');
  } catch (_err) {
    state.alertsSummary = { totals: { openAlerts: null, scheduledTodayCount: null }, items: [] };
    renderAlertsSummary(state.alertsSummary);
    renderDataLoadFailureGuard('alerts_summary_failed', _err);
    await loadTopbarStatus();
    if (notify) showToast(t('ui.toast.alerts.reloadFail', '要対応一覧の取得に失敗しました'), 'danger');
  }
}

async function loadDashboardKpis(options) {
  const notify = !options || options.notify !== false;
  const traceId = ensureTraceInput('traceId') || newTraceId();
  const monthsNeeded = Array.from(new Set(Object.keys(DASHBOARD_CARD_CONFIG).map((metricKey) => getDashboardWindowMonths(metricKey))));
  let failed = false;
  for (const months of monthsNeeded) {
    try {
      await fetchDashboardKpiByMonths(months, traceId);
    } catch (_err) {
      failed = true;
      delete state.dashboardCacheByMonths[String(months)];
    }
  }
  const defaultWindow = normalizeDashboardWindow(document.getElementById('dashboard-window-months')?.value || DASHBOARD_DEFAULT_WINDOW);
  state.dashboardKpis = resolveDashboardPayload(defaultWindow)?.kpis || null;
  renderDashboardKpis();
  await loadDashboardJourneyKpi({ notify: false });
  if (failed) {
    renderDataLoadFailureGuard('dashboard_kpi_failed', new Error('dashboard kpi failed'));
  }
  persistListStateToStorage('dashboardWindow', readDashboardWindowState());
  await loadTopbarStatus();
  if (notify) {
    showToast(
      failed ? t('ui.toast.dashboard.reloadFail', 'ダッシュボード指標の取得に失敗しました') : t('ui.toast.dashboard.reloadOk', 'ダッシュボード指標を更新しました'),
      failed ? 'danger' : 'ok'
    );
  }
}

function computeTopCauses(items) {
  const counts = new Map();
  (items || []).forEach((item) => {
    const reason = item && item.lastExecuteReason ? String(item.lastExecuteReason) : null;
    if (!reason) return;
    counts.set(reason, (counts.get(reason) || 0) + 1);
  });
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!sorted.length) return { text: '-', tip: '' };
  const text = sorted.map(([reason, count]) => `${reasonLabel(reason)}:${count}`).join(' / ');
  const tip = sorted.map(([reason, count]) => `${buildTip('ui.help.reasonCode', reason)} (${count})`).join(' / ');
  return { text, tip };
}

function computeTopAnomaly(items) {
  let best = null;
  (items || []).forEach((item) => {
    const delta = item && item.weekOverWeek && item.weekOverWeek.delta ? item.weekOverWeek.delta : null;
    if (!delta) return;
    const candidates = [
      { key: 'ctr', value: delta.ctr, label: 'CTR' },
      { key: 'click', value: delta.click, label: 'クリック' },
      { key: 'read', value: delta.read, label: '既読' },
      { key: 'sent', value: delta.sent, label: '送信' }
    ];
    candidates.forEach((c) => {
      if (typeof c.value !== 'number') return;
      if (!best || c.value < best.value) {
        best = { label: c.label, value: c.value };
      }
    });
  });
  if (!best) return '-';
  const formatted = best.label === 'CTR' ? formatDeltaPercent(best.value) : formatDeltaNumber(best.value);
  if (!formatted) return '-';
  const label = t(`ui.metric.delta.${best.key}`, best.label);
  return `${label} ${formatted}`;
}

function resolveComposerDecisionVm() {
  const tone = state.composerTone || 'unknown';
  const decisionState = tone === 'danger'
    ? 'STOP'
    : tone === 'warn'
      ? 'ATTENTION'
      : 'READY';
  const reasons = buildDecisionReasons(decisionState === 'READY' ? 0 : 1, state.lastRisk || state.currentComposerStatus || t('ui.desc.composer.riskDefault', 'Plan未実行'));
  return {
    state: decisionState,
    reason1: reasons.reason1,
    reason2: reasons.reason2,
    updatedAt: state.composerUpdatedAt || resolvePaneUpdatedAt('composer')
  };
}

function resolveMonitorDecisionVm() {
  const counts = getHealthCounts(state.monitorItems);
  const decisionState = counts.DANGER > 0 ? 'STOP' : counts.WARN > 0 ? 'ATTENTION' : 'READY';
  const reasons = buildDecisionReasons(counts.DANGER || 0, state.topCauses || '-');
  return {
    state: decisionState,
    reason1: reasons.reason1,
    reason2: reasons.reason2,
    updatedAt: resolvePaneUpdatedAt('monitor')
  };
}

function resolveErrorsDecisionVm() {
  const summary = state.errorsSummary && typeof state.errorsSummary === 'object' ? state.errorsSummary : null;
  const warnLinks = Array.isArray(summary && summary.warnLinks) ? summary.warnLinks.length : 0;
  const retryQueue = Array.isArray(summary && summary.retryQueuePending) ? summary.retryQueuePending.length : 0;
  const decisionState = warnLinks > 0 ? 'STOP' : retryQueue > 0 ? 'ATTENTION' : 'READY';
  const primary = warnLinks > 0
    ? t('ui.label.errors.warnLinks', '危険リンク一覧')
    : retryQueue > 0
      ? t('ui.label.errors.retryQueue', '再送待ち一覧')
      : t('ui.status.ok', '問題なし');
  const reasons = buildDecisionReasons(warnLinks + retryQueue, primary);
  return {
    state: decisionState,
    reason1: reasons.reason1,
    reason2: reasons.reason2,
    updatedAt: resolvePaneUpdatedAt('errors')
  };
}

function resolveReadModelDecisionVm() {
  const counts = getHealthCounts(state.readModelItems);
  const decisionState = counts.DANGER > 0 ? 'STOP' : counts.WARN > 0 ? 'ATTENTION' : 'READY';
  const reasons = buildDecisionReasons(counts.DANGER || 0, counts.WARN > 0 ? statusLabel('WARN') : statusLabel('OK'));
  return {
    state: decisionState,
    reason1: reasons.reason1,
    reason2: reasons.reason2,
    updatedAt: resolvePaneUpdatedAt('read-model')
  };
}

function resolveCityPackDecisionVm() {
  const inbox = Array.isArray(state.cityPackInboxItems) ? state.cityPackInboxItems : [];
  const needsReview = inbox.filter((item) => String(item && item.status) === 'needs_review').length;
  const blocked = inbox.filter((item) => {
    const status = String(item && item.status);
    return status === 'dead' || status === 'blocked';
  }).length;
  const decisionState = blocked > 0 ? 'STOP' : needsReview > 0 ? 'ATTENTION' : 'READY';
  const primary = blocked > 0
    ? t('ui.label.cityPack.col.result', 'result')
    : needsReview > 0
      ? t('ui.value.cityPack.status.needsReview', '要確認')
      : t('ui.status.ok', '問題なし');
  const reasons = buildDecisionReasons(blocked + needsReview, primary);
  return {
    state: decisionState,
    reason1: reasons.reason1,
    reason2: reasons.reason2,
    updatedAt: resolvePaneUpdatedAt('city-pack')
  };
}

function resolveVendorsDecisionVm() {
  const items = Array.isArray(state.vendorItems) ? state.vendorItems : [];
  const warnCount = items.filter((item) => String(item && item.healthState) === 'WARN').length;
  const staleCount = items.filter((item) => !item || !item.checkedAt).length;
  const decisionState = warnCount >= 3 ? 'STOP' : (warnCount > 0 || staleCount > 0) ? 'ATTENTION' : 'READY';
  const primary = warnCount > 0
    ? t('ui.status.warn', '注意')
    : staleCount > 0
      ? t('ui.label.vendors.state.unknown', '未確認')
      : t('ui.status.ok', '問題なし');
  const reasons = buildDecisionReasons(warnCount + staleCount, primary);
  return { state: decisionState, reason1: reasons.reason1, reason2: reasons.reason2, updatedAt: resolvePaneUpdatedAt('vendors') };
}

function resolveHomeDecisionVm() {
  const counts = getHealthCounts(state.monitorItems);
  const decisionState = counts.DANGER > 0 ? 'STOP' : counts.WARN > 0 ? 'ATTENTION' : 'READY';
  const reasons = buildDecisionReasons(counts.DANGER || 0, state.topCauses || '-');
  return {
    state: decisionState,
    reason1: reasons.reason1,
    reason2: reasons.reason2,
    updatedAt: resolvePaneUpdatedAt('monitor')
  };
}

function renderAllDecisionCards() {
  renderDecisionCard('home', resolveHomeDecisionVm());
  renderDecisionCard('composer', resolveComposerDecisionVm());
  renderDecisionCard('monitor', resolveMonitorDecisionVm());
  renderDecisionCard('errors', resolveErrorsDecisionVm());
  renderDecisionCard('read-model', resolveReadModelDecisionVm());
  renderDecisionCard('city-pack', resolveCityPackDecisionVm());
  renderDecisionCard('vendors', resolveVendorsDecisionVm());
}

function renderSafeNextStep(el, message) {
  if (!el) return;
  el.textContent = message || t('ui.desc.common.safeStepFallback', '次にやる安全な1手: 更新して最新状態を確認');
}

function renderMonitorRows(items) {
  const tbody = document.getElementById('monitor-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    if (item.notificationHealth === 'DANGER') tr.classList.add('row-health-danger');
    if (item.notificationHealth === 'WARN') tr.classList.add('row-health-warn');
    if (item.notificationHealth === 'OK') tr.classList.add('row-health-ok');
    const cols = [
      item.title || '-',
      withTip(scenarioLabel(item.scenarioKey), buildTip('ui.help.scenarioCode', item.scenarioKey)),
      withTip(stepLabel(item.stepKey), buildTip('ui.help.stepCode', item.stepKey)),
      item.targetCount != null ? String(item.targetCount) : '-',
      withTip(reasonLabel(item.lastExecuteReason), buildTip('ui.help.reasonCode', item.lastExecuteReason)),
      item.ctr != null ? String(item.ctr) : '-',
      withTip(statusLabel(item.notificationHealth), buildTip('ui.help.healthCode', item.notificationHealth))
    ];
    cols.forEach((value, idx) => {
      const td = document.createElement('td');
      if (idx === 3 || idx === 5) td.classList.add('cell-num');
      if (value instanceof Node) td.appendChild(value);
      else td.textContent = value;
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((row) => row.classList.remove('row-active'));
      tr.classList.add('row-active');
      const detail = document.getElementById('monitor-detail');
      const raw = document.getElementById('monitor-raw');
      if (detail) {
        const parts = [
          `${t('ui.label.monitor.col.title', 'タイトル')}: ${item.title || '-'}`,
          `${t('ui.label.monitor.col.scenario', 'シナリオ')}: ${scenarioLabel(item.scenarioKey)}`,
          `${t('ui.label.monitor.col.step', 'ステップ')}: ${stepLabel(item.stepKey)}`,
          `${t('ui.label.monitor.col.target', '対象数')}: ${item.targetCount != null ? item.targetCount : '-'}`,
          `${t('ui.label.monitor.col.last', '最終結果')}: ${reasonLabel(item.lastExecuteReason)}`,
          `${t('ui.label.monitor.col.ctr', '反応率')}: ${item.ctr != null ? item.ctr : '-'}`,
          `${t('ui.label.monitor.col.health', '健康度')}: ${statusLabel(item.notificationHealth)}`
        ];
        detail.textContent = parts.join('\n');
      }
      if (raw) raw.textContent = JSON.stringify(item, null, 2);
    });
    tbody.appendChild(tr);
  });
}

function renderReadModelRows(items) {
  const tbody = document.getElementById('read-model-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    if (item.notificationHealth === 'DANGER') tr.classList.add('row-health-danger');
    if (item.notificationHealth === 'WARN') tr.classList.add('row-health-warn');
    if (item.notificationHealth === 'OK') tr.classList.add('row-health-ok');
    const cols = [
      item.title || '-',
      withTip(scenarioLabel(item.scenarioKey), buildTip('ui.help.scenarioCode', item.scenarioKey)),
      withTip(stepLabel(item.stepKey), buildTip('ui.help.stepCode', item.stepKey)),
      item.targetCount != null ? String(item.targetCount) : '-',
      withTip(reasonLabel(item.lastExecuteReason), buildTip('ui.help.reasonCode', item.lastExecuteReason)),
      item.ctr != null ? String(item.ctr) : '-',
      withTip(statusLabel(item.notificationHealth), buildTip('ui.help.healthCode', item.notificationHealth))
    ];
    cols.forEach((value, idx) => {
      const td = document.createElement('td');
      if (idx === 3 || idx === 5) td.classList.add('cell-num');
      if (value instanceof Node) td.appendChild(value);
      else td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatDateLabel(value) {
  const ms = toMillis(value);
  if (!ms) return '-';
  return new Date(ms).toISOString();
}

function formatPercent(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return '-';
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}

function formatRatioPercent(value) {
  if (!Number.isFinite(value)) return '-';
  const normalized = value > 1 ? value / 100 : value;
  if (!Number.isFinite(normalized)) return '-';
  return `${Math.round(normalized * 1000) / 10}%`;
}

function parseDateInputMs(value, endOfDay) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay) parsed.setUTCHours(23, 59, 59, 999);
  return parsed.getTime();
}

function resolveComposerSavedTargetCount(item) {
  if (item && item.target && Number.isFinite(Number(item.target.limit))) return Number(item.target.limit);
  if (Number.isFinite(Number(item && item.targetCount))) return Number(item.targetCount);
  return null;
}

function resolveComposerSavedCtr(item) {
  if (Number.isFinite(Number(item && item.ctr))) {
    const numeric = Number(item.ctr);
    return numeric > 1 ? numeric / 100 : numeric;
  }
  const sent = Number(item && item.reactionSummary && item.reactionSummary.sent);
  const clicked = Number(item && item.reactionSummary && item.reactionSummary.clicked);
  if (!Number.isFinite(sent) || !Number.isFinite(clicked) || sent <= 0) return null;
  return clicked / sent;
}

function resolveComposerSavedSortValue(item, key) {
  if (key === 'status') return composerStatusLabel(item && item.status);
  if (key === 'notificationCategory') return composerCategoryLabel(item && item.notificationCategory);
  if (key === 'scenarioKey') return scenarioLabel(item && item.scenarioKey);
  if (key === 'stepKey') return stepLabel(item && item.stepKey);
  if (key === 'targetCount') return resolveComposerSavedTargetCount(item);
  if (key === 'ctr') return resolveComposerSavedCtr(item);
  if (key === 'createdAt') return item && item.createdAt;
  if (key === 'title') return item && item.title;
  return item ? item[key] : null;
}

function sortComposerSavedItems(items) {
  const list = Array.isArray(items) ? items.slice() : [];
  const key = state.composerSavedSortKey || 'createdAt';
  const valueType = COMPOSER_SAVED_SORT_TYPES[key] || 'string';
  const direction = state.composerSavedSortDir === 'asc' ? 'asc' : 'desc';
  const sortCore = resolveCoreSlice('sortCore');
  if (sortCore && typeof sortCore.sortRows === 'function' && typeof sortCore.compareValues === 'function') {
    return sortCore.sortRows(list, {
      key,
      dir: direction,
      typeMap: COMPOSER_SAVED_SORT_TYPES,
      valueGetter: (row, field) => resolveComposerSavedSortValue(row, field),
      tieBreaker: (a, b) => sortCore.compareValues(a && a.id, b && b.id, 'string', 'asc')
    });
  }
  return list.sort((a, b) => {
    const compared = compareSortValue(
      resolveComposerSavedSortValue(a, key),
      resolveComposerSavedSortValue(b, key),
      valueType,
      direction
    );
    if (compared !== 0) return compared;
    return compareSortValue(a && a.id, b && b.id, 'string', 'asc');
  });
}

function normalizeUserCategory(scenarioKey) {
  const key = typeof scenarioKey === 'string' ? scenarioKey.trim().toUpperCase() : '';
  return USER_CATEGORY_LABELS[key] ? key : '';
}

function userCategoryLabel(scenarioKey) {
  const key = normalizeUserCategory(scenarioKey);
  if (!key) return '-';
  return resolveDomainLabel('scenario', key, USER_CATEGORY_LABELS[key] || '-');
}

function resolveUserStatus(stepKey) {
  const step = typeof stepKey === 'string' ? stepKey.trim().toLowerCase() : '';
  if (step === '3mo' || step === '1mo' || step === 'week') return '赴任前';
  if (step === 'after1w') return '着任中';
  return '';
}

function normalizeBillingPlan(value) {
  return String(value || '').trim().toLowerCase() === 'pro' ? 'pro' : 'free';
}

function planLabel(value) {
  const plan = normalizeBillingPlan(value);
  return plan === 'pro' ? 'Pro' : 'Free';
}

function normalizeSubscriptionStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unknown'].includes(status)) {
    return status;
  }
  return 'unknown';
}

function subscriptionStatusLabel(value) {
  const status = normalizeSubscriptionStatus(value);
  const labels = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    unknown: 'unknown'
  };
  return labels[status] || 'unknown';
}

function normalizeHouseholdType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['single', 'couple', 'accompany1', 'accompany2'].includes(normalized)) return normalized;
  return '';
}

function householdTypeLabel(value) {
  const type = normalizeHouseholdType(value);
  if (!type) return '-';
  const labels = {
    single: 'single',
    couple: 'couple',
    accompany1: 'accompany1',
    accompany2: 'accompany2'
  };
  return labels[type] || type;
}

function normalizeJourneyStage(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return normalized;
}

function journeyStageLabel(value) {
  const stage = normalizeJourneyStage(value);
  return stage || '-';
}

function resolveUserReactionRate(item) {
  if (Number.isFinite(Number(item && item.reactionRate))) {
    const numeric = Number(item.reactionRate);
    return numeric > 1 ? numeric / 100 : numeric;
  }
  const deliveryCount = Number(item && item.deliveryCount);
  const clickCount = Number(item && item.clickCount);
  if (!Number.isFinite(deliveryCount) || !Number.isFinite(clickCount) || deliveryCount <= 0) return null;
  return clickCount / deliveryCount;
}

function formatUserReactionRate(item) {
  return formatRatioPercent(resolveUserReactionRate(item));
}

function resolveUsersSortValue(item, key) {
  if (key === 'category') return item && item.categoryLabel;
  if (key === 'status') return item && item.statusLabel;
  if (key === 'householdType') return item && item.householdType;
  if (key === 'journeyStage') return item && item.journeyStage;
  if (key === 'plan') return item && item.plan;
  if (key === 'subscriptionStatus') return item && item.subscriptionStatus;
  if (key === 'billingIntegrity') return item && item.billingIntegrityState;
  if (key === 'reactionRate') return resolveUserReactionRate(item);
  if (key === 'updatedAt') return item && item.updatedAt;
  if (key === 'currentPeriodEnd') return item && item.currentPeriodEnd;
  if (key === 'nextTodoDueAt') return item && item.nextTodoDueAt;
  if (key === 'todoOpenCount') return item && item.todoOpenCount;
  if (key === 'todoOverdueCount') return item && item.todoOverdueCount;
  if (key === 'llmUsage') return item && item.llmUsage;
  if (key === 'llmUsageToday') return item && item.llmUsageToday;
  if (key === 'todoProgressRate') return item && item.todoProgressRate;
  if (key === 'tokensToday') return item && item.llmTokenUsedToday;
  if (key === 'blockedRate') return item && item.llmBlockedRate;
  if (key === 'createdAt') return item && item.createdAt;
  return item ? item[key] : null;
}

function sortUsersSummaryItems(items) {
  const list = Array.isArray(items) ? items.slice() : [];
  const key = state.usersSummarySortKey || 'createdAt';
  const valueType = USERS_SUMMARY_SORT_TYPES[key] || 'string';
  const direction = state.usersSummarySortDir === 'asc' ? 'asc' : 'desc';
  const sortCore = resolveCoreSlice('sortCore');
  if (sortCore && typeof sortCore.sortRows === 'function' && typeof sortCore.compareValues === 'function') {
    return sortCore.sortRows(list, {
      key,
      dir: direction,
      typeMap: USERS_SUMMARY_SORT_TYPES,
      valueGetter: (row, field) => resolveUsersSortValue(row, field),
      tieBreaker: (a, b) => sortCore.compareValues(a && a.lineUserId, b && b.lineUserId, 'string', 'asc')
    });
  }
  return list.sort((a, b) => {
    const compared = compareSortValue(
      resolveUsersSortValue(a, key),
      resolveUsersSortValue(b, key),
      valueType,
      direction
    );
    if (compared !== 0) return compared;
    return compareSortValue(a && a.lineUserId, b && b.lineUserId, 'string', 'asc');
  });
}

function toSortMillis(value) {
  const sortCore = resolveCoreSlice('sortCore');
  if (sortCore && typeof sortCore.toSortMillis === 'function') {
    return sortCore.toSortMillis(value);
  }
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return null;
}

function isSortUnset(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim().length === 0) return true;
  return false;
}

function compareSortValue(baseA, baseB, valueType, direction) {
  const sortCore = resolveCoreSlice('sortCore');
  if (sortCore && typeof sortCore.compareValues === 'function') {
    return sortCore.compareValues(baseA, baseB, valueType, direction);
  }
  const dir = direction === 'asc' ? 1 : -1;
  const aUnset = isSortUnset(baseA);
  const bUnset = isSortUnset(baseB);
  if (aUnset && bUnset) return 0;
  if (aUnset) return 1;
  if (bUnset) return -1;

  if (valueType === 'date') {
    const aMs = toSortMillis(baseA);
    const bMs = toSortMillis(baseB);
    const aMsUnset = !Number.isFinite(aMs);
    const bMsUnset = !Number.isFinite(bMs);
    if (aMsUnset && bMsUnset) return 0;
    if (aMsUnset) return 1;
    if (bMsUnset) return -1;
    if (aMs === bMs) return 0;
    return aMs > bMs ? dir : -dir;
  }

  if (valueType === 'number') {
    const aNum = Number(baseA);
    const bNum = Number(baseB);
    const aNumUnset = !Number.isFinite(aNum);
    const bNumUnset = !Number.isFinite(bNum);
    if (aNumUnset && bNumUnset) return 0;
    if (aNumUnset) return 1;
    if (bNumUnset) return -1;
    if (aNum === bNum) return 0;
    return aNum > bNum ? dir : -dir;
  }

  const aText = String(baseA);
  const bText = String(baseB);
  const compared = aText.localeCompare(bText, 'ja', { sensitivity: 'base', numeric: true });
  if (compared === 0) return 0;
  return compared > 0 ? dir : -dir;
}

function toggleSortDirection(currentKey, nextKey, currentDirection) {
  if (currentKey !== nextKey) return 'asc';
  return currentDirection === 'asc' ? 'desc' : 'asc';
}

function applySortUiState(options) {
  if (!ADMIN_TREND_UI_ENABLED) return;
  const root = (options && options.root) || document;
  const attr = options && options.attr ? options.attr : '';
  if (!attr) return;
  const sortKey = options && options.sortKey ? String(options.sortKey) : '';
  const sortDir = options && options.sortDir === 'asc' ? 'asc' : 'desc';
  root.querySelectorAll(`[${attr}]`).forEach((btn) => {
    const key = btn.getAttribute(attr) || '';
    const th = btn.closest('th');
    if (key && key === sortKey) {
      btn.setAttribute('data-sort-direction', sortDir);
      if (th) th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
    } else {
      btn.removeAttribute('data-sort-direction');
      if (th) th.setAttribute('aria-sort', 'none');
    }
  });
}

function getInputValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  return String(el.value || '').trim();
}

function getSelectValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  return String(el.value || '').trim();
}

function getSelectLabel(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  const option = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
  return option ? String(option.textContent || '').trim() : '';
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setSelectValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function pushFilterChip(chips, label, value) {
  if (!value) return;
  chips.push({ label, value });
}

function renderFilterChips(containerId, chips) {
  if (!ADMIN_TREND_UI_ENABLED) return;
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const list = Array.isArray(chips) ? chips : [];
  if (!list.length) {
    const empty = document.createElement('span');
    empty.className = 'filter-chip filter-chip-empty';
    empty.textContent = t('ui.label.filters.none', '条件なし');
    container.appendChild(empty);
    return;
  }
  list.forEach((chip) => {
    const el = document.createElement('span');
    el.className = 'filter-chip';
    el.textContent = `${chip.label}: ${chip.value}`;
    container.appendChild(el);
  });
}

function formatFilterCountLabel(filteredCount, totalCount) {
  const label = t('ui.label.filters.count', '件数');
  const totalLabel = t('ui.label.filters.total', '全');
  if (Number.isFinite(totalCount) && totalCount > 0 && filteredCount !== totalCount) {
    return `${label}: ${filteredCount} / ${totalLabel}${totalCount}`;
  }
  return `${label}: ${filteredCount}`;
}

function updateFilterMeta(options) {
  if (!ADMIN_TREND_UI_ENABLED) return;
  const filteredCount = Number.isFinite(options.filteredCount) ? options.filteredCount : 0;
  const totalCount = Number.isFinite(options.totalCount) ? options.totalCount : 0;
  const countEl = document.getElementById(options.countId);
  if (countEl) countEl.textContent = formatFilterCountLabel(filteredCount, totalCount);
  const clearBtn = document.getElementById(options.clearId);
  if (clearBtn) {
    const disabled = !options.activeCount;
    clearBtn.disabled = disabled;
    if (disabled) clearBtn.setAttribute('aria-disabled', 'true');
    else clearBtn.removeAttribute('aria-disabled');
  }
}

function markNumericCell(td) {
  if (!td) return;
  td.classList.add('cell-num');
  td.classList.add('cell-number');
}

function cityPackRecordTypeLabel(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const fallback = CITY_PACK_RECORD_TYPE_LABELS[key] || key || '-';
  return resolveDomainLabel('type', key, fallback);
}

function resolveCityPackSortValue(item, key) {
  if (key === 'recordType') return cityPackRecordTypeLabel(item && item.recordType);
  if (key === 'createdAt') return item && item.createdAt;
  if (key === 'updatedAt') return item && item.updatedAt;
  return item ? item[key] : null;
}

function sortCityPackUnifiedItems(items) {
  const list = Array.isArray(items) ? items.slice() : [];
  const key = state.cityPackUnifiedSortKey || 'updatedAt';
  const valueType = CITY_PACK_UNIFIED_SORT_TYPES[key] || 'string';
  const direction = state.cityPackUnifiedSortDir === 'asc' ? 'asc' : 'desc';
  const sortCore = resolveCoreSlice('sortCore');
  if (sortCore && typeof sortCore.sortRows === 'function' && typeof sortCore.compareValues === 'function') {
    return sortCore.sortRows(list, {
      key,
      dir: direction,
      typeMap: CITY_PACK_UNIFIED_SORT_TYPES,
      valueGetter: (row, field) => resolveCityPackSortValue(row, field),
      tieBreaker: (a, b) => sortCore.compareValues(a && a.itemId, b && b.itemId, 'string', 'asc')
    });
  }
  return list.sort((a, b) => {
    const compared = compareSortValue(
      resolveCityPackSortValue(a, key),
      resolveCityPackSortValue(b, key),
      valueType,
      direction
    );
    if (compared !== 0) return compared;
    return compareSortValue(a && a.itemId, b && b.itemId, 'string', 'asc');
  });
}

function buildCityPackUnifiedItems() {
  const rows = [];
  const addRow = (item) => {
    rows.push({
      recordType: item.recordType || '',
      itemId: item.itemId || '',
      lineUserId: item.lineUserId || '',
      cityLabel: item.cityLabel || '',
      status: item.status || '',
      assignee: item.assignee || '',
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
      kpiText: item.kpiText || '-',
      kpiScore: Number.isFinite(Number(item.kpiScore)) ? Number(item.kpiScore) : null,
      raw: item.raw || null
    });
  };

  state.cityPackRequestItems.forEach((row) => {
    const cityLabel = [row.regionCity, row.regionState].filter(Boolean).join(', ') || row.regionKey || '-';
    const warningCount = Number.isFinite(Number(row.warningCount)) ? Number(row.warningCount) : 0;
    const agingHours = Number.isFinite(Number(row.agingHours)) ? Number(row.agingHours) : null;
    addRow({
      recordType: 'request',
      itemId: row.requestId || row.id || '',
      lineUserId: row.lineUserId || '',
      cityLabel,
      status: row.status || '',
      assignee: row.requestClass || '-',
      createdAt: row.requestedAt || row.createdAt || row.lastReviewAt || null,
      updatedAt: row.lastReviewAt || row.updatedAt || row.requestedAt || null,
      kpiText: `warn:${warningCount} / aging:${agingHours != null ? agingHours : '-'}h`,
      kpiScore: warningCount,
      raw: row
    });
  });

  state.cityPackFeedbackItems.forEach((row) => {
    const cityLabel = [row.regionCity, row.regionState].filter(Boolean).join(', ') || row.regionKey || '-';
    const score = row.status === 'resolved' ? 2 : row.status === 'triaged' ? 1 : 0;
    addRow({
      recordType: 'feedback',
      itemId: row.feedbackId || row.id || '',
      lineUserId: row.lineUserId || '',
      cityLabel,
      status: row.status || '',
      assignee: row.packClass || '-',
      createdAt: row.createdAt || row.resolvedAt || row.updatedAt || null,
      updatedAt: row.updatedAt || row.resolvedAt || row.createdAt || null,
      kpiText: `slot:${row.slotKey || '-'} / resolution:${row.resolution || '-'}`,
      kpiScore: score,
      raw: row
    });
  });

  state.cityPackBulletinItems.forEach((row) => {
    const deliveredCount = Number.isFinite(Number(row.deliveredCount)) ? Number(row.deliveredCount) : 0;
    addRow({
      recordType: 'bulletin',
      itemId: row.bulletinId || row.id || '',
      lineUserId: '',
      cityLabel: row.cityPackId || '-',
      status: row.status || '',
      assignee: row.notificationId || '-',
      createdAt: row.createdAt || row.approvedAt || row.sentAt || null,
      updatedAt: row.updatedAt || row.sentAt || row.approvedAt || row.createdAt || null,
      kpiText: `delivered:${deliveredCount}`,
      kpiScore: deliveredCount,
      raw: row
    });
  });

  state.cityPackProposalItems.forEach((row) => {
    const patchSize = row.proposalPatch && typeof row.proposalPatch === 'object'
      ? Object.keys(row.proposalPatch).length
      : 0;
    addRow({
      recordType: 'proposal',
      itemId: row.proposalId || row.id || '',
      lineUserId: '',
      cityLabel: row.cityPackId || '-',
      status: row.status || '',
      assignee: row.cityPackId || '-',
      createdAt: row.createdAt || row.approvedAt || row.updatedAt || null,
      updatedAt: row.updatedAt || row.approvedAt || row.createdAt || null,
      kpiText: `patchKeys:${patchSize}`,
      kpiScore: patchSize,
      raw: row
    });
  });

  state.cityPackInboxItems.forEach((row) => {
    const cityLabel = Array.isArray(row.usedBy) && row.usedBy.length ? String(row.usedBy[0]) : '-';
    addRow({
      recordType: 'review',
      itemId: row.sourceRefId || '',
      lineUserId: '',
      cityLabel,
      status: row.status || '',
      assignee: row.recommendation || '-',
      createdAt: row.validUntil || null,
      updatedAt: row.validUntil || null,
      kpiText: `priority:${row.priorityLevel || '-'}(${Number.isFinite(Number(row.priorityScore)) ? Number(row.priorityScore) : '-'}) / confidence:${Number.isFinite(Number(row.confidenceScore)) ? Number(row.confidenceScore) : '-'}`,
      kpiScore: row.priorityScore,
      raw: row
    });
  });

  state.cityPackTemplateLibraryItems.forEach((row) => {
    const traceScore = row.traceId ? String(row.traceId).length : 0;
    addRow({
      recordType: 'template',
      itemId: row.id || '',
      lineUserId: '',
      cityLabel: row.name || '-',
      status: row.status || '',
      assignee: row.source || '-',
      createdAt: row.createdAt || row.activatedAt || row.retiredAt || row.updatedAt || null,
      updatedAt: row.updatedAt || row.activatedAt || row.retiredAt || row.createdAt || null,
      kpiText: `schema:${row.schemaVersion || '-'} / trace:${row.traceId || '-'}`,
      kpiScore: traceScore,
      raw: row
    });
  });

  return rows;
}

function applyCityPackUnifiedFilters() {
  const idKeyword = (document.getElementById('city-pack-unified-filter-id')?.value || '').trim().toLowerCase();
  const userKeyword = (document.getElementById('city-pack-unified-filter-user-id')?.value || '').trim().toLowerCase();
  const cityKeyword = (document.getElementById('city-pack-unified-filter-city')?.value || '').trim().toLowerCase();
  const status = (document.getElementById('city-pack-unified-filter-status')?.value || '').trim().toLowerCase();
  const recordType = (document.getElementById('city-pack-unified-filter-type')?.value || '').trim().toLowerCase();
  const createdFromMs = parseDateInputMs(document.getElementById('city-pack-unified-filter-date-from')?.value || '', false);
  const createdToMs = parseDateInputMs(document.getElementById('city-pack-unified-filter-date-to')?.value || '', true);
  const filterCore = resolveCoreSlice('filterCore');
  const filtered = filterCore && typeof filterCore.applyAndFilters === 'function'
    ? filterCore.applyAndFilters(state.cityPackUnifiedItems, [
        { type: 'includes', value: idKeyword, normalize: { trim: true, lower: true }, getValue: (item) => item && item.itemId },
        { type: 'includes', value: userKeyword, normalize: { trim: true, lower: true }, getValue: (item) => item && item.lineUserId },
        { type: 'includes', value: cityKeyword, normalize: { trim: true, lower: true }, getValue: (item) => item && item.cityLabel },
        { type: 'equals', value: status, normalize: { trim: true, lower: true }, getValue: (item) => item && item.status },
        { type: 'equals', value: recordType, normalize: { trim: true, lower: true }, getValue: (item) => item && item.recordType },
        {
          type: 'predicate',
          value: createdFromMs == null ? '' : String(createdFromMs),
          predicate: (item, needle) => {
            const fromMs = Number(needle);
            if (!Number.isFinite(fromMs) || fromMs <= 0) return true;
            const createdAtMs = toSortMillis(item && item.createdAt);
            return Boolean(createdAtMs && createdAtMs >= fromMs);
          }
        },
        {
          type: 'predicate',
          value: createdToMs == null ? '' : String(createdToMs),
          predicate: (item, needle) => {
            const toMs = Number(needle);
            if (!Number.isFinite(toMs) || toMs <= 0) return true;
            const createdAtMs = toSortMillis(item && item.createdAt);
            return Boolean(createdAtMs && createdAtMs <= toMs);
          }
        }
      ])
    : state.cityPackUnifiedItems.filter((item) => {
      const itemId = String(item && item.itemId ? item.itemId : '').toLowerCase();
      const lineUserId = String(item && item.lineUserId ? item.lineUserId : '').toLowerCase();
      const cityLabel = String(item && item.cityLabel ? item.cityLabel : '').toLowerCase();
      const itemStatus = String(item && item.status ? item.status : '').toLowerCase();
      const itemType = String(item && item.recordType ? item.recordType : '').toLowerCase();
      if (idKeyword && !itemId.includes(idKeyword)) return false;
      if (userKeyword && !lineUserId.includes(userKeyword)) return false;
      if (cityKeyword && !cityLabel.includes(cityKeyword)) return false;
      if (status && itemStatus !== status) return false;
      if (recordType && itemType !== recordType) return false;
      const createdAtMs = toSortMillis(item && item.createdAt);
      if (createdFromMs && (!createdAtMs || createdAtMs < createdFromMs)) return false;
      if (createdToMs && (!createdAtMs || createdAtMs > createdToMs)) return false;
      return true;
    });
  state.cityPackUnifiedFilteredItems = sortCityPackUnifiedItems(filtered);
}

function buildCityPackUnifiedFilterChips() {
  const chips = [];
  const idValue = getInputValue('city-pack-unified-filter-id');
  const userValue = getInputValue('city-pack-unified-filter-user-id');
  const cityValue = getInputValue('city-pack-unified-filter-city');
  const statusValue = getSelectValue('city-pack-unified-filter-status');
  const typeValue = getSelectValue('city-pack-unified-filter-type');
  const createdFrom = getInputValue('city-pack-unified-filter-date-from');
  const createdTo = getInputValue('city-pack-unified-filter-date-to');
  pushFilterChip(chips, 'ID', idValue);
  pushFilterChip(chips, 'ユーザーID', userValue);
  pushFilterChip(chips, '都市', cityValue);
  if (statusValue) pushFilterChip(chips, '状態', getSelectLabel('city-pack-unified-filter-status'));
  if (typeValue) pushFilterChip(chips, '種別', getSelectLabel('city-pack-unified-filter-type'));
  pushFilterChip(chips, '作成日 from', createdFrom);
  pushFilterChip(chips, '作成日 to', createdTo);
  return chips;
}

function clearCityPackUnifiedFilters() {
  setInputValue('city-pack-unified-filter-id', '');
  setInputValue('city-pack-unified-filter-user-id', '');
  setInputValue('city-pack-unified-filter-city', '');
  setSelectValue('city-pack-unified-filter-status', '');
  setSelectValue('city-pack-unified-filter-type', '');
  setInputValue('city-pack-unified-filter-date-from', '');
  setInputValue('city-pack-unified-filter-date-to', '');
}

function createUnifiedActionButton(label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    handler();
  });
  return button;
}

function renderCityPackUnifiedActionCell(item) {
  const td = document.createElement('td');
  td.className = 'unified-action-cell';
  const group = document.createElement('div');
  group.className = 'unified-action-group';
  const type = item && item.recordType ? String(item.recordType) : '';
  const row = item && item.raw ? item.raw : null;
  if (type === 'request' && row) {
    group.appendChild(createUnifiedActionButton('Approve', () => { void runCityPackRequestAction('approve', row); }));
    group.appendChild(createUnifiedActionButton('Reject', () => { void runCityPackRequestAction('reject', row); }));
    group.appendChild(createUnifiedActionButton('Changes', () => { void runCityPackRequestAction('request-changes', row); }));
    group.appendChild(createUnifiedActionButton('Retry', () => { void runCityPackRequestAction('retry-job', row); }));
    group.appendChild(createUnifiedActionButton('Activate', () => { void runCityPackRequestAction('activate', row); }));
  } else if (type === 'feedback' && row) {
    group.appendChild(createUnifiedActionButton('Triage', () => { void runCityPackFeedbackAction('triage', row); }));
    group.appendChild(createUnifiedActionButton('Resolve', () => { void runCityPackFeedbackAction('resolve', row); }));
    group.appendChild(createUnifiedActionButton('Reject', () => { void runCityPackFeedbackAction('reject', row); }));
    group.appendChild(createUnifiedActionButton('Propose', () => { void runCityPackFeedbackAction('propose', row); }));
  } else if (type === 'bulletin' && row) {
    group.appendChild(createUnifiedActionButton('Approve', () => { void runCityPackBulletinAction('approve', row); }));
    group.appendChild(createUnifiedActionButton('Reject', () => { void runCityPackBulletinAction('reject', row); }));
    group.appendChild(createUnifiedActionButton('Send', () => { void runCityPackBulletinAction('send', row); }));
  } else if (type === 'proposal' && row) {
    group.appendChild(createUnifiedActionButton('Approve', () => { void runCityPackProposalAction('approve', row); }));
    group.appendChild(createUnifiedActionButton('Reject', () => { void runCityPackProposalAction('reject', row); }));
    group.appendChild(createUnifiedActionButton('Apply', () => { void runCityPackProposalAction('apply', row); }));
  } else if (type === 'review' && row) {
    group.appendChild(createUnifiedActionButton('Confirm', () => { void runCityPackSourceAction('confirm', row); }));
    group.appendChild(createUnifiedActionButton('Retire', () => { void runCityPackSourceAction('retire', row); }));
    group.appendChild(createUnifiedActionButton('Replace', () => { void runCityPackSourceAction('replace', row); }));
    group.appendChild(createUnifiedActionButton('Manual', () => { void runCityPackSourceAction('manual-only', row); }));
  } else if (type === 'template' && row) {
    group.appendChild(createUnifiedActionButton('Activate', () => { void runCityPackTemplateLibraryAction('activate', row); }));
    group.appendChild(createUnifiedActionButton('Retire', () => { void runCityPackTemplateLibraryAction('retire', row); }));
  }
  td.appendChild(group);
  return td;
}

function renderCityPackUnifiedRows() {
  const tbody = document.getElementById('city-pack-unified-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  applyCityPackUnifiedFilters();
  applySortUiState({
    root: document.getElementById('pane-city-pack'),
    attr: 'data-city-pack-sort-key',
    sortKey: state.cityPackUnifiedSortKey,
    sortDir: state.cityPackUnifiedSortDir
  });
  const items = state.cityPackUnifiedFilteredItems;
  const chips = buildCityPackUnifiedFilterChips();
  renderFilterChips('city-pack-unified-filter-chips', chips);
  updateFilterMeta({
    countId: 'city-pack-unified-result-count',
    clearId: 'city-pack-unified-clear',
    filteredCount: items.length,
    totalCount: state.cityPackUnifiedItems.length,
    activeCount: chips.length
  });
  persistListStateToStorage('cityPackUnified', readCityPackUnifiedListState());
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 10;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    const cols = [
      formatTimestampForList(item.createdAt),
      item.itemId || '-',
      item.lineUserId || '-',
      item.cityLabel || '-',
      cityPackRecordTypeLabel(item.recordType),
      item.status || '-',
      item.assignee || '-',
      formatTimestampForList(item.updatedAt),
      item.kpiText || '-'
    ];
    cols.forEach((value, idx) => {
      const td = document.createElement('td');
      if (idx === 8) markNumericCell(td);
      td.textContent = toUnifiedDisplay(value, '-');
      tr.appendChild(td);
    });
    tr.appendChild(renderCityPackUnifiedActionCell(item));
    tbody.appendChild(tr);
  });
}

function refreshCityPackUnifiedRows() {
  state.cityPackUnifiedItems = buildCityPackUnifiedItems();
  renderCityPackUnifiedRows();
}

function resolveVendorRelatedCount(row) {
  const numericKeys = ['relatedCount', 'usageCount', 'referenceCount', 'usedByCount'];
  for (const key of numericKeys) {
    const numeric = Number(row && row[key]);
    if (Number.isFinite(numeric)) return numeric;
  }
  const listKeys = ['usedByNotificationIds', 'usedBy', 'notificationIds', 'references'];
  for (const key of listKeys) {
    if (Array.isArray(row && row[key])) return row[key].length;
  }
  return 0;
}

function resolveVendorSortValue(item, key) {
  if (key === 'status') return item && item.status;
  if (key === 'createdAt') return item && item.createdAt;
  if (key === 'updatedAt') return item && item.updatedAt;
  return item ? item[key] : null;
}

function sortVendorItems(items) {
  const list = Array.isArray(items) ? items.slice() : [];
  const key = state.vendorSortKey || 'createdAt';
  const valueType = VENDOR_UNIFIED_SORT_TYPES[key] || 'string';
  const direction = state.vendorSortDir === 'asc' ? 'asc' : 'desc';
  const sortCore = resolveCoreSlice('sortCore');
  if (sortCore && typeof sortCore.sortRows === 'function' && typeof sortCore.compareValues === 'function') {
    return sortCore.sortRows(list, {
      key,
      dir: direction,
      typeMap: VENDOR_UNIFIED_SORT_TYPES,
      valueGetter: (row, field) => resolveVendorSortValue(row, field),
      tieBreaker: (a, b) => sortCore.compareValues(a && a.linkId, b && b.linkId, 'string', 'asc')
    });
  }
  return list.sort((a, b) => {
    const compared = compareSortValue(
      resolveVendorSortValue(a, key),
      resolveVendorSortValue(b, key),
      valueType,
      direction
    );
    if (compared !== 0) return compared;
    return compareSortValue(a && a.linkId, b && b.linkId, 'string', 'asc');
  });
}

function applyVendorUnifiedFilters() {
  const idKeyword = (document.getElementById('vendor-unified-filter-id')?.value || '').trim().toLowerCase();
  const nameKeyword = (document.getElementById('vendor-unified-filter-name')?.value || '').trim().toLowerCase();
  const status = (document.getElementById('vendor-unified-filter-status')?.value || '').trim().toUpperCase();
  const categoryKeyword = (document.getElementById('vendor-unified-filter-category')?.value || '').trim().toLowerCase();
  const createdFromMs = parseDateInputMs(document.getElementById('vendor-unified-filter-date-from')?.value || '', false);
  const createdToMs = parseDateInputMs(document.getElementById('vendor-unified-filter-date-to')?.value || '', true);
  const filterCore = resolveCoreSlice('filterCore');
  const filtered = filterCore && typeof filterCore.applyAndFilters === 'function'
    ? filterCore.applyAndFilters(state.vendorItems, [
        { type: 'includes', value: idKeyword, normalize: { trim: true, lower: true }, getValue: (item) => item && item.linkId },
        { type: 'includes', value: nameKeyword, normalize: { trim: true, lower: true }, getValue: (item) => item && item.vendorLabel },
        { type: 'equals', value: status, normalize: { trim: true, upper: true }, getValue: (item) => item && item.status },
        { type: 'includes', value: categoryKeyword, normalize: { trim: true, lower: true }, getValue: (item) => item && item.category },
        {
          type: 'predicate',
          value: createdFromMs == null ? '' : String(createdFromMs),
          predicate: (item, needle) => {
            const fromMs = Number(needle);
            if (!Number.isFinite(fromMs) || fromMs <= 0) return true;
            const createdAtMs = toSortMillis(item && item.createdAt);
            return Boolean(createdAtMs && createdAtMs >= fromMs);
          }
        },
        {
          type: 'predicate',
          value: createdToMs == null ? '' : String(createdToMs),
          predicate: (item, needle) => {
            const toMs = Number(needle);
            if (!Number.isFinite(toMs) || toMs <= 0) return true;
            const createdAtMs = toSortMillis(item && item.createdAt);
            return Boolean(createdAtMs && createdAtMs <= toMs);
          }
        }
      ])
    : state.vendorItems.filter((item) => {
      const linkId = String(item && item.linkId ? item.linkId : '').toLowerCase();
      const vendorLabel = String(item && item.vendorLabel ? item.vendorLabel : '').toLowerCase();
      const category = String(item && item.category ? item.category : '').toLowerCase();
      const rowStatus = String(item && item.status ? item.status : '').toUpperCase();
      if (idKeyword && !linkId.includes(idKeyword)) return false;
      if (nameKeyword && !vendorLabel.includes(nameKeyword)) return false;
      if (status && rowStatus !== status) return false;
      if (categoryKeyword && !category.includes(categoryKeyword)) return false;
      const createdAtMs = toSortMillis(item && item.createdAt);
      if (createdFromMs && (!createdAtMs || createdAtMs < createdFromMs)) return false;
      if (createdToMs && (!createdAtMs || createdAtMs > createdToMs)) return false;
      return true;
    });
  state.vendorUnifiedFilteredItems = sortVendorItems(filtered);
}

function buildVendorUnifiedFilterChips() {
  const chips = [];
  const idValue = getInputValue('vendor-unified-filter-id');
  const nameValue = getInputValue('vendor-unified-filter-name');
  const statusValue = getSelectValue('vendor-unified-filter-status');
  const categoryValue = getInputValue('vendor-unified-filter-category');
  const createdFrom = getInputValue('vendor-unified-filter-date-from');
  const createdTo = getInputValue('vendor-unified-filter-date-to');
  pushFilterChip(chips, 'Vendor ID', idValue);
  pushFilterChip(chips, '名称', nameValue);
  if (statusValue) pushFilterChip(chips, 'ステータス', getSelectLabel('vendor-unified-filter-status'));
  pushFilterChip(chips, 'カテゴリ', categoryValue);
  pushFilterChip(chips, '登録日 from', createdFrom);
  pushFilterChip(chips, '登録日 to', createdTo);
  return chips;
}

function clearVendorUnifiedFilters() {
  setInputValue('vendor-unified-filter-id', '');
  setInputValue('vendor-unified-filter-name', '');
  setSelectValue('vendor-unified-filter-status', '');
  setInputValue('vendor-unified-filter-category', '');
  setInputValue('vendor-unified-filter-date-from', '');
  setInputValue('vendor-unified-filter-date-to', '');
}

function runVendorActionForRow(action, row) {
  if (!row || !row.linkId) return;
  state.selectedVendorLinkId = row.linkId;
  void runVendorAction(action);
}

function renderVendorUnifiedActionCell(item) {
  const td = document.createElement('td');
  td.className = 'unified-action-cell';
  const group = document.createElement('div');
  group.className = 'unified-action-group';
  group.appendChild(createUnifiedActionButton('Edit', () => runVendorActionForRow('edit', item)));
  group.appendChild(createUnifiedActionButton('Activate', () => runVendorActionForRow('activate', item)));
  group.appendChild(createUnifiedActionButton('Disable', () => runVendorActionForRow('disable', item)));
  td.appendChild(group);
  return td;
}

function renderVendorUnifiedRows() {
  const tbody = document.getElementById('vendor-unified-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  applyVendorUnifiedFilters();
  applySortUiState({
    root: document.getElementById('pane-vendors'),
    attr: 'data-vendor-sort-key',
    sortKey: state.vendorSortKey,
    sortDir: state.vendorSortDir
  });
  const items = state.vendorUnifiedFilteredItems;
  const chips = buildVendorUnifiedFilterChips();
  renderFilterChips('vendor-unified-filter-chips', chips);
  updateFilterMeta({
    countId: 'vendor-unified-result-count',
    clearId: 'vendor-unified-clear',
    filteredCount: items.length,
    totalCount: state.vendorItems.length,
    activeCount: chips.length
  });
  persistListStateToStorage('vendorUnified', readVendorUnifiedListState());
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    const cols = [
      formatTimestampForList(item.createdAt),
      item.linkId || '-',
      item.vendorLabel || '-',
      item.category || '-',
      statusLabel(item.status === 'DEAD' ? 'DANGER' : item.status),
      formatTimestampForList(item.updatedAt),
      Number.isFinite(Number(item.relatedCount)) ? String(Number(item.relatedCount)) : '-'
    ];
    cols.forEach((value, idx) => {
      const td = document.createElement('td');
      if (idx === 6) markNumericCell(td);
      td.textContent = toUnifiedDisplay(value, '-');
      tr.appendChild(td);
    });
    tr.appendChild(renderVendorUnifiedActionCell(item));
    tr.addEventListener('click', () => {
      state.selectedVendorLinkId = item.linkId || null;
    });
    tbody.appendChild(tr);
  });
}

function renderComposerScenarioCompare(items) {
  const tbody = document.getElementById('composer-compare-rows');
  if (!tbody) return;
  const stats = new Map([
    ['A', { count: 0, sent: 0, clicked: 0 }],
    ['C', { count: 0, sent: 0, clicked: 0 }]
  ]);
  (items || []).forEach((item) => {
    const key = item && item.scenarioKey ? String(item.scenarioKey) : '';
    if (!stats.has(key)) return;
    const current = stats.get(key);
    current.count += 1;
    const sent = item && item.reactionSummary && Number.isFinite(item.reactionSummary.sent) ? item.reactionSummary.sent : 0;
    const clicked = item && item.reactionSummary && Number.isFinite(item.reactionSummary.clicked) ? item.reactionSummary.clicked : 0;
    current.sent += sent;
    current.clicked += clicked;
  });
  tbody.innerHTML = '';
  ['A', 'B', 'C', 'D'].forEach((scenario) => {
    const row = stats.get(scenario);
    const tr = document.createElement('tr');
    const scenarioTd = document.createElement('td');
    scenarioTd.textContent = scenarioLabel(scenario);
    tr.appendChild(scenarioTd);
    const countTd = document.createElement('td');
    countTd.textContent = String(row.count);
    tr.appendChild(countTd);
    const ctrTd = document.createElement('td');
    ctrTd.textContent = formatPercent(row.clicked, row.sent);
    tr.appendChild(ctrTd);
    tbody.appendChild(tr);
  });
}

function renderMonitorUserRows(items) {
  const tbody = document.getElementById('monitor-user-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    if (item.health === 'DANGER') tr.classList.add('row-health-danger');
    if (item.health === 'WARN') tr.classList.add('row-health-warn');
    if (item.health === 'OK') tr.classList.add('row-health-ok');
    const cols = [
      formatDateLabel(item.sentAt),
      formatDateLabel(item.deliveredAt),
      `${item.lineUserId || '-'} / ${item.memberNumber || '-'}`,
      item.title || item.notificationId || '-',
      item.statusLabel || '-',
      item.failureLabel || '-'
    ];
    cols.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => {
      const detail = document.getElementById('monitor-detail');
      const raw = document.getElementById('monitor-raw');
      tbody.querySelectorAll('tr').forEach((row) => row.classList.remove('row-active'));
      tr.classList.add('row-active');
      if (detail) {
        detail.textContent = [
          `${t('ui.label.monitor.userCol.user', '対象ユーザー')}: ${item.lineUserId || '-'}`,
          `${t('ui.label.monitor.userCol.notification', '通知')}: ${item.title || item.notificationId || '-'}`,
          `${t('ui.label.monitor.userCol.status', '状態')}: ${item.statusLabel || '-'}`,
          `${t('ui.label.traceId', '追跡ID')}: ${item.traceId || '-'}`
        ].join('\n');
      }
      if (raw) raw.textContent = JSON.stringify(item.raw || item, null, 2);
    });
    tbody.appendChild(tr);
  });
}

function renderVendorCtrRows(items) {
  const tbody = document.getElementById('monitor-vendor-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    [item.vendorLabel || item.vendorKey || '-', String(item.sent || 0), String(item.clicked || 0), item.ctr != null ? `${Math.round(item.ctr * 1000) / 10}%` : '-'].forEach((value, idx) => {
      const td = document.createElement('td');
      if (idx > 0) td.classList.add('cell-num');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderFaqReferenceRows(items) {
  const tbody = document.getElementById('monitor-faq-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    [item.articleId || '-', String(item.count || 0)].forEach((value, idx) => {
      const td = document.createElement('td');
      if (idx === 1) td.classList.add('cell-num');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function resolveHost(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    return parsed.host || null;
  } catch (_err) {
    return null;
  }
}

function normalizeVendorRow(item) {
  const row = item && typeof item === 'object' ? item : {};
  const fallbackHost = resolveHost(row.url);
  const healthState = row.healthState || (row.lastHealth && row.lastHealth.state) || 'UNKNOWN';
  const createdAt = row.createdAt || row.insertedAt || row.firstSeenAt || row.updatedAt || (row.lastHealth && row.lastHealth.checkedAt) || null;
  const updatedAt = row.updatedAt || (row.lastHealth && row.lastHealth.checkedAt) || row.checkedAt || row.createdAt || null;
  const category = row.vendorCategory || row.category || row.vendorKey || fallbackHost || '-';
  const relatedCount = resolveVendorRelatedCount(row);
  return {
    linkId: row.id || row.linkId || '-',
    vendorLabel: row.vendorLabel || fallbackHost || row.vendorKey || '-',
    vendorKey: row.vendorKey || fallbackHost || '-',
    category,
    status: healthState,
    healthState,
    checkedAt: row.checkedAt || (row.lastHealth && row.lastHealth.checkedAt) || row.updatedAt || null,
    createdAt,
    updatedAt,
    relatedCount,
    url: row.url || null,
    raw: row
  };
}

function renderVendorRows(items) {
  const tbody = document.getElementById('vendor-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    const detail = document.getElementById('vendor-detail');
    if (detail) detail.textContent = t('ui.desc.vendors.empty', '行を選択すると詳細を表示します。');
    const raw = document.getElementById('vendor-raw');
    if (raw) raw.textContent = '-';
    state.selectedVendorLinkId = null;
    state.selectedVendorRowIndex = null;
    return;
  }
  items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    tr.tabIndex = 0;
    tr.dataset.vendorIndex = String(idx);
    if (item.linkId) tr.dataset.vendorLinkId = String(item.linkId);
    if (item.healthState === 'WARN') tr.classList.add('row-health-warn');
    if (item.healthState === 'OK') tr.classList.add('row-health-ok');
    if (item.healthState === 'DEAD') tr.classList.add('row-health-danger');
    const cols = [
      item.vendorLabel || '-',
      statusLabel(item.healthState === 'DEAD' ? 'DANGER' : item.healthState),
      formatDateLabel(item.checkedAt),
      item.linkId || '-'
    ];
    cols.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => selectVendorRow(tbody, tr, item, idx, { focusRow: false }));
    tbody.appendChild(tr);
  });

  // Keep selection stable across reloads if possible.
  if (state.selectedVendorLinkId) {
    const foundIndex = items.findIndex((item) => item && item.linkId === state.selectedVendorLinkId);
    if (foundIndex >= 0) {
      const row = tbody.querySelector(`tr[data-vendor-index="${foundIndex}"]`);
      if (row) selectVendorRow(tbody, row, items[foundIndex], foundIndex, { focusRow: false });
    }
  }
}

function selectVendorRow(tbody, rowEl, item, idx, options) {
  if (!tbody || !rowEl || !item) return;
  tbody.querySelectorAll('tr').forEach((node) => {
    node.classList.remove('row-active');
    node.removeAttribute('aria-selected');
  });
  rowEl.classList.add('row-active');
  rowEl.setAttribute('aria-selected', 'true');
  state.selectedVendorLinkId = item.linkId || null;
  state.selectedVendorRowIndex = idx;

  const detail = document.getElementById('vendor-detail');
  if (detail) {
    detail.textContent = [
      `${t('ui.label.vendors.col.vendor', 'Vendor')}: ${item.vendorLabel || '-'}`,
      `${t('ui.label.vendors.col.state', '状態')}: ${statusLabel(item.healthState === 'DEAD' ? 'DANGER' : item.healthState)}`,
      `${t('ui.label.vendors.col.lastChecked', '最終確認')}: ${formatDateLabel(item.checkedAt)}`
    ].join('\n');
  }
  const raw = document.getElementById('vendor-raw');
  if (raw) raw.textContent = JSON.stringify(item.raw || item, null, 2);

  const focusRow = options && options.focusRow;
  if (focusRow && typeof rowEl.focus === 'function') {
    rowEl.focus({ preventScroll: true });
    rowEl.scrollIntoView({ block: 'nearest' });
  }
}

function setupVendorTableKeyboardNavigation() {
  const tbody = document.getElementById('vendor-rows');
  if (!tbody) return;
  tbody.addEventListener('keydown', (event) => {
    const key = event.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Enter') return;
    const rows = Array.from(tbody.querySelectorAll('tr[data-vendor-index]'));
    if (!rows.length) return;
    const active = document.activeElement;
    const currentIndex = active && active.dataset && active.dataset.vendorIndex
      ? Number(active.dataset.vendorIndex)
      : (typeof state.selectedVendorRowIndex === 'number' ? state.selectedVendorRowIndex : 0);

    if (!Number.isFinite(currentIndex)) return;
    event.preventDefault();

    if (key === 'Enter') {
      const row = rows[currentIndex];
      const item = state.vendorItems[currentIndex];
      if (row && item) selectVendorRow(tbody, row, item, currentIndex, { focusRow: false });
      return;
    }

    const next = key === 'ArrowDown'
      ? Math.min(currentIndex + 1, rows.length - 1)
      : Math.max(currentIndex - 1, 0);
    const row = rows[next];
    const item = state.vendorItems[next];
    if (row && item) selectVendorRow(tbody, row, item, next, { focusRow: true });
  });
}

function formatRatio(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 1000) / 10}%`;
}

function formatScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value)}`;
}

function toDateLabel(value) {
  if (!value) return '-';
  const ms = toMillis(value);
  if (!ms) return '-';
  return new Date(ms).toISOString().slice(0, 10);
}

function getCityPackRunDetailLimit() {
  const input = document.getElementById('city-pack-run-detail-limit');
  const value = Number(input && input.value);
  if (!Number.isFinite(value) || value <= 0) return 50;
  return Math.min(Math.max(Math.floor(value), 1), 200);
}

function renderCityPackKpi(metrics) {
  state.cityPackKpi = metrics || null;
  const zeroRateEl = document.getElementById('city-pack-kpi-expired-zero-rate');
  const reviewLagEl = document.getElementById('city-pack-kpi-review-lag');
  const deadRateEl = document.getElementById('city-pack-kpi-dead-rate');
  const blockRateEl = document.getElementById('city-pack-kpi-block-rate');
  if (zeroRateEl) zeroRateEl.textContent = metrics ? formatRatio(metrics.expiredSourceZeroRate) : '-';
  if (reviewLagEl) reviewLagEl.textContent = metrics && Number.isFinite(metrics.reviewLagHours) ? `${metrics.reviewLagHours}h` : '-';
  if (deadRateEl) deadRateEl.textContent = metrics ? formatRatio(metrics.deadDetectionRate) : '-';
  if (blockRateEl) blockRateEl.textContent = metrics ? formatRatio(metrics.sourceBlockedRate) : '-';
}

function renderCityPackMetrics(payload) {
  state.cityPackMetrics = payload && typeof payload === 'object' ? payload : null;
  const summaryEl = document.getElementById('city-pack-metrics-summary');
  const tbody = document.getElementById('city-pack-metrics-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  const items = Array.isArray(payload && payload.items) ? payload.items : [];
  const summary = payload && payload.summary && typeof payload.summary === 'object' ? payload.summary : null;

  if (summaryEl) {
    if (!summary) {
      summaryEl.textContent = t('ui.desc.cityPack.metricsSummaryEmpty', '効果測定データはありません。');
    } else {
      const totalRows = Number(summary.totalRows) || 0;
      const totalSent = Number(summary.totalSent) || 0;
      const totalDelivered = Number(summary.totalDelivered) || 0;
      const totalClicked = Number(summary.totalClicked) || 0;
      const windowCtr = typeof summary.windowCtr === 'number' ? formatRatio(summary.windowCtr) : '-';
      summaryEl.textContent = `${t('ui.label.cityPack.metrics.summary.rows', 'rows')}: ${totalRows}, ${t('ui.label.cityPack.metrics.summary.sent', 'sent')}: ${totalSent}, ${t('ui.label.cityPack.metrics.summary.delivered', 'delivered')}: ${totalDelivered}, ${t('ui.label.cityPack.metrics.summary.clicked', 'clicked')}: ${totalClicked}, CTR: ${windowCtr}`;
    }
  }

  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement('tr');
    const cols = [
      item.cityPackId || '-',
      item.slotId || '-',
      item.sourceRefId || '-',
      Number(item.sentCount) || 0,
      Number(item.deliveredCount) || 0,
      Number(item.clickCount) || 0,
      formatRatio(typeof item.ctr === 'number' ? item.ctr : 0),
      item.lastDateKey || '-'
    ];
    cols.forEach((value, idx) => {
      const td = document.createElement('td');
      if (idx >= 3 && idx <= 6) td.classList.add('cell-num');
      td.textContent = String(value);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderCityPackRunRows(payload) {
  const tbody = document.getElementById('city-pack-run-rows');
  const summaryEl = document.getElementById('city-pack-runs-summary');
  const data = payload && typeof payload === 'object' ? payload : {};
  const items = Array.isArray(data.items) ? data.items : [];
  const summary = data.summary && typeof data.summary === 'object' ? data.summary : null;
  state.cityPackRuns = items;
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    state.selectedCityPackRunId = null;
    state.selectedCityPackRunTraceId = null;
    state.selectedCityPackRunEvidenceId = null;
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (summaryEl) summaryEl.textContent = t('ui.desc.cityPack.runsEmpty', '実行履歴はありません。');
    renderCityPackRunDetail(null);
    return;
  }

  items.forEach((run) => {
    const tr = document.createElement('tr');
    const status = run && run.status ? String(run.status) : 'RUNNING';
    if (status === 'WARN') tr.classList.add('row-health-danger');
    else if (status === 'RUNNING') tr.classList.add('row-health-warn');
    else tr.classList.add('row-health-ok');

    const resultLabel = status === 'OK'
      ? t('ui.label.cityPack.runs.status.ok', '正常')
      : status === 'WARN'
        ? t('ui.label.cityPack.runs.status.warn', '要確認')
        : t('ui.label.cityPack.runs.status.running', '実行中');

    const processed = Number.isFinite(Number(run && run.processed)) ? Number(run.processed) : 0;
    const failed = Number.isFinite(Number(run && run.failed)) ? Number(run.failed) : 0;
    const stage = run && run.stage ? String(run.stage) : '-';
    const confidenceSummary = run && run.confidenceSummary && typeof run.confidenceSummary === 'object'
      ? run.confidenceSummary
      : null;
    const confidenceText = confidenceSummary && Number.isFinite(Number(confidenceSummary.average))
      ? `${formatScore(Number(confidenceSummary.average))}/100`
      : '-';

    const cells = [
      run && run.runId ? String(run.runId) : '-',
      run && run.mode ? String(run.mode) : '-',
      stage,
      run && run.startedAt ? String(run.startedAt) : '-',
      resultLabel,
      `${processed}/${failed}`,
      confidenceText,
      run && run.traceId ? String(run.traceId) : '-'
    ];
    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tr.classList.add('clickable-row');
    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      state.selectedCityPackRunId = run && run.runId ? String(run.runId) : null;
      state.selectedCityPackRunTraceId = run && run.traceId ? String(run.traceId) : null;
      const runId = run && run.runId ? String(run.runId) : '';
      if (runId) void loadCityPackAuditRunDetail(runId);
    });
    tbody.appendChild(tr);
  });

  if (summaryEl && summary) {
    summaryEl.textContent = `${t('ui.label.cityPack.runs.summary', '実行履歴')}: total ${summary.total || 0}, running ${summary.running || 0}, ok ${summary.ok || 0}, warn ${summary.warn || 0}`;
  } else if (summaryEl) {
    summaryEl.textContent = t('ui.desc.cityPack.runsLoaded', '実行履歴を更新しました。');
  }
}

function renderCityPackRunDetail(payload) {
  const summaryEl = document.getElementById('city-pack-run-detail-summary');
  const rowsEl = document.getElementById('city-pack-run-detail-rows');
  const rawEl = document.getElementById('city-pack-run-result');
  const data = payload && typeof payload === 'object' ? payload : null;
  const run = data && data.run && typeof data.run === 'object' ? data.run : null;
  const evidences = Array.isArray(data && data.evidences) ? data.evidences : [];

  if (rawEl) rawEl.textContent = JSON.stringify(data || {}, null, 2);

  if (!run) {
    state.selectedCityPackRunId = null;
    state.selectedCityPackRunTraceId = null;
    state.selectedCityPackRunEvidenceId = null;
    if (summaryEl) summaryEl.textContent = t('ui.desc.cityPack.runDetail.empty', '実行履歴の行を選択すると詳細を表示します。');
    if (rowsEl) {
      rowsEl.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = t('ui.label.common.empty', 'データなし');
      tr.appendChild(td);
      rowsEl.appendChild(tr);
    }
    return;
  }

  if (summaryEl) {
    const statusLabelText = run.status === 'OK'
      ? t('ui.label.cityPack.runs.status.ok', '正常')
      : run.status === 'WARN'
        ? t('ui.label.cityPack.runs.status.warn', '要確認')
        : t('ui.label.cityPack.runs.status.running', '実行中');
    const stageText = run.stage || '-';
    summaryEl.textContent = `${run.runId || '-'} / ${statusLabelText} / ${stageText} / ${t('ui.label.cityPack.runs.col.traceId', 'traceId')}: ${run.sourceTraceId || '-'}`;
  }

  if (!rowsEl) return;
  rowsEl.innerHTML = '';
  if (!evidences.length) {
    state.selectedCityPackRunEvidenceId = null;
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = t('ui.desc.cityPack.runDetail.noEvidence', 'この実行には証跡がありません。');
    tr.appendChild(td);
    rowsEl.appendChild(tr);
    return;
  }

  state.selectedCityPackRunEvidenceId = evidences[0] && evidences[0].evidenceId ? String(evidences[0].evidenceId) : null;
  evidences.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    if (index === 0) tr.classList.add('row-active');
    const cells = [
      item && item.evidenceId ? String(item.evidenceId) : '-',
      item && item.result ? String(item.result) : '-',
      item && item.checkedAt ? String(item.checkedAt) : '-',
      item && item.statusCode != null ? String(item.statusCode) : '-'
    ];
    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    const actionTd = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn city-pack-action-btn';
    button.textContent = t('ui.label.cityPack.runDetail.openEvidence', '証跡を開く');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const evidenceId = item && item.evidenceId ? String(item.evidenceId) : '';
      if (!evidenceId) return;
      state.selectedCityPackRunEvidenceId = evidenceId;
      rowsEl.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      void loadCityPackEvidence(evidenceId);
    });
    actionTd.appendChild(button);
    tr.appendChild(actionTd);
    tr.addEventListener('click', () => {
      const evidenceId = item && item.evidenceId ? String(item.evidenceId) : '';
      if (!evidenceId) return;
      state.selectedCityPackRunEvidenceId = evidenceId;
      rowsEl.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      void loadCityPackEvidence(evidenceId);
    });
    rowsEl.appendChild(tr);
  });
}

async function loadCityPackAuditRunDetail(runId) {
  if (!runId) return;
  state.selectedCityPackRunId = runId;
  const trace = ensureTraceInput('monitor-trace');
  const limit = getCityPackRunDetailLimit();
  try {
    const query = new URLSearchParams({ limit: String(limit) });
    const res = await fetch(`/api/admin/city-pack-source-audit/runs/${encodeURIComponent(runId)}?${query.toString()}`, {
      headers: buildHeaders({}, trace)
    });
    const data = await res.json();
    if (data && data.ok && data.run && data.run.sourceTraceId) {
      state.selectedCityPackRunTraceId = data.run.sourceTraceId;
    }
    renderCityPackRunDetail(data);
    if (data && data.ok && Array.isArray(data.evidences) && data.evidences.length) {
      const firstEvidenceId = data.evidences[0] && data.evidences[0].evidenceId ? String(data.evidences[0].evidenceId) : '';
      if (firstEvidenceId) {
        state.selectedCityPackRunEvidenceId = firstEvidenceId;
        await loadCityPackEvidence(firstEvidenceId);
      }
    }
  } catch (_err) {
    renderCityPackRunDetail({ ok: false, error: 'fetch error' });
  }
}

function renderCityPackEvidence(payload) {
  const summaryEl = document.getElementById('city-pack-evidence-summary');
  const screenshotsEl = document.getElementById('city-pack-evidence-screenshots');
  const httpEl = document.getElementById('city-pack-evidence-http');
  const diffEl = document.getElementById('city-pack-evidence-diff');
  const impactedEl = document.getElementById('city-pack-evidence-impacted');
  const evidence = payload && payload.evidence ? payload.evidence : null;
  if (!evidence) {
    if (summaryEl) summaryEl.textContent = t('ui.desc.cityPack.evidence.empty', 'Inboxの行を選択すると証跡を表示します。');
    if (screenshotsEl) screenshotsEl.textContent = '-';
    if (httpEl) httpEl.textContent = '-';
    if (diffEl) diffEl.textContent = '-';
    if (impactedEl) impactedEl.textContent = '-';
    return;
  }

  const previous = payload.previousEvidence || null;
  const sourceRef = payload.sourceRef || null;
  const impacted = Array.isArray(payload.impactedCityPacks) ? payload.impactedCityPacks : [];

  if (summaryEl) {
    summaryEl.textContent = `${sourceRef && sourceRef.url ? sourceRef.url : '-'} / ${evidence.result || '-'}`;
  }
  if (screenshotsEl) {
    const currentShots = Array.isArray(evidence.screenshotPaths) ? evidence.screenshotPaths : [];
    const previousShots = previous && Array.isArray(previous.screenshotPaths) ? previous.screenshotPaths : [];
    screenshotsEl.textContent = [
      `${t('ui.label.cityPack.evidence.current', '今回')}: ${currentShots.join(', ') || '-'}`,
      `${t('ui.label.cityPack.evidence.previous', '前回')}: ${previousShots.join(', ') || '-'}`
    ].join('\n');
  }
  if (httpEl) {
    httpEl.textContent = JSON.stringify({
      result: evidence.result || null,
      statusCode: evidence.statusCode || null,
      finalUrl: evidence.finalUrl || null,
      checkedAt: evidence.checkedAt || null
    }, null, 2);
  }
  if (diffEl) {
    diffEl.textContent = evidence.diffSummary || t('ui.desc.cityPack.evidence.noDiff', '差分要約なし');
  }
  if (impactedEl) {
    impactedEl.textContent = impacted.length
      ? impacted.map((item) => `${item.name || item.cityPackId} (${item.status || '-'})`).join('\n')
      : t('ui.desc.cityPack.evidence.noImpacted', '影響するCity Packはありません');
  }
}

function createCityPackActionButton(action, label, row) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn city-pack-action-btn';
  btn.textContent = label;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    void runCityPackSourceAction(action, row);
  });
  return btn;
}

function renderCityPackSourcePolicy(row) {
  const sourceRefIdEl = document.getElementById('city-pack-source-policy-source-ref-id');
  const sourceTypeEl = document.getElementById('city-pack-source-type');
  const requiredLevelEl = document.getElementById('city-pack-required-level');
  const authorityLevelEl = document.getElementById('city-pack-authority-level');
  if (sourceRefIdEl) {
    sourceRefIdEl.textContent = row && row.sourceRefId ? String(row.sourceRefId) : '-';
  }
  if (sourceTypeEl) {
    sourceTypeEl.value = row && row.sourceType ? String(row.sourceType) : 'other';
  }
  if (requiredLevelEl) {
    requiredLevelEl.value = row && row.requiredLevel ? String(row.requiredLevel) : 'required';
  }
  if (authorityLevelEl) {
    authorityLevelEl.value = row && row.authorityLevel ? String(row.authorityLevel) : 'other';
  }
}

function renderCityPackInboxRows(items) {
  const tbody = document.getElementById('city-pack-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 14;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    renderCityPackEvidence(null);
    renderCityPackSourcePolicy(null);
    return;
  }

  items.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    const priorityLevel = row && row.priorityLevel ? String(row.priorityLevel) : 'LOW';
    if (row.recommendation === 'Retire') tr.classList.add('row-health-danger');
    if (row.recommendation === 'Confirm') tr.classList.add('row-health-warn');
    if (row.recommendation === 'ManualOnly') tr.classList.add('row-health-ok');
    if (priorityLevel === 'HIGH') tr.classList.add('row-health-danger');
    else if (priorityLevel === 'MEDIUM') tr.classList.add('row-health-warn');
    else tr.classList.add('row-health-ok');
    const priorityTd = document.createElement('td');
    priorityTd.textContent = `${row.priorityLevel || '-'}(${Number.isFinite(Number(row.priorityScore)) ? Number(row.priorityScore) : '-'})`;
    tr.appendChild(priorityTd);

    const sourceTd = document.createElement('td');
    sourceTd.textContent = row.source || '-';
    tr.appendChild(sourceTd);

    const sourceTypeTd = document.createElement('td');
    sourceTypeTd.textContent = row.sourceType || '-';
    tr.appendChild(sourceTypeTd);

    const authorityLevelTd = document.createElement('td');
    authorityLevelTd.textContent = row.authorityLevel || 'other';
    tr.appendChild(authorityLevelTd);

    const requiredLevelTd = document.createElement('td');
    requiredLevelTd.textContent = row.requiredLevel || '-';
    tr.appendChild(requiredLevelTd);

    const usedByClassTd = document.createElement('td');
    usedByClassTd.textContent = Array.isArray(row.usedByPackClasses) && row.usedByPackClasses.length ? row.usedByPackClasses.join(' / ') : '-';
    tr.appendChild(usedByClassTd);

    const usedByLanguageTd = document.createElement('td');
    usedByLanguageTd.textContent = Array.isArray(row.usedByLanguages) && row.usedByLanguages.length ? row.usedByLanguages.join(' / ') : '-';
    tr.appendChild(usedByLanguageTd);

    const confidenceTd = document.createElement('td');
    confidenceTd.textContent = Number.isFinite(Number(row.confidenceScore)) ? `${Number(row.confidenceScore)}/100` : '-';
    tr.appendChild(confidenceTd);

    const stageTd = document.createElement('td');
    stageTd.textContent = row.lastAuditStage || '-';
    tr.appendChild(stageTd);

    const resultTd = document.createElement('td');
    resultTd.textContent = row.result || '-';
    tr.appendChild(resultTd);

    const validUntilTd = document.createElement('td');
    validUntilTd.textContent = toDateLabel(row.validUntil);
    tr.appendChild(validUntilTd);

    const usedByTd = document.createElement('td');
    usedByTd.textContent = Array.isArray(row.usedBy) && row.usedBy.length ? row.usedBy.join(' / ') : '-';
    tr.appendChild(usedByTd);

    const evidenceTd = document.createElement('td');
    evidenceTd.textContent = row.evidenceLatestId || '-';
    tr.appendChild(evidenceTd);

    const actionTd = document.createElement('td');
    const actions = [
      { key: 'confirm', label: t('ui.label.cityPack.action.confirm', 'Confirm') },
      { key: 'retire', label: t('ui.label.cityPack.action.retire', 'Retire') },
      { key: 'replace', label: t('ui.label.cityPack.action.replace', 'Replace') },
      { key: 'manual-only', label: t('ui.label.cityPack.action.manualOnly', 'ManualOnly') }
    ];
    actions.forEach((action) => {
      actionTd.appendChild(createCityPackActionButton(action.key, action.label, row));
    });
    tr.appendChild(actionTd);

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      state.selectedCityPackSourceRefId = row.sourceRefId || null;
      renderCityPackSourcePolicy(row);
      if (row.evidenceLatestId) {
        void loadCityPackEvidence(row.evidenceLatestId);
      } else {
        renderCityPackEvidence(null);
      }
      const safeStep = document.getElementById('city-pack-safe-step');
      if (safeStep) {
        safeStep.textContent = `${t('ui.desc.cityPack.safeStepPrefix', '次にやる安全な一手')}: ${row.recommendation || '-'}`;
      }
    });

    tbody.appendChild(tr);
  });
}

function parseCityPackCompositionLimit() {
  const el = document.getElementById('city-pack-composition-limit');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.min(Math.floor(value), 200);
}

function readCityPackCompositionRegionKey() {
  const el = document.getElementById('city-pack-composition-region-key');
  const value = el && typeof el.value === 'string' ? el.value.trim() : '';
  return value || null;
}

function readCityPackCompositionLanguage() {
  const el = document.getElementById('city-pack-composition-language');
  const value = el && typeof el.value === 'string' ? el.value.trim().toLowerCase() : '';
  return value || 'ja';
}

function renderCityPackCompositionDiagnostics() {
  const readinessEl = document.getElementById('city-pack-composition-readiness');
  const fallbackEl = document.getElementById('city-pack-composition-fallback');

  if (readinessEl) {
    const status = state.productReadiness && state.productReadiness.status
      ? String(state.productReadiness.status)
      : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    const blockers = Array.isArray(state.productReadiness && state.productReadiness.blockers)
      ? state.productReadiness.blockers.length
      : 0;
    readinessEl.textContent = `${t('ui.label.cityPack.composition.readiness', 'Readiness')}: ${status} / blockers=${blockers}`;
  }

  if (fallbackEl) {
    const rows = Array.isArray(state.readPathFallbackSummary) ? state.readPathFallbackSummary : [];
    const total = rows.reduce((sum, row) => {
      const count = Number.isFinite(Number(row && row.count)) ? Number(row.count) : 0;
      return sum + count;
    }, 0);
    const blocked = rows.reduce((sum, row) => {
      const count = Number.isFinite(Number(row && row.fallbackBlockedCount)) ? Number(row.fallbackBlockedCount) : 0;
      return sum + count;
    }, 0);
    if (!rows.length) {
      fallbackEl.textContent = `${t('ui.label.cityPack.composition.fallback', 'Fallback summary')}: ${t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE')}`;
      return;
    }
    fallbackEl.textContent = `${t('ui.label.cityPack.composition.fallback', 'Fallback summary')}: total=${total} / blocked=${blocked}`;
  }
}

function renderCityPackComposition(items, summary) {
  const tbody = document.getElementById('city-pack-composition-rows');
  const summaryEl = document.getElementById('city-pack-composition-summary');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'cell-muted';
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (summaryEl) {
      summaryEl.textContent = t('ui.desc.cityPack.compositionEmpty', 'Compositionに一致する候補はありません。');
    }
    renderCityPackCompositionDiagnostics();
    return;
  }

  rows.forEach((item) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    const cols = [
      item && item.packClass ? String(item.packClass) : '-',
      item && item.language ? String(item.language) : 'ja',
      item && item.nationwidePolicy ? String(item.nationwidePolicy) : '-',
      item && item.reason ? String(item.reason) : '-',
      item && item.name ? String(item.name) : '-',
      item && item.cityPackId ? String(item.cityPackId) : '-',
      formatDateLabel(item && item.updatedAt)
    ];
    cols.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => {
      const packId = item && item.cityPackId ? String(item.cityPackId) : '';
      if (!packId) return;
      const exportInput = document.getElementById('city-pack-template-export-pack-id');
      if (exportInput) exportInput.value = packId;
      const structurePackId = document.getElementById('city-pack-structure-pack-id');
      if (structurePackId) structurePackId.textContent = packId;
    });
    tbody.appendChild(tr);
  });

  if (summaryEl) {
    const safe = summary && typeof summary === 'object' ? summary : {};
    const total = Number.isFinite(Number(safe.total)) ? Number(safe.total) : rows.length;
    const regional = Number.isFinite(Number(safe.regional)) ? Number(safe.regional) : 0;
    const nationwide = Number.isFinite(Number(safe.nationwide)) ? Number(safe.nationwide) : 0;
    summaryEl.textContent = `${t('ui.label.cityPack.composition.summary', '候補')}: total=${total} / regional=${regional} / nationwide=${nationwide}`;
  }
  renderCityPackCompositionDiagnostics();
}

function createCityPackRequestActionButton(action, label, row) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn city-pack-action-btn';
  btn.textContent = label;
  btn.setAttribute('data-role', 'admin');
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    void runCityPackRequestAction(action, row);
  });
  return btn;
}

function renderCityPackRequestRows(items) {
  const tbody = document.getElementById('city-pack-request-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 11;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    renderCityPackRequestDetail(null);
    return;
  }

  items.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    if (row.status === 'failed') tr.classList.add('row-health-danger');
    else if (row.status === 'needs_review') tr.classList.add('row-health-warn');
    else if (row.status === 'approved' || row.status === 'active') tr.classList.add('row-health-ok');

    const regionLabel = [row.regionCity, row.regionState].filter(Boolean).join(', ') || row.regionKey || '-';
    const draftCount = Array.isArray(row.draftCityPackIds) ? row.draftCityPackIds.length : 0;

    const cells = [
      row.status || '-',
      regionLabel,
      row.requestClass || 'regional',
      row.requestedLanguage || 'ja',
      row.requestId || '-',
      row.experienceStage || '-',
      draftCount ? String(draftCount) : '-',
      Number.isFinite(Number(row.warningCount)) ? String(Number(row.warningCount)) : '-',
      Number.isFinite(Number(row.agingHours)) ? String(Number(row.agingHours)) : '-',
      row.traceId || '-'
    ];
    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    const actions = [
      { key: 'approve', label: t('ui.label.cityPack.request.action.approve', 'Approve') },
      { key: 'reject', label: t('ui.label.cityPack.request.action.reject', 'Reject') },
      { key: 'request-changes', label: t('ui.label.cityPack.request.action.request-changes', 'Request changes') },
      { key: 'retry-job', label: t('ui.label.cityPack.request.action.retry-job', 'Retry job') },
      { key: 'activate', label: t('ui.label.cityPack.request.action.activate', 'Activate') }
    ];
    actions.forEach((action) => {
      actionTd.appendChild(createCityPackRequestActionButton(action.key, action.label, row));
    });
    tr.appendChild(actionTd);

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      state.selectedCityPackRequestId = row.requestId || null;
      void loadCityPackRequestDetail(row.requestId);
    });

    tbody.appendChild(tr);
  });
}

function renderCityPackFeedbackRows(items) {
  const tbody = document.getElementById('city-pack-feedback-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    renderCityPackFeedbackDetail(null);
    return;
  }
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const regionLabel = [row.regionCity, row.regionState].filter(Boolean).join(', ') || row.regionKey || '-';
    const feedbackText = row.message || row.feedbackText || '-';
    const cells = [
      row.status || '-',
      regionLabel,
      row.packClass || 'regional',
      row.language || 'ja',
      row.slotKey || '-',
      feedbackText,
      row.resolution || '-',
      row.traceId || '-'
    ];
    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    const actions = [
      { key: 'triage', label: t('ui.label.cityPack.feedback.action.triage', 'Triage') },
      { key: 'resolve', label: t('ui.label.cityPack.feedback.action.resolve', 'Resolve') },
      { key: 'reject', label: t('ui.label.cityPack.feedback.action.reject', 'Reject') },
      { key: 'propose', label: t('ui.label.cityPack.feedback.action.propose', 'Propose') }
    ];
    actions.forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = action.label;
      btn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        void runCityPackFeedbackAction(action.key, row);
      });
      actionTd.appendChild(btn);
    });
    tr.appendChild(actionTd);

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      state.selectedCityPackFeedbackId = row.feedbackId || null;
      renderCityPackFeedbackDetail(row);
    });

    tbody.appendChild(tr);
  });
}

function renderCityPackRequestDetail(payload) {
  const summaryEl = document.getElementById('city-pack-request-summary');
  const rawEl = document.getElementById('city-pack-request-raw');
  const packIdEl = document.getElementById('city-pack-structure-pack-id');
  const basePackEl = document.getElementById('city-pack-structure-base-pack-id');
  const targetingEl = document.getElementById('city-pack-structure-targeting');
  const slotsEl = document.getElementById('city-pack-structure-slots');
  const data = payload && typeof payload === 'object' ? payload : null;
  const req = data && data.request ? data.request : null;
  const draftPack = data && Array.isArray(data.draftCityPacks) ? (data.draftCityPacks[0] || null) : null;
  if (!req) {
    if (summaryEl) summaryEl.textContent = t('ui.desc.cityPack.requestDetailEmpty', 'Requestの行を選択すると詳細を表示します。');
    if (rawEl) rawEl.textContent = '-';
    if (packIdEl) packIdEl.textContent = '-';
    if (basePackEl) basePackEl.value = '';
    if (targetingEl) targetingEl.value = '[]';
    if (slotsEl) slotsEl.value = '[]';
    state.selectedCityPackDraftId = null;
    return;
  }
  state.selectedCityPackRequestId = req.requestId || req.id || null;
  state.selectedCityPackDraftId = draftPack && draftPack.id ? draftPack.id : null;
  const region = [req.regionCity, req.regionState].filter(Boolean).join(', ') || req.regionKey || '-';
  const drafts = Array.isArray(req.draftCityPackIds) ? req.draftCityPackIds.length : 0;
  const linkDrafts = Array.isArray(req.draftLinkRegistryIds) ? req.draftLinkRegistryIds.length : 0;
  const stage = req.experienceStage || '-';
  const error = req.error ? ` / ${req.error}` : '';
  if (summaryEl) summaryEl.textContent = `status=${req.status || '-'} / stage=${stage} / region=${region} / class=${req.requestClass || 'regional'} / language=${req.requestedLanguage || 'ja'} / drafts=${drafts} / links=${linkDrafts} / traceId=${req.traceId || '-'}${error}`;
  if (rawEl) rawEl.textContent = JSON.stringify(payload, null, 2);
  if (packIdEl) packIdEl.textContent = state.selectedCityPackDraftId || '-';
  if (basePackEl) {
    const basePackId = draftPack && typeof draftPack.basePackId === 'string' ? draftPack.basePackId : '';
    basePackEl.value = basePackId;
  }
  if (targetingEl) {
    const targeting = draftPack && Array.isArray(draftPack.targetingRules) ? draftPack.targetingRules : [];
    targetingEl.value = JSON.stringify(targeting, null, 2);
  }
  if (slotsEl) {
    const slots = draftPack && Array.isArray(draftPack.slots) ? draftPack.slots : [];
    slotsEl.value = JSON.stringify(slots, null, 2);
  }
}

function renderCityPackFeedbackDetail(item) {
  const summaryEl = document.getElementById('city-pack-feedback-summary');
  const rawEl = document.getElementById('city-pack-feedback-raw');
  if (!item) {
    if (summaryEl) summaryEl.textContent = t('ui.desc.cityPack.feedbackDetailEmpty', 'Feedbackの行を選択すると詳細を表示します。');
    if (rawEl) rawEl.textContent = '-';
    state.selectedCityPackFeedbackId = null;
    return;
  }
  const region = [item.regionCity, item.regionState].filter(Boolean).join(', ') || item.regionKey || '-';
  const slotKey = item.slotKey || '-';
  const resolution = item.resolution || '-';
  if (summaryEl) summaryEl.textContent = `status=${item.status || '-'} / region=${region} / class=${item.packClass || 'regional'} / language=${item.language || 'ja'} / slot=${slotKey} / resolution=${resolution} / traceId=${item.traceId || '-'}`;
  if (rawEl) rawEl.textContent = JSON.stringify(item, null, 2);
}

function renderCityPackBulletinDetail(item) {
  const summaryEl = document.getElementById('city-pack-bulletin-detail-summary');
  const rawEl = document.getElementById('city-pack-bulletin-raw');
  if (!item) {
    if (summaryEl) summaryEl.textContent = t('ui.desc.cityPack.bulletinDetailEmpty', 'Bulletinの行を選択すると詳細を表示します。');
    if (rawEl) rawEl.textContent = '-';
    state.selectedCityPackBulletinId = null;
    return;
  }
  const summary = item.summary ? String(item.summary) : '-';
  if (summaryEl) {
    summaryEl.textContent = `status=${item.status || '-'} / cityPackId=${item.cityPackId || '-'} / notificationId=${item.notificationId || '-'} / summary=${summary} / traceId=${item.traceId || '-'}`;
  }
  if (rawEl) rawEl.textContent = JSON.stringify(item, null, 2);
}

function renderCityPackProposalDetail(item) {
  const summaryEl = document.getElementById('city-pack-proposal-detail-summary');
  const rawEl = document.getElementById('city-pack-proposal-raw');
  if (!item) {
    if (summaryEl) summaryEl.textContent = t('ui.desc.cityPack.proposalDetailEmpty', 'Proposalの行を選択すると詳細を表示します。');
    if (rawEl) rawEl.textContent = '-';
    state.selectedCityPackProposalId = null;
    return;
  }
  const summary = item.summary ? String(item.summary) : '-';
  if (summaryEl) {
    summaryEl.textContent = `status=${item.status || '-'} / cityPackId=${item.cityPackId || '-'} / summary=${summary} / traceId=${item.traceId || '-'}`;
  }
  if (rawEl) rawEl.textContent = JSON.stringify(item, null, 2);
}

function renderCityPackTemplateLibraryDetail(item) {
  const summaryEl = document.getElementById('city-pack-template-library-detail-summary');
  const rawEl = document.getElementById('city-pack-template-library-raw');
  if (!item) {
    if (summaryEl) summaryEl.textContent = t('ui.desc.cityPack.templateLibraryDetailEmpty', 'Templateの行を選択すると詳細を表示します。');
    if (rawEl) rawEl.textContent = '-';
    state.selectedCityPackTemplateLibraryId = null;
    return;
  }
  if (summaryEl) {
    summaryEl.textContent = `status=${item.status || '-'} / name=${item.name || '-'} / traceId=${item.traceId || '-'} / source=${item.source || '-'}`;
  }
  if (rawEl) rawEl.textContent = JSON.stringify(item, null, 2);
}

function createCityPackTemplateLibraryActionButton(action, label, row) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn city-pack-action-btn';
  btn.textContent = label;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    void runCityPackTemplateLibraryAction(action, row);
  });
  return btn;
}

function renderCityPackTemplateLibraryRows(items) {
  const tbody = document.getElementById('city-pack-template-library-rows');
  const summaryEl = document.getElementById('city-pack-template-library-summary');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = Array.isArray(items) ? items : [];
  if (summaryEl) {
    summaryEl.textContent = rows.length
      ? `${t('ui.label.cityPack.templateLibrary.summary', 'Template件数')}: ${rows.length}`
      : t('ui.desc.cityPack.templateLibrarySummaryEmpty', 'Templateがありません。');
  }
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    renderCityPackTemplateLibraryDetail(null);
    return;
  }
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    const cells = [
      row.status || '-',
      row.name || '-',
      row.schemaVersion || '-',
      row.source || '-',
      row.traceId || '-'
    ];
    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    const actionTd = document.createElement('td');
    const actions = [
      { key: 'activate', label: t('ui.label.cityPack.templateLibrary.action.activate', '有効化') },
      { key: 'retire', label: t('ui.label.cityPack.templateLibrary.action.retire', '廃止') }
    ];
    actions.forEach((action) => {
      actionTd.appendChild(createCityPackTemplateLibraryActionButton(action.key, action.label, row));
    });
    tr.appendChild(actionTd);

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      state.selectedCityPackTemplateLibraryId = row.id || null;
      renderCityPackTemplateLibraryDetail(row);
      const templateInput = document.getElementById('city-pack-template-json');
      if (templateInput) {
        const template = row.template && typeof row.template === 'object' ? row.template : {};
        templateInput.value = JSON.stringify(template, null, 2);
      }
    });
    tbody.appendChild(tr);
  });
}

function createCityPackBulletinActionButton(action, label, row) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn city-pack-action-btn';
  btn.textContent = label;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    void runCityPackBulletinAction(action, row);
  });
  return btn;
}

function createCityPackProposalActionButton(action, label, row) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn city-pack-action-btn';
  btn.textContent = label;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    void runCityPackProposalAction(action, row);
  });
  return btn;
}

function renderCityPackBulletinRows(items) {
  const tbody = document.getElementById('city-pack-bulletin-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    renderCityPackBulletinDetail(null);
    return;
  }

  items.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    const cells = [
      row.status || '-',
      row.cityPackId || '-',
      row.notificationId || '-',
      row.summary || '-',
      row.traceId || '-'
    ];
    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    const actions = [
      { key: 'approve', label: t('ui.label.cityPack.bulletin.action.approve', 'Approve') },
      { key: 'reject', label: t('ui.label.cityPack.bulletin.action.reject', 'Reject') },
      { key: 'send', label: t('ui.label.cityPack.bulletin.action.send', 'Send') }
    ];
    actions.forEach((action) => {
      actionTd.appendChild(createCityPackBulletinActionButton(action.key, action.label, row));
    });
    tr.appendChild(actionTd);

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      state.selectedCityPackBulletinId = row.bulletinId || row.id || null;
      renderCityPackBulletinDetail(row);
    });

    tbody.appendChild(tr);
  });
}

function renderCityPackProposalRows(items) {
  const tbody = document.getElementById('city-pack-proposal-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    renderCityPackProposalDetail(null);
    return;
  }

  items.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    const cells = [
      row.status || '-',
      row.cityPackId || '-',
      row.summary || '-',
      row.traceId || '-'
    ];
    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    const actions = [
      { key: 'approve', label: t('ui.label.cityPack.proposal.action.approve', 'Approve') },
      { key: 'reject', label: t('ui.label.cityPack.proposal.action.reject', 'Reject') },
      { key: 'apply', label: t('ui.label.cityPack.proposal.action.apply', 'Apply') }
    ];
    actions.forEach((action) => {
      actionTd.appendChild(createCityPackProposalActionButton(action.key, action.label, row));
    });
    tr.appendChild(actionTd);

    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      state.selectedCityPackProposalId = row.proposalId || row.id || null;
      renderCityPackProposalDetail(row);
    });

    tbody.appendChild(tr);
  });
}

function renderErrors(summary) {
  const summaryEl = document.getElementById('errors-summary');
  const problemsEl = document.getElementById('errors-problems');
  const recommendEl = document.getElementById('errors-recommend');
  if (summaryEl) summaryEl.textContent = JSON.stringify(summary || {}, null, 2);

  const warnLinks = Array.isArray(summary && summary.warnLinks) ? summary.warnLinks : [];
  const retryQueue = Array.isArray(summary && summary.retryQueuePending) ? summary.retryQueuePending : [];
  const total = warnLinks.length + retryQueue.length;
  if (problemsEl) problemsEl.textContent = String(total);
  if (recommendEl) {
    if (warnLinks.length > 0) recommendEl.textContent = t('ui.desc.errors.recommendWarn', '危険リンクを差し替え');
    else if (retryQueue.length > 0) recommendEl.textContent = t('ui.desc.errors.recommendRetry', '再送待ちを確認');
    else recommendEl.textContent = t('ui.desc.errors.recommendNone', '問題なし');
  }

  const warnRows = document.getElementById('errors-warn-rows');
  if (warnRows) {
    warnRows.innerHTML = '';
    if (!warnLinks.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = t('ui.label.common.empty', 'データなし');
      tr.appendChild(td);
      warnRows.appendChild(tr);
    } else {
      warnLinks.forEach((item) => {
        const tr = document.createElement('tr');
        [item.id, item.title, item.url, item.checkedAt].forEach((value) => {
          const td = document.createElement('td');
          td.textContent = value || '-';
          tr.appendChild(td);
        });
        warnRows.appendChild(tr);
      });
    }
  }

  const retryRows = document.getElementById('errors-retry-rows');
  if (retryRows) {
    retryRows.innerHTML = '';
    if (!retryQueue.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = t('ui.label.common.empty', 'データなし');
      tr.appendChild(td);
      retryRows.appendChild(tr);
    } else {
      retryQueue.forEach((item) => {
        const tr = document.createElement('tr');
        [item.id, item.lineUserId, item.templateKey, item.lastError, item.updatedAt || item.createdAt].forEach((value) => {
          const td = document.createElement('td');
          td.textContent = value || '-';
          tr.appendChild(td);
        });
        retryRows.appendChild(tr);
      });
    }
  }

  const safeStepEl = document.getElementById('errors-safe-step');
  if (warnLinks.length > 0) {
    renderSafeNextStep(safeStepEl, t('ui.desc.errors.safeStepWarn', '次にやる安全な1手: 危険リンク一覧を開いてリンク先を確認する'));
  } else if (retryQueue.length > 0) {
    renderSafeNextStep(safeStepEl, t('ui.desc.errors.safeStepRetry', '次にやる安全な1手: 再送待ち一覧を開いて最新エラーを確認する'));
  } else {
    renderSafeNextStep(safeStepEl, t('ui.desc.errors.safeStepNone', '次にやる安全な1手: 更新を押して異常がないことを再確認する'));
  }
}

async function loadMonitorData(options) {
  const notify = options && options.notify;
  const limit = document.getElementById('monitor-limit');
  const status = document.getElementById('monitor-status');
  const scenario = document.getElementById('monitor-scenario');
  const step = document.getElementById('monitor-step');
  const traceId = ensureTraceInput('monitor-trace');
  const params = new URLSearchParams();
  if (limit && limit.value) params.set('limit', limit.value);
  if (status && status.value) params.set('status', status.value);
  if (scenario && scenario.value) params.set('scenarioKey', scenario.value);
  if (step && step.value) params.set('stepKey', step.value);

  const skeleton = document.getElementById('monitor-skeleton');
  if (skeleton) skeleton.classList.remove('is-hidden');
  try {
    const res = await fetch(`/admin/read-model/notifications?${params.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    state.monitorItems = data && data.items ? data.items : [];
    renderMonitorRows(state.monitorItems);

    const causes = computeTopCauses(state.monitorItems);
    state.topCauses = causes.text;
    state.topCausesTip = causes.tip;
    state.topAnomaly = computeTopAnomaly(state.monitorItems);
    setPaneUpdatedAt('monitor');
    const counts = getHealthCounts(state.monitorItems);
    const monitorTodo = document.getElementById('monitor-todo');
    if (monitorTodo) monitorTodo.textContent = String(counts.DANGER || 0);
    updateTopBar();
    renderComposerScenarioCompare(state.monitorItems);
    renderAllDecisionCards();

    if (notify) showToast(data && data.ok ? t('ui.toast.monitor.ok', 'monitor OK') : t('ui.toast.monitor.fail', 'monitor 失敗'), data && data.ok ? 'ok' : 'danger');
  } catch (_err) {
    if (notify) showToast(t('ui.toast.monitor.fail', 'monitor 失敗'), 'danger');
  } finally {
    if (skeleton) skeleton.classList.add('is-hidden');
  }
}

async function loadReadModelData(options) {
  const notify = options && options.notify;
  const traceId = ensureTraceInput('read-model-trace');
  const skeleton = document.getElementById('read-model-skeleton');
  if (skeleton) skeleton.classList.remove('is-hidden');
  try {
    const res = await fetch('/admin/read-model/notifications?limit=50', { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    state.readModelItems = data && data.items ? data.items : [];
    renderReadModelRows(state.readModelItems);
    renderComposerScenarioCompare(state.readModelItems);
    setPaneUpdatedAt('read-model');
    renderAllDecisionCards();
    if (notify) showToast(data && data.ok ? t('ui.toast.readModel.ok', 'read model OK') : t('ui.toast.readModel.fail', 'read model 失敗'), data && data.ok ? 'ok' : 'danger');
  } catch (_err) {
    if (notify) showToast(t('ui.toast.readModel.fail', 'read model 失敗'), 'danger');
  } finally {
    if (skeleton) skeleton.classList.add('is-hidden');
  }
}

function normalizeUsersSummaryLimit(value, fallbackValue, maxValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallbackValue;
  return Math.min(Math.floor(parsed), maxValue);
}

function mapUsersSummaryItem(item) {
  const row = item && typeof item === 'object' ? item : {};
  const scenarioKey = typeof row.scenarioKey === 'string' ? row.scenarioKey : '';
  const stepKey = typeof row.stepKey === 'string' ? row.stepKey : '';
  const householdType = normalizeHouseholdType(row.householdType);
  const journeyStage = normalizeJourneyStage(row.journeyStage);
  const todoOpenCount = Number(row.todoOpenCount);
  const todoOverdueCount = Number(row.todoOverdueCount);
  const deliveryCount = Number(row.deliveryCount);
  const clickCount = Number(row.clickCount);
  const llmUsage = Number(row.llmUsage);
  const llmTokenUsed = Number(row.llmTokenUsed);
  const llmBlockedCount = Number(row.llmBlockedCount);
  const llmUsageToday = Number(row.llmUsageToday);
  const llmTokenUsedToday = Number(row.llmTokenUsedToday);
  const llmBlockedToday = Number(row.llmBlockedToday);
  const llmBlockedRate = Number(row.llmBlockedRate);
  const todoProgressRate = Number(row.todoProgressRate);
  const taskCompletionRate = Number(row.taskCompletionRate);
  const dependencyBlockRate = Number(row.dependencyBlockRate);
  const plan = normalizeBillingPlan(row.plan);
  const subscriptionStatus = normalizeSubscriptionStatus(row.subscriptionStatus);
  const billingIntegrityState = typeof row.billingIntegrityState === 'string' && row.billingIntegrityState.trim()
    ? row.billingIntegrityState.trim().toLowerCase()
    : 'unknown';
  const mapped = {
    lineUserId: typeof row.lineUserId === 'string' ? row.lineUserId : '',
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    memberNumber: typeof row.memberNumber === 'string' ? row.memberNumber : '',
    scenarioKey,
    stepKey,
    category: normalizeUserCategory(scenarioKey),
    categoryLabel: userCategoryLabel(scenarioKey),
    statusLabel: resolveUserStatus(stepKey),
    householdType,
    householdTypeLabel: householdTypeLabel(householdType),
    journeyStage,
    journeyStageLabel: journeyStageLabel(journeyStage),
    plan,
    planLabel: planLabel(plan),
    subscriptionStatus,
    subscriptionStatusLabel: subscriptionStatusLabel(subscriptionStatus),
    currentPeriodEnd: row.currentPeriodEnd || null,
    subscriptionUpdatedAt: row.subscriptionUpdatedAt || null,
    lastStripeEventId: typeof row.lastStripeEventId === 'string' ? row.lastStripeEventId : '',
    nextTodoDueAt: row.nextTodoDueAt || null,
    todoOpenCount: Number.isFinite(todoOpenCount) ? todoOpenCount : 0,
    todoOverdueCount: Number.isFinite(todoOverdueCount) ? todoOverdueCount : 0,
    todoProgressRate: Number.isFinite(todoProgressRate) ? todoProgressRate : 0,
    taskCompletionRate: Number.isFinite(taskCompletionRate) ? taskCompletionRate : 0,
    dependencyBlockRate: Number.isFinite(dependencyBlockRate) ? dependencyBlockRate : 0,
    llmUsage: Number.isFinite(llmUsage) ? llmUsage : 0,
    llmTokenUsed: Number.isFinite(llmTokenUsed) ? llmTokenUsed : 0,
    llmBlockedCount: Number.isFinite(llmBlockedCount) ? llmBlockedCount : 0,
    llmUsageToday: Number.isFinite(llmUsageToday) ? llmUsageToday : 0,
    llmTokenUsedToday: Number.isFinite(llmTokenUsedToday) ? llmTokenUsedToday : 0,
    llmBlockedToday: Number.isFinite(llmBlockedToday) ? llmBlockedToday : 0,
    llmBlockedRate: Number.isFinite(llmBlockedRate) ? llmBlockedRate : 0,
    billingIntegrityState,
    deliveryCount: Number.isFinite(deliveryCount) ? deliveryCount : 0,
    clickCount: Number.isFinite(clickCount) ? clickCount : 0,
    reactionRate: resolveUserReactionRate(row)
  };
  return mapped;
}

function applyUsersSummaryFilters() {
  const userIdKeyword = (document.getElementById('users-filter-line-user-id')?.value || '').trim().toLowerCase();
  const createdFromMs = parseDateInputMs(document.getElementById('users-filter-created-from')?.value || '', false);
  const createdToMs = parseDateInputMs(document.getElementById('users-filter-created-to')?.value || '', true);
  const category = (document.getElementById('users-filter-category')?.value || '').trim().toUpperCase();
  const status = (document.getElementById('users-filter-status')?.value || '').trim();
  const plan = normalizeBillingPlan(document.getElementById('users-filter-plan')?.value || '');
  const rawPlan = (document.getElementById('users-filter-plan')?.value || '').trim().toLowerCase();
  const subscriptionStatus = normalizeSubscriptionStatus(document.getElementById('users-filter-subscription-status')?.value || '');
  const rawSubscriptionStatus = (document.getElementById('users-filter-subscription-status')?.value || '').trim().toLowerCase();
  const billingIntegrity = (document.getElementById('users-filter-billing-integrity')?.value || '').trim().toLowerCase();
  const quickFilter = state.usersSummaryQuickFilter || 'all';
  const filterCore = resolveCoreSlice('filterCore');
  const filtered = filterCore && typeof filterCore.applyAndFilters === 'function'
    ? filterCore.applyAndFilters(state.usersSummaryItems, [
        { type: 'includes', value: userIdKeyword, normalize: { trim: true, lower: true }, getValue: (item) => item && item.lineUserId },
        {
          type: 'predicate',
          value: createdFromMs == null ? '' : String(createdFromMs),
          predicate: (item, needle) => {
            const fromMs = Number(needle);
            if (!Number.isFinite(fromMs) || fromMs <= 0) return true;
            const createdAtMs = toSortMillis(item && item.createdAt);
            return Boolean(createdAtMs && createdAtMs >= fromMs);
          }
        },
        {
          type: 'predicate',
          value: createdToMs == null ? '' : String(createdToMs),
          predicate: (item, needle) => {
            const toMs = Number(needle);
            if (!Number.isFinite(toMs) || toMs <= 0) return true;
            const createdAtMs = toSortMillis(item && item.createdAt);
            return Boolean(createdAtMs && createdAtMs <= toMs);
          }
        },
        { type: 'equals', value: category, normalize: { trim: true, upper: true }, getValue: (item) => item && item.category },
        { type: 'equals', value: status, normalize: { trim: true }, getValue: (item) => item && item.statusLabel },
        { type: 'equals', value: rawPlan, normalize: { trim: true, lower: true }, getValue: (item) => item && item.plan },
        { type: 'equals', value: rawSubscriptionStatus, normalize: { trim: true, lower: true }, getValue: (item) => item && item.subscriptionStatus },
        { type: 'equals', value: billingIntegrity, normalize: { trim: true, lower: true }, getValue: (item) => item && item.billingIntegrityState },
        {
          type: 'predicate',
          value: quickFilter,
          predicate: (item, mode) => {
            if (!mode || mode === 'all') return true;
            const rowPlan = String(item && item.plan ? item.plan : 'free');
            const rowStatus = String(item && item.subscriptionStatus ? item.subscriptionStatus : 'unknown');
            const rowIntegrity = String(item && item.billingIntegrityState ? item.billingIntegrityState : 'unknown');
            if (mode === 'pro_active') return rowPlan === 'pro' && (rowStatus === 'active' || rowStatus === 'trialing');
            if (mode === 'free') return rowPlan === 'free';
            if (mode === 'trialing') return rowStatus === 'trialing';
            if (mode === 'past_due') return rowStatus === 'past_due';
            if (mode === 'canceled') return rowStatus === 'canceled';
            if (mode === 'unknown') return rowStatus === 'unknown' || rowIntegrity === 'unknown' || rowIntegrity === 'conflict';
            return true;
          }
        }
      ])
    : state.usersSummaryItems.filter((item) => {
      const lineUserId = String(item && item.lineUserId ? item.lineUserId : '').toLowerCase();
      if (userIdKeyword && !lineUserId.includes(userIdKeyword)) return false;
      const createdAtMs = toSortMillis(item && item.createdAt);
      if (createdFromMs && (!createdAtMs || createdAtMs < createdFromMs)) return false;
      if (createdToMs && (!createdAtMs || createdAtMs > createdToMs)) return false;
      if (category && String(item && item.category ? item.category : '') !== category) return false;
      if (status && String(item && item.statusLabel ? item.statusLabel : '') !== status) return false;
      if (rawPlan && String(item && item.plan ? item.plan : '') !== plan) return false;
      if (rawSubscriptionStatus && String(item && item.subscriptionStatus ? item.subscriptionStatus : '') !== subscriptionStatus) return false;
      if (billingIntegrity && String(item && item.billingIntegrityState ? item.billingIntegrityState : 'unknown') !== billingIntegrity) return false;
      if (quickFilter === 'pro_active' && !(item && item.plan === 'pro' && (item.subscriptionStatus === 'active' || item.subscriptionStatus === 'trialing'))) return false;
      if (quickFilter === 'free' && !(item && item.plan === 'free')) return false;
      if (quickFilter === 'trialing' && !(item && item.subscriptionStatus === 'trialing')) return false;
      if (quickFilter === 'past_due' && !(item && item.subscriptionStatus === 'past_due')) return false;
      if (quickFilter === 'canceled' && !(item && item.subscriptionStatus === 'canceled')) return false;
      if (quickFilter === 'unknown') {
        const rowStatus = String(item && item.subscriptionStatus ? item.subscriptionStatus : 'unknown');
        const rowIntegrity = String(item && item.billingIntegrityState ? item.billingIntegrityState : 'unknown');
        if (rowStatus !== 'unknown' && rowIntegrity !== 'unknown' && rowIntegrity !== 'conflict') return false;
      }
      return true;
    });
  state.usersSummaryFilteredItems = sortUsersSummaryItems(filtered);
}

function buildUsersSummaryFilterChips() {
  const chips = [];
  const userId = getInputValue('users-filter-line-user-id');
  const createdFrom = getInputValue('users-filter-created-from');
  const createdTo = getInputValue('users-filter-created-to');
  const category = getSelectValue('users-filter-category');
  const status = getSelectValue('users-filter-status');
  const plan = getSelectValue('users-filter-plan');
  const subscriptionStatus = getSelectValue('users-filter-subscription-status');
  const billingIntegrity = getSelectValue('users-filter-billing-integrity');
  const quickFilter = state.usersSummaryQuickFilter || 'all';
  pushFilterChip(chips, 'ユーザーID', userId);
  pushFilterChip(chips, '登録期間 from', createdFrom);
  pushFilterChip(chips, '登録期間 to', createdTo);
  if (category) pushFilterChip(chips, 'カテゴリ', getSelectLabel('users-filter-category'));
  if (status) pushFilterChip(chips, 'ステータス', getSelectLabel('users-filter-status'));
  if (plan) pushFilterChip(chips, 'Plan', getSelectLabel('users-filter-plan'));
  if (subscriptionStatus) pushFilterChip(chips, '課金状態', getSelectLabel('users-filter-subscription-status'));
  if (billingIntegrity) pushFilterChip(chips, '課金整合', getSelectLabel('users-filter-billing-integrity'));
  if (quickFilter !== 'all') pushFilterChip(chips, 'Quick', USERS_QUICK_FILTER_LABELS[quickFilter] || quickFilter);
  return chips;
}

function clearUsersSummaryFilters() {
  setInputValue('users-filter-line-user-id', '');
  setInputValue('users-filter-created-from', '');
  setInputValue('users-filter-created-to', '');
  setSelectValue('users-filter-category', '');
  setSelectValue('users-filter-status', '');
  setSelectValue('users-filter-plan', '');
  setSelectValue('users-filter-subscription-status', '');
  setSelectValue('users-filter-billing-integrity', '');
  state.usersSummaryQuickFilter = 'all';
  state.usersSummaryAnalyze = null;
}

function setTextContent(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value == null || value === '' ? '-' : String(value);
}

function renderUsersSummaryBillingDetail(payload) {
  const detail = payload && typeof payload === 'object' ? payload : null;
  const lineUserId = detail && detail.lineUserId ? detail.lineUserId : state.usersSummarySelectedLineUserId;
  const billing = detail && detail.billing ? detail.billing : null;
  const usage = detail && detail.llmUsage ? detail.llmUsage : null;
  const journey = detail && detail.journey ? detail.journey : null;
  const journeyProfile = journey && journey.profile ? journey.profile : null;
  const journeySchedule = journey && journey.schedule ? journey.schedule : null;
  const journeyTodoStats = journey && journey.todoStats ? journey.todoStats : null;
  const lastStripeEvent = detail && detail.lastStripeEvent ? detail.lastStripeEvent : null;
  setTextContent('users-detail-line-user-id', lineUserId || '-');
  setTextContent('users-detail-plan', billing && billing.plan ? planLabel(billing.plan) : '-');
  setTextContent('users-detail-subscription-status', billing && billing.status ? subscriptionStatusLabel(billing.status) : '-');
  setTextContent('users-detail-current-period-end', billing && billing.currentPeriodEnd ? formatTimestampForList(billing.currentPeriodEnd) : '-');
  setTextContent('users-detail-last-stripe-event', billing && billing.lastEventId ? billing.lastEventId : '-');
  setTextContent('users-detail-llm-usage-count', usage && Number.isFinite(Number(usage.usageCount)) ? String(Number(usage.usageCount)) : '-');
  setTextContent('users-detail-llm-token-used', usage && Number.isFinite(Number(usage.totalTokenUsed)) ? String(Number(usage.totalTokenUsed)) : '-');
  setTextContent('users-detail-llm-blocked-count', usage && Number.isFinite(Number(usage.blockedCount)) ? String(Number(usage.blockedCount)) : '-');
  setTextContent('users-detail-last-used-at', usage && usage.lastUsedAt ? formatTimestampForList(usage.lastUsedAt) : '-');
  setTextContent('users-detail-journey-household-type', journeyProfile && journeyProfile.householdType ? householdTypeLabel(journeyProfile.householdType) : '-');
  setTextContent('users-detail-journey-stage', journeySchedule && journeySchedule.stage ? journeyStageLabel(journeySchedule.stage) : '-');
  setTextContent('users-detail-journey-departure-date', journeySchedule && journeySchedule.departureDate ? journeySchedule.departureDate : '-');
  setTextContent('users-detail-journey-assignment-date', journeySchedule && journeySchedule.assignmentDate ? journeySchedule.assignmentDate : '-');
  setTextContent('users-detail-journey-open-count', journeyTodoStats && Number.isFinite(Number(journeyTodoStats.openCount)) ? String(Number(journeyTodoStats.openCount)) : '-');
  setTextContent('users-detail-journey-overdue-count', journeyTodoStats && Number.isFinite(Number(journeyTodoStats.overdueCount)) ? String(Number(journeyTodoStats.overdueCount)) : '-');
  setTextContent('users-detail-journey-next-due-at', journeyTodoStats && journeyTodoStats.nextDueAt ? formatTimestampForList(journeyTodoStats.nextDueAt) : '-');
  setTextContent('users-detail-journey-last-reminder-at', journeyTodoStats && journeyTodoStats.lastReminderAt ? formatTimestampForList(journeyTodoStats.lastReminderAt) : '-');
  const historyEl = document.getElementById('users-detail-blocked-history');
  if (historyEl) {
    historyEl.innerHTML = '';
    const history = usage && Array.isArray(usage.blockedHistory) ? usage.blockedHistory : [];
    if (!history.length) {
      historyEl.textContent = '-';
    } else {
      history.slice(0, 5).forEach((entry) => {
        const li = document.createElement('li');
        const reason = entry && entry.blockedReason ? String(entry.blockedReason) : 'unknown';
        const createdAt = entry && entry.createdAt ? formatTimestampForList(entry.createdAt) : '-';
        li.textContent = `${reason} (${createdAt})`;
        historyEl.appendChild(li);
      });
    }
  }
  const eventType = lastStripeEvent && lastStripeEvent.eventType ? lastStripeEvent.eventType : '-';
  const eventStatus = lastStripeEvent && lastStripeEvent.status ? lastStripeEvent.status : '-';
  setTextContent('users-detail-last-stripe-event-type', `${eventType} / ${eventStatus}`);
  const nextTodosEl = document.getElementById('users-detail-journey-next-todos');
  if (nextTodosEl) {
    nextTodosEl.innerHTML = '';
    const nextTodos = journey && Array.isArray(journey.nextTodos) ? journey.nextTodos : [];
    if (!nextTodos.length) {
      nextTodosEl.textContent = '-';
    } else {
      nextTodos.slice(0, 5).forEach((entry) => {
        const li = document.createElement('li');
        const todoKey = entry && entry.todoKey ? String(entry.todoKey) : '-';
        const title = entry && entry.title ? String(entry.title) : '-';
        const dueDate = entry && entry.dueDate ? String(entry.dueDate) : '-';
        const status = entry && entry.status ? String(entry.status) : '-';
        li.textContent = `[${todoKey}] ${title} (${dueDate} / ${status})`;
        nextTodosEl.appendChild(li);
      });
    }
  }
}

async function loadUsersSummaryBillingDetail(lineUserId, options) {
  const normalized = typeof lineUserId === 'string' ? lineUserId.trim() : '';
  if (!normalized) {
    state.usersSummarySelectedLineUserId = null;
    state.usersSummaryBillingDetail = null;
    renderUsersSummaryBillingDetail(null);
    return;
  }
  const notify = Boolean(options && options.notify);
  state.usersSummarySelectedLineUserId = normalized;
  const traceId = ensureTraceInput('read-model-trace') || ensureTraceInput('monitor-trace') || newTraceId();
  try {
    const query = new URLSearchParams({ lineUserId: normalized });
    const res = await fetch(`/api/admin/os/user-billing-detail?${query.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'failed');
    state.usersSummaryBillingDetail = data;
    renderUsersSummaryBillingDetail(data);
    if (notify) showToast('ユーザー詳細を更新しました', 'ok');
  } catch (_err) {
    state.usersSummaryBillingDetail = null;
    renderUsersSummaryBillingDetail({ lineUserId: normalized });
    if (notify) showToast('ユーザー詳細の取得に失敗しました', 'danger');
  }
}

function resolveUsersSummaryVisibleColumns() {
  const current = Array.isArray(state.usersSummaryVisibleColumns)
    ? state.usersSummaryVisibleColumns.filter((item) => USERS_SUMMARY_COLUMN_KEYS.includes(item))
    : [];
  if (current.length) return current;
  return USERS_SUMMARY_COLUMN_KEYS.slice();
}

function isUsersColumnVisible(columnKey) {
  return resolveUsersSummaryVisibleColumns().includes(columnKey);
}

function syncUsersSummaryQuickFilterUi() {
  document.querySelectorAll('[data-users-quick-filter]').forEach((btn) => {
    const key = btn.getAttribute('data-users-quick-filter');
    if (!key) return;
    if ((state.usersSummaryQuickFilter || 'all') === key) {
      btn.classList.add('is-active');
    } else {
      btn.classList.remove('is-active');
    }
  });
}

function syncUsersSummaryColumnEditorUi() {
  const visible = new Set(resolveUsersSummaryVisibleColumns());
  document.querySelectorAll('[data-users-column-toggle]').forEach((input) => {
    const key = input.getAttribute('data-users-column-toggle');
    if (!key) return;
    input.checked = visible.has(key);
  });
}

function applyUsersSummaryColumnVisibility() {
  const visible = new Set(resolveUsersSummaryVisibleColumns());
  const table = document.querySelector('.users-summary-table');
  if (!table) return;
  table.querySelectorAll('[data-users-col]').forEach((el) => {
    const key = el.getAttribute('data-users-col');
    if (!key) return;
    if (visible.has(key)) el.classList.remove('is-col-hidden');
    else el.classList.add('is-col-hidden');
  });
}

function renderUsersSummaryAnalyzeResult() {
  const el = document.getElementById('users-summary-analyze-result');
  if (!el) return;
  const payload = state.usersSummaryAnalyze && typeof state.usersSummaryAnalyze === 'object'
    ? state.usersSummaryAnalyze
    : null;
  if (!payload) {
    el.textContent = 'Analyze: 操作待ち';
    return;
  }
  const ratio = Number.isFinite(Number(payload.proActiveRatio)) ? `${Math.round(Number(payload.proActiveRatio) * 1000) / 10}%` : '-';
  const unknownRatio = Number.isFinite(Number(payload.unknownRatio)) ? `${Math.round(Number(payload.unknownRatio) * 1000) / 10}%` : '-';
  const avgTaskCompletion = Number.isFinite(Number(payload.avgTaskCompletionRate))
    ? `${Math.round(Number(payload.avgTaskCompletionRate) * 1000) / 10}%`
    : '-';
  const avgDependencyBlock = Number.isFinite(Number(payload.avgDependencyBlockRate))
    ? `${Math.round(Number(payload.avgDependencyBlockRate) * 1000) / 10}%`
    : '-';
  el.textContent = `Analyze: total=${payload.total || 0}, pro=${payload.proActiveCount || 0} (${ratio}), unknown=${payload.unknownCount || 0} (${unknownRatio}), taskCompletion=${avgTaskCompletion}, dependencyBlock=${avgDependencyBlock}`;
}

function createUsersSummaryBadge(text, className) {
  const span = document.createElement('span');
  span.className = `users-badge ${className || ''}`.trim();
  span.textContent = text;
  return span;
}

function formatBlockedRateValue(value) {
  if (!Number.isFinite(Number(value))) return '-';
  return `${Math.round(Number(value) * 1000) / 10}%`;
}

function renderUsersSummaryRows() {
  const tbody = document.getElementById('users-summary-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  syncUsersSummaryQuickFilterUi();
  syncUsersSummaryColumnEditorUi();
  renderUsersSummaryAnalyzeResult();
  applyUsersSummaryFilters();
  applySortUiState({
    root: document.getElementById('pane-read-model'),
    attr: 'data-users-sort-key',
    sortKey: state.usersSummarySortKey,
    sortDir: state.usersSummarySortDir
  });
  const items = state.usersSummaryFilteredItems;
  const chips = buildUsersSummaryFilterChips();
  renderFilterChips('users-summary-filter-chips', chips);
  updateFilterMeta({
    countId: 'users-summary-result-count',
    clearId: 'users-summary-clear',
    filteredCount: items.length,
    totalCount: state.usersSummaryItems.length,
    activeCount: chips.length
  });
  applyUsersSummaryColumnVisibility();
  persistListStateToStorage('usersSummary', readUsersSummaryListState());
  const visibleColumns = resolveUsersSummaryVisibleColumns();
  if (!items.length) {
    state.usersSummarySelectedLineUserId = null;
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = visibleColumns.length || USERS_SUMMARY_COLUMN_KEYS.length;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    renderUsersSummaryBillingDetail(null);
    return;
  }

  const numericColumnKeys = new Set([
    'currentPeriodEnd',
    'llmUsage',
    'todoProgressRate',
    'llmUsageToday',
    'tokensToday',
    'blockedRate',
    'deliveryCount',
    'clickCount',
    'reactionRate'
  ]);

  items.forEach((item) => {
    const tr = document.createElement('tr');
    const isUnknownRow = item.subscriptionStatus === 'unknown'
      || item.billingIntegrityState === 'unknown'
      || item.billingIntegrityState === 'conflict';
    if (isUnknownRow) tr.classList.add('users-row-unknown');

    USERS_SUMMARY_COLUMN_KEYS.forEach((columnKey) => {
      const td = document.createElement('td');
      td.setAttribute('data-users-col', columnKey);
      if (numericColumnKeys.has(columnKey)) markNumericCell(td);

      if (columnKey === 'subscriptionStatus') {
        const status = item.subscriptionStatus || 'unknown';
        const badgeClass = status === 'unknown' ? 'users-badge-unknown' : (status === 'past_due' ? 'users-badge-warn' : '');
        td.appendChild(createUsersSummaryBadge(item.subscriptionStatusLabel || status, badgeClass));
        tr.appendChild(td);
        return;
      }
      if (columnKey === 'plan') {
        const badgeClass = item.plan === 'pro' ? 'users-badge-pro' : '';
        td.appendChild(createUsersSummaryBadge(item.planLabel || item.plan || '-', badgeClass));
        tr.appendChild(td);
        return;
      }
      if (columnKey === 'billingIntegrity') {
        const integrity = item.billingIntegrityState || 'unknown';
        const badgeClass = integrity === 'conflict'
          ? 'users-badge-conflict'
          : (integrity === 'unknown' ? 'users-badge-unknown' : 'users-badge-ok');
        td.appendChild(createUsersSummaryBadge(integrity, badgeClass));
        tr.appendChild(td);
        return;
      }

      let value = '-';
      if (columnKey === 'createdAt') value = formatTimestampForList(item.createdAt);
      else if (columnKey === 'updatedAt') value = formatTimestampForList(item.updatedAt);
      else if (columnKey === 'lineUserId') value = item.lineUserId || '-';
      else if (columnKey === 'memberNumber') value = item.memberNumber || '-';
      else if (columnKey === 'category') value = item.categoryLabel || '-';
      else if (columnKey === 'status') value = item.statusLabel || '-';
      else if (columnKey === 'currentPeriodEnd') value = formatTimestampForList(item.currentPeriodEnd);
      else if (columnKey === 'llmUsage') value = Number.isFinite(Number(item.llmUsage)) ? String(item.llmUsage) : '-';
      else if (columnKey === 'todoProgressRate') value = formatRatioPercent(item.todoProgressRate);
      else if (columnKey === 'llmUsageToday') value = Number.isFinite(Number(item.llmUsageToday)) ? String(item.llmUsageToday) : '-';
      else if (columnKey === 'tokensToday') value = Number.isFinite(Number(item.llmTokenUsedToday)) ? String(item.llmTokenUsedToday) : '-';
      else if (columnKey === 'blockedRate') value = formatBlockedRateValue(item.llmBlockedRate);
      else if (columnKey === 'deliveryCount') value = Number.isFinite(Number(item.deliveryCount)) ? String(item.deliveryCount) : '-';
      else if (columnKey === 'clickCount') value = Number.isFinite(Number(item.clickCount)) ? String(item.clickCount) : '-';
      else if (columnKey === 'reactionRate') value = formatUserReactionRate(item);
      td.textContent = toUnifiedDisplay(value, '-');
      tr.appendChild(td);
    });

    tr.classList.add('clickable-row');
    if (state.usersSummarySelectedLineUserId && state.usersSummarySelectedLineUserId === item.lineUserId) {
      tr.classList.add('row-active');
    }
    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((node) => node.classList.remove('row-active'));
      tr.classList.add('row-active');
      void loadUsersSummaryBillingDetail(item.lineUserId, { notify: false });
    });
    tbody.appendChild(tr);
  });
  applyUsersSummaryColumnVisibility();
}

function buildUsersSummaryQuery(limit, analyticsLimit) {
  const query = new URLSearchParams({
    limit: String(limit),
    analyticsLimit: String(analyticsLimit),
    fallbackMode: 'block',
    fallbackOnEmpty: 'false',
    sortKey: state.usersSummarySortKey || 'createdAt',
    sortDir: state.usersSummarySortDir || 'desc'
  });
  const plan = getSelectValue('users-filter-plan');
  const subscriptionStatus = getSelectValue('users-filter-subscription-status');
  const billingIntegrity = getSelectValue('users-filter-billing-integrity');
  const quickFilter = state.usersSummaryQuickFilter || 'all';
  if (plan) query.set('plan', plan);
  if (subscriptionStatus) query.set('subscriptionStatus', subscriptionStatus);
  if (billingIntegrity) query.set('billingIntegrity', billingIntegrity);
  if (quickFilter && quickFilter !== 'all') query.set('quickFilter', quickFilter);
  return query;
}

function updateUsersSummaryVisibleColumnsFromInputs() {
  const selected = [];
  document.querySelectorAll('[data-users-column-toggle]').forEach((input) => {
    const key = input.getAttribute('data-users-column-toggle');
    if (!key || !USERS_SUMMARY_COLUMN_KEYS.includes(key)) return;
    if (input.checked) selected.push(key);
  });
  state.usersSummaryVisibleColumns = selected.length ? selected : USERS_SUMMARY_COLUMN_KEYS.slice();
  renderUsersSummaryRows();
}

async function loadUsersSummaryAnalyze(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const limit = normalizeUsersSummaryLimit(document.getElementById('users-filter-limit')?.value, 200, 500);
  const analyticsLimit = normalizeUsersSummaryLimit(document.getElementById('users-filter-analytics-limit')?.value, 1200, 2000);
  const traceId = ensureTraceInput('read-model-trace') || ensureTraceInput('monitor-trace') || newTraceId();
  const query = buildUsersSummaryQuery(limit, analyticsLimit);
  try {
    const res = await fetch(`/api/admin/os/users-summary/analyze?${query.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'failed');
    state.usersSummaryAnalyze = data.analyze || null;
    renderUsersSummaryAnalyzeResult();
    if (notify) showToast('Analyze を更新しました', 'ok');
  } catch (_err) {
    state.usersSummaryAnalyze = null;
    renderUsersSummaryAnalyzeResult();
    if (notify) showToast('Analyze の取得に失敗しました', 'danger');
  }
}

async function exportUsersSummaryCsv() {
  const limit = normalizeUsersSummaryLimit(document.getElementById('users-filter-limit')?.value, 200, 500);
  const analyticsLimit = normalizeUsersSummaryLimit(document.getElementById('users-filter-analytics-limit')?.value, 1200, 2000);
  const traceId = ensureTraceInput('read-model-trace') || ensureTraceInput('monitor-trace') || newTraceId();
  const query = buildUsersSummaryQuery(limit, analyticsLimit);
  try {
    const res = await fetch(`/api/admin/os/users-summary/export?${query.toString()}`, { headers: buildHeaders({}, traceId) });
    if (!res.ok) throw new Error(`status_${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `users_summary_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('CSVを出力しました', 'ok');
  } catch (_err) {
    showToast('CSV出力に失敗しました', 'danger');
  }
}

async function loadUsersSummary(options) {
  const notify = Boolean(options && options.notify);
  const limit = normalizeUsersSummaryLimit(document.getElementById('users-filter-limit')?.value, 200, 500);
  const analyticsLimit = normalizeUsersSummaryLimit(document.getElementById('users-filter-analytics-limit')?.value, 1200, 2000);
  const traceId = ensureTraceInput('read-model-trace') || ensureTraceInput('monitor-trace') || newTraceId();
  const query = buildUsersSummaryQuery(limit, analyticsLimit);
  try {
    const res = await fetch(`/api/phase5/ops/users-summary?${query.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'failed');
    const items = Array.isArray(data.items) ? data.items : [];
    state.usersSummaryItems = items.map((item) => mapUsersSummaryItem(item));
    renderUsersSummaryRows();
    void loadUsersSummaryAnalyze({ notify: false });
    const selected = state.usersSummarySelectedLineUserId
      && state.usersSummaryItems.some((item) => item.lineUserId === state.usersSummarySelectedLineUserId)
      ? state.usersSummarySelectedLineUserId
      : (state.usersSummaryItems[0] && state.usersSummaryItems[0].lineUserId ? state.usersSummaryItems[0].lineUserId : '');
    if (selected) {
      await loadUsersSummaryBillingDetail(selected, { notify: false });
    } else {
      renderUsersSummaryBillingDetail(null);
    }
    setPaneUpdatedAt('read-model');
    renderAllDecisionCards();
    if (notify) showToast('ユーザー一覧を更新しました', 'ok');
  } catch (_err) {
    state.usersSummaryItems = [];
    state.usersSummaryFilteredItems = [];
    state.usersSummarySelectedLineUserId = null;
    state.usersSummaryAnalyze = null;
    renderUsersSummaryRows();
    renderUsersSummaryBillingDetail(null);
    if (notify) showToast('ユーザー一覧の取得に失敗しました', 'danger');
  }
}

async function loadErrors(options) {
  const notify = options && options.notify;
  const traceId = ensureTraceInput('errors-trace');
  const skeleton = document.getElementById('errors-skeleton');
  if (skeleton) skeleton.classList.remove('is-hidden');
  try {
    const res = await fetch('/api/admin/os/errors/summary', { headers: buildHeaders({}, traceId) });
    const summary = await res.json();
    state.errorsSummary = summary;
    renderErrors(summary);
    setPaneUpdatedAt('errors');
    renderAllDecisionCards();
    if (notify) showToast(summary && summary.ok ? t('ui.toast.errors.ok', 'errors OK') : t('ui.toast.errors.fail', 'errors 失敗'), summary && summary.ok ? 'ok' : 'danger');
  } catch (_err) {
    if (notify) showToast(t('ui.toast.errors.fail', 'errors 失敗'), 'danger');
  } finally {
    if (skeleton) skeleton.classList.add('is-hidden');
  }
}

async function loadMonitorUserDeliveries(options) {
  const notify = options && options.notify;
  const lineUserId = document.getElementById('monitor-user-line-user-id')?.value?.trim() || '';
  const memberNumber = document.getElementById('monitor-user-member-number')?.value?.trim() || '';
  const limit = document.getElementById('monitor-user-limit')?.value || '50';
  const traceId = ensureTraceInput('monitor-trace');
  if (!lineUserId && !memberNumber) {
    if (notify) showToast(t('ui.toast.monitor.userQueryRequired', 'LINEユーザーIDか会員番号を入力してください'), 'warn');
    renderMonitorUserRows([]);
    return;
  }
  const params = new URLSearchParams();
  if (lineUserId) params.set('lineUserId', lineUserId);
  if (memberNumber) params.set('memberNumber', memberNumber);
  params.set('limit', limit);
  params.set('traceId', traceId);
  try {
    const res = await fetch(`/api/admin/notification-deliveries?${params.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    const items = Array.isArray(data && data.items) ? data.items : [];
    state.monitorUserItems = items.map((item) => {
      const health = item && item.failureCode ? 'DANGER' : (item && item.status === 'delivered' ? 'OK' : 'WARN');
      return {
        sentAt: item.sentAt,
        deliveredAt: item.deliveredAt,
        lineUserId: item.lineUserId,
        memberNumber: item.memberNumber,
        title: item.title,
        notificationId: item.notificationId,
        statusLabel: item.statusLabel || item.status || '-',
        failureLabel: item.failureLabel || '-',
        traceId: item.traceId || data.traceId || null,
        health,
        raw: item
      };
    });
    renderMonitorUserRows(state.monitorUserItems);
    if (notify) showToast(t('ui.toast.monitor.userLoaded', 'ユーザー履歴を取得しました'), 'ok');
  } catch (_err) {
    if (notify) showToast(t('ui.toast.monitor.userLoadFail', 'ユーザー履歴の取得に失敗しました'), 'danger');
  }
}

async function loadMonitorInsights(options) {
  const notify = options && options.notify;
  const windowDays = document.getElementById('monitor-window-days')?.value || '7';
  const traceId = ensureTraceInput('monitor-trace');
  const params = new URLSearchParams({ windowDays, limit: '10', traceId });
  try {
    const res = await fetch(`/api/admin/monitor-insights?${params.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    state.monitorInsights = data;
    renderVendorCtrRows(Array.isArray(data && data.vendorCtrTop) ? data.vendorCtrTop : []);
    renderFaqReferenceRows(Array.isArray(data && data.faqReferenceTop) ? data.faqReferenceTop : []);
    const abEl = document.getElementById('monitor-ab-summary');
    if (abEl) {
      const ab = data && data.abSnapshot ? data.abSnapshot : null;
      if (!ab) {
        abEl.textContent = t('ui.desc.monitor.abNone', 'AB比較データはありません。');
      } else {
        abEl.textContent = `${ab.ctaA || '-'} ${t('ui.label.monitor.ab.vs', 'vs')} ${ab.ctaB || '-'} / ΔCTR ${typeof ab.deltaCTR === 'number' ? `${Math.round(ab.deltaCTR * 1000) / 10}%` : '-'}`;
      }
    }
    if (notify) showToast(t('ui.toast.monitor.insightsLoaded', 'クリック分析を更新しました'), 'ok');
  } catch (_err) {
    if (notify) showToast(t('ui.toast.monitor.insightsLoadFail', 'クリック分析の取得に失敗しました'), 'danger');
  }
}

async function loadVendors(options) {
  const notify = options && options.notify;
  const traceId = ensureTraceInput('vendor-trace') || ensureTraceInput('monitor-trace');
  const stateFilter = document.getElementById('vendor-unified-filter-status')?.value?.trim()
    || document.getElementById('vendor-state')?.value?.trim()
    || '';
  const limit = document.getElementById('vendor-limit')?.value || '50';
  const params = new URLSearchParams({ limit });
  if (stateFilter) params.set('state', stateFilter);
  const skeleton = document.getElementById('vendor-skeleton');
  if (skeleton) skeleton.classList.remove('is-hidden');
  try {
    const res = await fetch(`/api/admin/vendors?${params.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    const items = Array.isArray(data && data.items) ? data.items.map(normalizeVendorRow) : [];
    state.vendorItems = items;
    renderVendorRows(items);
    renderVendorUnifiedRows();
    setPaneUpdatedAt('vendors');
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.vendors.loaded', 'Vendor一覧を更新しました'), 'ok');
  } catch (_err) {
    state.vendorItems = [];
    renderVendorRows([]);
    renderVendorUnifiedRows();
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.vendors.loadFail', 'Vendor一覧の取得に失敗しました'), 'danger');
  } finally {
    if (skeleton) skeleton.classList.add('is-hidden');
  }
}

function resolveSelectedVendor() {
  if (!state.selectedVendorLinkId) return null;
  return state.vendorItems.find((item) => item.linkId === state.selectedVendorLinkId) || null;
}

async function runVendorAction(action) {
  const selected = resolveSelectedVendor();
  if (!selected || !selected.linkId) {
    showToast(t('ui.toast.vendors.needSelection', 'Vendor行を選択してください'), 'warn');
    return;
  }
  const traceId = ensureTraceInput('vendor-trace') || ensureTraceInput('monitor-trace');
  const linkId = encodeURIComponent(selected.linkId);
  let endpoint = null;
  let payload = {};
  if (action === 'edit') {
    const nextLabel = window.prompt(t('ui.prompt.vendors.editLabel', '表示名を入力してください'), selected.vendorLabel || '');
    if (!nextLabel) return;
    endpoint = `/api/admin/vendors/${linkId}/edit`;
    payload = { vendorLabel: nextLabel };
  } else if (action === 'activate') {
    const ok = window.confirm(t('ui.confirm.vendors.activate', 'このVendorを有効化しますか？'));
    if (!ok) return;
    endpoint = `/api/admin/vendors/${linkId}/activate`;
    payload = {};
  } else if (action === 'disable') {
    const ok = window.confirm(t('ui.confirm.vendors.disable', 'このVendorを停止・無効化しますか？'));
    if (!ok) return;
    endpoint = `/api/admin/vendors/${linkId}/disable`;
    payload = {};
  }
  if (!endpoint) return;
  try {
    const data = await postJson(endpoint, payload, traceId);
    if (data && data.ok) {
      showToast(t('ui.toast.vendors.actionOk', 'Vendorを更新しました'), 'ok');
      await loadVendors({ notify: false });
    } else {
      showToast(t('ui.toast.vendors.actionFail', 'Vendor更新に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.vendors.actionFail', 'Vendor更新に失敗しました'), 'danger');
  }
}

async function loadCityPackRequests(options) {
  const notify = options && options.notify;
  const status = document.getElementById('city-pack-request-status-filter')?.value || '';
  const regionKey = document.getElementById('city-pack-request-region')?.value || '';
  const requestClass = document.getElementById('city-pack-request-class-filter')?.value || '';
  const requestedLanguage = document.getElementById('city-pack-request-language-filter')?.value?.trim().toLowerCase() || '';
  const limit = document.getElementById('city-pack-request-limit')?.value || '50';
  const traceId = ensureTraceInput('monitor-trace');
  const params = new URLSearchParams({ limit, traceId });
  if (status) params.set('status', status);
  if (regionKey) params.set('regionKey', regionKey);
  if (requestClass) params.set('requestClass', requestClass);
  if (requestedLanguage) params.set('requestedLanguage', requestedLanguage);
  try {
    const res = await fetch(`/api/admin/city-pack-requests?${params.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    const items = Array.isArray(data && data.items) ? data.items : [];
    state.cityPackRequestItems = items;
    renderCityPackRequestRows(items);
    refreshCityPackUnifiedRows();
    setPaneUpdatedAt('city-pack');
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.cityPack.requestLoaded', 'Request一覧を取得しました'), 'ok');
  } catch (_err) {
    state.cityPackRequestItems = [];
    refreshCityPackUnifiedRows();
    if (notify) showToast(t('ui.toast.cityPack.requestLoadFail', 'Request一覧の取得に失敗しました'), 'danger');
    renderCityPackRequestRows([]);
  }
}

async function loadCityPackFeedback(options) {
  const notify = options && options.notify;
  const status = document.getElementById('city-pack-feedback-status-filter')?.value || '';
  const packClass = document.getElementById('city-pack-feedback-class-filter')?.value || '';
  const language = document.getElementById('city-pack-feedback-language-filter')?.value?.trim().toLowerCase() || '';
  const limitRaw = document.getElementById('city-pack-feedback-limit')?.value || '';
  const limit = Number(limitRaw) || 50;
  const trace = ensureTraceInput('monitor-trace');
  try {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (packClass) params.set('packClass', packClass);
    if (language) params.set('language', language);
    if (limit) params.set('limit', String(limit));
    const data = await getJson(`/api/admin/city-pack-feedback?${params.toString()}`, trace);
    if (data && data.ok) {
      const items = Array.isArray(data.items) ? data.items : [];
      state.cityPackFeedbackItems = items;
      renderCityPackFeedbackRows(items);
      refreshCityPackUnifiedRows();
      if (!state.selectedCityPackFeedbackId) renderCityPackFeedbackDetail(null);
      if (notify) showToast(t('ui.toast.cityPack.feedbackLoaded', 'Feedback一覧を取得しました'), 'ok');
    } else {
      state.cityPackFeedbackItems = [];
      refreshCityPackUnifiedRows();
      renderCityPackFeedbackRows([]);
      if (notify) showToast(t('ui.toast.cityPack.feedbackLoadFail', 'Feedback一覧の取得に失敗しました'), 'danger');
    }
  } catch (_err) {
    state.cityPackFeedbackItems = [];
    refreshCityPackUnifiedRows();
    renderCityPackFeedbackRows([]);
    if (notify) showToast(t('ui.toast.cityPack.feedbackLoadFail', 'Feedback一覧の取得に失敗しました'), 'danger');
  }
}

async function loadCityPackBulletins(options) {
  const notify = options && options.notify;
  const status = document.getElementById('city-pack-bulletin-status-filter')?.value || '';
  const limit = document.getElementById('city-pack-bulletin-limit')?.value || '50';
  const traceId = ensureTraceInput('monitor-trace');
  const params = new URLSearchParams({ limit, traceId });
  if (status) params.set('status', status);
  try {
    const res = await fetch(`/api/admin/city-pack-bulletins?${params.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    const items = Array.isArray(data && data.items) ? data.items : [];
    state.cityPackBulletinItems = items;
    renderCityPackBulletinRows(items);
    refreshCityPackUnifiedRows();
    if (!state.selectedCityPackBulletinId) renderCityPackBulletinDetail(null);
    if (notify) showToast(t('ui.toast.cityPack.bulletinLoaded', 'Bulletin一覧を取得しました'), 'ok');
  } catch (_err) {
    state.cityPackBulletinItems = [];
    refreshCityPackUnifiedRows();
    if (notify) showToast(t('ui.toast.cityPack.bulletinLoadFail', 'Bulletin一覧の取得に失敗しました'), 'danger');
    renderCityPackBulletinRows([]);
  }
}

async function loadCityPackProposals(options) {
  const notify = options && options.notify;
  const status = document.getElementById('city-pack-proposal-status-filter')?.value || '';
  const limit = document.getElementById('city-pack-proposal-limit')?.value || '50';
  const traceId = ensureTraceInput('monitor-trace');
  const params = new URLSearchParams({ limit, traceId });
  if (status) params.set('status', status);
  try {
    const res = await fetch(`/api/admin/city-pack-update-proposals?${params.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    const items = Array.isArray(data && data.items) ? data.items : [];
    state.cityPackProposalItems = items;
    renderCityPackProposalRows(items);
    refreshCityPackUnifiedRows();
    if (!state.selectedCityPackProposalId) renderCityPackProposalDetail(null);
    if (notify) showToast(t('ui.toast.cityPack.proposalLoaded', 'Proposal一覧を取得しました'), 'ok');
  } catch (_err) {
    state.cityPackProposalItems = [];
    refreshCityPackUnifiedRows();
    if (notify) showToast(t('ui.toast.cityPack.proposalLoadFail', 'Proposal一覧の取得に失敗しました'), 'danger');
    renderCityPackProposalRows([]);
  }
}

async function loadCityPackTemplateLibrary(options) {
  const notify = options && options.notify;
  const status = document.getElementById('city-pack-template-library-status-filter')?.value || '';
  const limit = document.getElementById('city-pack-template-library-limit')?.value || '50';
  const traceId = ensureTraceInput('monitor-trace');
  const params = new URLSearchParams({ limit, traceId });
  if (status) params.set('status', status);
  try {
    const data = await getJson(`/api/admin/city-pack-template-library?${params.toString()}`, traceId);
    if (data && data.ok) {
      const items = Array.isArray(data.items) ? data.items : [];
      state.cityPackTemplateLibraryItems = items;
      renderCityPackTemplateLibraryRows(items);
      refreshCityPackUnifiedRows();
      if (!state.selectedCityPackTemplateLibraryId) renderCityPackTemplateLibraryDetail(null);
      if (notify) showToast(t('ui.toast.cityPack.templateLibraryLoaded', 'Template一覧を取得しました'), 'ok');
    } else {
      state.cityPackTemplateLibraryItems = [];
      refreshCityPackUnifiedRows();
      renderCityPackTemplateLibraryRows([]);
      if (notify) showToast(t('ui.toast.cityPack.templateLibraryLoadFail', 'Template一覧の取得に失敗しました'), 'danger');
    }
  } catch (_err) {
    state.cityPackTemplateLibraryItems = [];
    refreshCityPackUnifiedRows();
    if (notify) showToast(t('ui.toast.cityPack.templateLibraryLoadFail', 'Template一覧の取得に失敗しました'), 'danger');
    renderCityPackTemplateLibraryRows([]);
  }
}

async function loadCityPackRequestDetail(requestId) {
  if (!requestId) {
    renderCityPackRequestDetail(null);
    return;
  }
  const traceId = ensureTraceInput('monitor-trace');
  try {
    const res = await fetch(`/api/admin/city-pack-requests/${encodeURIComponent(requestId)}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    if (!data || !data.ok) {
      renderCityPackRequestDetail(null);
      return;
    }
    renderCityPackRequestDetail(data);
  } catch (_err) {
    renderCityPackRequestDetail(null);
  }
}

async function loadCityPackReviewInbox(options) {
  const notify = options && options.notify;
  const status = document.getElementById('city-pack-status-filter')?.value || '';
  const packClass = document.getElementById('city-pack-pack-class-filter')?.value || '';
  const language = document.getElementById('city-pack-language-filter')?.value?.trim().toLowerCase() || '';
  const limit = document.getElementById('city-pack-limit')?.value || '50';
  const monitorTrace = ensureTraceInput('monitor-trace');
  const params = new URLSearchParams({ limit, traceId: monitorTrace });
  if (status) params.set('status', status);
  if (packClass) params.set('packClass', packClass);
  if (language) params.set('language', language);
  try {
    const res = await fetch(`/api/admin/review-inbox?${params.toString()}`, { headers: buildHeaders({}, monitorTrace) });
    const data = await res.json();
    const items = Array.isArray(data && data.items) ? data.items : [];
    state.cityPackInboxItems = items;
    renderCityPackInboxRows(items);
    refreshCityPackUnifiedRows();
    setPaneUpdatedAt('city-pack');
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.cityPack.inboxLoaded', 'Review Inboxを取得しました'), 'ok');
  } catch (_err) {
    state.cityPackInboxItems = [];
    refreshCityPackUnifiedRows();
    if (notify) showToast(t('ui.toast.cityPack.inboxLoadFail', 'Review Inboxの取得に失敗しました'), 'danger');
    renderCityPackInboxRows([]);
  }
}

async function loadCityPackComposition(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const traceId = ensureTraceInput('monitor-trace');
  const regionKey = readCityPackCompositionRegionKey();
  const language = readCityPackCompositionLanguage();
  const limit = parseCityPackCompositionLimit();
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (regionKey) params.set('regionKey', regionKey);
  if (language) params.set('language', language);
  try {
    const res = await fetch(`/api/admin/city-packs/composition?${params.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error('failed');
    const items = Array.isArray(data.items) ? data.items : [];
    state.cityPackCompositionItems = items;
    renderCityPackComposition(items, data.summary || null);
    setPaneUpdatedAt('city-pack');
    if (notify) showToast(t('ui.toast.cityPack.compositionLoaded', 'Pack composition を更新しました'), 'ok');
  } catch (_err) {
    state.cityPackCompositionItems = [];
    renderCityPackComposition([], null);
    if (notify) showToast(t('ui.toast.cityPack.compositionLoadFail', 'Pack composition の取得に失敗しました'), 'danger');
  }
}

async function loadCityPackEvidence(evidenceId) {
  if (!evidenceId) {
    renderCityPackEvidence(null);
    return;
  }
  const trace = ensureTraceInput('monitor-trace');
  try {
    const res = await fetch(`/api/admin/source-evidence/${encodeURIComponent(evidenceId)}`, { headers: buildHeaders({}, trace) });
    const data = await res.json();
    if (!data || !data.ok) {
      renderCityPackEvidence(null);
      return;
    }
    renderCityPackEvidence(data);
  } catch (_err) {
    renderCityPackEvidence(null);
  }
}

async function loadCityPackKpi(options) {
  const notify = options && options.notify;
  const trace = ensureTraceInput('monitor-trace');
  try {
    const res = await fetch('/api/admin/city-pack-kpi', { headers: buildHeaders({}, trace) });
    const data = await res.json();
    renderCityPackKpi(data && data.metrics ? data.metrics : null);
    setPaneUpdatedAt('city-pack');
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.cityPack.kpiLoaded', 'City Pack KPIを更新しました'), 'ok');
  } catch (_err) {
    renderCityPackKpi(null);
    renderDataLoadFailureGuard('city_pack_kpi_failed', _err);
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.cityPack.kpiLoadFail', 'City Pack KPIの取得に失敗しました'), 'danger');
  }
}

async function loadCityPackMetrics(options) {
  const notify = options && options.notify;
  const trace = ensureTraceInput('monitor-trace');
  const windowDays = document.getElementById('city-pack-metrics-window-days')?.value === '30' ? '30' : '7';
  const limitRaw = Number(document.getElementById('city-pack-metrics-limit')?.value);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 200) : 50;
  const qs = new URLSearchParams({ windowDays, limit: String(limit) });
  try {
    const res = await fetch(`/api/admin/city-pack-metrics?${qs.toString()}`, { headers: buildHeaders({}, trace) });
    const data = await res.json();
    renderCityPackMetrics(data && data.ok ? data : null);
    setPaneUpdatedAt('city-pack');
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.cityPack.metricsLoaded', 'City Pack効果測定を更新しました'), 'ok');
  } catch (_err) {
    renderCityPackMetrics(null);
    if (notify) showToast(t('ui.toast.cityPack.metricsLoadFail', 'City Pack効果測定の取得に失敗しました'), 'danger');
  }
}

async function loadCityPackAuditRuns(options) {
  const notify = options && options.notify;
  const trace = ensureTraceInput('monitor-trace');
  try {
    const res = await fetch('/api/admin/city-pack-source-audit/runs?limit=20', { headers: buildHeaders({}, trace) });
    const data = await res.json();
    renderCityPackRunRows(data);
    if (notify) showToast(t('ui.toast.cityPack.runsLoaded', '実行履歴を更新しました'), 'ok');
  } catch (_err) {
    renderCityPackRunRows({ items: [], summary: null });
    if (notify) showToast(t('ui.toast.cityPack.runsLoadFail', '実行履歴の取得に失敗しました'), 'danger');
  }
}

function shouldRequireReplaceUrl(action) {
  return action === 'replace';
}

async function runCityPackSourceAction(action, row) {
  if (!row || !row.sourceRefId) return;
  const trace = ensureTraceInput('monitor-trace');
  const sourceRefId = row.sourceRefId;
  const actionLabel = t(`ui.label.cityPack.action.${action === 'manual-only' ? 'manualOnly' : action}`, action);
  const approved = window.confirm(`${actionLabel} を実行しますか？`);
  if (!approved) return;
  let body = {};
  if (shouldRequireReplaceUrl(action)) {
    const replacementUrl = window.prompt(t('ui.prompt.cityPack.replaceUrl', '置換先URLを入力してください'));
    if (!replacementUrl) {
      showToast(t('ui.toast.cityPack.replaceCanceled', '置換を中止しました'), 'warn');
      return;
    }
    body = { replacementUrl };
  }
  try {
    const data = await postJson(`/api/admin/source-refs/${encodeURIComponent(sourceRefId)}/${action}`, body, trace);
    if (data && data.ok) {
      showToast(t('ui.toast.cityPack.actionOk', '情報源ステータスを更新しました'), 'ok');
      await loadCityPackReviewInbox({ notify: false });
      await loadCityPackKpi({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.actionFail', '情報源ステータス更新に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.actionFail', '情報源ステータス更新に失敗しました'), 'danger');
  }
}

async function runCityPackSaveSourcePolicy() {
  const sourceRefId = state.selectedCityPackSourceRefId;
  if (!sourceRefId) {
    showToast(t('ui.toast.cityPack.policyNeedSelection', 'Review Inboxの行を選択してください'), 'warn');
    return;
  }
  const sourceType = document.getElementById('city-pack-source-type')?.value || 'other';
  const requiredLevel = document.getElementById('city-pack-required-level')?.value || 'required';
  const authorityLevel = document.getElementById('city-pack-authority-level')?.value || 'other';
  const trace = ensureTraceInput('monitor-trace');
  const approved = window.confirm(t('ui.confirm.cityPack.sourcePolicySave', '情報源ポリシーを保存しますか？'));
  if (!approved) return;
  try {
    const data = await postJson(`/api/admin/source-refs/${encodeURIComponent(sourceRefId)}/policy`, {
      sourceType,
      requiredLevel,
      authorityLevel
    }, trace);
    if (data && data.ok) {
      showToast(t('ui.toast.cityPack.policySaved', '情報源ポリシーを保存しました'), 'ok');
      await loadCityPackReviewInbox({ notify: false });
      await loadCityPackKpi({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.policySaveFail', '情報源ポリシーの保存に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.policySaveFail', '情報源ポリシーの保存に失敗しました'), 'danger');
  }
}

async function runCityPackRequestAction(action, row) {
  if (!row || !row.requestId) return;
  const trace = ensureTraceInput('monitor-trace');
  const requestId = row.requestId;
  const actionLabel = t(`ui.label.cityPack.request.action.${action}`, action);
  if (action === 'approve' || action === 'activate' || action === 'reject') {
    const approved = window.confirm(`${actionLabel} を実行しますか？`);
    if (!approved) return;
  }
  let body = {};
  if (action === 'request-changes') {
    const note = window.prompt(t('ui.prompt.cityPack.requestChanges', '差し戻し理由を入力してください'));
    if (!note) return;
    body = { note };
  }
  if (action === 'retry-job') {
    const input = window.prompt(t('ui.prompt.cityPack.requestSources', '草案生成に使うsource URLをカンマ区切りで入力してください'));
    if (!input) return;
    const sourceUrls = input.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    body = { sourceUrls };
  }
  try {
    const data = await postJson(`/api/admin/city-pack-requests/${encodeURIComponent(requestId)}/${action}`, body, trace);
    if (data && data.ok !== false) {
      showToast(t('ui.toast.cityPack.requestActionOk', 'Request操作を実行しました'), 'ok');
      await loadCityPackRequests({ notify: false });
      await loadCityPackRequestDetail(requestId);
      await loadCityPackReviewInbox({ notify: false });
      await loadCityPackKpi({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.requestActionFail', 'Request操作に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.requestActionFail', 'Request操作に失敗しました'), 'danger');
  }
}

async function runCityPackFeedbackAction(action, row) {
  const feedbackId = row && (row.feedbackId || row.id);
  if (!feedbackId) return;
  const trace = ensureTraceInput('monitor-trace');
  let body = {};
  if (action === 'resolve' || action === 'propose') {
    const resolution = window.prompt(t('ui.prompt.cityPack.feedbackResolution', '対応内容を入力してください'), row && row.resolution ? String(row.resolution) : '');
    if (!resolution) return;
    body = { resolution };
  }
  try {
    const data = await postJson(`/api/admin/city-pack-feedback/${encodeURIComponent(feedbackId)}/${action}`, body, trace);
    if (data && data.ok !== false) {
      showToast(t('ui.toast.cityPack.feedbackActionOk', 'Feedback操作を実行しました'), 'ok');
      await loadCityPackFeedback({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.feedbackActionFail', 'Feedback操作に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.feedbackActionFail', 'Feedback操作に失敗しました'), 'danger');
  }
}

async function runCityPackBulletinAction(action, row) {
  const bulletinId = row && (row.bulletinId || row.id);
  if (!bulletinId) return;
  const trace = ensureTraceInput('monitor-trace');
  const actionLabel = t(`ui.label.cityPack.bulletin.action.${action}`, action);
  if (action === 'approve' || action === 'reject' || action === 'send') {
    const approved = window.confirm(t(`ui.confirm.cityPack.bulletin.${action}`, `${actionLabel} を実行しますか？`));
    if (!approved) return;
  }
  try {
    const data = await postJson(`/api/admin/city-pack-bulletins/${encodeURIComponent(bulletinId)}/${action}`, {}, trace);
    if (data && data.ok !== false) {
      showToast(t('ui.toast.cityPack.bulletinActionOk', 'Bulletin操作を実行しました'), 'ok');
      await loadCityPackBulletins({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.bulletinActionFail', 'Bulletin操作に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.bulletinActionFail', 'Bulletin操作に失敗しました'), 'danger');
  }
}

async function runCityPackProposalAction(action, row) {
  const proposalId = row && (row.proposalId || row.id);
  if (!proposalId) return;
  const trace = ensureTraceInput('monitor-trace');
  const actionLabel = t(`ui.label.cityPack.proposal.action.${action}`, action);
  if (action === 'approve' || action === 'reject' || action === 'apply') {
    const approved = window.confirm(t(`ui.confirm.cityPack.proposal.${action}`, `${actionLabel} を実行しますか？`));
    if (!approved) return;
  }
  try {
    const data = await postJson(`/api/admin/city-pack-update-proposals/${encodeURIComponent(proposalId)}/${action}`, {}, trace);
    if (data && data.ok !== false) {
      showToast(t('ui.toast.cityPack.proposalActionOk', 'Proposal操作を実行しました'), 'ok');
      await loadCityPackProposals({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.proposalActionFail', 'Proposal操作に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.proposalActionFail', 'Proposal操作に失敗しました'), 'danger');
  }
}

function parseProposalPatchJson(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return null;
  const raw = String(input.value || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid_patch');
    }
    return parsed;
  } catch (_err) {
    showToast(t('ui.toast.cityPack.proposalPatchInvalid', 'proposalPatch JSONが不正です'), 'danger');
    throw new Error('invalid_json');
  }
}

async function createCityPackBulletinDraft() {
  const cityPackId = document.getElementById('city-pack-bulletin-city-pack-id')?.value?.trim() || '';
  const notificationId = document.getElementById('city-pack-bulletin-notification-id')?.value?.trim() || '';
  const summary = document.getElementById('city-pack-bulletin-summary')?.value?.trim() || '';
  if (!cityPackId || !notificationId || !summary) {
    showToast(t('ui.toast.cityPack.bulletinNeedFields', 'cityPackId/notificationId/summary を入力してください'), 'warn');
    return;
  }
  const trace = ensureTraceInput('monitor-trace');
  try {
    const data = await postJson('/api/admin/city-pack-bulletins', {
      cityPackId,
      notificationId,
      summary
    }, trace);
    if (data && data.ok) {
      showToast(t('ui.toast.cityPack.bulletinCreateOk', 'Bulletinを作成しました'), 'ok');
      await loadCityPackBulletins({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.bulletinCreateFail', 'Bulletinの作成に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.bulletinCreateFail', 'Bulletinの作成に失敗しました'), 'danger');
  }
}

async function createCityPackProposalDraft() {
  const cityPackId = document.getElementById('city-pack-proposal-city-pack-id')?.value?.trim() || '';
  const summary = document.getElementById('city-pack-proposal-summary')?.value?.trim() || '';
  if (!cityPackId || !summary) {
    showToast(t('ui.toast.cityPack.proposalNeedFields', 'cityPackId/summary を入力してください'), 'warn');
    return;
  }
  let proposalPatch = null;
  try {
    proposalPatch = parseProposalPatchJson('city-pack-proposal-patch');
  } catch (_err) {
    return;
  }
  if (!proposalPatch) {
    showToast(t('ui.toast.cityPack.proposalNeedPatch', 'proposalPatch を入力してください'), 'warn');
    return;
  }
  const trace = ensureTraceInput('monitor-trace');
  try {
    const data = await postJson('/api/admin/city-pack-update-proposals', {
      cityPackId,
      summary,
      proposalPatch
    }, trace);
    if (data && data.ok) {
      showToast(t('ui.toast.cityPack.proposalCreateOk', 'Proposalを作成しました'), 'ok');
      await loadCityPackProposals({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.proposalCreateFail', 'Proposalの作成に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.proposalCreateFail', 'Proposalの作成に失敗しました'), 'danger');
  }
}

function parseCityPackTemplateJson(inputId, errorKey) {
  const input = document.getElementById(inputId);
  if (!input) return null;
  const raw = String(input.value || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_template');
    return parsed;
  } catch (_err) {
    showToast(t(errorKey, 'template JSONが不正です'), 'danger');
    throw new Error('invalid_json');
  }
}

async function runCityPackTemplateLibraryAction(action, row) {
  const templateId = row && row.id ? row.id : null;
  if (!templateId) return;
  const trace = ensureTraceInput('monitor-trace');
  const label = t(`ui.label.cityPack.templateLibrary.action.${action}`, action);
  const approved = window.confirm(t(`ui.confirm.cityPack.templateLibrary.${action}`, `${label} を実行しますか？`));
  if (!approved) return;
  try {
    const data = await postJson(`/api/admin/city-pack-template-library/${encodeURIComponent(templateId)}/${action}`, {}, trace);
    if (data && data.ok) {
      showToast(t('ui.toast.cityPack.templateLibraryActionOk', 'Template状態を更新しました'), 'ok');
      await loadCityPackTemplateLibrary({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.templateLibraryActionFail', 'Template状態の更新に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.templateLibraryActionFail', 'Template状態の更新に失敗しました'), 'danger');
  }
}

async function runCityPackTemplateExport() {
  const cityPackId = document.getElementById('city-pack-template-export-pack-id')?.value?.trim() || '';
  if (!cityPackId) {
    showToast(t('ui.toast.cityPack.templateExportNeedPackId', 'cityPackId を入力してください'), 'warn');
    return;
  }
  const trace = ensureTraceInput('monitor-trace');
  try {
    const data = await getJson(`/api/admin/city-packs/${encodeURIComponent(cityPackId)}/export`, trace);
    if (data && data.ok && data.template) {
      const templateText = JSON.stringify(data.template, null, 2);
      const templateInput = document.getElementById('city-pack-template-json');
      if (templateInput) templateInput.value = templateText;
      const summary = document.getElementById('city-pack-template-import-summary');
      if (summary) summary.textContent = `${t('ui.desc.cityPack.templateExportSummary', 'Templateを出力しました')}: ${cityPackId}`;
      showToast(t('ui.toast.cityPack.templateExportOk', 'Templateを出力しました'), 'ok');
    } else {
      showToast(t('ui.toast.cityPack.templateExportFail', 'Templateの出力に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.templateExportFail', 'Templateの出力に失敗しました'), 'danger');
  }
}

async function createCityPackTemplateLibraryEntry() {
  let template = null;
  try {
    template = parseCityPackTemplateJson('city-pack-template-json', 'ui.toast.cityPack.templateJsonInvalid');
  } catch (_err) {
    return;
  }
  if (!template) {
    showToast(t('ui.toast.cityPack.templateNeedJson', 'template JSON を入力してください'), 'warn');
    return;
  }
  const name = template.name ? String(template.name).trim() : '';
  if (!name) {
    showToast(t('ui.toast.cityPack.templateNeedName', 'template.name が必要です'), 'warn');
    return;
  }
  const trace = ensureTraceInput('monitor-trace');
  try {
    const data = await postJson('/api/admin/city-pack-template-library', { name, template, source: 'manual' }, trace);
    if (data && data.ok) {
      showToast(t('ui.toast.cityPack.templateLibraryCreateOk', 'Templateを保存しました'), 'ok');
      await loadCityPackTemplateLibrary({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.templateLibraryCreateFail', 'Templateの保存に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.templateLibraryCreateFail', 'Templateの保存に失敗しました'), 'danger');
  }
}

async function runCityPackTemplateImportDryRun() {
  let template = null;
  try {
    template = parseCityPackTemplateJson('city-pack-template-json', 'ui.toast.cityPack.templateJsonInvalid');
  } catch (_err) {
    return;
  }
  if (!template) {
    showToast(t('ui.toast.cityPack.templateNeedJson', 'template JSON を入力してください'), 'warn');
    return;
  }
  const trace = ensureTraceInput('monitor-trace');
  try {
    const data = await postJson('/api/admin/city-packs/import/dry-run', { template }, trace);
    if (data && data.ok) {
      state.cityPackTemplateImportPlanHash = data.planHash || null;
      state.cityPackTemplateImportConfirmToken = data.confirmToken || null;
      const planHashEl = document.getElementById('city-pack-template-import-plan-hash');
      const tokenEl = document.getElementById('city-pack-template-import-confirm-token');
      const summary = document.getElementById('city-pack-template-import-summary');
      if (planHashEl) planHashEl.value = data.planHash || '';
      if (tokenEl) tokenEl.value = data.confirmToken || '';
      if (summary) summary.textContent = t('ui.desc.cityPack.templateImportDryRunOk', 'Import dry-run を実行しました。');
      showToast(t('ui.toast.cityPack.templateImportDryRunOk', 'Import dry-run を実行しました'), 'ok');
    } else {
      showToast(t('ui.toast.cityPack.templateImportDryRunFail', 'Import dry-run に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.templateImportDryRunFail', 'Import dry-run に失敗しました'), 'danger');
  }
}

async function runCityPackTemplateImportApply() {
  let template = null;
  try {
    template = parseCityPackTemplateJson('city-pack-template-json', 'ui.toast.cityPack.templateJsonInvalid');
  } catch (_err) {
    return;
  }
  if (!template) {
    showToast(t('ui.toast.cityPack.templateNeedJson', 'template JSON を入力してください'), 'warn');
    return;
  }
  const planHashEl = document.getElementById('city-pack-template-import-plan-hash');
  const tokenEl = document.getElementById('city-pack-template-import-confirm-token');
  const planHash = (planHashEl?.value || state.cityPackTemplateImportPlanHash || '').trim();
  const confirmToken = (tokenEl?.value || state.cityPackTemplateImportConfirmToken || '').trim();
  if (!planHash || !confirmToken) {
    showToast(t('ui.toast.cityPack.templateImportNeedDryRun', '先に dry-run を実行してください'), 'warn');
    return;
  }
  const approved = window.confirm(t('ui.confirm.cityPack.templateImportApply', 'Import apply を実行しますか？'));
  if (!approved) return;
  const trace = ensureTraceInput('monitor-trace');
  try {
    const data = await postJson('/api/admin/city-packs/import/apply', {
      template,
      planHash,
      confirmToken
    }, trace);
    if (data && data.ok) {
      const summary = document.getElementById('city-pack-template-import-summary');
      if (summary) {
        summary.textContent = `${t('ui.desc.cityPack.templateImportApplyOk', 'Import apply を実行しました')}: ${data.cityPackId || '-'}`;
      }
      showToast(t('ui.toast.cityPack.templateImportApplyOk', 'Import apply を実行しました'), 'ok');
      await loadCityPackRequests({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.templateImportApplyFail', 'Import apply に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.templateImportApplyFail', 'Import apply に失敗しました'), 'danger');
  }
}

function parseStructureJson(id, fallbackLabelKey) {
  const input = document.getElementById(id);
  if (!input) return [];
  const raw = String(input.value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    showToast(t(fallbackLabelKey, 'JSON形式が不正です'), 'danger');
    throw new Error('invalid_json');
  }
}

async function runCityPackSaveStructure() {
  const cityPackId = state.selectedCityPackDraftId;
  if (!cityPackId) {
    showToast(t('ui.toast.cityPack.structureNeedDraft', 'Draft City Packを先に選択してください'), 'warn');
    return;
  }
  const trace = ensureTraceInput('monitor-trace');
  const basePackId = document.getElementById('city-pack-structure-base-pack-id')?.value?.trim() || '';
  let targetingRules;
  let slots;
  try {
    targetingRules = parseStructureJson('city-pack-structure-targeting', 'ui.toast.cityPack.structureInvalidTargeting');
    slots = parseStructureJson('city-pack-structure-slots', 'ui.toast.cityPack.structureInvalidSlots');
  } catch (_err) {
    return;
  }
  const approved = window.confirm(t('ui.confirm.cityPack.structureSave', 'Rule Pack / Slots を保存しますか？'));
  if (!approved) return;
  try {
    const data = await postJson(`/api/admin/city-packs/${encodeURIComponent(cityPackId)}/structure`, {
      basePackId: basePackId || null,
      targetingRules,
      slots
    }, trace);
    if (data && data.ok) {
      showToast(t('ui.toast.cityPack.structureSaved', 'Rule Pack / Slots を保存しました'), 'ok');
      if (state.selectedCityPackRequestId) {
        await loadCityPackRequestDetail(state.selectedCityPackRequestId);
      }
      await loadCityPackRequests({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.structureSaveFail', 'Rule Pack / Slots の保存に失敗しました'), 'danger');
    }
  } catch (_err) {
    showToast(t('ui.toast.cityPack.structureSaveFail', 'Rule Pack / Slots の保存に失敗しました'), 'danger');
  }
}

async function runCityPackAuditJob() {
  const trace = ensureTraceInput('monitor-trace');
  const stage = document.getElementById('city-pack-run-mode')?.value === 'heavy' ? 'heavy' : 'light';
  const mode = stage === 'heavy' ? 'canary' : 'scheduled';
  const packClass = document.getElementById('city-pack-pack-class-filter')?.value || '';
  const resultEl = document.getElementById('city-pack-run-result');
  const approved = window.confirm(t('ui.confirm.cityPack.runAudit', 'City Pack監査ジョブを実行しますか？'));
  if (!approved) return;
  try {
    const data = await postJson('/api/admin/city-pack-source-audit/run', {
      mode,
      stage,
      packClass: packClass || null,
      runId: `cp_manual_${Date.now()}`
    }, trace);
    if (resultEl) resultEl.textContent = JSON.stringify(data || {}, null, 2);
    if (data && data.ok) {
      showToast(t('ui.toast.cityPack.runOk', '監査ジョブを実行しました'), 'ok');
      await loadCityPackReviewInbox({ notify: false });
      await loadCityPackKpi({ notify: false });
      await loadCityPackAuditRuns({ notify: false });
    } else {
      showToast(t('ui.toast.cityPack.runFail', '監査ジョブの実行に失敗しました'), 'danger');
    }
  } catch (_err) {
    if (resultEl) resultEl.textContent = JSON.stringify({ ok: false, error: 'fetch error' }, null, 2);
    showToast(t('ui.toast.cityPack.runFail', '監査ジョブの実行に失敗しました'), 'danger');
  }
}

function navigateToMonitorWithTrace(traceId, lineUserId) {
  const normalizedTrace = traceId || (resolveCoreSlice('traceCore') && typeof resolveCoreSlice('traceCore').getTraceFromUrl === 'function'
    ? resolveCoreSlice('traceCore').getTraceFromUrl(globalThis.location.search)
    : null);
  activatePane('monitor');
  const monitorTrace = document.getElementById('monitor-trace');
  if (monitorTrace && normalizedTrace) monitorTrace.value = normalizedTrace;
  const auditTrace = document.getElementById('audit-trace');
  if (auditTrace && normalizedTrace) auditTrace.value = normalizedTrace;
  const userIdInput = document.getElementById('monitor-user-line-user-id');
  if (userIdInput && lineUserId) userIdInput.value = lineUserId;
  void loadMonitorData({ notify: false });
  if (lineUserId) void loadMonitorUserDeliveries({ notify: false });
}

async function runHomeSafeTest() {
  const notificationId = document.getElementById('home-test-notification-id')?.value?.trim() || '';
  const lineUserId = document.getElementById('home-test-line-user-id')?.value?.trim() || '';
  const mode = document.getElementById('home-test-mode')?.value === 'self_send' ? 'self_send' : 'dry_run';
  const traceId = ensureTraceInput('monitor-trace');
  const resultEl = document.getElementById('home-test-result');
  if (!notificationId) {
    showToast(t('ui.toast.home.testNeedNotificationId', '通知IDを入力してください'), 'warn');
    return;
  }
  if (mode === 'self_send' && !lineUserId) {
    showToast(t('ui.toast.home.testNeedLineUserId', '自己送信にはLINEユーザーIDが必要です'), 'warn');
    return;
  }
  if (mode === 'self_send') {
    const approved = window.confirm(t('ui.confirm.home.testSelfSend', '自己送信テストを実行しますか？'));
    if (!approved) {
      showToast(t('ui.toast.home.testCanceled', 'テストを中止しました'), 'warn');
      return;
    }
  }
  try {
    const data = await postJson('/api/admin/send-test', { notificationId, lineUserId: lineUserId || null, mode }, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(data, null, 2);
    if (data && data.ok) {
      showToast(t('ui.toast.home.testOk', '安全テストを実行しました'), 'ok');
      navigateToMonitorWithTrace(data.traceId || traceId, lineUserId || null);
    } else {
      showToast(t('ui.toast.home.testFail', '安全テストに失敗しました'), 'danger');
    }
  } catch (_err) {
    if (resultEl) resultEl.textContent = JSON.stringify({ ok: false, error: 'fetch error' }, null, 2);
    showToast(t('ui.toast.home.testFail', '安全テストに失敗しました'), 'danger');
  }
}

async function loadAudit() {
  const traceId = ensureTraceInput('audit-trace');
  if (!traceId) return;
  const res = await fetch(`/api/admin/trace?traceId=${encodeURIComponent(traceId)}`, { headers: buildHeaders({}, traceId) });
  const data = await res.json();
  const result = document.getElementById('audit-result');
  const detail = document.getElementById('audit-detail');
  if (result) result.textContent = JSON.stringify(data || {}, null, 2);
  if (detail) detail.textContent = JSON.stringify(data || {}, null, 2);
}

function parseStructDriftScanLimit() {
  const el = document.getElementById('struct-drift-scan-limit');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 500;
  return Math.min(Math.floor(value), 5000);
}

function readStructDriftResumeAfterUserId() {
  const el = document.getElementById('struct-drift-resume-after');
  const value = el && typeof el.value === 'string' ? el.value.trim() : '';
  return value || null;
}

function renderStructDriftRuns(items) {
  const tbody = document.getElementById('struct-drift-runs-rows');
  const summaryEl = document.getElementById('struct-drift-summary');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'cell-muted';
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (summaryEl) summaryEl.textContent = t('ui.desc.structDrift.summaryEmpty', '実行履歴はありません。');
    return;
  }
  rows.forEach((item) => {
    const tr = document.createElement('tr');
    const cols = [
      formatDateLabel(item.createdAt),
      item.mode || '-',
      Number.isFinite(Number(item.changedCount)) ? String(item.changedCount) : '-',
      item.traceId || '-'
    ];
    cols.forEach((value, index) => {
      const td = document.createElement('td');
      if (index === 2) td.classList.add('cell-num');
      td.textContent = value;
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => {
      const trace = item && item.traceId ? String(item.traceId) : '';
      if (!trace) return;
      const traceInput = document.getElementById('audit-trace');
      if (traceInput) traceInput.value = trace;
      void loadAudit().catch(() => {
        showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
      });
    });
    tbody.appendChild(tr);
  });
  if (summaryEl) {
    const latest = rows[0];
    summaryEl.textContent = `${t('ui.label.structDrift.summary', '最新')}: ${formatDateLabel(latest.createdAt)} / ${latest.mode || '-'} / changed=${Number.isFinite(Number(latest.changedCount)) ? latest.changedCount : '-'}`;
  }
}

function renderStructDriftResult(result) {
  const pre = document.getElementById('struct-drift-result');
  if (!pre) return;
  pre.textContent = JSON.stringify(result || {}, null, 2);
}

async function loadStructDriftRuns(options) {
  const opts = options || {};
  const traceId = ensureTraceInput('audit-trace');
  try {
    const res = await fetch('/api/admin/struct-drift/backfill-runs?limit=20', { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error('failed');
    state.structDriftRuns = Array.isArray(data.items) ? data.items : [];
    renderStructDriftRuns(state.structDriftRuns);
    if (opts.notify) showToast(t('ui.toast.structDrift.runsLoaded', '構造ドリフト補正の実行履歴を更新しました'), 'ok');
  } catch (_err) {
    renderStructDriftRuns([]);
    if (opts.notify) showToast(t('ui.toast.structDrift.runsLoadFail', '構造ドリフト補正の実行履歴取得に失敗しました'), 'danger');
  }
}

async function runStructDriftBackfill(mode) {
  const apply = mode === 'apply';
  const traceId = ensureTraceInput('audit-trace');
  const payload = {
    scanLimit: parseStructDriftScanLimit(),
    resumeAfterUserId: readStructDriftResumeAfterUserId(),
    dryRun: !apply,
    apply
  };
  if (apply) {
    const approved = window.confirm(t('ui.confirm.structDrift.apply', '構造ドリフト補正を適用しますか？'));
    if (!approved) {
      showToast(t('ui.toast.structDrift.canceled', '構造ドリフト補正を中止しました'), 'warn');
      return;
    }
    payload.confirmApply = true;
  }
  try {
    const data = await postJson('/api/admin/struct-drift/backfill', payload, traceId);
    state.structDriftLastResult = data || null;
    renderStructDriftResult(data);
    if (data && data.ok) {
      const summary = data.summary || {};
      const nextResume = summary && summary.nextResumeAfterUserId ? String(summary.nextResumeAfterUserId) : '';
      if (nextResume) {
        const resumeEl = document.getElementById('struct-drift-resume-after');
        if (resumeEl) resumeEl.value = nextResume;
      }
      showToast(
        apply
          ? t('ui.toast.structDrift.applyOk', '構造ドリフト補正を適用しました')
          : t('ui.toast.structDrift.dryOk', '構造ドリフト補正をdry-runで実行しました'),
        'ok'
      );
      await loadStructDriftRuns({ notify: false });
    } else {
      showToast(
        apply
          ? t('ui.toast.structDrift.applyFail', '構造ドリフト補正の適用に失敗しました')
          : t('ui.toast.structDrift.dryFail', '構造ドリフト補正dry-runに失敗しました'),
        'danger'
      );
    }
  } catch (_err) {
    showToast(
      apply
        ? t('ui.toast.structDrift.applyFail', '構造ドリフト補正の適用に失敗しました')
        : t('ui.toast.structDrift.dryFail', '構造ドリフト補正dry-runに失敗しました'),
      'danger'
    );
  }
}

function parseSnapshotHealthLimit() {
  const el = document.getElementById('maintenance-snapshot-health-limit');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.min(Math.floor(value), 200);
}

function parseSnapshotHealthStaleAfterMinutes() {
  const el = document.getElementById('maintenance-snapshot-health-stale-after');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 60;
  return Math.min(Math.floor(value), 1440);
}

function readSnapshotHealthTypeFilter() {
  const el = document.getElementById('maintenance-snapshot-health-type');
  const value = el && typeof el.value === 'string' ? el.value.trim() : '';
  return value || null;
}

function renderSnapshotHealth(items) {
  const tbody = document.getElementById('maintenance-snapshot-health-rows');
  const note = document.getElementById('maintenance-snapshot-health-note');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'cell-muted';
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (note) note.textContent = t('ui.desc.maintenance.snapshotHealth.empty', 'Snapshot はありません。');
    return;
  }
  rows.forEach((item) => {
    const tr = document.createElement('tr');
    const cols = [
      item && item.snapshotType ? String(item.snapshotType) : '-',
      item && item.snapshotKey ? String(item.snapshotKey) : '-',
      formatDateLabel(item && item.asOf),
      item && item.isStale ? t('ui.value.boolean.yes', 'はい') : t('ui.value.boolean.no', 'いいえ'),
      item && item.sourceTraceId ? String(item.sourceTraceId) : '-',
      formatDateLabel(item && item.updatedAt)
    ];
    cols.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => {
      const trace = item && item.sourceTraceId ? String(item.sourceTraceId) : '';
      if (!trace) return;
      const traceInput = document.getElementById('audit-trace');
      if (traceInput) traceInput.value = trace;
      void loadAudit().catch(() => {
        showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
      });
    });
    tbody.appendChild(tr);
  });
  if (note) {
    const staleCount = rows.filter((row) => row && row.isStale).length;
    note.textContent = `${t('ui.label.maintenance.snapshotHealth.summary', 'stale件数')}: ${staleCount} / ${rows.length}`;
  }
}

async function loadSnapshotHealth(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const traceId = ensureTraceInput('audit-trace');
  const limit = parseSnapshotHealthLimit();
  const staleAfterMinutes = parseSnapshotHealthStaleAfterMinutes();
  const snapshotType = readSnapshotHealthTypeFilter();
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  qs.set('staleAfterMinutes', String(staleAfterMinutes));
  if (snapshotType) qs.set('snapshotType', snapshotType);
  try {
    const res = await fetch(`/api/admin/ops-snapshot-health?${qs.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error('failed');
    state.snapshotHealthItems = Array.isArray(data.items) ? data.items : [];
    renderSnapshotHealth(state.snapshotHealthItems);
    if (notify) showToast(t('ui.toast.maintenance.snapshotHealth.reloadOk', 'Snapshot健全性を更新しました'), 'ok');
  } catch (_err) {
    state.snapshotHealthItems = [];
    renderSnapshotHealth([]);
    renderDataLoadFailureGuard('snapshot_health_failed', _err);
    if (notify) showToast(t('ui.toast.maintenance.snapshotHealth.reloadFail', 'Snapshot健全性の取得に失敗しました'), 'danger');
  }
}

function parseRetentionRunsLimit() {
  const el = document.getElementById('maintenance-retention-runs-limit');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.min(Math.floor(value), 200);
}

function readRetentionRunsTraceFilter() {
  const el = document.getElementById('maintenance-retention-runs-trace');
  const value = el && typeof el.value === 'string' ? el.value.trim() : '';
  return value || null;
}

function formatRetentionAction(action) {
  if (action === 'retention.dry_run.execute') return 'dry-run';
  if (action === 'retention.apply.execute') return 'apply';
  if (action === 'retention.apply.blocked') return 'blocked';
  return action || '-';
}

function renderRetentionRuns(items) {
  const tbody = document.getElementById('maintenance-retention-runs-rows');
  const note = document.getElementById('maintenance-retention-runs-note');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'cell-muted';
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (note) note.textContent = t('ui.desc.maintenance.retentionRuns.empty', '実行履歴はありません。');
    return;
  }
  rows.forEach((item) => {
    const tr = document.createElement('tr');
    const deletedCount = Number.isFinite(Number(item && item.deletedCount)) ? Number(item.deletedCount) : 0;
    const collectionText = item && item.collection
      ? String(item.collection)
      : (Array.isArray(item && item.collections) && item.collections.length ? item.collections.join(',') : '-');
    const cols = [
      formatDateLabel(item && item.createdAt),
      formatRetentionAction(item && item.action),
      String(deletedCount),
      collectionText,
      item && item.traceId ? String(item.traceId) : '-',
      item && item.dryRunTraceId ? String(item.dryRunTraceId) : '-'
    ];
    cols.forEach((value, index) => {
      const td = document.createElement('td');
      if (index === 2) td.classList.add('cell-num');
      td.textContent = value;
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => {
      const trace = item && item.traceId ? String(item.traceId) : '';
      if (!trace) return;
      const traceInput = document.getElementById('audit-trace');
      if (traceInput) traceInput.value = trace;
      void loadAudit().catch(() => {
        showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
      });
    });
    tbody.appendChild(tr);
  });
  if (note) {
    const latest = rows[0];
    const latestText = latest
      ? `${formatDateLabel(latest.createdAt)} / ${formatRetentionAction(latest.action)} / deleted=${Number.isFinite(Number(latest.deletedCount)) ? Number(latest.deletedCount) : 0}`
      : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    note.textContent = `${t('ui.label.maintenance.retentionRuns.summary', '最新')}: ${latestText}`;
  }
}

async function loadRetentionRuns(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const traceId = ensureTraceInput('audit-trace');
  const limit = parseRetentionRunsLimit();
  const queryTraceId = readRetentionRunsTraceFilter();
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  if (queryTraceId) qs.set('traceId', queryTraceId);
  try {
    const res = await fetch(`/api/admin/retention-runs?${qs.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error('failed');
    state.retentionRuns = Array.isArray(data.items) ? data.items : [];
    renderRetentionRuns(state.retentionRuns);
    if (notify) showToast(t('ui.toast.maintenance.retentionRuns.reloadOk', 'Retention実行履歴を更新しました'), 'ok');
  } catch (_err) {
    state.retentionRuns = [];
    renderRetentionRuns([]);
    if (notify) showToast(t('ui.toast.maintenance.retentionRuns.reloadFail', 'Retention実行履歴の取得に失敗しました'), 'danger');
  }
}

function parseReadPathFallbackSummaryLimit() {
  const el = document.getElementById('maintenance-fallback-summary-limit');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 20;
  return Math.min(Math.floor(value), 200);
}

function parseReadPathFallbackSummaryWindowHours() {
  const el = document.getElementById('maintenance-fallback-summary-window');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 24;
  return Math.min(Math.floor(value), 24 * 30);
}

function renderReadPathFallbackSummary(items) {
  const tbody = document.getElementById('maintenance-fallback-summary-rows');
  const note = document.getElementById('maintenance-fallback-summary-note');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'cell-muted';
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (note) note.textContent = t('ui.desc.maintenance.fallbackSummary.empty', 'fallback サマリーはありません。');
    return;
  }
  rows.forEach((item) => {
    const tr = document.createElement('tr');
    const cols = [
      item && item.endpoint ? String(item.endpoint) : '-',
      item && item.action ? String(item.action) : '-',
      String(Number.isFinite(Number(item && item.count)) ? Number(item.count) : 0),
      String(Number.isFinite(Number(item && item.fallbackUsedCount)) ? Number(item.fallbackUsedCount) : 0),
      String(Number.isFinite(Number(item && item.fallbackBlockedCount)) ? Number(item.fallbackBlockedCount) : 0),
      formatDateLabel(item && item.latestCreatedAt),
      item && item.latestTraceId ? String(item.latestTraceId) : '-'
    ];
    cols.forEach((value, index) => {
      const td = document.createElement('td');
      if (index >= 2 && index <= 4) td.classList.add('cell-num');
      td.textContent = value;
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => {
      const trace = item && item.latestTraceId ? String(item.latestTraceId) : '';
      if (!trace) return;
      const traceInput = document.getElementById('audit-trace');
      if (traceInput) traceInput.value = trace;
      void loadAudit().catch(() => {
        showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
      });
    });
    tbody.appendChild(tr);
  });
  if (note) {
    const total = rows.reduce((sum, row) => sum + (Number.isFinite(Number(row && row.count)) ? Number(row.count) : 0), 0);
    note.textContent = `${t('ui.label.maintenance.fallbackSummary.summary', 'fallback件数')}: ${total}`;
  }
}

async function loadReadPathFallbackSummary(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const traceId = ensureTraceInput('audit-trace');
  const limit = parseReadPathFallbackSummaryLimit();
  const windowHours = parseReadPathFallbackSummaryWindowHours();
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  qs.set('windowHours', String(windowHours));
  try {
    const res = await fetch(`/api/admin/read-path-fallback-summary?${qs.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error('failed');
    state.readPathFallbackSummary = Array.isArray(data.items) ? data.items : [];
    renderReadPathFallbackSummary(state.readPathFallbackSummary);
    renderCityPackCompositionDiagnostics();
    if (notify) showToast(t('ui.toast.maintenance.fallbackSummary.reloadOk', 'read-path fallback サマリーを更新しました'), 'ok');
  } catch (_err) {
    state.readPathFallbackSummary = [];
    renderReadPathFallbackSummary([]);
    renderCityPackCompositionDiagnostics();
    if (notify) showToast(t('ui.toast.maintenance.fallbackSummary.reloadFail', 'read-path fallback サマリーの取得に失敗しました'), 'danger');
  }
}

function parseMissingIndexSurfaceLimit() {
  const el = document.getElementById('maintenance-missing-index-limit');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.min(Math.floor(value), 200);
}

function readMissingIndexSurfaceFileFilter() {
  const el = document.getElementById('maintenance-missing-index-file-filter');
  const value = el && typeof el.value === 'string' ? el.value.trim() : '';
  return value || null;
}

function formatMissingIndexPolicy(policy) {
  const row = policy && typeof policy === 'object' ? policy : {};
  const prod = row.production ? String(row.production) : '-';
  const local = row.local ? String(row.local) : '-';
  return `prod=${prod} / local=${local}`;
}

function renderMissingIndexSurface(payload) {
  const tbody = document.getElementById('maintenance-missing-index-rows');
  const note = document.getElementById('maintenance-missing-index-note');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = Array.isArray(payload && payload.items) ? payload.items : [];
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'cell-muted';
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (note) note.textContent = t('ui.desc.maintenance.missingIndexSurface.empty', 'missing-index surface はありません。');
    return;
  }
  rows.forEach((item) => {
    const tr = document.createElement('tr');
    const lines = Array.isArray(item && item.lines) ? item.lines.map((line) => String(line)).join(',') : '-';
    const occurrences = Number.isFinite(Number(item && item.occurrences)) ? Number(item.occurrences) : 0;
    const cols = [
      item && item.file ? String(item.file) : '-',
      item && item.call ? String(item.call) : '-',
      lines || '-',
      String(occurrences),
      formatMissingIndexPolicy(item && item.policy)
    ];
    cols.forEach((value, index) => {
      const td = document.createElement('td');
      if (index === 3) td.classList.add('cell-num');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  if (note) {
    const generatedAt = payload && payload.generatedAt ? formatDateLabel(payload.generatedAt) : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
    const surfaceCount = Number.isFinite(Number(payload && payload.surfaceCount)) ? Number(payload.surfaceCount) : rows.length;
    note.textContent = `${t('ui.label.maintenance.missingIndexSurface.summary', 'surface件数')}: ${surfaceCount} / generatedAt=${generatedAt}`;
  }
}

async function loadMissingIndexSurface(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const traceId = ensureTraceInput('audit-trace');
  const limit = parseMissingIndexSurfaceLimit();
  const fileContains = readMissingIndexSurfaceFileFilter();
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  if (fileContains) qs.set('fileContains', fileContains);
  try {
    const res = await fetch(`/api/admin/missing-index-surface?${qs.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error('failed');
    state.missingIndexSurfaceItems = Array.isArray(data.items) ? data.items : [];
    state.missingIndexSurfaceMeta = data;
    renderMissingIndexSurface(data);
    if (notify) showToast(t('ui.toast.maintenance.missingIndexSurface.reloadOk', 'missing-index surface を更新しました'), 'ok');
  } catch (_err) {
    state.missingIndexSurfaceItems = [];
    state.missingIndexSurfaceMeta = null;
    renderMissingIndexSurface(null);
    if (notify) showToast(t('ui.toast.maintenance.missingIndexSurface.reloadFail', 'missing-index surface の取得に失敗しました'), 'danger');
  }
}

function parseProductReadinessWindowHours() {
  const el = document.getElementById('maintenance-product-readiness-window');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 24;
  return Math.min(Math.floor(value), 24 * 30);
}

function parseProductReadinessStaleAfterMinutes() {
  const el = document.getElementById('maintenance-product-readiness-stale-after');
  const value = Number(el && el.value);
  if (!Number.isFinite(value) || value <= 0) return 60;
  return Math.min(Math.floor(value), 1440);
}

function renderProductReadiness(payload) {
  const statusEl = document.getElementById('maintenance-product-readiness-status');
  const blockerCountEl = document.getElementById('maintenance-product-readiness-blocker-count');
  const blockersEl = document.getElementById('maintenance-product-readiness-blockers');
  const noteEl = document.getElementById('maintenance-product-readiness-note');
  const status = payload && payload.status ? String(payload.status) : t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE');
  const blockers = Array.isArray(payload && payload.blockers) ? payload.blockers : [];

  if (statusEl) statusEl.textContent = status;
  if (blockerCountEl) blockerCountEl.textContent = String(blockers.length);
  if (blockersEl) {
    blockersEl.innerHTML = '';
    if (!blockers.length) {
      const li = document.createElement('li');
      li.textContent = t('ui.desc.maintenance.productReadiness.blockersEmpty', 'blocker はありません。');
      blockersEl.appendChild(li);
    } else {
      blockers.forEach((item) => {
        const li = document.createElement('li');
        const code = item && item.code ? String(item.code) : '-';
        const message = item && item.message ? String(item.message) : '-';
        li.textContent = `${code}: ${message}`;
        blockersEl.appendChild(li);
      });
    }
  }
  if (noteEl) {
    const fallbackCount = payload && payload.checks && payload.checks.fallbackSpikes
      && Number.isFinite(Number(payload.checks.fallbackSpikes.count))
      ? Number(payload.checks.fallbackSpikes.count)
      : null;
    const missingIndexSurfaceCount = payload && payload.checks && payload.checks.missingIndexSurface
      && Number.isFinite(Number(payload.checks.missingIndexSurface.surfaceCount))
      ? Number(payload.checks.missingIndexSurface.surfaceCount)
      : null;
    const staleRatio = payload && payload.checks && payload.checks.snapshotHealth
      && Number.isFinite(Number(payload.checks.snapshotHealth.staleRatio))
      ? Number(payload.checks.snapshotHealth.staleRatio)
      : null;
    if (fallbackCount === null && staleRatio === null && missingIndexSurfaceCount === null) {
      noteEl.textContent = t('ui.desc.maintenance.productReadiness.note', 'GO/NO_GO は運用判断の参考値です。');
    } else {
      const staleText = staleRatio === null ? '-' : `${Math.round(staleRatio * 1000) / 10}%`;
      const fallbackText = fallbackCount === null ? '-' : String(fallbackCount);
      const missingIndexText = missingIndexSurfaceCount === null ? '-' : String(missingIndexSurfaceCount);
      noteEl.textContent = `${t('ui.label.maintenance.productReadiness.summary', 'snapshot stale率 / fallback件数 / missing-index surface')}: ${staleText} / ${fallbackText} / ${missingIndexText}`;
    }
  }
}

async function loadProductReadiness(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const notify = opts.notify === true;
  const traceId = ensureTraceInput('audit-trace');
  const windowHours = parseProductReadinessWindowHours();
  const staleAfterMinutes = parseProductReadinessStaleAfterMinutes();
  const qs = new URLSearchParams();
  qs.set('windowHours', String(windowHours));
  qs.set('staleAfterMinutes', String(staleAfterMinutes));
  try {
    const res = await fetch(`/api/admin/product-readiness?${qs.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error('failed');
    state.productReadiness = data;
    renderProductReadiness(data);
    renderCityPackCompositionDiagnostics();
    if (notify) showToast(t('ui.toast.maintenance.productReadiness.reloadOk', 'Product Readiness 判定を更新しました'), 'ok');
  } catch (_err) {
    state.productReadiness = null;
    renderProductReadiness(null);
    renderCityPackCompositionDiagnostics();
    renderDataLoadFailureGuard('product_readiness_failed', _err);
    if (notify) showToast(t('ui.toast.maintenance.productReadiness.reloadFail', 'Product Readiness 判定の取得に失敗しました'), 'danger');
  }
}

function normalizeComposerType(value) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'GENERAL' || raw === 'ANNOUNCEMENT' || raw === 'VENDOR' || raw === 'AB' || raw === 'STEP') return raw;
  return 'STEP';
}

function selectedComposerType() {
  const typeEl = document.getElementById('notificationType');
  return normalizeComposerType(typeEl ? typeEl.value : '');
}

function composerTypeHint(type) {
  if (type === 'GENERAL') return t('ui.desc.composer.typeHint.general', '一般通知: 重要な連絡を簡潔に送ります。');
  if (type === 'ANNOUNCEMENT') return t('ui.desc.composer.typeHint.announcement', 'お知らせ: 公開期限と優先度を必要な場合のみ指定します。');
  if (type === 'VENDOR') return t('ui.desc.composer.typeHint.vendor', 'ベンダー通知: ベンダーIDを必須入力してください。');
  if (type === 'AB') return t('ui.desc.composer.typeHint.ab', 'ABテスト: 比率と指標を設定して比較します。');
  return t('ui.desc.composer.typeHint.step', 'ステップ通知: シナリオとステップを指定して対象を絞り込みます。');
}

function applyComposerTypeFields() {
  const selected = selectedComposerType();
  document.querySelectorAll('#composer-type-fields .type-fields').forEach((el) => {
    const type = normalizeComposerType(el.getAttribute('data-type-fields') || '');
    if (type === selected) el.classList.add('is-active');
    else el.classList.remove('is-active');
  });
  if (selected !== 'STEP') {
    const scenarioEl = document.getElementById('scenarioKey');
    const stepEl = document.getElementById('stepKey');
    const targetLimitEl = document.getElementById('targetLimit');
    const targetRegionEl = document.getElementById('targetRegion');
    const membersOnlyEl = document.getElementById('membersOnly');
    if (scenarioEl) scenarioEl.value = 'A';
    if (stepEl) stepEl.value = 'week';
    if (targetLimitEl) targetLimitEl.value = '50';
    if (targetRegionEl) targetRegionEl.value = '';
    if (membersOnlyEl) membersOnlyEl.checked = false;
  }
  const hintEl = document.getElementById('composer-type-hint');
  if (hintEl) hintEl.textContent = composerTypeHint(selected);
}

function mapComposerStatusLabel(statusLabelValue) {
  const raw = typeof statusLabelValue === 'string' ? statusLabelValue.toUpperCase() : '';
  if (raw === 'ACTIVE') return 'approved';
  if (raw === 'SENT') return 'executed';
  return 'draft';
}

function updateComposerStatusPill() {
  const pill = document.getElementById('composer-status-pill');
  if (!pill) return;
  const mapped = mapComposerStatusLabel(state.currentComposerStatus);
  pill.textContent = mapped;
  pill.className = 'badge badge-info';
  if (mapped === 'approved') pill.className = 'badge badge-warn';
  if (mapped === 'executed') pill.className = 'badge badge-ok';
}

function buildComposerNotificationMeta(type) {
  if (type === 'ANNOUNCEMENT') {
    const expiry = document.getElementById('metaAnnouncementExpiry')?.value?.trim() || '';
    const priority = document.getElementById('metaAnnouncementPriority')?.value?.trim() || '';
    const meta = {};
    if (expiry) meta.expiry = expiry;
    if (priority) meta.priority = priority;
    return Object.keys(meta).length ? meta : null;
  }
  if (type === 'VENDOR') {
    const vendorId = document.getElementById('metaVendorId')?.value?.trim() || '';
    const targeting = document.getElementById('metaVendorTargeting')?.value?.trim() || '';
    const meta = {};
    if (vendorId) meta.vendorId = vendorId;
    if (targeting) meta.targeting = targeting;
    return Object.keys(meta).length ? meta : null;
  }
  if (type === 'AB') {
    const variants = document.getElementById('metaAbVariants')?.value?.trim() || '';
    const ratio = document.getElementById('metaAbRatio')?.value?.trim() || '';
    const metric = document.getElementById('metaAbMetric')?.value?.trim() || '';
    const meta = {};
    if (variants) meta.variants = variants;
    if (ratio) meta.ratio = ratio;
    if (metric) meta.metric = metric;
    return Object.keys(meta).length ? meta : null;
  }
  if (type === 'STEP') {
    const membersOnly = Boolean(document.getElementById('membersOnly')?.checked);
    const meta = {};
    if (membersOnly) meta.membersOnly = true;
    return Object.keys(meta).length ? meta : null;
  }
  return null;
}

function renderComposerLivePreview() {
  const title = document.getElementById('title')?.value?.trim() || '-';
  const body = document.getElementById('body')?.value || '-';
  const cta = document.getElementById('ctaText')?.value?.trim() || '-';
  const cta2 = document.getElementById('ctaText2')?.value?.trim() || '';
  const previewTitle = document.getElementById('composer-preview-title');
  const previewBody = document.getElementById('composer-preview-body');
  const previewCta = document.getElementById('composer-preview-cta');
  const previewCta2 = document.getElementById('composer-preview-cta2');
  const previewLink = document.getElementById('composer-preview-link');
  if (previewTitle) previewTitle.textContent = title;
  if (previewBody) previewBody.textContent = body;
  if (previewCta) previewCta.textContent = cta;
  if (previewCta2) {
    previewCta2.textContent = cta2 || '-';
    previewCta2.classList.toggle('is-hidden', !cta2);
  }
  if (previewLink) {
    const link = state.composerLinkPreview;
    if (link && link.id) {
      const label = link.label || link.title || link.id;
      previewLink.textContent = `${label}${link.url ? ` (${link.url})` : ''}`;
    } else {
      const linkId = document.getElementById('linkRegistryId')?.value?.trim() || '';
      previewLink.textContent = linkId ? linkId : '-';
    }
  }
}

function buildComposerLocalSafetyIssues(payload) {
  const issues = [];
  if (state.composerKillSwitch) {
    issues.push(t('ui.desc.composer.safety.killSwitch', 'KillSwitchがONです。送信を停止してから再実行してください。'));
  }
  if (!payload.title || !payload.body || !payload.ctaText || !payload.linkRegistryId) {
    issues.push(t('ui.desc.composer.safety.required', '必須項目が未入力です。タイトル・本文・ボタン文言1・リンクIDを入力してください。'));
  }
  if (looksLikeDirectUrl(payload.linkRegistryId || '')) {
    issues.push(t('ui.desc.composer.safety.directUrl', 'リンクIDにはURLを直接入力できません。リンク管理IDを指定してください。'));
  }
  if (payload.notificationType === 'STEP') {
    if (!COMPOSER_ALLOWED_SCENARIOS.has(String(payload.scenarioKey || ''))) {
      issues.push(t('ui.desc.composer.safety.scenario', 'シナリオが不正です。A/B/C/Dから選択してください。'));
    }
    if (!COMPOSER_ALLOWED_STEPS.has(String(payload.stepKey || ''))) {
      issues.push(t('ui.desc.composer.safety.step', 'ステップが不正です。定義済みステップを選択してください。'));
    }
  }
  if (payload.notificationType === 'AB') {
    const cta2 = document.getElementById('ctaText2')?.value?.trim() || '';
    if (cta2) {
      issues.push(t('ui.desc.composer.safety.cta2PreviewOnly', 'CTA2はプレビュー専用です。送信ではCTA1のみ使用されます。'));
    }
  }
  if (!payload.target || !Number.isFinite(Number(payload.target.limit)) || Number(payload.target.limit) <= 0) {
    issues.push(t('ui.desc.composer.safety.target', '対象件数が0です。1以上の上限件数を指定してください。'));
  }
  if (state.composerLinkPreview && state.composerLinkPreview.state === 'WARN') {
    issues.push(t('ui.desc.composer.safety.linkWarn', 'リンク状態がWARNです。リンク管理の状態を解消してください。'));
  }
  return issues;
}

function renderComposerSafety(issues) {
  const badge = document.getElementById('composer-safety');
  const listEl = document.getElementById('composer-safety-reasons');
  const banner = document.getElementById('composer-killswitch-banner');
  if (banner) {
    banner.classList.toggle('is-visible', state.composerKillSwitch);
    banner.textContent = state.composerKillSwitch
      ? t('ui.desc.composer.killSwitchBanner', 'KillSwitchがONです。通知送信は停止中です。')
      : '';
  }
  if (badge) {
    const hasIssue = Array.isArray(issues) && issues.length > 0;
    badge.className = hasIssue ? 'badge badge-danger' : 'badge badge-ok';
    badge.textContent = hasIssue ? 'NG' : 'OK';
    state.lastRisk = hasIssue
      ? t('ui.desc.composer.riskNeedsAction', '運用で解消できる要対応があります')
      : t('ui.desc.composer.riskOk', '問題なし');
  }
  if (!listEl) return;
  listEl.innerHTML = '';
  const values = Array.isArray(issues) && issues.length ? issues : [t('ui.desc.composer.safety.ok', '修正が必要な項目はありません。')];
  values.forEach((reason) => {
    const li = document.createElement('li');
    li.textContent = reason;
    listEl.appendChild(li);
  });
}

function updateComposerSummary() {
  applyComposerTypeFields();
  updateComposerStatusPill();
  renderComposerLivePreview();
  const payload = buildDraftPayload();
  const issues = buildComposerLocalSafetyIssues(payload);
  renderComposerSafety(issues);
}

function setComposerStatus(tone, label) {
  state.composerTone = tone || 'unknown';
  state.currentComposerStatus = label || '-';
  state.composerUpdatedAt = new Date().toISOString();
  updateComposerSummary();
  renderAllDecisionCards();
}

function updateSafetyBadge(result) {
  const payload = buildDraftPayload();
  const issues = buildComposerLocalSafetyIssues(payload);
  if (!result || !result.ok) {
    issues.push(t('ui.desc.composer.safety.planFail', '送信計画の作成に失敗しました。入力とリンク状態を確認してください。'));
  } else {
    if (Number(result.count || 0) <= 0) {
      issues.push(t('ui.desc.composer.safety.planZero', '対象数が0のため送信できません。対象条件を見直してください。'));
    }
    if (Number(result.capBlockedCount || 0) > 0) {
      issues.push(t('ui.desc.composer.safety.planBlocked', '抑制対象が含まれています。上限設定または対象条件を調整してください。'));
    }
  }
  renderComposerSafety(issues);
}

function buildDraftPayload() {
  const notificationType = selectedComposerType();
  const scenarioKey = notificationType === 'STEP'
    ? (document.getElementById('scenarioKey')?.value || 'A')
    : 'A';
  const stepKey = notificationType === 'STEP'
    ? (document.getElementById('stepKey')?.value || 'week')
    : 'week';
  const notificationMeta = buildComposerNotificationMeta(notificationType);
  return {
    title: document.getElementById('title')?.value?.trim() || '',
    body: document.getElementById('body')?.value || '',
    ctaText: document.getElementById('ctaText')?.value?.trim() || '',
    linkRegistryId: document.getElementById('linkRegistryId')?.value?.trim() || '',
    scenarioKey,
    stepKey,
    notificationCategory: document.getElementById('notificationCategory')?.value || 'SEQUENCE_GUIDANCE',
    notificationType,
    notificationMeta,
    target: buildTarget(notificationType)
  };
}

function buildTarget(notificationType) {
  const type = normalizeComposerType(notificationType);
  const membersOnly = Boolean(document.getElementById('membersOnly')?.checked);
  if (type !== 'STEP') {
    return { limit: 50 };
  }
  const target = {};
  if (membersOnly) target.membersOnly = true;
  target.limit = 50;
  return target;
}

function normalizeComposerSavedStatus(status) {
  const raw = typeof status === 'string' ? status.toLowerCase() : '';
  if (raw === 'active') return 'approved';
  if (raw === 'sent') return 'executed';
  return raw || 'draft';
}

function formatTimestampForList(value) {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value && Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
  return String(value);
}

function applyComposerSavedFilters() {
  const keyword = (document.getElementById('composer-saved-search')?.value || '').trim().toLowerCase();
  const status = (document.getElementById('composer-saved-status')?.value || '').trim().toLowerCase();
  const type = (document.getElementById('composer-saved-type')?.value || '').trim().toUpperCase();
  const category = (document.getElementById('composer-saved-category')?.value || '').trim().toUpperCase();
  const scenarioKey = (document.getElementById('composer-saved-scenario')?.value || '').trim().toUpperCase();
  const stepKey = (document.getElementById('composer-saved-step')?.value || '').trim().toLowerCase();
  const filterCore = resolveCoreSlice('filterCore');
  const filtered = filterCore && typeof filterCore.applyAndFilters === 'function'
    ? filterCore.applyAndFilters(state.composerSavedItems, [
        {
          type: 'includes',
          value: keyword,
          normalize: { trim: true, lower: true },
          getValue: (item) => [item && item.title, item && item.body, item && item.ctaText].map((value) => String(value || '')).join('\n')
        },
        { type: 'equals', value: status, normalize: { trim: true, lower: true }, getValue: (item) => normalizeComposerSavedStatus(item && item.status) },
        { type: 'equals', value: type, normalize: { trim: true, upper: true }, getValue: (item) => normalizeComposerType(item && item.notificationType ? item.notificationType : 'STEP') },
        { type: 'equals', value: category, normalize: { trim: true, upper: true }, getValue: (item) => item && item.notificationCategory },
        { type: 'equals', value: scenarioKey, normalize: { trim: true, upper: true }, getValue: (item) => item && item.scenarioKey },
        { type: 'equals', value: stepKey, normalize: { trim: true, lower: true }, getValue: (item) => item && item.stepKey }
      ])
    : state.composerSavedItems.filter((item) => {
      const searchable = [item.title, item.body, item.ctaText].map((value) => String(value || '').toLowerCase()).join('\n');
      if (keyword && !searchable.includes(keyword)) return false;
      if (status && normalizeComposerSavedStatus(item.status) !== status) return false;
      if (type && normalizeComposerType(item.notificationType || 'STEP') !== type) return false;
      if (category && String(item.notificationCategory || '').toUpperCase() !== category) return false;
      if (scenarioKey && String(item.scenarioKey || '').toUpperCase() !== scenarioKey) return false;
      if (stepKey && String(item.stepKey || '').toLowerCase() !== stepKey) return false;
      return true;
    });
  state.composerSavedFilteredItems = sortComposerSavedItems(filtered);
}

function buildComposerSavedFilterChips() {
  const chips = [];
  const keyword = getInputValue('composer-saved-search');
  const status = getSelectValue('composer-saved-status');
  const type = getSelectValue('composer-saved-type');
  const category = getSelectValue('composer-saved-category');
  const scenario = getSelectValue('composer-saved-scenario');
  const step = getSelectValue('composer-saved-step');
  pushFilterChip(chips, '検索', keyword);
  if (status) pushFilterChip(chips, '状態', getSelectLabel('composer-saved-status'));
  if (type) pushFilterChip(chips, 'タイプ', getSelectLabel('composer-saved-type'));
  if (category) pushFilterChip(chips, 'カテゴリ', getSelectLabel('composer-saved-category'));
  if (scenario) pushFilterChip(chips, 'シナリオ', getSelectLabel('composer-saved-scenario'));
  if (step) pushFilterChip(chips, 'ステップ', getSelectLabel('composer-saved-step'));
  return chips;
}

function clearComposerSavedFilters() {
  setInputValue('composer-saved-search', '');
  setSelectValue('composer-saved-status', '');
  setSelectValue('composer-saved-type', '');
  setSelectValue('composer-saved-category', '');
  setSelectValue('composer-saved-scenario', '');
  setSelectValue('composer-saved-step', '');
}

function extractComposerLinkDomain(urlValue) {
  const raw = typeof urlValue === 'string' ? urlValue.trim() : '';
  if (!raw) return '-';
  try {
    const parsed = new URL(raw);
    return parsed.hostname || '-';
  } catch (_err) {
    return '-';
  }
}

function formatComposerLinkOption(item) {
  const title = item && typeof (item.title || item.label) === 'string'
    ? String(item.title || item.label).trim() || '-'
    : '-';
  const domain = extractComposerLinkDomain(item && item.url);
  const id = item && typeof item.id === 'string' ? item.id : '-';
  return `${title} / ${domain} / ${id}`;
}

function setComposerLinkRegistryOptions(items, selectedId) {
  const select = document.getElementById('linkRegistryId');
  if (!select) return;
  const previous = typeof selectedId === 'string' ? selectedId : (select.value || '');
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Link Registryから選択';
  select.appendChild(placeholder);
  (Array.isArray(items) ? items : []).forEach((item) => {
    const id = item && typeof item.id === 'string' ? item.id : '';
    if (!id) return;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = formatComposerLinkOption(item);
    select.appendChild(option);
  });
  if (previous) select.value = previous;
  if (select.value !== previous) select.value = '';
}

async function ensureComposerLinkRegistryOption(linkRegistryId) {
  const id = typeof linkRegistryId === 'string' ? linkRegistryId.trim() : '';
  if (!id) return;
  const select = document.getElementById('linkRegistryId');
  if (select && select.querySelector(`option[value="${id.replace(/"/g, '\\"')}"]`)) return;
  const traceId = ensureTraceInput('traceId');
  try {
    const res = await fetch(`/api/admin/os/link-registry/${encodeURIComponent(id)}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || !data.ok || !data.item || !data.item.id) return;
    const current = Array.isArray(state.composerLinkOptions) ? state.composerLinkOptions.slice() : [];
    if (!current.some((item) => item && item.id === data.item.id)) current.push(data.item);
    state.composerLinkOptions = current;
    setComposerLinkRegistryOptions(current, id);
    const select = document.getElementById('linkRegistryId');
    if (select) select.value = id;
    updateComposerSummary();
    void loadComposerLinkPreview();
  } catch (_err) {
    // best effort only
  }
}

async function loadComposerLinkRegistryOptions(options) {
  const notify = Boolean(options && options.notify);
  const selectedId = options && typeof options.selectedId === 'string' ? options.selectedId : '';
  const traceId = ensureTraceInput('traceId');
  try {
    const query = new URLSearchParams({ limit: '200' });
    const res = await fetch(`/admin/link-registry?${query.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || !data.ok) throw new Error((data && data.error) || 'failed');
    const items = Array.isArray(data.items) ? data.items : [];
    state.composerLinkOptions = items.filter((item) => item && typeof item.id === 'string' && item.id.trim());
    setComposerLinkRegistryOptions(state.composerLinkOptions, selectedId);
    if (notify) showToast('Link Registry一覧を更新しました', 'ok');
  } catch (_err) {
    setComposerLinkRegistryOptions([], selectedId);
    if (notify) showToast('Link Registry一覧の取得に失敗しました', 'warn');
  }
}

function loadComposerFormFromRow(row, duplicateMode) {
  if (!row) return;
  document.getElementById('title').value = row.title || '';
  document.getElementById('body').value = row.body || '';
  document.getElementById('ctaText').value = row.ctaText || '';
  document.getElementById('ctaText2').value = '';
  const selectedLinkRegistryId = row.linkRegistryId || '';
  document.getElementById('linkRegistryId').value = selectedLinkRegistryId;
  if (selectedLinkRegistryId) {
    void ensureComposerLinkRegistryOption(selectedLinkRegistryId);
  }
  document.getElementById('notificationCategory').value = row.notificationCategory || 'SEQUENCE_GUIDANCE';
  document.getElementById('notificationType').value = normalizeComposerType(row.notificationType || 'STEP');
  document.getElementById('scenarioKey').value = row.scenarioKey || 'A';
  document.getElementById('stepKey').value = row.stepKey || 'week';
  document.getElementById('targetRegion').value = '';
  document.getElementById('targetLimit').value = '50';
  document.getElementById('membersOnly').checked = Boolean(row.target && row.target.membersOnly);

  const meta = row.notificationMeta && typeof row.notificationMeta === 'object' ? row.notificationMeta : {};
  document.getElementById('ctaText2').value = '';
  document.getElementById('metaAnnouncementExpiry').value = meta.expiry || '';
  document.getElementById('metaAnnouncementPriority').value = meta.priority || '';
  document.getElementById('metaVendorId').value = meta.vendorId || '';
  document.getElementById('metaVendorTargeting').value = meta.targeting || '';
  document.getElementById('metaAbVariants').value = meta.variants || '';
  document.getElementById('metaAbRatio').value = meta.ratio || '';
  document.getElementById('metaAbMetric').value = meta.metric || '';

  if (duplicateMode) {
    document.getElementById('notificationId').textContent = '-';
    state.currentComposerStatus = 'DRAFT';
    state.composerSelectedNotificationId = null;
    state.composerCurrentNotificationId = null;
    state.composerCurrentPlanHash = null;
    state.composerCurrentConfirmToken = null;
    if (document.getElementById('planHash')) document.getElementById('planHash').textContent = '-';
    if (document.getElementById('confirmToken')) document.getElementById('confirmToken').textContent = '-';
    showToast(t('ui.toast.composer.duplicated', '複製して新規に読み込みました'), 'ok');
  } else {
    document.getElementById('notificationId').textContent = row.id || '-';
    state.currentComposerStatus = String(row.status || 'draft').toUpperCase();
    state.composerSelectedNotificationId = row.id || null;
    state.composerCurrentNotificationId = row.id || null;
    state.composerCurrentPlanHash = null;
    state.composerCurrentConfirmToken = null;
    if (document.getElementById('planHash')) document.getElementById('planHash').textContent = '-';
    if (document.getElementById('confirmToken')) document.getElementById('confirmToken').textContent = '-';
  }
  updateComposerSummary();
  void loadComposerLinkPreview();
}

function renderComposerSavedRows() {
  const tbody = document.getElementById('composer-saved-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  applyComposerSavedFilters();
  applySortUiState({
    root: document.getElementById('composer-saved-panel'),
    attr: 'data-composer-sort-key',
    sortKey: state.composerSavedSortKey,
    sortDir: state.composerSavedSortDir
  });
  const items = state.composerSavedFilteredItems;
  const chips = buildComposerSavedFilterChips();
  renderFilterChips('composer-saved-filter-chips', chips);
  updateFilterMeta({
    countId: 'composer-saved-result-count',
    clearId: 'composer-saved-clear',
    filteredCount: items.length,
    totalCount: state.composerSavedItems.length,
    activeCount: chips.length
  });
  persistListStateToStorage('composerSaved', readComposerSavedListState());
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    if (state.composerSelectedNotificationId && state.composerSelectedNotificationId === item.id) tr.classList.add('row-active');
    const targetCount = resolveComposerSavedTargetCount(item);
    const ctr = resolveComposerSavedCtr(item);
    const cells = [
      formatTimestampForList(item.createdAt),
      item.title || '-',
      composerStatusLabel(item.status),
      composerCategoryLabel(item.notificationCategory),
      scenarioLabel(item.scenarioKey),
      stepLabel(item.stepKey),
      targetCount === null ? '-' : String(targetCount),
      formatRatioPercent(ctr)
    ];
    cells.forEach((value, idx) => {
      const td = document.createElement('td');
      if (idx === 2 || idx === 3 || idx === 4 || idx === 5) td.classList.add('cell-muted');
      if (idx === 6 || idx === 7) markNumericCell(td);
      td.textContent = toUnifiedDisplay(value, '-');
      tr.appendChild(td);
    });
    const actionTd = document.createElement('td');
    const cloneBtn = document.createElement('button');
    cloneBtn.type = 'button';
    cloneBtn.className = 'button-subtle';
    cloneBtn.textContent = t('ui.label.composer.saved.duplicate', '複製して新規');
    cloneBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      loadComposerFormFromRow(item, true);
    });
    actionTd.appendChild(cloneBtn);
    tr.appendChild(actionTd);
    tr.addEventListener('click', () => {
      loadComposerFormFromRow(item, false);
      renderComposerSavedRows();
    });
    tbody.appendChild(tr);
  });
}

async function loadComposerSavedNotifications(options) {
  const notify = !options || options.notify !== false;
  const traceId = ensureTraceInput('traceId');
  try {
    const limit = 200;
    const query = new URLSearchParams({ limit: String(limit) });
    const res = await fetch(`/api/admin/os/notifications/list?${query.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    if (!data || !data.ok) throw new Error((data && data.error) || 'list failed');
    state.composerSavedItems = Array.isArray(data.items) ? data.items : [];
    state.composerListLoadedAt = new Date().toISOString();
    renderComposerSavedRows();
    if (notify) showToast(t('ui.toast.composer.listOk', '保存済み通知を更新しました'), 'ok');
  } catch (_err) {
    if (notify) showToast(t('ui.toast.composer.listFail', '保存済み通知の取得に失敗しました'), 'danger');
  }
}

async function loadComposerLinkPreview() {
  const linkId = document.getElementById('linkRegistryId')?.value?.trim() || '';
  state.composerLinkPreview = null;
  if (!linkId) {
    renderComposerLivePreview();
    return;
  }
  const traceId = ensureTraceInput('traceId');
  try {
    const res = await fetch(`/api/admin/os/link-registry/${encodeURIComponent(linkId)}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    if (data && data.ok && data.item) {
      state.composerLinkPreview = data.item;
    }
  } catch (_err) {
    state.composerLinkPreview = null;
  }
  renderComposerLivePreview();
}

async function loadComposerSafetyContext() {
  const traceId = ensureTraceInput('traceId') || newTraceId();
  try {
    const res = await fetch('/api/admin/os/kill-switch/status', { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    state.composerKillSwitch = Boolean(data && data.ok && data.killSwitch);
  } catch (_err) {
    state.composerKillSwitch = false;
  }
  state.paneUpdatedAt.composer = new Date().toISOString();
  updateComposerSummary();
}

function validateComposerPayload(payload) {
  if (!payload.title || !payload.body || !payload.ctaText || !payload.linkRegistryId) {
    return t('ui.toast.composer.needRequired', '必須項目を入力してください');
  }
  if (payload.notificationType === 'VENDOR') {
    const vendorId = payload.notificationMeta && payload.notificationMeta.vendorId ? String(payload.notificationMeta.vendorId).trim() : '';
    if (!vendorId) return t('ui.toast.composer.needVendorId', 'VENDORタイプにはベンダーIDが必要です');
  }
  return '';
}

function composerTypeLabel(value) {
  const type = normalizeComposerType(value || 'STEP');
  if (type === 'GENERAL') return t('ui.value.composer.type.general', '一般');
  if (type === 'ANNOUNCEMENT') return t('ui.value.composer.type.announcement', 'お知らせ');
  if (type === 'VENDOR') return t('ui.value.composer.type.vendor', 'ベンダー');
  if (type === 'AB') return t('ui.value.composer.type.ab', 'ABテスト');
  return t('ui.value.composer.type.step', 'ステップ');
}

function composerCategoryLabel(value) {
  const raw = String(value || '').toUpperCase();
  let fallback = raw || '-';
  if (raw === 'DEADLINE_REQUIRED') fallback = t('ui.value.composer.category.deadline', '期限必須');
  if (raw === 'IMMEDIATE_ACTION') fallback = t('ui.value.composer.category.immediate', '即時対応');
  if (raw === 'SEQUENCE_GUIDANCE') fallback = t('ui.value.composer.category.sequence', '順次案内');
  if (raw === 'TARGETED_ONLY') fallback = t('ui.value.composer.category.targeted', '対象限定');
  if (raw === 'COMPLETION_CONFIRMATION') fallback = t('ui.value.composer.category.completion', '完了確認');
  return resolveDomainLabel('category', raw, fallback);
}

function composerStatusLabel(value) {
  const raw = normalizeComposerSavedStatus(value);
  let fallback = t('ui.value.composer.status.draft', '下書き');
  if (raw === 'approved' || raw === 'active') fallback = t('ui.value.composer.status.approved', '承認済み');
  if (raw === 'executed' || raw === 'sent') fallback = t('ui.value.composer.status.executed', '実行済み');
  return resolveDomainLabel('status', raw, fallback);
}

async function adminFetchJson(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const url = String(opts.url || '');
  if (!url) return { ok: false, error: 'url missing' };
  const method = opts.method ? String(opts.method).toUpperCase() : 'GET';
  const traceId = opts.traceId || newTraceId();
  const headers = Object.assign({}, opts.headers || {}, buildHeaders({}, traceId));
  let body;
  if (opts.payload !== undefined) {
    headers['content-type'] = headers['content-type'] || 'application/json; charset=utf-8';
    body = JSON.stringify(opts.payload || {});
  }
  const res = await fetch(url, { method, headers, body });
  const data = await readJsonResponse(res);
  if (res.ok && data && data.ok !== false) {
    clearGuardBanner();
    return data;
  }
  if (data && typeof data === 'object') {
    renderGuardBanner(data);
    return data;
  }
  renderGuardBanner({ error: `http_${res.status}` });
  return { ok: false, error: `http_${res.status}` };
}

async function postJson(url, payload, traceId) {
  return adminFetchJson({
    url,
    method: 'POST',
    traceId,
    payload
  });
}

function setupComposerActions() {
  if (document.getElementById('traceId')) {
    document.getElementById('traceId').value = newTraceId();
  }
  state.composerCurrentNotificationId = null;
  state.composerCurrentPlanHash = null;
  state.composerCurrentConfirmToken = null;
  state.composerSelectedNotificationId = null;

  document.getElementById('create-draft')?.addEventListener('click', async () => {
    const resultEl = document.getElementById('draft-result');
    const traceId = ensureTraceInput('traceId');
    const payload = buildDraftPayload();
    const validationError = validateComposerPayload(payload);
    if (validationError) {
      if (resultEl) resultEl.textContent = validationError;
      showToast(validationError, 'warn');
      return;
    }
    const result = await postJson('/api/admin/os/notifications/draft', payload, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    if (result && result.ok) {
      state.composerCurrentNotificationId = result.notificationId || null;
      state.composerSelectedNotificationId = result.notificationId || null;
      state.composerCurrentPlanHash = null;
      state.composerCurrentConfirmToken = null;
      if (document.getElementById('notificationId')) document.getElementById('notificationId').textContent = state.composerCurrentNotificationId || '-';
      if (document.getElementById('planHash')) document.getElementById('planHash').textContent = '-';
      if (document.getElementById('confirmToken')) document.getElementById('confirmToken').textContent = '-';
      showToast(t('ui.toast.composer.draftOk', 'draft OK'), 'ok');
      setComposerStatus('ok', 'DRAFT');
      await loadComposerSavedNotifications({ notify: false });
      renderComposerSavedRows();
    } else {
      showToast(t('ui.toast.composer.draftFail', 'draft 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
  });

  document.getElementById('preview')?.addEventListener('click', async () => {
    const resultEl = document.getElementById('draft-result');
    const traceId = ensureTraceInput('traceId');
    const payload = buildDraftPayload();
    const validationError = validateComposerPayload(payload);
    if (validationError) {
      if (resultEl) resultEl.textContent = validationError;
      showToast(validationError, 'warn');
      return;
    }
    const result = await postJson('/api/admin/os/notifications/preview', payload, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    if (result && result.ok) {
      showToast(t('ui.toast.composer.previewOk', 'preview OK'), 'ok');
      setComposerStatus('ok', 'PREVIEW');
    } else {
      showToast(t('ui.toast.composer.previewFail', 'preview 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
  });

  document.getElementById('approve')?.addEventListener('click', async () => {
    if (!state.composerCurrentNotificationId) {
      showToast(t('ui.toast.composer.needId', '通知IDが必要です'), 'warn');
      setComposerStatus('warn', 'WARN');
      return;
    }
    const confirmed = window.confirm(t('ui.confirm.composer.approve', '承認（有効化）を実行しますか？'));
    if (!confirmed) {
      showToast(t('ui.toast.composer.canceled', '操作を中止しました'), 'warn');
      return;
    }
    const traceId = ensureTraceInput('traceId');
    const resultEl = document.getElementById('draft-result');
    const result = await postJson('/api/admin/os/notifications/approve', { notificationId: state.composerCurrentNotificationId }, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    if (result && result.ok) {
      showToast(t('ui.toast.composer.approveOk', 'approve OK'), 'ok');
      setComposerStatus('ok', 'ACTIVE');
      await loadComposerSavedNotifications({ notify: false });
      renderComposerSavedRows();
    } else {
      showToast(t('ui.toast.composer.approveFail', 'approve 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
  });

  document.getElementById('plan')?.addEventListener('click', async () => {
    const planTargetCountEl = document.getElementById('planTargetCount');
    const planCapBlockedEl = document.getElementById('planCapBlockedCount');
    const resultEl = document.getElementById('plan-result');
    if (planTargetCountEl) planTargetCountEl.textContent = '-';
    if (planCapBlockedEl) planCapBlockedEl.textContent = '-';
    if (!state.composerCurrentNotificationId) {
      if (resultEl) resultEl.textContent = t('ui.toast.composer.needId', '通知IDが必要です');
      showToast(t('ui.toast.composer.needId', '通知IDが必要です'), 'warn');
      setComposerStatus('warn', 'WARN');
      return;
    }
    const traceId = ensureTraceInput('traceId');
    const result = await postJson('/api/admin/os/notifications/send/plan', { notificationId: state.composerCurrentNotificationId }, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    if (result && result.ok) {
      state.composerCurrentPlanHash = result.planHash || null;
      state.composerCurrentConfirmToken = result.confirmToken || null;
      if (document.getElementById('planHash')) document.getElementById('planHash').textContent = state.composerCurrentPlanHash || '-';
      if (document.getElementById('confirmToken')) document.getElementById('confirmToken').textContent = state.composerCurrentConfirmToken ? 'set' : '-';
      if (planTargetCountEl) planTargetCountEl.textContent = typeof result.count === 'number' ? String(result.count) : '-';
      if (planCapBlockedEl) planCapBlockedEl.textContent = typeof result.capBlockedCount === 'number' ? String(result.capBlockedCount) : '-';
      showToast(t('ui.toast.composer.planOk', 'plan OK'), 'ok');
      setComposerStatus('ok', 'PLAN');
    } else {
      showToast(t('ui.toast.composer.planFail', 'plan 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
    updateSafetyBadge(result);
  });

  document.getElementById('execute')?.addEventListener('click', async () => {
    const resultEl = document.getElementById('execute-result');
    if (!state.composerCurrentNotificationId || !state.composerCurrentPlanHash || !state.composerCurrentConfirmToken) {
      if (resultEl) resultEl.textContent = t('ui.toast.composer.needPlan', '計画ハッシュと確認トークンが必要です');
      showToast(t('ui.toast.composer.needPlan', '計画ハッシュと確認トークンが必要です'), 'warn');
      setComposerStatus('warn', 'WARN');
      return;
    }
    const confirmed = window.confirm(t('ui.confirm.composer.execute', '送信実行を実行しますか？'));
    if (!confirmed) {
      showToast(t('ui.toast.composer.canceled', '操作を中止しました'), 'warn');
      return;
    }
    const traceId = ensureTraceInput('traceId');
    const result = await postJson('/api/admin/os/notifications/send/execute', {
      notificationId: state.composerCurrentNotificationId,
      planHash: state.composerCurrentPlanHash,
      confirmToken: state.composerCurrentConfirmToken
    }, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    const metaEl = document.getElementById('execute-cap-meta');
    if (metaEl) {
      const reason = result && result.reason ? result.reason : (result && result.ok ? 'ok' : '-');
      metaEl.textContent = `${t('ui.label.composer.countMode', '計数方式')}: ${result.capCountMode || '-'} / ${t('ui.label.composer.countSource', '計数元')}: ${result.capCountSource || '-'} / ${t('ui.label.composer.countStrategy', '計数戦略')}: ${result.capCountStrategy || '-'} / ${t('ui.label.composer.lastReason', '最終理由')}: ${reason}`;
    }
    if (result && result.ok) {
      showToast(t('ui.toast.composer.executeOk', 'execute OK'), 'ok');
      setComposerStatus('ok', 'SENT');
      await loadComposerSavedNotifications({ notify: false });
      renderComposerSavedRows();
    } else {
      showToast(t('ui.toast.composer.executeFail', 'execute 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
  });

  ['title', 'body', 'ctaText', 'ctaText2', 'scenarioKey', 'stepKey', 'notificationCategory', 'targetRegion', 'targetLimit', 'notificationType', 'metaAnnouncementExpiry', 'metaAnnouncementPriority', 'metaVendorId', 'metaVendorTargeting', 'metaAbVariants', 'metaAbRatio', 'metaAbMetric'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', updateComposerSummary);
      return;
    }
    el.addEventListener('input', updateComposerSummary);
  });
  const linkRegistryInput = document.getElementById('linkRegistryId');
  if (linkRegistryInput) {
    linkRegistryInput.addEventListener('change', () => {
      updateComposerSummary();
      void loadComposerLinkPreview();
    });
  }
  const membersOnly = document.getElementById('membersOnly');
  if (membersOnly) membersOnly.addEventListener('change', updateComposerSummary);

  ['composer-saved-search', 'composer-saved-status', 'composer-saved-type', 'composer-saved-category', 'composer-saved-scenario', 'composer-saved-step'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      renderComposerSavedRows();
    });
  });
  document.getElementById('composer-saved-clear')?.addEventListener('click', () => {
    clearComposerSavedFilters();
    renderComposerSavedRows();
  });
  document.querySelectorAll('[data-composer-sort-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sortKey = btn.getAttribute('data-composer-sort-key');
      if (!sortKey) return;
      state.composerSavedSortDir = toggleSortDirection(
        state.composerSavedSortKey,
        sortKey,
        state.composerSavedSortDir
      );
      state.composerSavedSortKey = sortKey;
      renderComposerSavedRows();
    });
  });

  applyComposerTypeFields();
  updateComposerSummary();
  void loadComposerLinkRegistryOptions({ notify: false });
  void loadComposerSavedNotifications({ notify: false });
  void loadComposerLinkPreview();
  void loadComposerSafetyContext();
}

function setupAudit() {
  document.getElementById('audit-search')?.addEventListener('click', () => {
    loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
  });
  document.getElementById('struct-drift-runs-reload')?.addEventListener('click', () => {
    void loadStructDriftRuns({ notify: true });
  });
  document.getElementById('struct-drift-run-dry')?.addEventListener('click', () => {
    void runStructDriftBackfill('dry');
  });
  document.getElementById('struct-drift-run-apply')?.addEventListener('click', () => {
    void runStructDriftBackfill('apply');
  });
  void loadStructDriftRuns({ notify: false });
}

function setupMonitorControls() {
  document.getElementById('monitor-regen')?.addEventListener('click', () => {
    const el = document.getElementById('monitor-trace');
    if (el) el.value = newTraceId();
  });
  document.getElementById('monitor-reload')?.addEventListener('click', () => {
    loadMonitorData({ notify: true });
  });
  document.getElementById('monitor-user-search')?.addEventListener('click', () => {
    loadMonitorUserDeliveries({ notify: true });
  });
  document.getElementById('monitor-insights-reload')?.addEventListener('click', () => {
    loadMonitorInsights({ notify: true });
  });
  document.getElementById('monitor-window-days')?.addEventListener('change', () => {
    loadMonitorInsights({ notify: false });
  });
  document.getElementById('monitor-open-trace')?.addEventListener('click', async () => {
    const trace = ensureTraceInput('monitor-trace');
    const auditTrace = document.getElementById('audit-trace');
    if (auditTrace) auditTrace.value = trace;
    activatePane('audit');
    await loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
  });
  if (document.getElementById('monitor-trace')) document.getElementById('monitor-trace').value = newTraceId();
}

function setupErrorsControls() {
  document.getElementById('errors-regen')?.addEventListener('click', () => {
    const el = document.getElementById('errors-trace');
    if (el) el.value = newTraceId();
  });
  document.getElementById('errors-reload')?.addEventListener('click', () => {
    loadErrors({ notify: true });
  });
  document.getElementById('errors-to-ops')?.addEventListener('click', () => {
    activatePane('home');
  });
  if (document.getElementById('errors-trace')) document.getElementById('errors-trace').value = newTraceId();
}

function setupReadModelControls() {
  document.getElementById('read-model-regen')?.addEventListener('click', () => {
    const el = document.getElementById('read-model-trace');
    if (el) el.value = newTraceId();
  });
  document.getElementById('read-model-reload')?.addEventListener('click', () => {
    loadReadModelData({ notify: true });
  });
  if (document.getElementById('read-model-trace')) document.getElementById('read-model-trace').value = newTraceId();

  document.getElementById('users-summary-reload')?.addEventListener('click', () => {
    void loadUsersSummary({ notify: true });
  });
  [
    'users-filter-line-user-id',
    'users-filter-created-from',
    'users-filter-created-to',
    'users-filter-category',
    'users-filter-status',
    'users-filter-plan',
    'users-filter-subscription-status',
    'users-filter-billing-integrity'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      renderUsersSummaryRows();
    });
  });
  document.getElementById('users-summary-clear')?.addEventListener('click', () => {
    clearUsersSummaryFilters();
    syncUsersSummaryQuickFilterUi();
    renderUsersSummaryRows();
    void loadUsersSummary({ notify: false });
  });
  document.getElementById('users-summary-analyze')?.addEventListener('click', () => {
    void loadUsersSummaryAnalyze({ notify: true });
  });
  document.getElementById('users-summary-export')?.addEventListener('click', () => {
    void exportUsersSummaryCsv();
  });
  document.getElementById('users-summary-edit-columns')?.addEventListener('click', () => {
    const panel = document.getElementById('users-summary-columns-panel');
    if (!panel) return;
    panel.classList.toggle('is-hidden');
  });
  document.querySelectorAll('[data-users-column-toggle]').forEach((input) => {
    input.addEventListener('change', () => {
      updateUsersSummaryVisibleColumnsFromInputs();
    });
  });
  document.querySelectorAll('[data-users-quick-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const quickFilter = btn.getAttribute('data-users-quick-filter') || 'all';
      state.usersSummaryQuickFilter = quickFilter;
      syncUsersSummaryQuickFilterUi();
      renderUsersSummaryRows();
      void loadUsersSummary({ notify: false });
    });
  });
  ['users-filter-limit', 'users-filter-analytics-limit'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      void loadUsersSummary({ notify: false });
    });
  });
  document.querySelectorAll('[data-users-sort-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sortKey = btn.getAttribute('data-users-sort-key');
      if (!sortKey) return;
      state.usersSummarySortDir = toggleSortDirection(
        state.usersSummarySortKey,
        sortKey,
        state.usersSummarySortDir
      );
      state.usersSummarySortKey = sortKey;
      renderUsersSummaryRows();
    });
  });
}

function setupCityPackControls() {
  document.getElementById('city-pack-unified-reload')?.addEventListener('click', () => {
    void loadCityPackRequests({ notify: false });
    void loadCityPackFeedback({ notify: false });
    void loadCityPackBulletins({ notify: false });
    void loadCityPackProposals({ notify: false });
    void loadCityPackTemplateLibrary({ notify: false });
    void loadCityPackReviewInbox({ notify: true });
  });
  ['city-pack-unified-filter-id', 'city-pack-unified-filter-user-id', 'city-pack-unified-filter-city', 'city-pack-unified-filter-date-from', 'city-pack-unified-filter-date-to'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      renderCityPackUnifiedRows();
    });
  });
  ['city-pack-unified-filter-status', 'city-pack-unified-filter-type'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      renderCityPackUnifiedRows();
    });
  });
  document.getElementById('city-pack-unified-clear')?.addEventListener('click', () => {
    clearCityPackUnifiedFilters();
    renderCityPackUnifiedRows();
  });
  document.querySelectorAll('[data-city-pack-sort-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sortKey = btn.getAttribute('data-city-pack-sort-key');
      if (!sortKey) return;
      state.cityPackUnifiedSortDir = toggleSortDirection(
        state.cityPackUnifiedSortKey,
        sortKey,
        state.cityPackUnifiedSortDir
      );
      state.cityPackUnifiedSortKey = sortKey;
      renderCityPackUnifiedRows();
    });
  });
  document.getElementById('city-pack-request-reload')?.addEventListener('click', () => {
    void loadCityPackRequests({ notify: true });
  });
  document.getElementById('city-pack-request-status-filter')?.addEventListener('change', () => {
    void loadCityPackRequests({ notify: false });
  });
  document.getElementById('city-pack-request-region')?.addEventListener('change', () => {
    void loadCityPackRequests({ notify: false });
  });
  document.getElementById('city-pack-request-class-filter')?.addEventListener('change', () => {
    void loadCityPackRequests({ notify: false });
  });
  document.getElementById('city-pack-request-language-filter')?.addEventListener('change', () => {
    void loadCityPackRequests({ notify: false });
  });
  document.getElementById('city-pack-feedback-reload')?.addEventListener('click', () => {
    void loadCityPackFeedback({ notify: true });
  });
  document.getElementById('city-pack-feedback-status-filter')?.addEventListener('change', () => {
    void loadCityPackFeedback({ notify: false });
  });
  document.getElementById('city-pack-feedback-class-filter')?.addEventListener('change', () => {
    void loadCityPackFeedback({ notify: false });
  });
  document.getElementById('city-pack-feedback-language-filter')?.addEventListener('change', () => {
    void loadCityPackFeedback({ notify: false });
  });
  document.getElementById('city-pack-bulletin-reload')?.addEventListener('click', () => {
    void loadCityPackBulletins({ notify: true });
  });
  document.getElementById('city-pack-bulletin-status-filter')?.addEventListener('change', () => {
    void loadCityPackBulletins({ notify: false });
  });
  document.getElementById('city-pack-proposal-reload')?.addEventListener('click', () => {
    void loadCityPackProposals({ notify: true });
  });
  document.getElementById('city-pack-proposal-status-filter')?.addEventListener('change', () => {
    void loadCityPackProposals({ notify: false });
  });
  document.getElementById('city-pack-template-library-reload')?.addEventListener('click', () => {
    void loadCityPackTemplateLibrary({ notify: true });
  });
  document.getElementById('city-pack-template-library-status-filter')?.addEventListener('change', () => {
    void loadCityPackTemplateLibrary({ notify: false });
  });
  document.getElementById('city-pack-metrics-reload')?.addEventListener('click', () => {
    void loadCityPackMetrics({ notify: true });
  });
  document.getElementById('city-pack-metrics-window-days')?.addEventListener('change', () => {
    void loadCityPackMetrics({ notify: false });
  });
  document.getElementById('city-pack-composition-reload')?.addEventListener('click', () => {
    void loadCityPackComposition({ notify: true });
  });
  document.getElementById('city-pack-composition-region-key')?.addEventListener('change', () => {
    void loadCityPackComposition({ notify: false });
  });
  document.getElementById('city-pack-composition-language')?.addEventListener('change', () => {
    void loadCityPackComposition({ notify: false });
  });
  document.getElementById('city-pack-composition-limit')?.addEventListener('change', () => {
    void loadCityPackComposition({ notify: false });
  });
  document.getElementById('city-pack-reload')?.addEventListener('click', () => {
    void loadCityPackRequests({ notify: false });
    void loadCityPackFeedback({ notify: false });
    void loadCityPackBulletins({ notify: false });
    void loadCityPackProposals({ notify: false });
    void loadCityPackTemplateLibrary({ notify: false });
    void loadCityPackReviewInbox({ notify: true });
    void loadCityPackKpi({ notify: false });
    void loadCityPackMetrics({ notify: false });
    void loadCityPackAuditRuns({ notify: false });
    void loadCityPackComposition({ notify: false });
  });
  document.getElementById('city-pack-status-filter')?.addEventListener('change', () => {
    void loadCityPackReviewInbox({ notify: false });
  });
  document.getElementById('city-pack-pack-class-filter')?.addEventListener('change', () => {
    void loadCityPackReviewInbox({ notify: false });
  });
  document.getElementById('city-pack-language-filter')?.addEventListener('change', () => {
    void loadCityPackReviewInbox({ notify: false });
  });
  document.getElementById('city-pack-run-audit')?.addEventListener('click', () => {
    void runCityPackAuditJob();
  });
  document.getElementById('city-pack-runs-reload')?.addEventListener('click', () => {
    void loadCityPackAuditRuns({ notify: true });
  });
  document.getElementById('city-pack-run-detail-limit')?.addEventListener('change', () => {
    if (state.selectedCityPackRunId) {
      void loadCityPackAuditRunDetail(state.selectedCityPackRunId);
    }
  });
  document.getElementById('city-pack-open-trace')?.addEventListener('click', async () => {
    const trace = state.selectedCityPackRunTraceId || ensureTraceInput('monitor-trace');
    if (!trace) {
      showToast(t('ui.toast.cityPack.traceMissing', '追跡IDが未選択です'), 'warn');
      return;
    }
    const auditTrace = document.getElementById('audit-trace');
    if (auditTrace && trace) auditTrace.value = trace;
    activatePane('audit');
    await loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
  });
  document.getElementById('city-pack-structure-save')?.addEventListener('click', () => {
    void runCityPackSaveStructure();
  });
  document.getElementById('city-pack-source-policy-save')?.addEventListener('click', () => {
    void runCityPackSaveSourcePolicy();
  });
  document.getElementById('city-pack-bulletin-create')?.addEventListener('click', () => {
    void createCityPackBulletinDraft();
  });
  document.getElementById('city-pack-proposal-create')?.addEventListener('click', () => {
    void createCityPackProposalDraft();
  });
  document.getElementById('city-pack-template-export-run')?.addEventListener('click', () => {
    void runCityPackTemplateExport();
  });
  document.getElementById('city-pack-template-library-create')?.addEventListener('click', () => {
    void createCityPackTemplateLibraryEntry();
  });
  document.getElementById('city-pack-template-import-dry-run')?.addEventListener('click', () => {
    void runCityPackTemplateImportDryRun();
  });
  document.getElementById('city-pack-template-import-apply')?.addEventListener('click', () => {
    void runCityPackTemplateImportApply();
  });
  renderCityPackSourcePolicy(null);
}

function setupVendorControls() {
  if (document.getElementById('vendor-trace')) document.getElementById('vendor-trace').value = newTraceId();
  document.getElementById('vendor-unified-reload')?.addEventListener('click', () => {
    void loadVendors({ notify: true });
  });
  ['vendor-unified-filter-id', 'vendor-unified-filter-name', 'vendor-unified-filter-category', 'vendor-unified-filter-date-from', 'vendor-unified-filter-date-to'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      renderVendorUnifiedRows();
    });
  });
  document.getElementById('vendor-unified-filter-status')?.addEventListener('change', () => {
    renderVendorUnifiedRows();
    void loadVendors({ notify: false });
  });
  document.getElementById('vendor-unified-clear')?.addEventListener('click', () => {
    clearVendorUnifiedFilters();
    renderVendorUnifiedRows();
  });
  document.querySelectorAll('[data-vendor-sort-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sortKey = btn.getAttribute('data-vendor-sort-key');
      if (!sortKey) return;
      state.vendorSortDir = toggleSortDirection(
        state.vendorSortKey,
        sortKey,
        state.vendorSortDir
      );
      state.vendorSortKey = sortKey;
      renderVendorUnifiedRows();
    });
  });
  document.getElementById('vendor-regen')?.addEventListener('click', () => {
    const el = document.getElementById('vendor-trace');
    if (el) el.value = newTraceId();
  });
  document.getElementById('vendor-reload')?.addEventListener('click', () => {
    void loadVendors({ notify: true });
  });
  document.getElementById('vendor-edit')?.addEventListener('click', () => {
    void runVendorAction('edit');
  });
  document.getElementById('vendor-activate')?.addEventListener('click', () => {
    void runVendorAction('activate');
  });
  document.getElementById('vendor-disable')?.addEventListener('click', () => {
    void runVendorAction('disable');
  });
  document.getElementById('vendor-state')?.addEventListener('change', () => {
    void loadVendors({ notify: false });
  });

  setupVendorTableKeyboardNavigation();

  document.getElementById('vendors-action-edit')?.addEventListener('click', () => {
    void runVendorAction('edit');
  });
  document.getElementById('vendors-action-activate')?.addEventListener('click', () => {
    void runVendorAction('activate');
  });
  document.getElementById('vendors-action-disable')?.addEventListener('click', () => {
    void runVendorAction('disable');
  });
}

function setupMaintenanceControls() {
  document.getElementById('maintenance-snapshot-health-reload')?.addEventListener('click', () => {
    void loadSnapshotHealth({ notify: true });
  });
  document.getElementById('maintenance-retention-runs-reload')?.addEventListener('click', () => {
    void loadRetentionRuns({ notify: true });
  });
  document.getElementById('maintenance-fallback-summary-reload')?.addEventListener('click', () => {
    void loadReadPathFallbackSummary({ notify: true });
  });
  document.getElementById('maintenance-missing-index-reload')?.addEventListener('click', () => {
    void loadMissingIndexSurface({ notify: true });
  });
  document.getElementById('maintenance-product-readiness-reload')?.addEventListener('click', () => {
    void loadProductReadiness({ notify: true });
  });
  document.getElementById('maintenance-open-audit')?.addEventListener('click', async () => {
    activatePane('audit');
    await loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
  });
  void loadSnapshotHealth({ notify: false });
  void loadRetentionRuns({ notify: false });
  void loadReadPathFallbackSummary({ notify: false });
  void loadMissingIndexSurface({ notify: false });
  void loadProductReadiness({ notify: false });
}

function setupDecisionActions() {
  document.getElementById('composer-action-edit')?.addEventListener('click', () => {
    activatePane('composer');
    document.getElementById('title')?.focus();
  });
  document.getElementById('composer-action-activate')?.addEventListener('click', () => {
    activatePane('composer');
    document.getElementById('approve')?.click();
  });
  document.getElementById('composer-action-disable')?.addEventListener('click', () => {
    activatePane('errors');
  });

  document.getElementById('monitor-action-edit')?.addEventListener('click', () => {
    activatePane('composer');
  });
  document.getElementById('monitor-action-activate')?.addEventListener('click', () => {
    activatePane('monitor');
    document.getElementById('monitor-reload')?.click();
  });
  document.getElementById('monitor-action-disable')?.addEventListener('click', () => {
    activatePane('errors');
  });

  document.getElementById('errors-action-edit')?.addEventListener('click', () => {
    activatePane('monitor');
  });
  document.getElementById('errors-action-activate')?.addEventListener('click', () => {
    activatePane('errors');
    document.getElementById('errors-reload')?.click();
  });
  document.getElementById('errors-action-disable')?.addEventListener('click', () => {
    activatePane('maintenance');
  });

  document.getElementById('read-model-action-edit')?.addEventListener('click', () => {
    activatePane('composer');
  });
  document.getElementById('read-model-action-activate')?.addEventListener('click', () => {
    activatePane('read-model');
    document.getElementById('read-model-reload')?.click();
  });
  document.getElementById('read-model-action-disable')?.addEventListener('click', () => {
    activatePane('errors');
  });

  document.getElementById('city-pack-action-edit')?.addEventListener('click', () => {
    activatePane('city-pack');
    document.getElementById('city-pack-request-reload')?.click();
    document.getElementById('city-pack-template-library-reload')?.click();
  });
  document.getElementById('city-pack-action-activate')?.addEventListener('click', () => {
    activatePane('city-pack');
    const selected = state.cityPackRequestItems.find((item) => item.requestId === state.selectedCityPackRequestId);
    if (selected) {
      void runCityPackRequestAction('approve', selected);
    } else {
      showToast(t('ui.toast.cityPack.needRequestSelection', 'Request行を選択してください'), 'warn');
    }
  });
  document.getElementById('city-pack-action-disable')?.addEventListener('click', () => {
    activatePane('city-pack');
    showToast(t('ui.toast.cityPack.disableHint', '停止操作はReview Inboxで実行してください'), 'warn');
  });
}

function looksLikeDirectUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function normalizeNextActionsForDisplay(payload) {
  const input = payload && typeof payload === 'object' ? payload : null;
  if (!input || !input.nextActionCandidates || !Array.isArray(input.nextActionCandidates.candidates)) return payload;
  const output = JSON.parse(JSON.stringify(input));
  output.nextActionCandidates.candidates = output.nextActionCandidates.candidates.map((item) => {
    const normalized = Object.assign({}, item);
    if (typeof normalized.action === 'string') {
      normalized.action = normalized.action.toLowerCase();
    }
    return normalized;
  });
  if (output.nextActionTemplate && output.nextActionTemplate.proposal && Array.isArray(output.nextActionTemplate.proposal.actions)) {
    output.nextActionTemplate.proposal.actions = output.nextActionTemplate.proposal.actions.map((action) => {
      return typeof action === 'string' ? action.toLowerCase() : action;
    });
  }
  return output;
}

function renderLlmResult(targetId, payload) {
  const el = document.getElementById(targetId);
  if (!el) return;
  if (targetId === 'llm-next-actions-result') {
    el.textContent = JSON.stringify(normalizeNextActionsForDisplay(payload || {}), null, 2);
    return;
  }
  el.textContent = JSON.stringify(payload || {}, null, 2);
}

function llmBlockedReasonCategoryLabel(category) {
  const key = String(category || 'UNKNOWN');
  if (key === 'NO_KB_MATCH') return t('ui.label.llm.block.reason.NO_KB_MATCH', 'KB一致なし');
  if (key === 'LOW_CONFIDENCE') return t('ui.label.llm.block.reason.LOW_CONFIDENCE', '根拠の信頼度不足');
  if (key === 'DIRECT_URL_DETECTED') return t('ui.label.llm.block.reason.DIRECT_URL_DETECTED', '直接URLを検出');
  if (key === 'WARN_LINK_BLOCKED') return t('ui.label.llm.block.reason.WARN_LINK_BLOCKED', '危険リンクを検出');
  if (key === 'SENSITIVE_QUERY') return t('ui.label.llm.block.reason.SENSITIVE_QUERY', '機微情報を検出');
  if (key === 'CONSENT_MISSING') return t('ui.label.llm.block.reason.CONSENT_MISSING', '同意未確認');
  return t('ui.label.llm.block.reason.UNKNOWN', '安全ルールで停止');
}

function llmFallbackActionLabel(item) {
  if (item && typeof item.label === 'string' && item.label.trim()) return item.label.trim();
  const actionKey = item && typeof item.actionKey === 'string' ? item.actionKey.trim() : '';
  if (actionKey === 'open_official_faq') return t('ui.label.llm.block.action.open_official_faq', '公式FAQを見る');
  if (actionKey === 'open_contact') return t('ui.label.llm.block.action.open_contact', '問い合わせる');
  return t('ui.label.llm.block.action.unknown', '対応先を確認する');
}

function appendListItem(listEl, text) {
  if (!listEl) return;
  const li = document.createElement('li');
  li.textContent = text;
  listEl.appendChild(li);
}

function renderLlmFaqBlockPanel(payload) {
  const panel = document.getElementById('llm-faq-block');
  const reasonEl = document.getElementById('llm-faq-block-reason');
  const actionsEl = document.getElementById('llm-faq-block-actions');
  const suggestedEl = document.getElementById('llm-faq-block-suggested');
  if (!panel || !reasonEl || !actionsEl || !suggestedEl) return;

  const blocked = payload && payload.ok === false && payload.blocked === true;
  if (!blocked) {
    panel.classList.add('is-hidden');
    reasonEl.textContent = '-';
    actionsEl.innerHTML = '';
    suggestedEl.innerHTML = '';
    return;
  }

  panel.classList.remove('is-hidden');
  reasonEl.textContent = llmBlockedReasonCategoryLabel(payload.blockedReasonCategory);

  actionsEl.innerHTML = '';
  const fallbackActions = Array.isArray(payload.fallbackActions) ? payload.fallbackActions : [];
  if (!fallbackActions.length) {
    appendListItem(actionsEl, t('ui.desc.llm.block.noActions', '代替アクションは未設定です。'));
  } else {
    fallbackActions.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      if (looksLikeDirectUrl(item.sourceId)) return;
      const label = llmFallbackActionLabel(item);
      const sourceId = typeof item.sourceId === 'string' && item.sourceId.trim() ? item.sourceId.trim() : '-';
      appendListItem(actionsEl, `${label} (${sourceId})`);
    });
    if (!actionsEl.children.length) {
      appendListItem(actionsEl, t('ui.desc.llm.block.noActions', '代替アクションは未設定です。'));
    }
  }

  suggestedEl.innerHTML = '';
  const suggestedFaqs = Array.isArray(payload.suggestedFaqs) ? payload.suggestedFaqs : [];
  if (!suggestedFaqs.length) {
    appendListItem(suggestedEl, t('ui.desc.llm.block.none', '候補FAQはありません。'));
  } else {
    suggestedFaqs.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const articleId = typeof item.articleId === 'string' && item.articleId.trim() ? item.articleId.trim() : '-';
      const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : t('ui.label.common.empty', 'データなし');
      appendListItem(suggestedEl, `${title} (${articleId})`);
    });
  }
}

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return { ok: false, error: 'empty response' };
  try {
    return JSON.parse(text);
  } catch (_err) {
    return { ok: false, error: text };
  }
}

async function fetchJsonWithFallback(primaryPath, fallbackPath, traceId) {
  const headers = buildHeaders({}, traceId);
  try {
    const primaryRes = await fetch(primaryPath, { headers });
    if (primaryRes.status !== 404) {
      return await readJsonResponse(primaryRes);
    }
  } catch (_err) {
    // fallback
  }
  const fallbackRes = await fetch(fallbackPath, { headers });
  return await readJsonResponse(fallbackRes);
}

function getLlmLineUserId() {
  const el = document.getElementById('llm-line-user-id');
  return el && typeof el.value === 'string' ? el.value.trim() : '';
}

function getLlmFaqQuestion() {
  const el = document.getElementById('llm-faq-question');
  return el && typeof el.value === 'string' ? el.value.trim() : '';
}

function copyLlmTraceToAudit() {
  const llmTrace = ensureTraceInput('llm-trace');
  const auditTrace = document.getElementById('audit-trace');
  if (auditTrace && llmTrace) {
    auditTrace.value = llmTrace;
  }
}

function parseLlmEnabled(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

let llmConfigPlanHash = null;
let llmConfigConfirmToken = null;
let llmPolicyPlanHash = null;
let llmPolicyConfirmToken = null;

async function runLlmOpsExplain() {
  const lineUserId = getLlmLineUserId();
  if (!lineUserId) {
    const payload = { ok: false, error: t('ui.toast.llm.needLineUserId', 'lineUserId を入力してください') };
    renderLlmResult('llm-ops-explain-result', payload);
    showToast(t('ui.toast.llm.needLineUserId', 'lineUserId を入力してください'), 'warn');
    return;
  }
  const traceId = ensureTraceInput('llm-trace');
  const qs = new URLSearchParams({ lineUserId });
  try {
    const data = await fetchJsonWithFallback(
      `/api/admin/llm/ops-explain?${qs.toString()}`,
      `/api/phaseLLM2/ops-explain?${qs.toString()}`,
      traceId
    );
    renderLlmResult('llm-ops-explain-result', data);
    showToast(data && data.ok ? t('ui.toast.llm.opsExplainOk', 'Ops説明を取得しました') : t('ui.toast.llm.opsExplainFail', 'Ops説明の取得に失敗しました'), data && data.ok ? 'ok' : 'danger');
  } catch (_err) {
    const payload = { ok: false, error: 'fetch error' };
    renderLlmResult('llm-ops-explain-result', payload);
    showToast(t('ui.toast.llm.opsExplainFail', 'Ops説明の取得に失敗しました'), 'danger');
  }
}

async function runLlmNextActions() {
  const lineUserId = getLlmLineUserId();
  if (!lineUserId) {
    const payload = { ok: false, error: t('ui.toast.llm.needLineUserId', 'lineUserId を入力してください') };
    renderLlmResult('llm-next-actions-result', payload);
    showToast(t('ui.toast.llm.needLineUserId', 'lineUserId を入力してください'), 'warn');
    return;
  }
  const traceId = ensureTraceInput('llm-trace');
  const qs = new URLSearchParams({ lineUserId });
  try {
    const data = await fetchJsonWithFallback(
      `/api/admin/llm/next-actions?${qs.toString()}`,
      `/api/phaseLLM3/ops-next-actions?${qs.toString()}`,
      traceId
    );
    renderLlmResult('llm-next-actions-result', data);
    showToast(data && data.ok ? t('ui.toast.llm.nextActionsOk', '次候補を取得しました') : t('ui.toast.llm.nextActionsFail', '次候補の取得に失敗しました'), data && data.ok ? 'ok' : 'danger');
  } catch (_err) {
    const payload = { ok: false, error: 'fetch error' };
    renderLlmResult('llm-next-actions-result', payload);
    showToast(t('ui.toast.llm.nextActionsFail', '次候補の取得に失敗しました'), 'danger');
  }
}

async function runLlmFaq() {
  const question = getLlmFaqQuestion();
  if (!question) {
    const payload = { ok: false, error: t('ui.toast.llm.needQuestion', 'FAQ質問を入力してください') };
    renderLlmResult('llm-faq-result', payload);
    showToast(t('ui.toast.llm.needQuestion', 'FAQ質問を入力してください'), 'warn');
    return;
  }
  const traceId = ensureTraceInput('llm-trace');
  try {
    const data = await postJson('/api/admin/llm/faq/answer', { question, locale: 'ja' }, traceId);
    renderLlmResult('llm-faq-result', data);
    renderLlmFaqBlockPanel(data);
    showToast(data && data.ok ? t('ui.toast.llm.faqOk', 'FAQ回答を生成しました') : t('ui.toast.llm.faqFail', 'FAQ回答の生成に失敗しました'), data && data.ok ? 'ok' : 'danger');
  } catch (_err) {
    const payload = { ok: false, error: 'fetch error' };
    renderLlmResult('llm-faq-result', payload);
    renderLlmFaqBlockPanel(payload);
    showToast(t('ui.toast.llm.faqFail', 'FAQ回答の生成に失敗しました'), 'danger');
  }
}

async function loadLlmConfigStatus() {
  const traceId = ensureTraceInput('llm-trace');
  try {
    const res = await fetch('/api/admin/llm/config/status', { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    renderLlmResult('llm-config-status', data);
    if (data && data.ok) {
      const select = document.getElementById('llm-config-enabled');
      if (select) select.value = data.llmEnabled ? 'true' : 'false';
      showToast(t('ui.toast.llm.configStatusOk', 'LLM設定状態を取得しました'), 'ok');
    } else {
      showToast(t('ui.toast.llm.configStatusFail', 'LLM設定状態の取得に失敗しました'), 'danger');
    }
  } catch (_err) {
    renderLlmResult('llm-config-status', { ok: false, error: 'fetch error' });
    showToast(t('ui.toast.llm.configStatusFail', 'LLM設定状態の取得に失敗しました'), 'danger');
  }
}

async function planLlmConfig() {
  const traceId = ensureTraceInput('llm-trace');
  const llmEnabled = parseLlmEnabled(document.getElementById('llm-config-enabled')?.value);
  if (llmEnabled === null) {
    renderLlmResult('llm-config-plan-result', { ok: false, error: t('ui.toast.llm.invalidEnabled', 'LLM設定値が不正です') });
    showToast(t('ui.toast.llm.invalidEnabled', 'LLM設定値が不正です'), 'warn');
    return;
  }
  try {
    const data = await postJson('/api/admin/llm/config/plan', { llmEnabled }, traceId);
    renderLlmResult('llm-config-plan-result', data);
    if (data && data.ok) {
      llmConfigPlanHash = data.planHash || null;
      llmConfigConfirmToken = data.confirmToken || null;
      showToast(t('ui.toast.llm.configPlanOk', 'LLM設定の計画を作成しました'), 'ok');
    } else {
      showToast(t('ui.toast.llm.configPlanFail', 'LLM設定の計画作成に失敗しました'), 'danger');
    }
  } catch (_err) {
    renderLlmResult('llm-config-plan-result', { ok: false, error: 'fetch error' });
    showToast(t('ui.toast.llm.configPlanFail', 'LLM設定の計画作成に失敗しました'), 'danger');
  }
}

async function setLlmConfig() {
  const llmEnabled = parseLlmEnabled(document.getElementById('llm-config-enabled')?.value);
  if (llmEnabled === null) {
    renderLlmResult('llm-config-set-result', { ok: false, error: t('ui.toast.llm.invalidEnabled', 'LLM設定値が不正です') });
    showToast(t('ui.toast.llm.invalidEnabled', 'LLM設定値が不正です'), 'warn');
    return;
  }
  if (!llmConfigPlanHash || !llmConfigConfirmToken) {
    renderLlmResult('llm-config-set-result', { ok: false, error: t('ui.toast.llm.needConfigPlan', '設定計画が必要です') });
    showToast(t('ui.toast.llm.needConfigPlan', '設定計画が必要です'), 'warn');
    return;
  }
  const guardedTrace = runDangerActionGuard({
    confirmKey: 'ui.confirm.llmConfigSet',
    confirmFallback: 'LLM設定を適用しますか？',
    traceInputId: 'llm-trace',
    cancelMessage: t('ui.toast.llm.configSetCanceled', 'LLM設定の適用を中止しました')
  });
  if (guardedTrace === null) return;
  const traceId = guardedTrace || ensureTraceInput('llm-trace');
  try {
    const data = await postJson('/api/admin/llm/config/set', {
      llmEnabled,
      planHash: llmConfigPlanHash,
      confirmToken: llmConfigConfirmToken
    }, traceId);
    renderLlmResult('llm-config-set-result', data);
    if (data && data.ok) {
      showToast(t('ui.toast.llm.configSetOk', 'LLM設定を適用しました'), 'ok');
      await loadLlmConfigStatus();
    } else {
      showToast(t('ui.toast.llm.configSetFail', 'LLM設定の適用に失敗しました'), 'danger');
    }
  } catch (_err) {
    renderLlmResult('llm-config-set-result', { ok: false, error: 'fetch error' });
    showToast(t('ui.toast.llm.configSetFail', 'LLM設定の適用に失敗しました'), 'danger');
  }
}

function parseNumberField(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseIntentCsv(value) {
  if (typeof value !== 'string') return [];
  return Array.from(new Set(
    value.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .map((intent) => (Object.prototype.hasOwnProperty.call(POLICY_INTENT_ALIASES, intent)
        ? POLICY_INTENT_ALIASES[intent]
        : intent))
  ));
}

function buildPolicyPayloadFromForm() {
  const maxTokens = Math.floor(parseNumberField(document.getElementById('llm-policy-max-output-tokens')?.value, 600));
  const perUserLimit = Math.floor(parseNumberField(document.getElementById('llm-policy-per-user-daily-limit')?.value, 20));
  const rateLimit = Math.floor(parseNumberField(document.getElementById('llm-policy-global-qps-limit')?.value, 5));
  const perUserTokenBudget = Math.floor(parseNumberField(document.getElementById('llm-policy-per-user-token-budget')?.value, 12000));
  return {
    enabled: parseLlmEnabled(document.getElementById('llm-policy-enabled')?.value) === true,
    model: (document.getElementById('llm-policy-model')?.value || '').trim() || 'gpt-4o-mini',
    temperature: parseNumberField(document.getElementById('llm-policy-temperature')?.value, 0.2),
    top_p: parseNumberField(document.getElementById('llm-policy-top-p')?.value, 1),
    max_tokens: maxTokens,
    max_output_tokens: maxTokens,
    per_user_limit: perUserLimit,
    per_user_daily_limit: perUserLimit,
    per_user_token_budget: perUserTokenBudget,
    per_user_daily_token_budget: perUserTokenBudget,
    rate_limit: rateLimit,
    global_qps_limit: rateLimit,
    cache_ttl_sec: Math.floor(parseNumberField(document.getElementById('llm-policy-cache-ttl-sec')?.value, 120)),
    allowed_intents_free: parseIntentCsv(document.getElementById('llm-policy-allowed-intents-free')?.value || ''),
    allowed_intents_pro: parseIntentCsv(document.getElementById('llm-policy-allowed-intents-pro')?.value || ''),
    safety_mode: (document.getElementById('llm-policy-safety-mode')?.value || '').trim() || 'strict'
  };
}

function applyPolicyForm(policy) {
  const payload = policy && typeof policy === 'object' ? policy : {};
  setSelectValue('llm-policy-enabled', payload.enabled === true ? 'true' : 'false');
  setInputValue('llm-policy-model', payload.model || 'gpt-4o-mini');
  setInputValue('llm-policy-temperature', String(Number.isFinite(Number(payload.temperature)) ? Number(payload.temperature) : 0.2));
  setInputValue('llm-policy-top-p', String(Number.isFinite(Number(payload.top_p)) ? Number(payload.top_p) : 1));
  setInputValue('llm-policy-max-output-tokens', String(Number.isFinite(Number(payload.max_output_tokens)) ? Number(payload.max_output_tokens) : 600));
  setInputValue('llm-policy-per-user-daily-limit', String(Number.isFinite(Number(payload.per_user_daily_limit)) ? Number(payload.per_user_daily_limit) : 20));
  const perUserTokenBudget = Number.isFinite(Number(payload.per_user_token_budget))
    ? Number(payload.per_user_token_budget)
    : (Number.isFinite(Number(payload.per_user_daily_token_budget)) ? Number(payload.per_user_daily_token_budget) : 12000);
  setInputValue('llm-policy-per-user-token-budget', String(perUserTokenBudget));
  setInputValue('llm-policy-global-qps-limit', String(Number.isFinite(Number(payload.global_qps_limit)) ? Number(payload.global_qps_limit) : 5));
  setInputValue('llm-policy-cache-ttl-sec', String(Number.isFinite(Number(payload.cache_ttl_sec)) ? Number(payload.cache_ttl_sec) : 120));
  setInputValue('llm-policy-allowed-intents-free', Array.isArray(payload.allowed_intents_free) ? payload.allowed_intents_free.join(',') : 'faq_search');
  setInputValue('llm-policy-allowed-intents-pro', Array.isArray(payload.allowed_intents_pro) ? payload.allowed_intents_pro.join(',') : 'faq_search');
  setSelectValue('llm-policy-safety-mode', payload.safety_mode || 'strict');
}

function formatPolicyHistoryForDisplay(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '[]';
  return JSON.stringify(list.map((item) => {
    const policy = item && item.policy && typeof item.policy === 'object' ? item.policy : {};
    return {
      createdAt: item && item.createdAt ? item.createdAt : null,
      actor: item && item.actor ? item.actor : null,
      planHash: item && item.planHash ? item.planHash : null,
      temperature: policy.temperature,
      max_tokens: policy.max_output_tokens,
      per_user_limit: policy.per_user_daily_limit,
      rate_limit: policy.global_qps_limit,
      safety_mode: policy.safety_mode
    };
  }), null, 2);
}

async function loadLlmPolicyStatus(options) {
  const notify = Boolean(options && options.notify);
  const traceId = ensureTraceInput('llm-trace');
  try {
    const res = await fetch('/api/admin/llm/policy/status', { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    renderLlmResult('llm-policy-status', data);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'failed');
    applyPolicyForm(data.llmPolicy || {});
    setTextContent('llm-policy-effective-enabled', data.effectiveEnabled === true ? 'true' : 'false');
    if (notify) showToast('LLMポリシー状態を取得しました', 'ok');
  } catch (_err) {
    setTextContent('llm-policy-effective-enabled', '-');
    if (notify) showToast('LLMポリシー状態の取得に失敗しました', 'danger');
  }
}

async function loadLlmPolicyHistory(options) {
  const notify = Boolean(options && options.notify);
  const traceId = ensureTraceInput('llm-trace');
  const outputEl = document.getElementById('llm-policy-history-result');
  try {
    const res = await fetch('/api/admin/os/llm-policy/history?limit=20', { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'failed');
    if (outputEl) outputEl.textContent = formatPolicyHistoryForDisplay(data.items || []);
    if (notify) showToast('LLMポリシー履歴を取得しました', 'ok');
  } catch (_err) {
    if (outputEl) outputEl.textContent = JSON.stringify({ ok: false, error: 'fetch error' }, null, 2);
    if (notify) showToast('LLMポリシー履歴の取得に失敗しました', 'danger');
  }
}

async function loadLlmUsageSummary(options) {
  const notify = Boolean(options && options.notify);
  const traceId = ensureTraceInput('llm-trace');
  const windowDays = Math.max(1, Math.min(90, Math.floor(parseNumberField(document.getElementById('llm-usage-window-days')?.value, 7))));
  try {
    const res = await fetch(`/api/admin/os/llm-usage/summary?windowDays=${encodeURIComponent(String(windowDays))}&limit=20`, {
      headers: buildHeaders({}, traceId)
    });
    const data = await readJsonResponse(res);
    renderLlmResult('llm-usage-summary-result', data);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'failed');
    if (notify) showToast('LLM usage集計を取得しました', 'ok');
  } catch (_err) {
    if (notify) showToast('LLM usage集計の取得に失敗しました', 'danger');
  }
}

async function exportLlmUsageCsv() {
  const traceId = ensureTraceInput('llm-trace');
  const windowDays = Math.max(1, Math.min(90, Math.floor(parseNumberField(document.getElementById('llm-usage-window-days')?.value, 7))));
  try {
    const query = new URLSearchParams({
      windowDays: String(windowDays),
      limit: '100'
    });
    const res = await fetch(`/api/admin/os/llm-usage/export?${query.toString()}`, {
      headers: buildHeaders({}, traceId)
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `llm_usage_summary_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('LLM usage CSVを出力しました', 'ok');
  } catch (_err) {
    showToast('LLM usage CSVの出力に失敗しました', 'danger');
  }
}

async function planLlmPolicy() {
  const traceId = ensureTraceInput('llm-trace');
  const policy = buildPolicyPayloadFromForm();
  try {
    const data = await postJson('/api/admin/llm/policy/plan', { policy }, traceId);
    renderLlmResult('llm-policy-plan-result', data);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'failed');
    llmPolicyPlanHash = data.planHash || null;
    llmPolicyConfirmToken = data.confirmToken || null;
    if (data.llmPolicy) applyPolicyForm(data.llmPolicy);
    showToast('LLMポリシー計画を作成しました', 'ok');
  } catch (_err) {
    showToast('LLMポリシー計画の作成に失敗しました', 'danger');
  }
}

async function setLlmPolicy() {
  if (!llmPolicyPlanHash || !llmPolicyConfirmToken) {
    renderLlmResult('llm-policy-set-result', { ok: false, error: 'plan required' });
    showToast('LLMポリシー適用には先に計画が必要です', 'warn');
    return;
  }
  const guardedTrace = runDangerActionGuard({
    confirmFallback: 'LLMポリシーを適用しますか？',
    traceInputId: 'llm-trace',
    cancelMessage: 'LLMポリシー適用を中止しました'
  });
  if (guardedTrace === null) return;
  const traceId = guardedTrace || ensureTraceInput('llm-trace');
  const policy = buildPolicyPayloadFromForm();
  try {
    const data = await postJson('/api/admin/llm/policy/set', {
      policy,
      planHash: llmPolicyPlanHash,
      confirmToken: llmPolicyConfirmToken
    }, traceId);
    renderLlmResult('llm-policy-set-result', data);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'failed');
    llmPolicyPlanHash = null;
    llmPolicyConfirmToken = null;
    if (data.llmPolicy) applyPolicyForm(data.llmPolicy);
    await loadLlmPolicyStatus({ notify: false });
    await loadLlmPolicyHistory({ notify: false });
    showToast('LLMポリシーを適用しました', 'ok');
  } catch (_err) {
    showToast('LLMポリシーの適用に失敗しました', 'danger');
  }
}

function setupLlmControls() {
  document.getElementById('llm-regen')?.addEventListener('click', () => {
    const el = document.getElementById('llm-trace');
    if (el) el.value = newTraceId();
  });
  if (document.getElementById('llm-trace')) document.getElementById('llm-trace').value = newTraceId();
  document.getElementById('llm-run-ops-explain')?.addEventListener('click', runLlmOpsExplain);
  document.getElementById('llm-run-next-actions')?.addEventListener('click', runLlmNextActions);
  document.getElementById('llm-run-faq')?.addEventListener('click', runLlmFaq);
  document.getElementById('llm-open-audit')?.addEventListener('click', async () => {
    copyLlmTraceToAudit();
    activatePane('audit');
    await loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
  });
  document.getElementById('llm-config-reload')?.addEventListener('click', loadLlmConfigStatus);
  document.getElementById('llm-config-plan')?.addEventListener('click', planLlmConfig);
  document.getElementById('llm-config-set')?.addEventListener('click', setLlmConfig);
  document.getElementById('llm-policy-reload')?.addEventListener('click', () => {
    void loadLlmPolicyStatus({ notify: true });
  });
  document.getElementById('llm-policy-plan')?.addEventListener('click', () => {
    void planLlmPolicy();
  });
  document.getElementById('llm-policy-set')?.addEventListener('click', () => {
    void setLlmPolicy();
  });
  document.getElementById('llm-policy-history')?.addEventListener('click', () => {
    void loadLlmPolicyHistory({ notify: true });
  });
  document.getElementById('llm-usage-summary-reload')?.addEventListener('click', () => {
    void loadLlmUsageSummary({ notify: true });
  });
  document.getElementById('llm-usage-export')?.addEventListener('click', () => {
    void exportLlmUsageCsv();
  });
  loadLlmConfigStatus();
  void loadLlmPolicyStatus({ notify: false });
  void loadLlmPolicyHistory({ notify: false });
  void loadLlmUsageSummary({ notify: false });
}

(async () => {
  await loadDict();
  applyDict();
  applyBuildMetaBadge();
  applyTopSummaryVisibility();
  applyUsersStripeLayoutVisibility();
  hydrateListState();
  setupRoleSwitch();
  setupNav();
  setupHeaderActions();
  setupDeveloperMenu();
  setupHomeControls();
  setupComposerActions();
  setupMonitorControls();
  setupErrorsControls();
  setupReadModelControls();
  setupCityPackControls();
  setupVendorControls();
  setupMaintenanceControls();
  setupDecisionActions();
  setupAudit();
  setupLlmControls();
  setRole(state.role, { historyMode: 'replace', syncHistory: false });
  expandAllDetails();
  enforceNoCollapseUi();
  activateInitialPane();
  setupHistorySync();
  setupPaneKeyboardShortcuts();
  await loadLocalPreflight({ notify: false });

  loadMonitorData({ notify: false });
  loadMonitorInsights({ notify: false });
  loadReadModelData({ notify: false });
  loadUsersSummary({ notify: false });
  loadErrors({ notify: false });
  loadVendors({ notify: false });
  loadCityPackRequests({ notify: false });
  loadCityPackFeedback({ notify: false });
  loadCityPackBulletins({ notify: false });
  loadCityPackProposals({ notify: false });
  loadCityPackTemplateLibrary({ notify: false });
  loadCityPackReviewInbox({ notify: false });
  loadCityPackKpi({ notify: false });
  loadCityPackMetrics({ notify: false });
  loadCityPackAuditRuns({ notify: false });
  loadCityPackComposition({ notify: false });
  loadDashboardKpis({ notify: false });
  loadAlertsSummary({ notify: false });
  loadRepoMap({ notify: false });
  renderAllDecisionCards();
})();
