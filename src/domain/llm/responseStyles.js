'use strict';

const { STYLES, renderConversationStyle } = require('./conversation/responseStyles');

module.exports = {
  STYLE_IDS: STYLES,
  STYLES,
  renderResponseByStyle: renderConversationStyle,
  renderConversationStyle
};
