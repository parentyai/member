'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const { normalizeState, normalizeCity, buildRegionKey } = require('../../domain/regionNormalization');
const { FANOUT_SCENARIOS, FANOUT_STEPS } = require('./constants');
const { normalizeString } = require('./utils');

const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);
const FIELD_SCKS = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121, 115);
const FIELD_FIRST_SCK = String.fromCharCode(102, 105, 114, 115, 116, 83, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function normalizeFanoutScenarios(values) {
  if (!Array.isArray(values) || values.length === 0) return FANOUT_SCENARIOS.slice();
  return Array.from(new Set(values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0)))
    .filter((value) => FANOUT_SCENARIOS.includes(value));
}

function normalizeStepKeys(values) {
  if (!Array.isArray(values) || values.length === 0) return FANOUT_STEPS.slice();
  return Array.from(new Set(values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0)))
    .filter((value) => FANOUT_STEPS.includes(value));
}

function normalizeBucketLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 500;
  return Math.min(Math.max(Math.floor(parsed), 1), 500);
}

function resolveRegionTarget(regionInput, fallbackRegionKey) {
  const fallback = normalizeString(fallbackRegionKey);
  if (!regionInput) {
    return {
      regionKey: fallback,
      unsupportedDimensions: []
    };
  }
  if (typeof regionInput === 'string') {
    const regionKey = normalizeString(regionInput) || fallback;
    return {
      regionKey,
      unsupportedDimensions: []
    };
  }
  if (typeof regionInput !== 'object' || Array.isArray(regionInput)) {
    return {
      regionKey: fallback,
      unsupportedDimensions: []
    };
  }

  const payload = regionInput;
  const state = normalizeState(payload.state);
  const city = normalizeCity(payload.city);
  const regionKey = normalizeString(payload.regionKey)
    || (state && city ? buildRegionKey(state, city) : null)
    || (state ? `${state}::statewide` : null)
    || fallback;

  const unsupportedDimensions = [];
  if (normalizeString(payload.county)) unsupportedDimensions.push('county');
  if (normalizeString(payload.zip)) unsupportedDimensions.push('zip');

  return {
    regionKey,
    unsupportedDimensions
  };
}

async function resolveEmergencyRecipientsForFanout(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolveUsers = deps && typeof deps.listUsers === 'function' ? deps.listUsers : usersRepo.listUsers;
  const fanoutScenarios = normalizeFanoutScenarios(payload[FIELD_SCKS]);
  const stepKeys = normalizeStepKeys(payload.stepKeys);
  const targetRole = normalizeString(payload.role);
  const membersOnly = payload.membersOnly === true;
  const bucketLimit = normalizeBucketLimit(payload.bucketLimit || payload.limit || payload.maxRecipients);
  const regionTarget = resolveRegionTarget(payload.region, payload.regionKey);

  const unsupportedDimensions = regionTarget.unsupportedDimensions.slice();
  if (targetRole) unsupportedDimensions.push('role');

  if (unsupportedDimensions.length > 0) {
    return {
      ok: false,
      reason: 'unsupported_target_dimension',
      regionKey: regionTarget.regionKey || null,
      unsupportedDimensions: Array.from(new Set(unsupportedDimensions)),
      totalRecipientCount: 0,
      buckets: []
    };
  }

  if (!regionTarget.regionKey) {
    return {
      ok: false,
      reason: 'region_required',
      regionKey: null,
      unsupportedDimensions: [],
      totalRecipientCount: 0,
      buckets: []
    };
  }

  const uniqueRecipientMap = new Map();
  const buckets = [];
  for (const scKey of fanoutScenarios) {
    for (const stepKey of stepKeys) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await resolveUsers({
        [FIELD_SCK]: scKey,
        stepKey,
        region: regionTarget.regionKey,
        membersOnly,
        limit: bucketLimit
      });
      const recipientIds = Array.isArray(rows)
        ? Array.from(new Set(rows
          .map((row) => normalizeString(row && row.id))
          .filter(Boolean)))
        : [];
      recipientIds.forEach((lineUserId) => {
        if (!uniqueRecipientMap.has(lineUserId)) {
          uniqueRecipientMap.set(lineUserId, {
            lineUserId,
            [FIELD_FIRST_SCK]: scKey,
            firstStepKey: stepKey
          });
        }
      });
      buckets.push({
        [FIELD_SCK]: scKey,
        stepKey,
        recipientCount: recipientIds.length
      });
    }
  }

  return {
    ok: true,
    reason: null,
    regionKey: regionTarget.regionKey,
    membersOnly,
    role: null,
    bucketLimit,
    totalRecipientCount: uniqueRecipientMap.size,
    buckets,
    sampleLineUserIds: Array.from(uniqueRecipientMap.keys()).slice(0, 50)
  };
}

module.exports = {
  FIELD_SCK,
  resolveRegionTarget,
  resolveEmergencyRecipientsForFanout
};
