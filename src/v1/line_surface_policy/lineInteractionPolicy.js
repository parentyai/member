'use strict';

function selectLineSurface(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const needsHandoff = input.handoffRequired === true;
  const longText = typeof input.text === 'string' && input.text.length > 700;
  if (needsHandoff && input.miniAppUrl) return 'mini_app';
  if (needsHandoff && input.liffUrl) return 'liff';
  if (longText) return 'flex';
  return 'text';
}

module.exports = {
  selectLineSurface
};
