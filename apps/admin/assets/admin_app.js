'use strict';

const OPS_ACTOR_HEADERS = { 'x-actor': 'admin_app' };
const TRACE_HEADER_NAME = 'x-trace-id';

const toastEl = document.getElementById('toast');
const appShell = document.getElementById('app-shell');

const state = {
  dict: {},
  role: 'operator',
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
  composerSelectedNotificationId: null,
  composerListLoadedAt: null,
  composerLinkPreview: null,
  composerCurrentNotificationId: null,
  composerCurrentPlanHash: null,
  composerCurrentConfirmToken: null,
  composerKillSwitch: false,
  dashboardKpis: null,
  repoMap: null,
  topCauses: '-',
  topCausesTip: '',
  topAnomaly: '-',
  structDriftRuns: [],
  structDriftLastResult: null,
  paneUpdatedAt: {}
};

const COMPOSER_ALLOWED_SCENARIOS = new Set(['A', 'C']);
const COMPOSER_ALLOWED_STEPS = new Set(['3mo', '1mo', 'week', 'after1w']);
const PANE_HEADER_MAP = Object.freeze({
  home: { titleKey: 'ui.label.nav.dashboard', subtitleKey: 'ui.desc.page.home' },
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
  return `${t('ui.label.scenario', 'シナリオ')}${value}`;
}

function stepLabel(value) {
  if (!value) return '-';
  const key = `ui.value.step.${value}`;
  const label = t(key, '');
  if (label && label !== key) return label;
  return value;
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

function setRole(role) {
  const nextRole = role === 'admin' ? 'admin' : 'operator';
  state.role = nextRole;
  if (appShell) appShell.setAttribute('data-role', nextRole);
  document.querySelectorAll('.role-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.roleValue === nextRole);
  });
}

function setupRoleSwitch() {
  document.querySelectorAll('.role-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setRole(btn.dataset.roleValue);
    });
  });
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.paneTarget;
      if (!target) return;
      const scrollTarget = btn.dataset.scrollTarget || null;
      activatePane(target, { scrollTarget, clickedButton: btn });
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
  if (subtitleEl) subtitleEl.textContent = t(meta.subtitleKey, subtitleEl.textContent || '');
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
  document.getElementById('home-run-test')?.addEventListener('click', () => {
    runHomeSafeTest();
  });
  document.getElementById('dashboard-reload')?.addEventListener('click', () => {
    void loadDashboardKpis({ notify: true });
  });
  document.getElementById('dashboard-window-months')?.addEventListener('change', () => {
    void loadDashboardKpis({ notify: false });
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

      const sections = [
        { label: t('ui.label.repoMap.canDo', '今できること'), values: item && item.canDo },
        { label: t('ui.label.repoMap.cannotDo', 'まだできないこと'), values: item && item.cannotDo },
        { label: t('ui.label.repoMap.risks', 'リスク'), values: item && item.risks },
        { label: t('ui.label.repoMap.nextActions', '次にやるべきこと'), values: item && item.nextActions }
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
      relatedLabel.className = 'repo-map-card-subtitle';
      relatedLabel.textContent = t('ui.label.repoMap.relatedFiles', '関連ファイル');
      card.appendChild(relatedLabel);
      const relatedList = document.createElement('ul');
      relatedList.className = 'repo-map-list mono-list';
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
}

async function loadRepoMap(options) {
  const notify = !options || options.notify !== false;
  const traceId = newTraceId();
  try {
    const res = await fetch('/api/admin/repo-map', { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'repo map load failed');
    renderRepoMap(data);
    await loadNotificationMatrixOverlay().then((matrix) => {
      renderRepoMapMatrix(matrix);
    }).catch(() => {
      // keep fallback matrix
    });
    if (notify) showToast(t('ui.toast.repoMap.reloadOk', 'Repo Mapを更新しました'), 'ok');
  } catch (_err) {
    renderRepoMap({
      repoMap: {
        meta: {},
        systemOverview: { what: [t('ui.value.repoMap.notAvailable', 'NOT AVAILABLE')], statusSummary: {} },
        categories: [],
        scenarioStepMatrix: { scenarios: [], steps: [], cells: [] },
        layers: {}
      }
    });
    if (notify) showToast(t('ui.toast.repoMap.reloadFail', 'Repo Mapの取得に失敗しました'), 'danger');
  }
}

function setupDeveloperMenu() {
  const openMap = document.getElementById('developer-open-map');
  const openSystem = document.getElementById('developer-open-system');
  const openAudit = document.getElementById('developer-open-audit');
  const openImplementation = document.getElementById('developer-open-implementation');
  const openManualRedac = document.getElementById('developer-open-manual-redac');
  const openManualUser = document.getElementById('developer-open-manual-user');
  const reload = document.getElementById('repo-map-reload');
  const paneSystem = document.getElementById('repo-map-open-settings');
  const paneAudit = document.getElementById('repo-map-open-audit');
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
  openManualRedac?.addEventListener('click', () => {
    activatePane('developer-manual-redac');
  });
  openManualUser?.addEventListener('click', () => {
    activatePane('developer-manual-user');
  });
  reload?.addEventListener('click', () => {
    void loadRepoMap({ notify: true });
  });
  paneSystem?.addEventListener('click', () => activatePane('settings'));
  paneAudit?.addEventListener('click', async () => {
    activatePane('audit');
    await loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
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
  if (opts.clickedButton) {
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('is-active', el === opts.clickedButton);
    });
  } else {
    let activated = false;
    document.querySelectorAll('.nav-item').forEach((el) => {
      const shouldActivate = !activated && el.dataset.paneTarget === normalizedTarget;
      el.classList.toggle('is-active', shouldActivate);
      if (shouldActivate) activated = true;
    });
  }
  document.querySelectorAll('.app-pane').forEach((pane) => {
    pane.classList.toggle('is-active', pane.dataset.pane === normalizedTarget);
  });
  if (!opts.skipHistory && globalThis.history && typeof globalThis.history.replaceState === 'function') {
    const nextUrl = new URL(globalThis.location.href);
    nextUrl.searchParams.set('pane', normalizedTarget);
    globalThis.history.replaceState({}, '', `${nextUrl.pathname}?${nextUrl.searchParams.toString()}`);
  }
  updatePageHeader(normalizedTarget);
  expandPaneDetails(normalizedTarget);
  if (opts.scrollTarget) {
    scrollToPaneAnchor(opts.scrollTarget);
  }
}

function activateInitialPane() {
  const currentUrl = new URL(globalThis.location.href);
  const pane = currentUrl.searchParams.get('pane');
  activatePane(pane || 'home', { skipHistory: true });
}

const PANE_SHORTCUTS = Object.freeze({
  '0': 'home',
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
    activatePane(pane);
    focusPaneDecisionCard(pane);
  });
}

function newTraceId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function ensureTraceInput(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  if (!el.value) el.value = newTraceId();
  return el.value.trim();
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

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) return '-';
  return `${Math.round(Number(value) * 1000) / 10}%`;
}

function createSparklineBars(containerEl, series) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  if (!Array.isArray(series) || !series.length) return;
  const numeric = series.filter((value) => Number.isFinite(Number(value))).map((value) => Number(value));
  if (!numeric.length) return;
  const max = Math.max(...numeric, 1);
  series.forEach((value) => {
    const bar = document.createElement('span');
    bar.className = 'kpi-spark-bar';
    const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
    const ratio = max > 0 ? safe / max : 0;
    bar.style.height = `${Math.max(8, Math.round(ratio * 36))}px`;
    containerEl.appendChild(bar);
  });
}

