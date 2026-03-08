'use strict';

function parseBooleanEnv(value, defaultValue) {
  if (value === undefined || value === null || value === '') return Boolean(defaultValue);
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return Boolean(defaultValue);
}

function resolveBooleanEnvFlag(name, defaultValue, env) {
  const source = env && typeof env === 'object' ? env : process.env;
  return parseBooleanEnv(source[name], defaultValue);
}

function resolveNumberEnvFlag(name, defaultValue, env, min, max) {
  const source = env && typeof env === 'object' ? env : process.env;
  const raw = source[name];
  if (raw === undefined || raw === null || raw === '') return Number(defaultValue);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return Number(defaultValue);
  if (typeof min === 'number' && parsed < min) return Number(defaultValue);
  if (typeof max === 'number' && parsed > max) return Number(defaultValue);
  return parsed;
}

module.exports = {
  parseBooleanEnv,
  resolveBooleanEnvFlag,
  resolveNumberEnvFlag
};
