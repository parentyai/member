'use strict';

function governTone(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const style = typeof payload.style === 'string' ? payload.style : 'coach';
  return {
    style,
    banFormalReportTone: true,
    maxQuestions: 1,
    maxActions: 3
  };
}

module.exports = {
  governTone
};
