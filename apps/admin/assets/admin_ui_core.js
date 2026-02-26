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

  function parseRoleFromQuery(search, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const key = typeof opts.key === 'string' && opts.key.trim() ? opts.key.trim() : 'role';
    const parsed = parseSearchParams(search || '');
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) return null;
    const role = parsed[key];
    return normalizeRole(role);
  }

  function applyRoleToUrl(role, url, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const key = typeof opts.key === 'string' && opts.key.trim() ? opts.key.trim() : 'role';
    const nextRole = normalizeRole(role);
    const baseUrl = globalScope && globalScope.location ? globalScope.location.href : 'http://localhost/admin/app';
    const target = new URL(url || baseUrl, baseUrl);
    target.searchParams.set(key, nextRole);
    return `${target.pathname}?${target.searchParams.toString()}`.replace(/\?$/, '');
  }

  function saveRoleState(role, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const storage = resolveStorage(opts.storage);
    if (!storage || typeof storage.setItem !== 'function') return false;
    const namespace = typeof opts.namespace === 'string' ? opts.namespace : 'admin.ui.role.';
    const key = typeof opts.key === 'string' && opts.key.trim() ? opts.key.trim() : 'role';
    try {
      storage.setItem(`${namespace}${key}`, normalizeRole(role));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function loadRoleState(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const storage = resolveStorage(opts.storage);
    if (!storage || typeof storage.getItem !== 'function') return null;
    const namespace = typeof opts.namespace === 'string' ? opts.namespace : 'admin.ui.role.';
    const key = typeof opts.key === 'string' && opts.key.trim() ? opts.key.trim() : 'role';
    try {
      const raw = storage.getItem(`${namespace}${key}`);
      if (raw == null || raw === '') return null;
      return normalizeRole(raw);
    } catch (_err) {
      return null;
    }
  }

  function resolveRoleState(urlRole, storedRole, defaultRole) {
    const fallbackRole = normalizeRole(defaultRole || 'operator');
    const fromUrl = normalizeRole(urlRole || '');
    if (urlRole && fromUrl) return fromUrl;
    const fromStorage = normalizeRole(storedRole || '');
    if (storedRole && fromStorage) return fromStorage;
    return fallbackRole;
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

    if (lower.includes('local_preflight_unavailable')) {
      return { cause: 'ローカル診断APIを取得できません', impact: '環境不備と実装不備の切り分けができません', action: '/api/admin/local-preflight を直接確認してください', tone: 'warn' };
    }
    if (lower.includes('adc_reauth_required')) {
      return { cause: 'ADC認証の再実行が必要です', impact: 'Firestore依存APIの取得が失敗します', action: 'gcloud auth application-default login を実行して再診断してください', tone: 'danger' };
    }
    if (lower.includes('firestore_timeout')) {
      return { cause: 'Firestore接続がタイムアウトしました', impact: 'ダッシュボード/監視の取得が停止します', action: 'ネットワークまたは認証状態を確認して再診断してください', tone: 'danger' };
    }
    if (lower.includes('firestore_network_error')) {
      return { cause: 'Firestore到達性に問題があります', impact: 'Firestore依存APIが断続的に失敗します', action: '接続環境を確認し、ローカル診断を再実行してください', tone: 'danger' };
    }
    if (lower.includes('firestore_permission_error')) {
      return { cause: 'Firestoreアクセス権限が不足しています', impact: '管理画面のFirestore依存操作が拒否されます', action: '利用中アカウントのIAM権限を確認して再診断してください', tone: 'danger' };
    }
    if (lower.includes('firestore_unknown')) {
      return { cause: 'Firestore接続で未分類エラーを検知しました', impact: '原因が判別できず復旧判断が遅れます', action: 'ローカル診断の詳細ヒントを確認して再実行してください', tone: 'warn' };
    }
    if (lower.includes('firestore_probe_failed')) {
      return { cause: 'Firestore read-only診断が失敗しました', impact: 'Firestore依存APIの取得が失敗し、NOT AVAILABLE が表示されます', action: 'ローカル診断バナーの復旧コマンドを実行して再診断してください', tone: 'danger' };
    }
    if (lower.includes('local_prefight') || lower.includes('local_preflight')) {
      return { cause: 'ローカル前提条件の確認で異常を検知しました', impact: 'Firestore依存APIの取得が失敗し、NOT AVAILABLE が表示されます', action: 'ローカル診断バナーの手順に従って認証設定を修正してください', tone: 'danger' };
    }
    if (lower.includes('credentials_path_invalid')
      || lower.includes('credentials_path_not_file')
      || lower.includes('firestore_credentials_error')) {
      return { cause: 'Firestore認証情報を読み込めません', impact: 'Dashboard/Alerts/City Pack などのAPI取得が失敗します', action: 'GOOGLE_APPLICATION_CREDENTIALS を解除するか、有効な鍵ファイルへ修正してください', tone: 'danger' };
    }
    if (lower.includes('firestore_project_id_missing') || lower.includes('firestore_project_id_error')) {
      return { cause: 'FIRESTORE_PROJECT_ID が不足または不正です', impact: '一部環境でFirestore接続先を確定できません', action: 'FIRESTORE_PROJECT_ID を設定し、プロセスを再起動してください', tone: 'warn' };
    }
    if (lower.includes('unauthorized')) {
      return { cause: '認証が不足しています', impact: '操作を続行できません', action: '再ログインして再試行してください', tone: 'danger' };
    }
    if (lower.includes('pane_forbidden')) {
      return { cause: '選択した画面への遷移が許可されていません', impact: '現在のロールでは表示できない画面です', action: 'Roleを切り替えるか、許可された画面から操作してください', tone: 'warn' };
    }
    if (lower.includes('role_forbidden')) {
      return { cause: 'Roleポリシーにより画面遷移が拒否されました', impact: '対象操作を続行できません', action: 'Roleを確認し、許可された画面に戻ってください', tone: 'warn' };
    }
    if (lower.includes('rollout_disabled')) {
      return { cause: '段階ロールアウトが無効です', impact: '対象導線は一時的に閉じています', action: '管理者へロールアウト設定を確認してください', tone: 'warn' };
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
    if (lower.includes('pane_forbidden')) {
      return { cause: '選択した画面への遷移が許可されていません', impact: '現在のロールでは表示できない画面です', action: 'Roleを切り替えるか、許可された画面から操作してください', tone: 'warn' };
    }
    if (lower.includes('role_forbidden')) {
      return { cause: 'Roleポリシーにより画面遷移が拒否されました', impact: '対象操作を続行できません', action: 'Roleを確認し、許可された画面に戻ってください', tone: 'warn' };
    }
    if (lower.includes('rollout_disabled')) {
      return { cause: '段階ロールアウトが無効です', impact: '対象導線は一時的に閉じています', action: '管理者へロールアウト設定を確認してください', tone: 'warn' };
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

  const DEFAULT_NAV_PANE_POLICY = Object.freeze({
    operator: Object.freeze(['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'emergency-layer', 'city-pack', 'audit', 'settings']),
    admin: Object.freeze(['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'emergency-layer', 'city-pack', 'audit', 'settings', 'llm', 'maintenance', 'developer-map', 'developer-manual-redac', 'developer-manual-user']),
    developer: Object.freeze(['home', 'alerts', 'composer', 'monitor', 'errors', 'read-model', 'vendors', 'emergency-layer', 'city-pack', 'audit', 'settings', 'llm', 'maintenance', 'developer-map', 'developer-manual-redac', 'developer-manual-user'])
  });

  const DEFAULT_NAV_GROUP_ROLLOUT_POLICY = Object.freeze({
    operator: Object.freeze([]),
    admin: Object.freeze(['communication', 'operations']),
    developer: Object.freeze(['communication', 'operations'])
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

  function resolvePolicyHash(input) {
    function normalizeValue(value) {
      if (Array.isArray(value)) return value.map((entry) => normalizeValue(entry));
      if (!value || typeof value !== 'object') return value;
      const out = {};
      Object.keys(value).sort().forEach((key) => {
        out[key] = normalizeValue(value[key]);
      });
      return out;
    }
    const normalized = normalizeValue(input && typeof input === 'object' ? input : {});
    const serialized = JSON.stringify(normalized);
    let hash = 0;
    for (let index = 0; index < serialized.length; index += 1) {
      hash = (hash + serialized.charCodeAt(index) * (index + 1)) % 2147483647;
    }
    return `${serialized.length}:${hash}`;
  }

  function parseCsvList(value) {
    if (Array.isArray(value)) return normalizeStringList(value);
    if (typeof value !== 'string') return [];
    return normalizeStringList(value.split(','));
  }

  function isNavRolloutAllowed(role, rollout, rolloutEnabled) {
    const enabled = rolloutEnabled !== false;
    const list = parseCsvList(rollout);
    if (!list.length) return true;
    if (!enabled) return false;
    return list.includes(normalizeRole(role));
  }

  function resolveVisibleNavItems(navItems, role, options) {
    const list = Array.isArray(navItems) ? navItems : [];
    const opts = options && typeof options === 'object' ? options : {};
    const normalizedRole = normalizeRole(role);
    const groupPolicy = opts.groupPolicy && typeof opts.groupPolicy === 'object'
      ? opts.groupPolicy
      : DEFAULT_NAV_GROUP_VISIBILITY_POLICY;
    return list.map((item, index) => {
      const groupKey = item && item.groupKey ? String(item.groupKey).trim() : '';
      const pane = item && item.pane ? String(item.pane).trim() : '';
      const priority = Number.isFinite(Number(item && item.priority)) ? Number(item.priority) : 0;
      const allowList = parseCsvList(item && item.allowList);
      const groupVisible = groupKey ? isGroupVisible(normalizedRole, groupKey, groupPolicy) : true;
      const roleAllowed = isRoleAllowed(normalizedRole, allowList);
      const rolloutAllowed = isNavRolloutAllowed(normalizedRole, item && item.rollout, opts.rolloutEnabled);
      const visible = groupVisible && roleAllowed && rolloutAllowed;
      return Object.assign({}, item || {}, {
        groupKey,
        pane,
        priority,
        index,
        roleAllowed,
        rolloutAllowed,
        groupVisible,
        visible
      });
    });
  }

  function resolveVisibleNavItemsByAllowedPanes(navItems, role, panePolicy, options) {
    const list = Array.isArray(navItems) ? navItems : [];
    const normalizedRole = normalizeRole(role);
    const paneSource = panePolicy && typeof panePolicy === 'object'
      ? panePolicy
      : DEFAULT_NAV_PANE_POLICY;
    const allowedPanes = normalizeStringList(paneSource[normalizedRole]);
    const opts = options && typeof options === 'object' ? options : {};
    return list.map((item, index) => {
      const groupKey = item && item.groupKey ? String(item.groupKey).trim() : '';
      const pane = item && item.pane ? String(item.pane).trim() : '';
      const priority = Number.isFinite(Number(item && item.priority)) ? Number(item.priority) : 0;
      const itemIndex = Number.isFinite(Number(item && item.index)) ? Number(item.index) : index;
      const allowList = parseCsvList(item && item.allowList);
      const roleAllowed = isRoleAllowed(normalizedRole, allowList);
      const paneAllowed = pane.length > 0 && allowedPanes.includes(pane);
      const rolloutAllowed = opts.useRollout === true
        ? isNavRolloutAllowed(normalizedRole, item && item.rollout, opts.rolloutEnabled)
        : true;
      const visible = paneAllowed && roleAllowed && rolloutAllowed;
      return Object.assign({}, item || {}, {
        groupKey,
        pane,
        priority,
        index: itemIndex,
        roleAllowed,
        paneAllowed,
        rolloutAllowed,
        visible
      });
    });
  }

  function dedupeVisibleNavItemsByPane(navItems, options) {
    const list = Array.isArray(navItems) ? navItems : [];
    const opts = options && typeof options === 'object' ? options : {};
    const preserveSameGroup = opts.preserveSameGroup !== false;
    const groups = {};
    list.forEach((item, sourceIndex) => {
      const pane = item && item.pane ? String(item.pane).trim() : '';
      if (!pane || !item || item.visible !== true) return;
      if (!Array.isArray(groups[pane])) groups[pane] = [];
      groups[pane].push(Object.assign({}, item, { sourceIndex }));
    });
    const keepIndexMap = {};
    Object.keys(groups).forEach((pane) => {
      const entries = groups[pane].slice().sort((left, right) => {
        const leftPriority = Number.isFinite(Number(left.priority)) ? Number(left.priority) : 0;
        const rightPriority = Number.isFinite(Number(right.priority)) ? Number(right.priority) : 0;
        if (leftPriority !== rightPriority) return rightPriority - leftPriority;
        const leftIndex = Number.isFinite(Number(left.index)) ? Number(left.index) : left.sourceIndex;
        const rightIndex = Number.isFinite(Number(right.index)) ? Number(right.index) : right.sourceIndex;
        return leftIndex - rightIndex;
      });
      if (!entries.length) return;
      const winner = entries[0];
      keepIndexMap[winner.sourceIndex] = true;
      if (preserveSameGroup) {
        entries.forEach((entry) => {
          if (entry.groupKey && winner.groupKey && entry.groupKey === winner.groupKey) {
            keepIndexMap[entry.sourceIndex] = true;
          }
        });
      }
    });
    return list.map((item, sourceIndex) => {
      if (!item || item.visible !== true) return item;
      const pane = item.pane ? String(item.pane).trim() : '';
      if (!pane) return item;
      if (keepIndexMap[sourceIndex] === true) return Object.assign({}, item, { dedupedByPane: false });
      return Object.assign({}, item, { visible: false, dedupedByPane: true });
    });
  }

  function resolveVisibleGroupsFromItems(navItems) {
    const list = Array.isArray(navItems) ? navItems : [];
    const out = [];
    list.forEach((item) => {
      if (!item || item.visible !== true) return;
      const groupKey = item.groupKey ? String(item.groupKey).trim() : '';
      if (!groupKey) return;
      if (!out.includes(groupKey)) out.push(groupKey);
    });
    return out;
  }

  function resolveActiveNavItem(navItems, pane, role, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const normalizedRole = normalizeRole(role);
    const currentPane = typeof pane === 'string' ? pane.trim() : '';
    const visibleItems = resolveVisibleNavItems(navItems, normalizedRole, opts);
    const matchPane = visibleItems
      .filter((item) => item.visible && item.pane === currentPane)
      .sort((left, right) => {
        if (left.priority !== right.priority) return right.priority - left.priority;
        return left.index - right.index;
      });
    if (matchPane.length > 0) return matchPane[0];
    const fallbackPane = typeof opts.fallbackPane === 'string' && opts.fallbackPane.trim()
      ? opts.fallbackPane.trim()
      : 'home';
    const fallbackMatch = visibleItems
      .filter((item) => item.visible && item.pane === fallbackPane)
      .sort((left, right) => {
        if (left.priority !== right.priority) return right.priority - left.priority;
        return left.index - right.index;
      });
    return fallbackMatch.length > 0 ? fallbackMatch[0] : null;
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
      mergeStatePriority,
      parseRoleFromQuery,
      applyRoleToUrl,
      saveRoleState,
      loadRoleState,
      resolveRoleState
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
      isRoleAllowed,
      resolvePolicyHash,
      resolveVisibleNavItems,
      resolveVisibleNavItemsByAllowedPanes,
      dedupeVisibleNavItemsByPane,
      resolveVisibleGroupsFromItems,
      resolveActiveNavItem,
      isNavRolloutAllowed,
      DEFAULT_NAV_PANE_POLICY,
      DEFAULT_NAV_GROUP_VISIBILITY_POLICY,
      DEFAULT_NAV_GROUP_ROLLOUT_POLICY
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  globalScope.AdminUiCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));
