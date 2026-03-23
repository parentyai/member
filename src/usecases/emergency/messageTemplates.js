'use strict';

function normalizeCategory(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return raw || 'alert';
}

function humanizeRegionKey(value) {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : '';
  if (!raw || !raw.includes('::')) return raw || '-';
  const parts = raw.split('::');
  if (parts.length !== 2) return raw;
  const state = parts[0].trim().toUpperCase();
  const scope = parts[1]
    .trim()
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  if (!scope) return raw;
  if (scope.toLowerCase() === 'statewide') return `${state} statewide`;
  return `${scope}, ${state}`;
}

function resolveLeadLine(payload) {
  const category = normalizeCategory(payload.category);
  const providerKey = typeof payload.providerKey === 'string' ? payload.providerKey.trim().toLowerCase() : '';
  const severity = typeof payload.severity === 'string' ? payload.severity.trim().toUpperCase() : 'WARN';
  if (category === 'recall' || providerKey === 'openfda_recalls') {
    return '【要確認 / リコール】';
  }
  if (category === 'weather' || providerKey === 'nws_alerts') {
    return severity === 'CRITICAL' ? '【至急確認 / 気象警報】' : '【確認 / 気象情報】';
  }
  if (providerKey === 'usgs_earthquakes') {
    return severity === 'CRITICAL' ? '【至急確認 / 地震情報】' : '【確認 / 地震情報】';
  }
  return severity === 'CRITICAL' ? '【至急確認 / 緊急情報】' : '【確認 / 緊急情報】';
}

function resolveActionLine(payload) {
  const category = normalizeCategory(payload.category);
  const providerKey = typeof payload.providerKey === 'string' ? payload.providerKey.trim().toLowerCase() : '';
  if (category === 'recall' || providerKey === 'openfda_recalls') {
    return 'まず商品名・購入有無を公式情報で確認し、該当品は使用停止してください。';
  }
  if (category === 'weather' || providerKey === 'nws_alerts') {
    return '外出・通学前に警報と交通状況を確認し、危険時は行動を切り替えてください。';
  }
  if (providerKey === 'usgs_earthquakes') {
    return '安全確保を優先し、余震や交通影響を公式情報で確認してください。';
  }
  return 'まず公式情報で対象地域と影響範囲を確認してください。';
}

function buildEmergencyMessageDraft(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const regionKey = humanizeRegionKey(payload.regionKey);
  const headline = typeof payload.headline === 'string' && payload.headline.trim() ? payload.headline.trim() : '緊急情報を確認してください。';
  return `${resolveLeadLine(payload)} ${headline}\n対象地域: ${regionKey}\n${resolveActionLine(payload)}`;
}

module.exports = {
  buildEmergencyMessageDraft
};
