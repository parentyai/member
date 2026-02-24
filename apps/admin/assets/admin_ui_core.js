'use strict';

(function bootstrapAdminUiCore(globalScope) {
  const NOT_AVAILABLE = 'NOT AVAILABLE';

  function isUnset(value) {
    return value === null
      || value === undefined
      || (typeof value === 'string' && value.trim().length === 0);
  }

  function toDisplayValue(value, fallbackValue) {
    if (isUnset(value)) {
      return typeof fallbackValue === 'string' ? fallbackValue : NOT_AVAILABLE;
    }
    return String(value);
  }

  function toSortMillis(value) {
    if (isUnset(value)) return null;
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
    if (value && typeof value.toDate === 'function') {
      const date = value.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isFinite(parsed.getTime()) ? parsed.getTime() : null;
    }
    return null;
  }

  function compareValues(baseA, baseB, valueType, direction) {
    const dir = direction === 'asc' ? 1 : -1;
    const aUnset = isUnset(baseA);
    const bUnset = isUnset(baseB);
    if (aUnset && bUnset) return 0;
    if (aUnset) return 1;
    if (bUnset) return -1;

    if (valueType === 'date') {
      const aMs = toSortMillis(baseA);
      const bMs = toSortMillis(baseB);
      if (!Number.isFinite(aMs) && !Number.isFinite(bMs)) return 0;
      if (!Number.isFinite(aMs)) return 1;
      if (!Number.isFinite(bMs)) return -1;
      if (aMs === bMs) return 0;
      return aMs > bMs ? dir : -dir;
    }

    if (valueType === 'number') {
      const aNum = Number(baseA);
      const bNum = Number(baseB);
      if (!Number.isFinite(aNum) && !Number.isFinite(bNum)) return 0;
      if (!Number.isFinite(aNum)) return 1;
      if (!Number.isFinite(bNum)) return -1;
      if (aNum === bNum) return 0;
      return aNum > bNum ? dir : -dir;
    }

    const compared = String(baseA).localeCompare(String(baseB), 'ja', { sensitivity: 'base', numeric: true });
    if (compared === 0) return 0;
    return compared > 0 ? dir : -dir;
  }

  function sortRows(rows, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const key = opts.key ? String(opts.key) : '';
    const valueType = opts.typeMap && key && opts.typeMap[key] ? opts.typeMap[key] : 'string';
    const direction = opts.dir === 'asc' ? 'asc' : 'desc';
    const tieBreaker = typeof opts.tieBreaker === 'function' ? opts.tieBreaker : null;
    const valueGetter = typeof opts.valueGetter === 'function'
      ? opts.valueGetter
      : (row, field) => (row ? row[field] : null);

    const cloned = Array.isArray(rows) ? rows.slice() : [];
    return cloned.sort((a, b) => {
      const compared = compareValues(valueGetter(a, key), valueGetter(b, key), valueType, direction);
      if (compared !== 0) return compared;
      if (tieBreaker) return tieBreaker(a, b);
      return 0;
    });
  }

  function normalizeFilterValue(value, options) {
    const opts = options && typeof options === 'object' ? options : {};
    let next = value == null ? '' : String(value);
    if (opts.trim !== false) next = next.trim();
    if (opts.upper === true) next = next.toUpperCase();
    if (opts.lower === true) next = next.toLowerCase();
    return next;
  }

  function applyAndFilters(rows, descriptors) {
    const list = Array.isArray(rows) ? rows : [];
    const filters = Array.isArray(descriptors) ? descriptors : [];
    return list.filter((row) => {
      for (const filter of filters) {
        if (!filter || typeof filter !== 'object') continue;
        const type = filter.type || 'includes';
        const normalizedNeedle = normalizeFilterValue(filter.value, filter.normalize);
        if (filter.ignoreEmpty !== false && normalizedNeedle.length === 0) continue;

        let haystack = '';
        if (typeof filter.getValue === 'function') haystack = filter.getValue(row);
        else if (filter.key) haystack = row ? row[filter.key] : '';

        const normalizedHaystack = normalizeFilterValue(haystack, filter.normalize);
        if (type === 'equals' && normalizedHaystack !== normalizedNeedle) return false;
        if (type === 'includes' && !normalizedHaystack.includes(normalizedNeedle)) return false;
        if (type === 'startsWith' && !normalizedHaystack.startsWith(normalizedNeedle)) return false;
        if (type === 'endsWith' && !normalizedHaystack.endsWith(normalizedNeedle)) return false;
        if (type === 'gte' && Number(normalizedHaystack) < Number(normalizedNeedle)) return false;
        if (type === 'lte' && Number(normalizedHaystack) > Number(normalizedNeedle)) return false;
        if (type === 'predicate' && typeof filter.predicate === 'function' && !filter.predicate(row, normalizedNeedle)) return false;
      }
      return true;
    });
  }

  function mapRowsForColumns(rows, columns, options) {
    const list = Array.isArray(rows) ? rows : [];
    const defs = Array.isArray(columns) ? columns : [];
    const opts = options && typeof options === 'object' ? options : {};
    const fallback = typeof opts.fallback === 'string' ? opts.fallback : NOT_AVAILABLE;

    return list.map((row, rowIndex) => ({
      rowIndex,
      raw: row,
      cells: defs.map((column) => {
        const key = column && column.key ? String(column.key) : '';
        const rawValue = typeof column.render === 'function'
          ? column.render(row, rowIndex)
          : (row ? row[key] : null);
        return {
          key,
          value: rawValue,
          text: toDisplayValue(rawValue, fallback),
          align: column && column.align ? column.align : null
        };
      })
    }));
  }

  function renderTable(config) {
    const opts = config && typeof config === 'object' ? config : {};
    const mappedRows = mapRowsForColumns(opts.rows, opts.columns, {
      fallback: opts.emptyCellText || NOT_AVAILABLE
    });
    if (mappedRows.length > 0) {
      return {
        ok: true,
        rows: mappedRows,
        empty: false,
        emptyText: ''
      };
    }
    return {
      ok: true,
      rows: [],
      empty: true,
      emptyText: typeof opts.emptyText === 'string' ? opts.emptyText : NOT_AVAILABLE
    };
  }

  function parseSearchParams(search) {
    const raw = typeof search === 'string' ? search : '';
    const normalized = raw.startsWith('?') ? raw.slice(1) : raw;
    const params = new URLSearchParams(normalized);
    const out = {};
    params.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  function serializeListState(listKey, state, options) {
    const key = typeof listKey === 'string' ? listKey.trim() : '';
    if (!key) return {};
    const values = state && typeof state === 'object' ? state : {};
    const opts = options && typeof options === 'object' ? options : {};
    const prefix = typeof opts.prefix === 'string' ? opts.prefix : `${key}.`;
    const out = {};
    Object.keys(values).forEach((entryKey) => {
      const value = values[entryKey];
      if (value === undefined || value === null || value === '') return;
      out[`${prefix}${entryKey}`] = String(value);
    });
    return out;
  }

  function parseListStateFromQuery(listKey, search, options) {
    const key = typeof listKey === 'string' ? listKey.trim() : '';
    if (!key) return {};
    const opts = options && typeof options === 'object' ? options : {};
    const prefix = typeof opts.prefix === 'string' ? opts.prefix : `${key}.`;
    const parsed = parseSearchParams(search);
    const out = {};
    Object.keys(parsed).forEach((queryKey) => {
      if (!queryKey.startsWith(prefix)) return;
      const stateKey = queryKey.slice(prefix.length);
      if (!stateKey) return;
      out[stateKey] = parsed[queryKey];
    });
    return out;
  }

  function applyListStateToUrl(listKey, state, options) {
    const key = typeof listKey === 'string' ? listKey.trim() : '';
    const opts = options && typeof options === 'object' ? options : {};
    const currentUrl = opts.url
      ? new URL(opts.url, 'http://localhost')
      : new URL((globalScope && globalScope.location ? globalScope.location.href : 'http://localhost'));
    if (!key) return `${currentUrl.pathname}?${currentUrl.searchParams.toString()}`.replace(/\?$/, '');

    const prefix = typeof opts.prefix === 'string' ? opts.prefix : `${key}.`;
    const nextMap = serializeListState(key, state, { prefix });

    Array.from(currentUrl.searchParams.keys()).forEach((queryKey) => {
      if (queryKey.startsWith(prefix)) currentUrl.searchParams.delete(queryKey);
    });
    Object.keys(nextMap).forEach((queryKey) => {
      currentUrl.searchParams.set(queryKey, nextMap[queryKey]);
    });
    return `${currentUrl.pathname}?${currentUrl.searchParams.toString()}`.replace(/\?$/, '');
  }

  function resolveStorage(storageOverride) {
    if (storageOverride) return storageOverride;
    if (globalScope && globalScope.localStorage) return globalScope.localStorage;
    return null;
  }

  function saveListState(listKey, state, options) {
    const key = typeof listKey === 'string' ? listKey.trim() : '';
    if (!key) return false;
    const opts = options && typeof options === 'object' ? options : {};
    const storage = resolveStorage(opts.storage);
    if (!storage || typeof storage.setItem !== 'function') return false;
    const namespace = typeof opts.namespace === 'string' ? opts.namespace : 'admin.ui.listState.';
    try {
      storage.setItem(`${namespace}${key}`, JSON.stringify(state || {}));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function loadListState(listKey, options) {
    const key = typeof listKey === 'string' ? listKey.trim() : '';
    if (!key) return {};
    const opts = options && typeof options === 'object' ? options : {};
    const storage = resolveStorage(opts.storage);
    if (!storage || typeof storage.getItem !== 'function') return {};
    const namespace = typeof opts.namespace === 'string' ? opts.namespace : 'admin.ui.listState.';
    try {
      const raw = storage.getItem(`${namespace}${key}`);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function mergeStatePriority(urlState, storedState, defaults) {
    return Object.assign({}, defaults || {}, storedState || {}, urlState || {});
  }

  const DOMAIN_LABELS = Object.freeze({
    scenario: Object.freeze({ A: 'A単身', B: 'B夫婦', C: 'C帯同1', D: 'D帯同2' }),
    step: Object.freeze({ '3mo': '3か月前', '1mo': '1か月前', week: '1週間前', after1w: '着任後1週間' }),
    status: Object.freeze({
      draft: '下書き',
      active: '有効',
      sent: '送信済み',
      WARN: '注意',
      DANGER: '要対応',
      OK: '問題なし'
    }),
    category: Object.freeze({
      DEADLINE_REQUIRED: '期限必須',
      IMMEDIATE_ACTION: '即時対応',
      SEQUENCE_GUIDANCE: '段階ガイド',
      TARGETED_ONLY: '対象限定',
      COMPLETION_CONFIRMATION: '完了確認'
    }),
    type: Object.freeze({
      STEP: 'ステップ通知',
      GENERAL: '一般通知',
      ANNOUNCEMENT: '告知',
      VENDOR: 'ベンダー',
      AB: 'ABテスト'
    })
  });

  function resolveDomainLabel(kind, key, dictResolver) {
    const group = DOMAIN_LABELS[kind] || {};
    const normalized = key == null ? '' : String(key).trim();
    if (!normalized) return NOT_AVAILABLE;
    if (Object.prototype.hasOwnProperty.call(group, normalized)) return group[normalized];
    if (typeof dictResolver === 'function') {
      const dynamic = dictResolver(`ui.domain.${kind}.${normalized}`);
      if (typeof dynamic === 'string' && dynamic.trim()) return dynamic.trim();
    }
    return normalized;
  }

  const ALERT_SEVERITY_BY_TYPE = Object.freeze({
    kill_switch_on: 'DANGER',
    link_warn: 'DANGER',
    retry_queue_pending: 'WARN',
    target_zero: 'WARN',
    unapproved_notifications: 'INFO'
  });

  function extractActionable(items, options) {
    const list = Array.isArray(items) ? items : [];
    const opts = options && typeof options === 'object' ? options : {};
    const allowZero = opts.allowZero === true;
    const operableOnly = opts.operableOnly !== false;
    const withSeverity = list.map((item) => {
      const count = Number(item && item.count);
      return Object.assign({}, item, {
        severity: ALERT_SEVERITY_BY_TYPE[item && item.type] || 'INFO',
        count: Number.isFinite(count) ? count : 0
      });
    }).filter((item) => (allowZero ? true : item.count > 0))
      .filter((item) => (operableOnly ? Boolean(item.actionPane) : true));

    const rank = { DANGER: 0, WARN: 1, INFO: 2 };
    return withSeverity.sort((a, b) => {
      const bySeverity = rank[a.severity] - rank[b.severity];
      if (bySeverity !== 0) return bySeverity;
      const byCount = Number(b.count) - Number(a.count);
      if (byCount !== 0) return byCount;
      return String(a.type || '').localeCompare(String(b.type || ''));
    });
  }

  function summarizeActionable(items) {
    const list = Array.isArray(items) ? items : [];
    return list.reduce((acc, item) => {
      const count = Number(item && item.count);
      if (Number.isFinite(count)) acc.total += count;
      if (item && item.severity === 'DANGER') acc.danger += 1;
      if (item && item.severity === 'WARN') acc.warn += 1;
      return acc;
    }, { total: 0, danger: 0, warn: 0 });
  }

  function normalizeGuardError(input) {
    const raw = input && typeof input === 'object'
      ? (input.error || input.reason || input.message || '')
      : String(input || '');
    const message = String(raw || '').trim();
    const lower = message.toLowerCase();

    if (lower.includes('unauthorized')) {
      return { cause: '認証が不足しています', impact: '操作を続行できません', action: '再ログインして再試行してください', tone: 'danger' };
    }
    if (lower.includes('forbidden')) {
      return { cause: 'CSRF/権限ガードに抵触しました', impact: '状態変更操作が拒否されました', action: '同一オリジンから操作をやり直してください', tone: 'danger' };
    }
    if (lower.includes('direct url')) {
      return { cause: '直URLは禁止されています', impact: '通知作成がブロックされました', action: 'Link Registry IDを指定してください', tone: 'warn' };
    }
    if (lower.includes('warn link')) {
      return { cause: 'リンク状態がWARNです', impact: '送信処理が停止しました', action: 'リンク管理でWARNを解消してください', tone: 'warn' };
    }
    if (lower.includes('confirm_token_mismatch') || lower.includes('confirmtoken')) {
      return { cause: '確認トークンが一致しません', impact: '危険操作を実行できません', action: 'planを再実行して最新トークンで再試行してください', tone: 'warn' };
    }
    return { cause: message || '不明なエラー', impact: '操作結果を確定できません', action: 'traceIdで監査ログを確認してください', tone: 'danger' };
  }

  function normalizeSeries(series) {
    if (!Array.isArray(series)) return [];
    return series
      .map((value) => (Number.isFinite(Number(value)) ? Number(value) : null))
      .filter((value) => value !== null);
  }

  function buildLinePath(series, options) {
    const values = normalizeSeries(series);
    if (!values.length) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const width = Number.isFinite(Number(opts.width)) ? Number(opts.width) : 280;
    const height = Number.isFinite(Number(opts.height)) ? Number(opts.height) : 96;
    const padding = Number.isFinite(Number(opts.padding)) ? Number(opts.padding) : 12;
    const max = Math.max.apply(null, values.concat([1]));
    const min = Math.min.apply(null, values.concat([0]));
    const span = Math.max(max - min, 1);
    const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
    const points = values.map((value, index) => {
      const x = padding + index * stepX;
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return { x, y };
    });
    return {
      width,
      height,
      padding,
      max,
      min,
      points,
      path: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
    };
  }

  function validateRepoMapSchemaMin(payload) {
    const errors = [];
    const data = payload && typeof payload === 'object' ? payload : null;
    if (!data) errors.push('payload missing');
    if (!data || !data.meta || typeof data.meta !== 'object') errors.push('meta missing');
    if (!data || !Array.isArray(data.categories)) errors.push('categories missing');
    if (!data || !data.systemOverview || typeof data.systemOverview !== 'object') errors.push('systemOverview missing');
    return { ok: errors.length === 0, errors };
  }

  function buildTodoCardsFromRepoMap(payload) {
    const categories = payload && Array.isArray(payload.categories) ? payload.categories : [];
    const cards = [];
    categories.forEach((category) => {
      const items = Array.isArray(category && category.items) ? category.items : [];
      items.forEach((item) => {
        const cannotDo = Array.isArray(item && item.cannotDo) ? item.cannotDo : [];
        const risks = Array.isArray(item && item.risks) ? item.risks : [];
        const nextActions = Array.isArray(item && item.nextActions) ? item.nextActions : [];
        if (!cannotDo.length && !risks.length && !nextActions.length) return;
        cards.push({
          urgency: risks.length > 0 ? 'high' : 'normal',
          task: nextActions[0] || cannotDo[0] || NOT_AVAILABLE,
          why: cannotDo[0] || NOT_AVAILABLE,
          impact: risks[0] || NOT_AVAILABLE,
          category: category && category.labelJa ? category.labelJa : null,
          featureId: item && item.id ? item.id : null
        });
      });
    });
    return cards;
  }

  function newTraceId() {
    if (globalScope && globalScope.crypto && typeof globalScope.crypto.randomUUID === 'function') {
      return globalScope.crypto.randomUUID();
    }
    return `trace-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
  }

  function getTraceFromUrl(search) {
    const params = parseSearchParams(search || (globalScope && globalScope.location ? globalScope.location.search : ''));
    if (params.traceId && String(params.traceId).trim()) return String(params.traceId).trim();
    return null;
  }

function setTraceToUrl(url, traceId) {
  const normalizedTrace = typeof traceId === 'string' && traceId.trim() ? traceId.trim() : '';
  const baseUrl = globalScope && globalScope.location ? globalScope.location.href : 'http://localhost';
  const target = new URL(url || baseUrl, baseUrl);
  if (normalizedTrace) target.searchParams.set('traceId', normalizedTrace);
  return `${target.pathname}?${target.searchParams.toString()}`.replace(/\?$/, '');
}

  function forwardTraceToUrl(url, traceId) {
    return setTraceToUrl(url, traceId || getTraceFromUrl());
  }

  function isNoFoldCssReady(cssText) {
    const text = typeof cssText === 'string' ? cssText : '';
    return text.includes('details:not([open]) > *:not(summary)')
      && text.includes('.decision-details > summary');
  }

  const DEFAULT_NAV_GROUP_VISIBILITY_POLICY = Object.freeze({
    operator: Object.freeze(['dashboard', 'notifications', 'users', 'catalog']),
    admin: Object.freeze(['dashboard', 'notifications', 'users', 'catalog']),
    developer: Object.freeze(['dashboard', 'notifications', 'users', 'catalog', 'developer'])
  });

  function normalizeRole(role) {
    const value = typeof role === 'string' ? role.trim() : '';
    if (value === 'admin' || value === 'developer') return value;
    return 'operator';
  }

  function normalizeStringList(values) {
    const list = Array.isArray(values) ? values : [];
    const normalized = [];
    list.forEach((item) => {
      const next = typeof item === 'string' ? item.trim() : '';
      if (!next) return;
      if (!normalized.includes(next)) normalized.push(next);
    });
    return normalized;
  }

  function resolveVisibleGroupKeys(role, policy) {
    const normalizedRole = normalizeRole(role);
    const source = policy && typeof policy === 'object'
      ? policy
      : DEFAULT_NAV_GROUP_VISIBILITY_POLICY;
    return normalizeStringList(source[normalizedRole]);
  }

  function isGroupVisible(role, groupKey, policy) {
    const key = typeof groupKey === 'string' ? groupKey.trim() : '';
    if (!key) return false;
    return resolveVisibleGroupKeys(role, policy).includes(key);
  }

  function resolveAllowedPane(role, pane, panePolicy, fallback) {
    const normalizedRole = normalizeRole(role);
    const nextPane = typeof pane === 'string' ? pane.trim() : '';
    const fallbackPane = typeof fallback === 'string' && fallback.trim() ? fallback.trim() : 'home';
    const source = panePolicy && typeof panePolicy === 'object' ? panePolicy : {};
    const allowed = normalizeStringList(source[normalizedRole]);
    if (nextPane && allowed.includes(nextPane)) return nextPane;
    if (allowed.includes(fallbackPane)) return fallbackPane;
    return fallbackPane || 'home';
  }

  function isRoleAllowed(role, allowList) {
    const normalizedRole = normalizeRole(role);
    const list = Array.isArray(allowList) ? allowList : [];
    if (!list.length) return true;
    return list.includes(normalizedRole);
  }

  const api = {
    tableCore: {
      NOT_AVAILABLE,
      toDisplayValue,
      mapRowsForColumns,
      renderTable
    },
    sortCore: {
      toSortMillis,
      compareValues,
      sortRows
    },
    filterCore: {
      normalizeFilterValue,
      applyAndFilters
    },
    stateCore: {
      parseSearchParams,
      serializeListState,
      parseListStateFromQuery,
      applyListStateToUrl,
      saveListState,
      loadListState,
      mergeStatePriority
    },
    dictionaryCore: {
      resolveDomainLabel
    },
    alertsCore: {
      extractActionable,
      summarizeActionable
    },
    fetchGuardCore: {
      normalizeGuardError
    },
    chartCore: {
      normalizeSeries,
      buildLinePath
    },
    repoMapCore: {
      validateSchemaMin: validateRepoMapSchemaMin,
      buildTodoCards: buildTodoCardsFromRepoMap
    },
    traceCore: {
      newTraceId,
      getTraceFromUrl,
      setTraceToUrl,
      forwardTraceToUrl
    },
    noFoldContract: {
      isNoFoldCssReady
    },
    navCore: {
      normalizeRole,
      resolveVisibleGroupKeys,
      isGroupVisible,
      resolveAllowedPane,
      isRoleAllowed
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  globalScope.AdminUiCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));
