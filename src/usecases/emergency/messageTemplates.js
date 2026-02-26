'use strict';

function buildEmergencyMessageDraft(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const severity = typeof payload.severity === 'string' ? payload.severity.trim().toUpperCase() : 'WARN';
  const category = typeof payload.category === 'string' && payload.category.trim() ? payload.category.trim() : 'alert';
  const regionKey = typeof payload.regionKey === 'string' && payload.regionKey.trim() ? payload.regionKey.trim() : '-';
  const headline = typeof payload.headline === 'string' && payload.headline.trim() ? payload.headline.trim() : '緊急情報を確認してください。';

  return `[${severity}] ${headline}\n地域: ${regionKey}\nカテゴリ: ${category}\n最新の公式情報をご確認ください。`;
}

module.exports = {
  buildEmergencyMessageDraft
};
