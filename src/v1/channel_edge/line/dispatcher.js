'use strict';

function classifyDispatchMode(event) {
  const text = event && event.message && typeof event.message.text === 'string'
    ? event.message.text.trim()
    : '';
  if (!text) return { mode: 'fast', reason: 'non_text' };
  if (text.length <= 24) return { mode: 'fast', reason: 'short_message' };
  return { mode: 'slow', reason: 'complex_message' };
}

module.exports = {
  classifyDispatchMode
};
