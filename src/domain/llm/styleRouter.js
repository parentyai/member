'use strict';

const { selectConversationStyle } = require('./conversation/styleRouter');

module.exports = {
  selectResponseStyle: selectConversationStyle,
  selectConversationStyle
};