function renderDashboardMetricCard(metricKey, metric) {
  const valueEl = document.getElementById(`dashboard-kpi-${metricKey}-value`);
  const sparkEl = document.getElementById(`dashboard-kpi-${metricKey}-spark`);
  const noteEl = document.getElementById(`dashboard-kpi-${metricKey}-note`);
  if (!valueEl || !sparkEl || !noteEl) return;

  if (!metric || metric.available !== true) {
    valueEl.textContent = t('ui.value.dashboard.notAvailable', 'NOT AVAILABLE');
    noteEl.textContent = t('ui.desc.dashboard.notAvailable', '現行データから算出できません');
    createSparklineBars(sparkEl, []);
    return;
  }
  valueEl.textContent = metric.valueLabel || '-';
  noteEl.textContent = metric.note || '-';
  createSparklineBars(sparkEl, metric.series || []);
}

function renderDashboardKpis(payload) {
  const kpis = payload && payload.kpis && typeof payload.kpis === 'object' ? payload.kpis : {};
  renderDashboardMetricCard('registrations', kpis.registrations);
  renderDashboardMetricCard('membership', kpis.membership);
  renderDashboardMetricCard('step', kpis.stepStates);
  renderDashboardMetricCard('churn', kpis.churnRate);
  renderDashboardMetricCard('ctr', kpis.ctrTrend);
  renderDashboardMetricCard('citypack', kpis.cityPackUsage);
}

