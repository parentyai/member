'use strict';

function parseFlag(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return fallback === true;
}

function parseNumber(name, fallback, min, max) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (Number.isFinite(min) && normalized < min) return fallback;
  if (Number.isFinite(max) && normalized > max) return fallback;
  return normalized;
}

function isUxosEventsEnabled() {
  return parseFlag('ENABLE_UXOS_EVENTS', false);
}

function isUxosNbaEnabled() {
  return parseFlag('ENABLE_UXOS_NBA', false);
}

function isUxosFatigueWarnEnabled() {
  return parseFlag('ENABLE_UXOS_FATIGUE_WARN', false);
}

function isUxosPolicyReadonlyEnabled() {
  return parseFlag('ENABLE_UXOS_POLICY_READONLY', false);
}

function getUxosEventsAppendMaxPerSend() {
  return parseNumber('UXOS_EVENTS_APPEND_MAX_PER_SEND', 300, 1, 5000);
}

function getUxosFatigueWarnMinRecipients() {
  return parseNumber('UXOS_FATIGUE_WARN_MIN_RECIPIENTS', 20, 1, 10000);
}

function getUxosFatigueWarnBlockedRateThreshold() {
  const raw = process.env.UXOS_FATIGUE_WARN_BLOCKED_RATE;
  if (typeof raw !== 'string') return 0.25;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0.25;
  return Math.min(1, Math.max(0, parsed));
}

module.exports = {
  isUxosEventsEnabled,
  isUxosNbaEnabled,
  isUxosFatigueWarnEnabled,
  isUxosPolicyReadonlyEnabled,
  getUxosEventsAppendMaxPerSend,
  getUxosFatigueWarnMinRecipients,
  getUxosFatigueWarnBlockedRateThreshold
};
