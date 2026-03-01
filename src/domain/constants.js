'use strict';

// P0-008: Domain constants only (no logic).

const SCENARIO_KEYS = Object.freeze({
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D'
});

const PHASE0_SCENARIOS = Object.freeze(['A', 'B', 'C', 'D']);

const STEP_KEYS = Object.freeze({
  THREE_MONTHS: '3mo',
  ONE_MONTH: '1mo',
  WEEK: 'week',
  AFTER_ONE_WEEK: 'after1w'
});

const STEP_ORDER = Object.freeze(['3mo', '1mo', 'week', 'after1w']);

const NOTIFICATION_TRIGGER = Object.freeze({
  MANUAL: 'manual'
});

const NOTIFICATION_TRIGGER_VALUES = Object.freeze([NOTIFICATION_TRIGGER.MANUAL]);

const RICH_MENU_ITEMS = Object.freeze([
  {
    key: 'faq',
    label: '📖 よくある質問',
    target: 'external',
    path: 'TODO_OFFICIAL_FAQ_URL'
  },
  {
    key: 'contact',
    label: '✉️ 問い合わせ・相談',
    target: 'external',
    path: 'TODO_OFFICIAL_CONTACT_URL'
  }
]);

module.exports = {
  SCENARIO_KEYS,
  PHASE0_SCENARIOS,
  STEP_KEYS,
  STEP_ORDER,
  NOTIFICATION_TRIGGER,
  NOTIFICATION_TRIGGER_VALUES,
  RICH_MENU_ITEMS
};
