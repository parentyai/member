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
  readModelItems: [],
  errorsSummary: null,
  cityPackInboxItems: [],
  cityPackKpi: null,
  cityPackRuns: [],
  selectedCityPackRunTraceId: null,
  selectedCityPackSourceRefId: null,
  currentComposerStatus: '未取得',
  topCauses: '-',
  topCausesTip: '',
  topAnomaly: '-'
};

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
      activatePane(target);
    });
  });
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
}

function activatePane(target) {
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.paneTarget === target);
  });
  document.querySelectorAll('.app-pane').forEach((pane) => {
    pane.classList.toggle('is-active', pane.dataset.pane === target);
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

  const homeTodo = document.getElementById('home-todo');
  if (homeTodo) homeTodo.textContent = String(todo);
  const homeCauses = document.getElementById('home-causes');
  if (homeCauses) {
    homeCauses.textContent = state.topCauses || '-';
    const tip = state.topCausesTip || '';
    if (tip) {
      homeCauses.setAttribute('data-tip', tip);
      homeCauses.setAttribute('tabindex', '0');
    }
  }
  const homeAnomaly = document.getElementById('home-anomaly');
  if (homeAnomaly) homeAnomaly.textContent = state.topAnomaly || '-';

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
    cols.forEach((value) => {
      const td = document.createElement('td');
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
    cols.forEach((value) => {
      const td = document.createElement('td');
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
    [item.vendorLabel || item.vendorKey || '-', String(item.sent || 0), String(item.clicked || 0), item.ctr != null ? `${Math.round(item.ctr * 1000) / 10}%` : '-'].forEach((value) => {
      const td = document.createElement('td');
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
    [item.articleId || '-', String(item.count || 0)].forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function formatRatio(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 1000) / 10}%`;
}

function toDateLabel(value) {
  if (!value) return '-';
  const ms = toMillis(value);
  if (!ms) return '-';
  return new Date(ms).toISOString().slice(0, 10);
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
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    if (summaryEl) summaryEl.textContent = t('ui.desc.cityPack.runsEmpty', '実行履歴はありません。');
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

    const cells = [
      run && run.runId ? String(run.runId) : '-',
      run && run.mode ? String(run.mode) : '-',
      run && run.startedAt ? String(run.startedAt) : '-',
      resultLabel,
      `${processed}/${failed}`,
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

async function loadCityPackAuditRunDetail(runId) {
  if (!runId) return;
  const trace = ensureTraceInput('monitor-trace');
  const resultEl = document.getElementById('city-pack-run-result');
  try {
    const res = await fetch(`/api/admin/city-pack-source-audit/runs/${encodeURIComponent(runId)}`, {
      headers: buildHeaders({}, trace)
    });
    const data = await res.json();
    if (data && data.ok && data.run && data.run.sourceTraceId) {
      state.selectedCityPackRunTraceId = data.run.sourceTraceId;
    }
    if (resultEl) resultEl.textContent = JSON.stringify(data || {}, null, 2);
  } catch (_err) {
    if (resultEl) resultEl.textContent = JSON.stringify({ ok: false, error: 'fetch error' }, null, 2);
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

function renderCityPackInboxRows(items) {
  const tbody = document.getElementById('city-pack-rows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = t('ui.label.common.empty', 'データなし');
    tr.appendChild(td);
    tbody.appendChild(tr);
    renderCityPackEvidence(null);
    return;
  }

  items.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    if (row.recommendation === 'Retire') tr.classList.add('row-health-danger');
    if (row.recommendation === 'Confirm') tr.classList.add('row-health-warn');
    if (row.recommendation === 'ManualOnly') tr.classList.add('row-health-ok');
    const sourceTd = document.createElement('td');
    sourceTd.textContent = row.source || '-';
    tr.appendChild(sourceTd);

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
    const counts = getHealthCounts(state.monitorItems);
    const monitorTodo = document.getElementById('monitor-todo');
    if (monitorTodo) monitorTodo.textContent = String(counts.DANGER || 0);
    updateTopBar();
    renderComposerScenarioCompare(state.monitorItems);

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
    if (notify) showToast(t('ui.toast.cityPack.kpiLoaded', 'City Pack KPIを更新しました'), 'ok');
  } catch (_err) {
    renderCityPackKpi(null);
    if (notify) showToast(t('ui.toast.cityPack.kpiLoadFail', 'City Pack KPIの取得に失敗しました'), 'danger');
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

async function runCityPackAuditJob() {
  const trace = ensureTraceInput('monitor-trace');
  const mode = document.getElementById('city-pack-run-mode')?.value === 'canary' ? 'canary' : 'scheduled';
  const resultEl = document.getElementById('city-pack-run-result');
  const approved = window.confirm(t('ui.confirm.cityPack.runAudit', 'City Pack監査ジョブを実行しますか？'));
  if (!approved) return;
  try {
    const data = await postJson('/api/admin/city-pack-source-audit/run', {
      mode,
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
  if (result) result.textContent = JSON.stringify(data || {}, null, 2);
}

function updateComposerSummary() {
  const title = document.getElementById('title')?.value?.trim() || '-';
  const category = document.getElementById('notificationCategory')?.value || '-';
  const scenario = document.getElementById('scenarioKey')?.value || '-';
  const step = document.getElementById('stepKey')?.value || '-';
  const targetRegion = document.getElementById('targetRegion')?.value?.trim();
  const limit = document.getElementById('targetLimit')?.value || '-';
  const membersOnly = document.getElementById('membersOnly')?.checked ? t('ui.label.composer.membersOnly', '会員のみ') : t('ui.label.composer.membersAll', '全員');
  const target = `${scenario}/${step} ${targetRegion ? `(${targetRegion})` : ''} limit:${limit} ${membersOnly}`;

  const purposeEl = document.getElementById('composer-summary-purpose');
  const targetEl = document.getElementById('composer-summary-target');
  const timingEl = document.getElementById('composer-summary-timing');
  const riskEl = document.getElementById('composer-summary-risk');
  const statusEl = document.getElementById('composer-summary-status');

  if (purposeEl) purposeEl.textContent = `${title} / ${category}`;
  if (targetEl) targetEl.textContent = target;
  if (timingEl) timingEl.textContent = step;
  if (riskEl) riskEl.textContent = state.lastRisk || t('ui.desc.composer.riskDefault', 'Plan未実行');
  if (statusEl) statusEl.textContent = state.currentComposerStatus || '-';
}

function setComposerStatus(tone, label) {
  void tone;
  state.currentComposerStatus = label || '-';
  updateComposerSummary();
}

function updateSafetyBadge(result) {
  const badge = document.getElementById('composer-safety');
  if (!badge) return;
  if (!result || !result.ok) {
    badge.className = 'badge badge-danger';
    badge.textContent = statusLabel('DANGER');
    state.lastRisk = t('ui.desc.composer.riskFail', 'Plan失敗');
    return;
  }
  const blocked = typeof result.capBlockedCount === 'number' ? result.capBlockedCount : 0;
  if (blocked > 0) {
    badge.className = 'badge badge-warn';
    badge.textContent = statusLabel('WARN');
    state.lastRisk = t('ui.desc.composer.riskBlocked', '抑制対象あり');
  } else {
    badge.className = 'badge badge-ok';
    badge.textContent = statusLabel('OK');
    state.lastRisk = t('ui.desc.composer.riskOk', '問題なし');
  }
}

function buildDraftPayload() {
  return {
    title: document.getElementById('title').value.trim(),
    body: document.getElementById('body').value,
    ctaText: document.getElementById('ctaText').value.trim(),
    linkRegistryId: document.getElementById('linkRegistryId').value.trim(),
    scenarioKey: document.getElementById('scenarioKey').value,
    stepKey: document.getElementById('stepKey').value,
    notificationCategory: document.getElementById('notificationCategory').value,
    target: buildTarget()
  };
}

function buildTarget() {
  const region = document.getElementById('targetRegion').value.trim();
  const limitValue = document.getElementById('targetLimit').value;
  const limit = limitValue ? Number(limitValue) : null;
  const membersOnly = document.getElementById('membersOnly').checked;
  const target = {};
  if (region) target.region = region;
  if (membersOnly) target.membersOnly = true;
  if (limit) target.limit = limit;
  return target;
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
  const regen = document.getElementById('regen-trace');
  if (regen) regen.addEventListener('click', () => {
    const trace = newTraceId();
    const el = document.getElementById('traceId');
    if (el) el.value = trace;
    const note = document.getElementById('trace-note');
    if (note) note.textContent = '';
  });
  if (document.getElementById('traceId')) {
    document.getElementById('traceId').value = newTraceId();
  }

  let currentNotificationId = null;
  let currentPlanHash = null;
  let currentConfirmToken = null;

  document.getElementById('create-draft')?.addEventListener('click', async () => {
    const resultEl = document.getElementById('draft-result');
    const traceId = ensureTraceInput('traceId');
    const payload = buildDraftPayload();
    const result = await postJson('/api/admin/os/notifications/draft', payload, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    if (result && result.ok) {
      currentNotificationId = result.notificationId || null;
      if (document.getElementById('notificationId')) document.getElementById('notificationId').textContent = currentNotificationId || '-';
      showToast(t('ui.toast.composer.draftOk', 'draft OK'), 'ok');
      setComposerStatus('ok', 'DRAFT');
    } else {
      showToast(t('ui.toast.composer.draftFail', 'draft 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
    updateComposerSummary();
  });

  document.getElementById('preview')?.addEventListener('click', async () => {
    const resultEl = document.getElementById('draft-result');
    const traceId = ensureTraceInput('traceId');
    const payload = buildDraftPayload();
    const result = await postJson('/api/admin/os/notifications/preview', payload, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    if (result && result.ok) {
      showToast(t('ui.toast.composer.previewOk', 'preview OK'), 'ok');
      setComposerStatus('ok', 'PREVIEW');
    } else {
      showToast(t('ui.toast.composer.previewFail', 'preview 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
    updateComposerSummary();
  });

  document.getElementById('approve')?.addEventListener('click', async () => {
    if (!currentNotificationId) {
      showToast(t('ui.toast.composer.needId', '通知IDが必要です'), 'warn');
      setComposerStatus('warn', 'WARN');
      return;
    }
    const resultEl = document.getElementById('draft-result');
    const traceId = ensureTraceInput('traceId');
    const result = await postJson('/api/admin/os/notifications/approve', { notificationId: currentNotificationId }, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    if (result && result.ok) {
      showToast(t('ui.toast.composer.approveOk', 'approve OK'), 'ok');
      setComposerStatus('ok', 'ACTIVE');
    } else {
      showToast(t('ui.toast.composer.approveFail', 'approve 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
    updateComposerSummary();
  });

  document.getElementById('plan')?.addEventListener('click', async () => {
    const planTargetCountEl = document.getElementById('planTargetCount');
    const planCapBlockedEl = document.getElementById('planCapBlockedCount');
    const resultEl = document.getElementById('plan-result');
    if (planTargetCountEl) planTargetCountEl.textContent = '-';
    if (planCapBlockedEl) planCapBlockedEl.textContent = '-';
    if (!currentNotificationId) {
      if (resultEl) resultEl.textContent = t('ui.toast.composer.needId', '通知IDが必要です');
      showToast(t('ui.toast.composer.needId', '通知IDが必要です'), 'warn');
      setComposerStatus('warn', 'WARN');
      return;
    }
    const traceId = ensureTraceInput('traceId');
    const result = await postJson('/api/admin/os/notifications/send/plan', { notificationId: currentNotificationId }, traceId);
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    if (result && result.ok) {
      currentPlanHash = result.planHash || null;
      currentConfirmToken = result.confirmToken || null;
      if (document.getElementById('planHash')) document.getElementById('planHash').textContent = currentPlanHash || '-';
      if (document.getElementById('confirmToken')) document.getElementById('confirmToken').textContent = currentConfirmToken ? 'set' : '-';
      if (planTargetCountEl) planTargetCountEl.textContent = typeof result.count === 'number' ? String(result.count) : '-';
      if (planCapBlockedEl) planCapBlockedEl.textContent = typeof result.capBlockedCount === 'number' ? String(result.capBlockedCount) : '-';
      showToast(t('ui.toast.composer.planOk', 'plan OK'), 'ok');
      setComposerStatus('ok', 'PLAN');
    } else {
      showToast(t('ui.toast.composer.planFail', 'plan 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
    updateSafetyBadge(result);
    updateComposerSummary();
  });

  document.getElementById('execute')?.addEventListener('click', async () => {
    const resultEl = document.getElementById('execute-result');
    if (!currentNotificationId || !currentPlanHash || !currentConfirmToken) {
      if (resultEl) resultEl.textContent = t('ui.toast.composer.needPlan', '計画ハッシュと確認トークンが必要です');
      showToast(t('ui.toast.composer.needPlan', '計画ハッシュと確認トークンが必要です'), 'warn');
      setComposerStatus('warn', 'WARN');
      return;
    }
    const traceId = ensureTraceInput('traceId');
    const result = await postJson('/api/admin/os/notifications/send/execute', {
      notificationId: currentNotificationId,
      planHash: currentPlanHash,
      confirmToken: currentConfirmToken
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
    } else {
      showToast(t('ui.toast.composer.executeFail', 'execute 失敗'), 'danger');
      setComposerStatus('danger', 'ERROR');
    }
    updateComposerSummary();
  });

  ['title', 'body', 'ctaText', 'linkRegistryId', 'scenarioKey', 'stepKey', 'notificationCategory', 'targetRegion', 'targetLimit'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateComposerSummary);
  });
  const membersOnly = document.getElementById('membersOnly');
  if (membersOnly) membersOnly.addEventListener('change', updateComposerSummary);

  updateComposerSummary();
}

function setupAudit() {
  document.getElementById('audit-search')?.addEventListener('click', () => {
    loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
  });
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
  document.getElementById('city-pack-reload')?.addEventListener('click', () => {
    void loadCityPackReviewInbox({ notify: true });
    void loadCityPackKpi({ notify: false });
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
  document.getElementById('city-pack-open-trace')?.addEventListener('click', async () => {
    const trace = state.selectedCityPackRunTraceId || ensureTraceInput('monitor-trace');
    const auditTrace = document.getElementById('audit-trace');
    if (auditTrace && trace) auditTrace.value = trace;
    activatePane('audit');
    await loadAudit().catch(() => {
      showToast(t('ui.toast.audit.fail', 'audit 失敗'), 'danger');
    });
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
  setupHomeControls();
  setupComposerActions();
  setupMonitorControls();
  setupErrorsControls();
  setupReadModelControls();
  setupCityPackControls();
  setupAudit();
  setupLlmControls();
  setRole(state.role);

  loadMonitorData({ notify: false });
  loadMonitorInsights({ notify: false });
  loadReadModelData({ notify: false });
  loadErrors({ notify: false });
  loadCityPackReviewInbox({ notify: false });
  loadCityPackKpi({ notify: false });
  loadCityPackAuditRuns({ notify: false });
})();
