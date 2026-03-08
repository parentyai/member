'use strict';

const REDAC_CANONICAL_LINK_COLLECTION = 'redac_membership_links';
const REDAC_LEGACY_LINK_COLLECTION = 'ridac_membership_links';
const REDAC_HASH_FIELD = 'redacMembershipIdHash';
const REDAC_LAST4_FIELD = 'redacMembershipIdLast4';
const REDAC_LEGACY_HASH_FIELD = 'ridacMembershipIdHash';
const REDAC_LEGACY_LAST4_FIELD = 'ridacMembershipIdLast4';

const OPS_STATE_CANONICAL_COLLECTION = 'ops_states';
const OPS_STATE_LEGACY_COLLECTION = 'ops_state';

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveRedacMembershipFromRecord(record) {
  const payload = record && typeof record === 'object' ? record : {};
  const canonicalHash = normalizeString(payload[REDAC_HASH_FIELD]);
  const canonicalLast4 = normalizeString(payload[REDAC_LAST4_FIELD]);
  if (canonicalHash || canonicalLast4) {
    return {
      hash: canonicalHash,
      last4: canonicalLast4,
      source: 'redac',
      legacyReadUsed: false
    };
  }

  const legacyHash = normalizeString(payload[REDAC_LEGACY_HASH_FIELD]);
  const legacyLast4 = normalizeString(payload[REDAC_LEGACY_LAST4_FIELD]);
  if (legacyHash || legacyLast4) {
    return {
      hash: legacyHash,
      last4: legacyLast4,
      source: 'ridac',
      legacyReadUsed: true
    };
  }

  return {
    hash: null,
    last4: null,
    source: 'none',
    legacyReadUsed: false
  };
}

function resolveRedacLinkRecord(record, fallbackId) {
  const payload = record && typeof record === 'object' ? record : {};
  const canonicalHash = normalizeString(payload[REDAC_HASH_FIELD]);
  const legacyHash = normalizeString(payload[REDAC_LEGACY_HASH_FIELD]);
  const idHash = normalizeString(fallbackId);
  const hash = canonicalHash || legacyHash || idHash;
  const last4 = normalizeString(payload[REDAC_LAST4_FIELD]) || normalizeString(payload[REDAC_LEGACY_LAST4_FIELD]);
  return {
    hash,
    last4,
    legacyReadUsed: Boolean(!canonicalHash && (legacyHash || normalizeString(payload[REDAC_LEGACY_LAST4_FIELD])))
  };
}

function isLegacyOpsStateCollection(collection) {
  return String(collection || '') === OPS_STATE_LEGACY_COLLECTION;
}

function logCanonicalAuthorityLegacyRead(scope, meta) {
  const target = normalizeString(scope) || 'unknown';
  const info = meta && typeof meta === 'object' ? meta : {};
  const keys = Object.keys(info).filter((key) => info[key] !== undefined && info[key] !== null);
  const suffix = keys.map((key) => `${key}=${String(info[key])}`).join(' ');
  if (suffix) {
    console.warn(`[canonical_authority] scope=${target} mode=legacy_read ${suffix}`);
    return;
  }
  console.warn(`[canonical_authority] scope=${target} mode=legacy_read`);
}

module.exports = {
  REDAC_CANONICAL_LINK_COLLECTION,
  REDAC_LEGACY_LINK_COLLECTION,
  REDAC_HASH_FIELD,
  REDAC_LAST4_FIELD,
  REDAC_LEGACY_HASH_FIELD,
  REDAC_LEGACY_LAST4_FIELD,
  OPS_STATE_CANONICAL_COLLECTION,
  OPS_STATE_LEGACY_COLLECTION,
  resolveRedacMembershipFromRecord,
  resolveRedacLinkRecord,
  isLegacyOpsStateCollection,
  logCanonicalAuthorityLegacyRead
};
