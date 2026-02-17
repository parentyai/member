'use strict';

const { answerFaqFromKb } = require('../faq/answerFaqFromKb');

async function getFaqAnswer(params, deps) {
  return answerFaqFromKb(params, deps);
}

module.exports = {
  getFaqAnswer
};