async function loadDashboardKpis(options) {
  const notify = !options || options.notify !== false;
  const months = document.getElementById('dashboard-window-months')?.value || '1';
  const traceId = ensureTraceInput('traceId') || newTraceId();
  try {
    const res = await fetch(`/api/admin/os/dashboard/kpi?windowMonths=${encodeURIComponent(months)}`, { headers: buildHeaders({}, traceId) });
    const data = await readJsonResponse(res);
    if (!data || data.ok !== true) throw new Error((data && data.error) || 'kpi load failed');
    state.dashboardKpis = data.kpis || null;
    renderDashboardKpis(data);
    if (notify) showToast(t('ui.toast.dashboard.reloadOk', 'ダッシュボード指標を更新しました'), 'ok');
  } catch (_err) {
    renderDashboardKpis({ kpis: {} });
    if (notify) showToast(t('ui.toast.dashboard.reloadFail', 'ダッシュボード指標の取得に失敗しました'), 'danger');
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
    td.colSpan = 7;
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
  ['A', 'C'].forEach((scenario) => {
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
  return {
    linkId: row.id || row.linkId || '-',
    vendorLabel: row.vendorLabel || fallbackHost || row.vendorKey || '-',
    vendorKey: row.vendorKey || fallbackHost || '-',
    healthState,
    checkedAt: row.checkedAt || (row.lastHealth && row.lastHealth.checkedAt) || row.updatedAt || null,
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
  if (sourceRefIdEl) {
    sourceRefIdEl.textContent = row && row.sourceRefId ? String(row.sourceRefId) : '-';
  }
  if (sourceTypeEl) {
    sourceTypeEl.value = row && row.sourceType ? String(row.sourceType) : 'other';
  }
  if (requiredLevelEl) {
    requiredLevelEl.value = row && row.requiredLevel ? String(row.requiredLevel) : 'required';
  }
}

function renderCityPackInboxRows(items) {
  const tbody = document.getElementById('city-pack-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 11;
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

    const requiredLevelTd = document.createElement('td');
    requiredLevelTd.textContent = row.requiredLevel || '-';
    tr.appendChild(requiredLevelTd);

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
    td.colSpan = 9;
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
  if (summaryEl) summaryEl.textContent = `status=${req.status || '-'} / stage=${stage} / region=${region} / drafts=${drafts} / links=${linkDrafts} / traceId=${req.traceId || '-'}${error}`;
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
  if (summaryEl) summaryEl.textContent = `status=${item.status || '-'} / region=${region} / slot=${slotKey} / resolution=${resolution} / traceId=${item.traceId || '-'}`;
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
  const stateFilter = document.getElementById('vendor-state')?.value?.trim() || '';
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
    setPaneUpdatedAt('vendors');
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.vendors.loaded', 'Vendor一覧を更新しました'), 'ok');
  } catch (_err) {
    state.vendorItems = [];
    renderVendorRows([]);
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
  const limit = document.getElementById('city-pack-request-limit')?.value || '50';
  const traceId = ensureTraceInput('monitor-trace');
  const params = new URLSearchParams({ limit, traceId });
  if (status) params.set('status', status);
  if (regionKey) params.set('regionKey', regionKey);
  try {
    const res = await fetch(`/api/admin/city-pack-requests?${params.toString()}`, { headers: buildHeaders({}, traceId) });
    const data = await res.json();
    const items = Array.isArray(data && data.items) ? data.items : [];
    state.cityPackRequestItems = items;
    renderCityPackRequestRows(items);
    setPaneUpdatedAt('city-pack');
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.cityPack.requestLoaded', 'Request一覧を取得しました'), 'ok');
  } catch (_err) {
    if (notify) showToast(t('ui.toast.cityPack.requestLoadFail', 'Request一覧の取得に失敗しました'), 'danger');
    renderCityPackRequestRows([]);
  }
}

async function loadCityPackFeedback(options) {
  const notify = options && options.notify;
  const status = document.getElementById('city-pack-feedback-status-filter')?.value || '';
  const limitRaw = document.getElementById('city-pack-feedback-limit')?.value || '';
  const limit = Number(limitRaw) || 50;
  const trace = ensureTraceInput('monitor-trace');
  try {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit) params.set('limit', String(limit));
    const data = await getJson(`/api/admin/city-pack-feedback?${params.toString()}`, trace);
    if (data && data.ok) {
      const items = Array.isArray(data.items) ? data.items : [];
      state.cityPackFeedbackItems = items;
      renderCityPackFeedbackRows(items);
      if (!state.selectedCityPackFeedbackId) renderCityPackFeedbackDetail(null);
      if (notify) showToast(t('ui.toast.cityPack.feedbackLoaded', 'Feedback一覧を取得しました'), 'ok');
    } else if (notify) {
      showToast(t('ui.toast.cityPack.feedbackLoadFail', 'Feedback一覧の取得に失敗しました'), 'danger');
    }
  } catch (_err) {
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
    if (!state.selectedCityPackBulletinId) renderCityPackBulletinDetail(null);
    if (notify) showToast(t('ui.toast.cityPack.bulletinLoaded', 'Bulletin一覧を取得しました'), 'ok');
  } catch (_err) {
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
    if (!state.selectedCityPackProposalId) renderCityPackProposalDetail(null);
    if (notify) showToast(t('ui.toast.cityPack.proposalLoaded', 'Proposal一覧を取得しました'), 'ok');
  } catch (_err) {
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
      if (!state.selectedCityPackTemplateLibraryId) renderCityPackTemplateLibraryDetail(null);
      if (notify) showToast(t('ui.toast.cityPack.templateLibraryLoaded', 'Template一覧を取得しました'), 'ok');
    } else if (notify) {
      showToast(t('ui.toast.cityPack.templateLibraryLoadFail', 'Template一覧の取得に失敗しました'), 'danger');
    }
  } catch (_err) {
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
  const limit = document.getElementById('city-pack-limit')?.value || '50';
  const monitorTrace = ensureTraceInput('monitor-trace');
  const params = new URLSearchParams({ limit, traceId: monitorTrace });
  if (status) params.set('status', status);
  try {
    const res = await fetch(`/api/admin/review-inbox?${params.toString()}`, { headers: buildHeaders({}, monitorTrace) });
    const data = await res.json();
    const items = Array.isArray(data && data.items) ? data.items : [];
    state.cityPackInboxItems = items;
    renderCityPackInboxRows(items);
    setPaneUpdatedAt('city-pack');
    renderAllDecisionCards();
    if (notify) showToast(t('ui.toast.cityPack.inboxLoaded', 'Review Inboxを取得しました'), 'ok');
  } catch (_err) {
    if (notify) showToast(t('ui.toast.cityPack.inboxLoadFail', 'Review Inboxの取得に失敗しました'), 'danger');
    renderCityPackInboxRows([]);
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
  const trace = ensureTraceInput('monitor-trace');
  const approved = window.confirm(t('ui.confirm.cityPack.sourcePolicySave', '情報源ポリシーを保存しますか？'));
  if (!approved) return;
  try {
    const data = await postJson(`/api/admin/source-refs/${encodeURIComponent(sourceRefId)}/policy`, {
      sourceType,
      requiredLevel
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
  const resultEl = document.getElementById('city-pack-run-result');
  const approved = window.confirm(t('ui.confirm.cityPack.runAudit', 'City Pack監査ジョブを実行しますか？'));
  if (!approved) return;
  try {
    const data = await postJson('/api/admin/city-pack-source-audit/run', {
      mode,
      stage,
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
  activatePane('monitor');
  const monitorTrace = document.getElementById('monitor-trace');
  if (monitorTrace && traceId) monitorTrace.value = traceId;
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
      issues.push(t('ui.desc.composer.safety.scenario', 'シナリオが不正です。AまたはCを選択してください。'));
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
  state.composerSavedFilteredItems = state.composerSavedItems.filter((item) => {
    const searchable = [item.title, item.body, item.ctaText].map((value) => String(value || '').toLowerCase()).join('\n');
    if (keyword && !searchable.includes(keyword)) return false;
    if (status && normalizeComposerSavedStatus(item.status) !== status) return false;
    if (type && normalizeComposerType(item.notificationType || 'STEP') !== type) return false;
    if (category && String(item.notificationCategory || '').toUpperCase() !== category) return false;
    if (scenarioKey && String(item.scenarioKey || '').toUpperCase() !== scenarioKey) return false;
    if (stepKey && String(item.stepKey || '').toLowerCase() !== stepKey) return false;
    return true;
  });
}

function loadComposerFormFromRow(row, duplicateMode) {
  if (!row) return;
  document.getElementById('title').value = row.title || '';
  document.getElementById('body').value = row.body || '';
  document.getElementById('ctaText').value = row.ctaText || '';
  document.getElementById('ctaText2').value = '';
  document.getElementById('linkRegistryId').value = row.linkRegistryId || '';
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
  const items = state.composerSavedFilteredItems;
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
    if (state.composerSelectedNotificationId && state.composerSelectedNotificationId === item.id) tr.classList.add('row-active');
    const targetCount = item && item.target && Number.isFinite(Number(item.target.limit)) ? Number(item.target.limit) : null;
    const cells = [
      formatTimestampForList(item.createdAt),
      item.title || '-',
      composerStatusLabel(item.status),
      targetCount === null ? '-' : String(targetCount),
      t('ui.value.dashboard.notAvailable', 'NOT AVAILABLE')
    ];
    cells.forEach((value, idx) => {
      const td = document.createElement('td');
      if (idx >= 2) td.classList.add('cell-muted');
      td.textContent = String(value);
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
  if (raw === 'DEADLINE_REQUIRED') return t('ui.value.composer.category.deadline', '期限必須');
  if (raw === 'IMMEDIATE_ACTION') return t('ui.value.composer.category.immediate', '即時対応');
  if (raw === 'SEQUENCE_GUIDANCE') return t('ui.value.composer.category.sequence', '順次案内');
  if (raw === 'TARGETED_ONLY') return t('ui.value.composer.category.targeted', '対象限定');
  if (raw === 'COMPLETION_CONFIRMATION') return t('ui.value.composer.category.completion', '完了確認');
  return raw || '-';
}

function composerStatusLabel(value) {
  const raw = normalizeComposerSavedStatus(value);
  if (raw === 'approved' || raw === 'active') return t('ui.value.composer.status.approved', '承認済み');
  if (raw === 'executed' || raw === 'sent') return t('ui.value.composer.status.executed', '実行済み');
  return t('ui.value.composer.status.draft', '下書き');
}

async function postJson(url, payload, traceId) {
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, buildHeaders({}, traceId)),
    body: JSON.stringify(payload || {})
  });
  return res.text().then((text) => {
    try { return JSON.parse(text); } catch (_err) { return { ok: false, error: text || 'error' }; }
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
    const resultEl = document.getElementById('draft-result');
    const traceId = ensureTraceInput('traceId');
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

  let linkLookupTimer = null;
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
    linkRegistryInput.addEventListener('input', () => {
      updateComposerSummary();
      if (linkLookupTimer) clearTimeout(linkLookupTimer);
      linkLookupTimer = setTimeout(() => {
        void loadComposerLinkPreview();
      }, 220);
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

  applyComposerTypeFields();
  updateComposerSummary();
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
}

function setupCityPackControls() {
  document.getElementById('city-pack-request-reload')?.addEventListener('click', () => {
    void loadCityPackRequests({ notify: true });
  });
  document.getElementById('city-pack-request-status-filter')?.addEventListener('change', () => {
    void loadCityPackRequests({ notify: false });
  });
  document.getElementById('city-pack-request-region')?.addEventListener('change', () => {
    void loadCityPackRequests({ notify: false });
  });
  document.getElementById('city-pack-feedback-reload')?.addEventListener('click', () => {
    void loadCityPackFeedback({ notify: true });
  });
  document.getElementById('city-pack-feedback-status-filter')?.addEventListener('change', () => {
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
  });
  document.getElementById('city-pack-status-filter')?.addEventListener('change', () => {
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
  const traceId = ensureTraceInput('llm-trace');
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
  const approved = window.confirm(t('ui.confirm.llmConfigSet', 'LLM設定を適用しますか？')); // eslint-disable-line no-alert
  if (!approved) {
    showToast(t('ui.toast.llm.configSetCanceled', 'LLM設定の適用を中止しました'), 'warn');
    return;
  }
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
  loadLlmConfigStatus();
}

(async () => {
  await loadDict();
  applyDict();
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
  setupDecisionActions();
  setupAudit();
  setupLlmControls();
  setRole(state.role);
  expandAllDetails();
  activateInitialPane();
  setupPaneKeyboardShortcuts();

  loadMonitorData({ notify: false });
  loadMonitorInsights({ notify: false });
  loadReadModelData({ notify: false });
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
  loadDashboardKpis({ notify: false });
  loadRepoMap({ notify: false });
  renderAllDecisionCards();
})();
