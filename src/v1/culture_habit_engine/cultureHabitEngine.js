'use strict';

function applyCultureHabitGuidance(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const locale = payload.locale || 'ja-US';
  const empathy = payload.empathyLevel || 'balanced';
  return {
    locale,
    empathy,
    guidance: ['service_polite', 'avoid_overclaim', 'next_step_first']
  };
}

module.exports = {
  applyCultureHabitGuidance
};
