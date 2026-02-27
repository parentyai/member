'use strict';

const STATUS_OK = 'OK';
const STATUS_WARN = 'WARN';
const STATUS_ALERT = 'ALERT';
const STATUS_UNKNOWN = 'UNKNOWN';

const STATUS_ORDER = Object.freeze({
  UNKNOWN: 0,
  OK: 1,
  WARN: 2,
  ALERT: 3
});

const STATUS_COLOR = Object.freeze({
  OK: 'green',
  WARN: 'yellow',
  ALERT: 'red',
  UNKNOWN: 'gray'
});

const REASON_CODES = Object.freeze({
  DATA_MISSING: 'DATA_MISSING',
  DATA_STALE: 'DATA_STALE',
  COUNT_TRUNCATED_LIMIT: 'COUNT_TRUNCATED_LIMIT',
  SOURCE_QUERY_FAILED: 'SOURCE_QUERY_FAILED',
  KILLSWITCH_ON: 'KILLSWITCH_ON',
  THRESHOLD_WARN: 'THRESHOLD_WARN',
  THRESHOLD_ALERT: 'THRESHOLD_ALERT',
  INDEX_CONTRACT_RISK: 'INDEX_CONTRACT_RISK',
  DRIFT_RISK: 'DRIFT_RISK',
  AUTH_INTERPRETATION_NOISE: 'AUTH_INTERPRETATION_NOISE',
  SOURCE_TIME_FALLBACK: 'SOURCE_TIME_FALLBACK',
  POLICY_CHANGE_DETECTED: 'POLICY_CHANGE_DETECTED',
  PRODUCT_READINESS_NO_GO: 'PRODUCT_READINESS_NO_GO'
});

function dedupeReasonCodes(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date) {
      const ms = date.getTime();
      return Number.isFinite(ms) ? ms : null;
    }
  }
  if (value && Number.isFinite(Number(value._seconds))) {
    return Number(value._seconds) * 1000;
  }
  return null;
}

function toIsoString(value) {
  const ms = toMillis(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function toRatioPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num * 100;
}

function mergeStatus(currentStatus, nextStatus) {
  const base = STATUS_ORDER[currentStatus] || 0;
  const incoming = STATUS_ORDER[nextStatus] || 0;
  return incoming > base ? nextStatus : currentStatus;
}

function thresholdStatus(value, warnThreshold, alertThreshold) {
  const num = Number(value);
  if (!Number.isFinite(num)) return STATUS_UNKNOWN;
  if (Number.isFinite(alertThreshold) && num >= alertThreshold) return STATUS_ALERT;
  if (Number.isFinite(warnThreshold) && num >= warnThreshold) return STATUS_WARN;
  return STATUS_OK;
}

function evaluateRateStatus(rateValue, warnPercent, alertPercent) {
  const percent = toRatioPercent(rateValue);
  if (!Number.isFinite(percent)) {
    return {
      status: STATUS_UNKNOWN,
      reasonCodes: [REASON_CODES.DATA_MISSING],
      percent: null
    };
  }
  const status = thresholdStatus(percent, warnPercent, alertPercent);
  const reasonCodes = [];
  if (status === STATUS_WARN) reasonCodes.push(REASON_CODES.THRESHOLD_WARN);
  if (status === STATUS_ALERT) reasonCodes.push(REASON_CODES.THRESHOLD_ALERT);
  return { status, reasonCodes, percent };
}

function evaluateAgeStatus(ageSeconds, warnSeconds, alertSeconds) {
  const age = Number(ageSeconds);
  if (!Number.isFinite(age) || age < 0) {
    return {
      status: STATUS_UNKNOWN,
      reasonCodes: [REASON_CODES.DATA_MISSING]
    };
  }
  const status = thresholdStatus(age, warnSeconds, alertSeconds);
  const reasonCodes = [];
  if (status === STATUS_WARN) reasonCodes.push(REASON_CODES.DATA_STALE, REASON_CODES.THRESHOLD_WARN);
  if (status === STATUS_ALERT) reasonCodes.push(REASON_CODES.DATA_STALE, REASON_CODES.THRESHOLD_ALERT);
  return { status, reasonCodes };
}

function computeStalenessSeconds(lastUpdatedAt, nowIso) {
  const nowMs = toMillis(nowIso);
  const updatedMs = toMillis(lastUpdatedAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(updatedMs)) return null;
  return Math.max(0, Math.floor((nowMs - updatedMs) / 1000));
}

function buildStatusEnvelope(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const nowIso = toIsoString(payload.nowIso) || new Date().toISOString();
  const lastUpdatedAt = toIsoString(payload.lastUpdatedAt) || toIsoString(payload.updatedAt) || nowIso;
  const status = payload.status || STATUS_UNKNOWN;
  const reasonCodes = dedupeReasonCodes(payload.reasonCodes || []);
  const stalenessSeconds = Number.isFinite(Number(payload.stalenessSeconds))
    ? Number(payload.stalenessSeconds)
    : computeStalenessSeconds(lastUpdatedAt, nowIso);

  return {
    status,
    statusColor: STATUS_COLOR[status] || STATUS_COLOR.UNKNOWN,
    reasonCodes,
    updatedAt: toIsoString(payload.updatedAt) || nowIso,
    lastUpdatedAt,
    stalenessSeconds,
    computedWindow: payload.computedWindow && typeof payload.computedWindow === 'object'
      ? payload.computedWindow
      : null
  };
}

function resolveGlobalStatus(items) {
  const list = Array.isArray(items) ? items : [];
  let status = STATUS_OK;
  if (!list.length) status = STATUS_UNKNOWN;
  list.forEach((item) => {
    status = mergeStatus(status, item && item.status ? item.status : STATUS_UNKNOWN);
  });
  return status;
}

function booleanStatus(value, okWhenTrue) {
  if (typeof value !== 'boolean') {
    return {
      status: STATUS_UNKNOWN,
      reasonCodes: [REASON_CODES.DATA_MISSING]
    };
  }
  if (okWhenTrue === true) {
    return {
      status: value ? STATUS_OK : STATUS_ALERT,
      reasonCodes: value ? [] : [REASON_CODES.THRESHOLD_ALERT]
    };
  }
  return {
    status: value ? STATUS_ALERT : STATUS_OK,
    reasonCodes: value ? [REASON_CODES.THRESHOLD_ALERT] : []
  };
}

module.exports = {
  STATUS_OK,
  STATUS_WARN,
  STATUS_ALERT,
  STATUS_UNKNOWN,
  STATUS_COLOR,
  REASON_CODES,
  toMillis,
  toIsoString,
  toRatioPercent,
  mergeStatus,
  thresholdStatus,
  evaluateRateStatus,
  evaluateAgeStatus,
  computeStalenessSeconds,
  buildStatusEnvelope,
  resolveGlobalStatus,
  booleanStatus,
  dedupeReasonCodes
};
