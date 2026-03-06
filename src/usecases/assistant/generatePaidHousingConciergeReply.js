'use strict';

const { generatePaidDomainConciergeReply } = require('./generatePaidDomainConciergeReply');

function generatePaidHousingConciergeReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  return generatePaidDomainConciergeReply(Object.assign({}, payload, {
    domainIntent: 'housing'
  }));
}

module.exports = {
  generatePaidHousingConciergeReply
};
