'use strict';

const OPS_ACTOR_HEADERS = { 'x-actor': 'admin_app' };
const TRACE_HEADER_NAME = 'x-trace-id';

const toastEl = document.getElementById('toast');
const appShell = document.getElementById('app-shell');

const state = {
  dict: {},
  role: 'operator',
  monitorItems: [],
  readModelItems: [],
  errorsSummary: null,
  currentComposerStatus: 'unknown'
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
      document.querySelectorAll('.nav-item').forEach((el) => {
        el.classList.toggle('is-active', el === btn);
      });
      document.querySelectorAll('.app-pane').forEach((pane) => {
        pane.classList.toggle('is-active', pane.dataset.pane === target);
      });
    });
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

function setStatusPanel(panelId, pillId, actionId, summaryKey, counts) {
  const panel = document.getElementById(panelId);
  const pill = document.getElementById(pillId);
  const action = document.getElementById(actionId);
  if (!panel || !pill) return;
  const danger = counts.DANGER || 0;
  const warn = counts.WARN || 0;
  const ok = counts.OK || 0;
  if (!danger && !warn && !ok) {
    pill.className = 'status-pill status-unknown';
    pill.textContent = t('ui.status.unknown', '未設定');
    panel.classList.remove('status-ok', 'status-warn', 'status-danger');
    panel.classList.add('status-unknown');
  } else if (danger > 0) {
    pill.className = 'status-pill status-danger';
    pill.textContent = statusLabel('DANGER');
    panel.classList.add('status-danger');
    panel.classList.remove('status-ok', 'status-warn', 'status-unknown');
  } else if (warn > 0) {
    pill.className = 'status-pill status-warn';
    pill.textContent = statusLabel('WARN');
    panel.classList.add('status-warn');
    panel.classList.remove('status-ok', 'status-danger', 'status-unknown');
  } else {
    pill.className = 'status-pill status-ok';
    pill.textContent = statusLabel('OK');
    panel.classList.add('status-ok');
    panel.classList.remove('status-warn', 'status-danger', 'status-unknown');
  }
  if (action) action.textContent = String(danger);
  const summaryEl = document.querySelector(`[data-summary="${summaryKey}"]`);
  if (summaryEl) summaryEl.textContent = `DANGER ${danger} / WARN ${warn} / OK ${ok}`;
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
      const detail = document.getElementById('monitor-detail');
      const raw = document.getElementById('monitor-raw');
      if (detail) detail.textContent = JSON.stringify(item, null, 2);
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

  const counts = { OK: 0, WARN: 0, DANGER: total > 0 ? total : 0 };
  if (total === 0) counts.OK = 1;
  setStatusPanel('errors-status-panel', 'errors-status-pill', 'errors-action-count', 'errors', counts);
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
    setStatusPanel('monitor-status-panel', 'monitor-status-pill', 'monitor-todo', 'monitor', counts);
    updateTopBar();

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
    const counts = getHealthCounts(state.readModelItems);
    setStatusPanel('read-model-status-panel', 'read-model-status-pill', 'read-model-action-count', 'read-model', counts);
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
  const panel = document.getElementById('composer-status-panel');
  const pill = document.getElementById('composer-status-pill');
  if (panel) {
    panel.classList.remove('status-ok', 'status-warn', 'status-danger', 'status-unknown');
    panel.classList.add(`status-${tone || 'unknown'}`);
  }
  if (pill) {
    pill.className = `status-pill status-${tone || 'unknown'}`;
    pill.textContent = label || '未取得';
  }
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
    window.location.href = '/admin/ops';
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

(async () => {
  await loadDict();
  applyDict();
  setupRoleSwitch();
  setupNav();
  setupComposerActions();
  setupMonitorControls();
  setupErrorsControls();
  setupReadModelControls();
  setupAudit();
  setRole(state.role);

  loadMonitorData({ notify: false });
  loadReadModelData({ notify: false });
  loadErrors({ notify: false });
})();
