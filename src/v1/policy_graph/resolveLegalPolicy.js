'use strict';

function resolveLegalPolicySnapshot(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const lawfulBasis = payload.lawfulBasis || 'consent';
  const consentVerified = payload.consentVerified !== false;
  const crossBorder = payload.crossBorder || 'allow';
  const legalDecision = consentVerified ? 'allow' : 'block';
  const legalReasonCodes = consentVerified ? ['legal_allow'] : ['consent_missing'];
  return {
    lawfulBasis,
    consentVerified,
    crossBorder,
    legalDecision,
    legalReasonCodes
  };
}

module.exports = {
  resolveLegalPolicySnapshot
};
