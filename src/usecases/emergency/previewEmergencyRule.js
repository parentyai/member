'use strict';

const emergencyRulesRepo = require('../../repos/firestore/emergencyRulesRepo');
const emergencyBulletinsRepo = require('../../repos/firestore/emergencyBulletinsRepo');
const emergencyDiffsRepo = require('../../repos/firestore/emergencyDiffsRepo');
const { resolveEmergencyRecipientsForFanout } = require('./resolveEmergencyRecipients');
const { matchEmergencyRule, resolveEmergencyEventType } = require('./emergencyRuleEngine');
const { normalizeString } = require('./utils');

async function resolveDiffForBulletin(bulletin, deps) {
  const row = bulletin && typeof bulletin === 'object' ? bulletin : {};
  const refs = row.evidenceRefs && typeof row.evidenceRefs === 'object' ? row.evidenceRefs : {};
  const diffId = normalizeString(refs.diffId);
  if (!diffId) return null;
  const getDiff = deps && typeof deps.getDiff === 'function' ? deps.getDiff : emergencyDiffsRepo.getDiff;
  return getDiff(diffId).catch(() => null);
}

function buildRuleInputFromBulletin(bulletin, diff) {
  const row = bulletin && typeof bulletin === 'object' ? bulletin : {};
  const diffRow = diff && typeof diff === 'object' ? diff : {};
  return {
    providerKey: normalizeString(row.providerKey),
    severity: normalizeString(row.severity),
    regionKey: normalizeString(row.regionKey),
    category: normalizeString(row.category) || normalizeString(diffRow.category),
    diffType: normalizeString(diffRow.diffType) || 'update',
    eventType: resolveEmergencyEventType({
      category: normalizeString(row.category) || normalizeString(diffRow.category),
      diffType: normalizeString(diffRow.diffType) || 'update'
    })
  };
}

function sanitizeBulletinRow(bulletin, input) {
  const row = bulletin && typeof bulletin === 'object' ? bulletin : {};
  return {
    bulletinId: row.id || null,
    status: row.status || null,
    providerKey: input.providerKey || null,
    severity: input.severity || null,
    regionKey: input.regionKey || null,
    eventType: input.eventType || null
  };
}

async function previewEmergencyRule(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const ruleId = normalizeString(payload.ruleId);
  if (!ruleId) throw new Error('ruleId required');

  const getRule = deps && typeof deps.getRule === 'function' ? deps.getRule : emergencyRulesRepo.getRule;
  const listBulletins = deps && typeof deps.listBulletins === 'function'
    ? deps.listBulletins
    : emergencyBulletinsRepo.listBulletins;
  const getBulletin = deps && typeof deps.getBulletin === 'function'
    ? deps.getBulletin
    : emergencyBulletinsRepo.getBulletin;
  const resolveRecipients = deps && typeof deps.resolveEmergencyRecipientsForFanout === 'function'
    ? deps.resolveEmergencyRecipientsForFanout
    : resolveEmergencyRecipientsForFanout;

  const rule = await getRule(ruleId);
  if (!rule) {
    return {
      ok: false,
      reason: 'rule_not_found',
      ruleId
    };
  }

  const bulletinId = normalizeString(payload.bulletinId);
  let bulletins = [];
  if (bulletinId) {
    const row = await getBulletin(bulletinId);
    if (row) bulletins = [row];
  } else {
    const limit = Number.isFinite(Number(payload.limit)) ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 100) : 20;
    bulletins = await listBulletins({ status: 'draft', limit });
  }

  const matches = [];
  const nonMatches = [];

  for (const bulletin of (Array.isArray(bulletins) ? bulletins : [])) {
    // eslint-disable-next-line no-await-in-loop
    const diff = await resolveDiffForBulletin(bulletin, deps);
    const ruleInput = buildRuleInputFromBulletin(bulletin, diff);
    const result = matchEmergencyRule(rule, ruleInput);
    if (!result.ok) {
      nonMatches.push(Object.assign(sanitizeBulletinRow(bulletin, ruleInput), {
        reason: result.reason || 'not_matched',
        unsupportedDimensions: result.unsupportedDimensions || []
      }));
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const recipientPreview = await resolveRecipients({
      region: rule.region || { regionKey: ruleInput.regionKey },
      regionKey: ruleInput.regionKey,
      membersOnly: rule.membersOnly === true,
      role: rule.role || null,
      maxRecipients: rule.maxRecipients
    }, deps);

    matches.push(Object.assign(sanitizeBulletinRow(bulletin, ruleInput), {
      recipientPreview
    }));
  }

  const blockedByDimension = matches
    .filter((item) => !item.recipientPreview || item.recipientPreview.ok !== true)
    .map((item) => ({
      bulletinId: item.bulletinId,
      reason: item.recipientPreview ? item.recipientPreview.reason : 'recipient_preview_failed',
      unsupportedDimensions: item.recipientPreview && item.recipientPreview.unsupportedDimensions
        ? item.recipientPreview.unsupportedDimensions
        : []
    }));

  return {
    ok: true,
    rule,
    ruleId,
    candidateCount: Array.isArray(bulletins) ? bulletins.length : 0,
    matchCount: matches.length,
    blockedCount: blockedByDimension.length,
    matches,
    blockedByDimension,
    nonMatches: nonMatches.slice(0, 20)
  };
}

module.exports = {
  previewEmergencyRule
};
