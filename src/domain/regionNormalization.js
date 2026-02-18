'use strict';

const STATE_ALIASES = new Map([
  ['ALABAMA', 'AL'], ['AL', 'AL'],
  ['ALASKA', 'AK'], ['AK', 'AK'],
  ['ARIZONA', 'AZ'], ['AZ', 'AZ'],
  ['ARKANSAS', 'AR'], ['AR', 'AR'],
  ['CALIFORNIA', 'CA'], ['CA', 'CA'],
  ['COLORADO', 'CO'], ['CO', 'CO'],
  ['CONNECTICUT', 'CT'], ['CT', 'CT'],
  ['DELAWARE', 'DE'], ['DE', 'DE'],
  ['DISTRICT OF COLUMBIA', 'DC'], ['DC', 'DC'],
  ['FLORIDA', 'FL'], ['FL', 'FL'],
  ['GEORGIA', 'GA'], ['GA', 'GA'],
  ['HAWAII', 'HI'], ['HI', 'HI'],
  ['IDAHO', 'ID'], ['ID', 'ID'],
  ['ILLINOIS', 'IL'], ['IL', 'IL'],
  ['INDIANA', 'IN'], ['IN', 'IN'],
  ['IOWA', 'IA'], ['IA', 'IA'],
  ['KANSAS', 'KS'], ['KS', 'KS'],
  ['KENTUCKY', 'KY'], ['KY', 'KY'],
  ['LOUISIANA', 'LA'], ['LA', 'LA'],
  ['MAINE', 'ME'], ['ME', 'ME'],
  ['MARYLAND', 'MD'], ['MD', 'MD'],
  ['MASSACHUSETTS', 'MA'], ['MA', 'MA'],
  ['MICHIGAN', 'MI'], ['MI', 'MI'],
  ['MINNESOTA', 'MN'], ['MN', 'MN'],
  ['MISSISSIPPI', 'MS'], ['MS', 'MS'],
  ['MISSOURI', 'MO'], ['MO', 'MO'],
  ['MONTANA', 'MT'], ['MT', 'MT'],
  ['NEBRASKA', 'NE'], ['NE', 'NE'],
  ['NEVADA', 'NV'], ['NV', 'NV'],
  ['NEW HAMPSHIRE', 'NH'], ['NH', 'NH'],
  ['NEW JERSEY', 'NJ'], ['NJ', 'NJ'],
  ['NEW MEXICO', 'NM'], ['NM', 'NM'],
  ['NEW YORK', 'NY'], ['NY', 'NY'],
  ['NORTH CAROLINA', 'NC'], ['NC', 'NC'],
  ['NORTH DAKOTA', 'ND'], ['ND', 'ND'],
  ['OHIO', 'OH'], ['OH', 'OH'],
  ['OKLAHOMA', 'OK'], ['OK', 'OK'],
  ['OREGON', 'OR'], ['OR', 'OR'],
  ['PENNSYLVANIA', 'PA'], ['PA', 'PA'],
  ['RHODE ISLAND', 'RI'], ['RI', 'RI'],
  ['SOUTH CAROLINA', 'SC'], ['SC', 'SC'],
  ['SOUTH DAKOTA', 'SD'], ['SD', 'SD'],
  ['TENNESSEE', 'TN'], ['TN', 'TN'],
  ['TEXAS', 'TX'], ['TX', 'TX'],
  ['UTAH', 'UT'], ['UT', 'UT'],
  ['VERMONT', 'VT'], ['VT', 'VT'],
  ['VIRGINIA', 'VA'], ['VA', 'VA'],
  ['WASHINGTON', 'WA'], ['WA', 'WA'],
  ['WEST VIRGINIA', 'WV'], ['WV', 'WV'],
  ['WISCONSIN', 'WI'], ['WI', 'WI'],
  ['WYOMING', 'WY'], ['WY', 'WY']
]);

function normalizeState(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return null;
  const normalized = raw.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return STATE_ALIASES.get(normalized) || null;
}

function normalizeCity(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed : null;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildRegionKey(stateCode, city) {
  if (!stateCode || !city) return null;
  const slug = slugify(city);
  if (!slug) return null;
  return `${stateCode}::${slug}`;
}

function parseRegionInput(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return { ok: false, reason: 'empty' };

  const cleaned = raw.replace(/^\s*(地域|city|state|region)\s*[:：]?\s*/i, '').trim();
  if (!cleaned) return { ok: false, reason: 'empty' };

  let cityPart = '';
  let statePart = '';

  const separators = [',', '、', '/', '／'];
  for (const sep of separators) {
    if (cleaned.includes(sep)) {
      const parts = cleaned.split(sep).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        cityPart = parts[0];
        statePart = parts[1];
        break;
      }
    }
  }

  if (!cityPart || !statePart) {
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const possibleState = tokens[tokens.length - 1];
      const normalizedState = normalizeState(possibleState);
      if (normalizedState) {
        cityPart = tokens.slice(0, -1).join(' ');
        statePart = possibleState;
      }
    }
  }

  const city = normalizeCity(cityPart);
  const state = normalizeState(statePart);
  if (!city || !state) {
    return { ok: false, reason: 'invalid_format' };
  }
  const regionKey = buildRegionKey(state, city);
  if (!regionKey) return { ok: false, reason: 'invalid_format' };
  return { ok: true, city, state, regionKey };
}

module.exports = {
  normalizeState,
  normalizeCity,
  buildRegionKey,
  parseRegionInput
};
