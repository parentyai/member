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

const CITY_ALIAS_ROWS = Object.freeze([
  { cityKey: 'new-york', state: 'NY', aliases: ['new york city', 'new york', 'nyc', 'ニューヨーク市', 'ニューヨーク', 'newyork'] },
  { cityKey: 'los-angeles', state: 'CA', aliases: ['los angeles', 'la city', 'ロサンゼルス', 'losangeles'] },
  { cityKey: 'san-francisco', state: 'CA', aliases: ['san francisco', 'サンフランシスコ', 'sanfrancisco', 'sf'] },
  { cityKey: 'seattle', state: 'WA', aliases: ['seattle', 'シアトル'] },
  { cityKey: 'boston', state: 'MA', aliases: ['boston', 'ボストン'] },
  { cityKey: 'chicago', state: 'IL', aliases: ['chicago', 'シカゴ'] },
  { cityKey: 'austin', state: 'TX', aliases: ['austin', 'オースティン'] },
  { cityKey: 'san-diego', state: 'CA', aliases: ['san diego', 'サンディエゴ', 'sandiego'] },
  { cityKey: 'washington', state: 'DC', aliases: ['washington dc', 'washington d c', 'ワシントンdc', 'ワシントン', 'dc'] }
]);

const CITY_ALIAS_INDEX = CITY_ALIAS_ROWS.reduce((acc, row) => {
  row.aliases.forEach((alias) => {
    acc.set(slugify(alias), row);
  });
  return acc;
}, new Map());

function normalizeRegionKeyParts(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return {
      regionKey: null,
      state: null,
      city: null,
      cityKey: null
    };
  }
  const normalized = raw.toLowerCase();
  if (normalized.includes('::')) {
    const [statePart, cityPart] = normalized.split('::');
    const state = normalizeState(statePart);
    const cityKey = normalizeCityKey(cityPart);
    return {
      regionKey: state && cityKey ? `${state}::${cityKey}` : normalized,
      state,
      city: cityPart || null,
      cityKey
    };
  }
  const compact = normalized.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const compactParts = compact.split('-').filter(Boolean);
  if (compactParts.length >= 3 && compactParts[0] === 'us') {
    const possibleState = normalizeState(compactParts[1]);
    const cityKey = normalizeCityKey(compactParts.slice(2).join('-'));
    return {
      regionKey: possibleState && cityKey ? `${possibleState}::${cityKey}` : compact,
      state: possibleState,
      city: compactParts.slice(2).join(' '),
      cityKey
    };
  }
  const cityKey = normalizeCityKey(compact);
  return {
    regionKey: cityKey,
    state: null,
    city: compact,
    cityKey
  };
}

function normalizeCityKey(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const slug = slugify(raw);
  if (!slug) return null;
  const aliased = CITY_ALIAS_INDEX.get(slug);
  if (aliased) return aliased.cityKey;
  return slug;
}

function buildLocationHint(params) {
  const payload = params && typeof params === 'object' ? params : {};
  return {
    kind: payload.kind || 'none',
    matchedText: typeof payload.matchedText === 'string' ? payload.matchedText : null,
    regionKey: typeof payload.regionKey === 'string' ? payload.regionKey : null,
    state: typeof payload.state === 'string' ? payload.state : null,
    city: typeof payload.city === 'string' ? payload.city : null,
    cityKey: typeof payload.cityKey === 'string' ? payload.cityKey : null,
    source: typeof payload.source === 'string' ? payload.source : 'none'
  };
}

function buildLocationHintFromRegionKey(value, source) {
  const normalized = normalizeRegionKeyParts(value);
  if (!normalized.regionKey) return buildLocationHint({});
  if (normalized.cityKey) {
    return buildLocationHint({
      kind: normalized.state ? 'regionKey' : 'city',
      matchedText: typeof value === 'string' ? value.trim() : null,
      regionKey: normalized.regionKey,
      state: normalized.state,
      city: normalized.city,
      cityKey: normalized.cityKey,
      source: source || 'region_key'
    });
  }
  if (normalized.state) {
    return buildLocationHint({
      kind: 'state',
      matchedText: typeof value === 'string' ? value.trim() : null,
      regionKey: normalized.state,
      state: normalized.state,
      source: source || 'region_key'
    });
  }
  return buildLocationHint({});
}

function hasLooseStateToken(text, stateCode) {
  const normalized = typeof text === 'string' ? text.toLowerCase() : '';
  if (!normalized || !stateCode) return false;
  const lowerState = stateCode.toLowerCase();
  return new RegExp(`(^|[^a-z])${lowerState}($|[^a-z])`, 'i').test(normalized)
    || normalized.includes(`${lowerState}で`)
    || normalized.includes(`${lowerState}の`);
}

function extractLocationHintFromText(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return buildLocationHint({});

  const parsed = parseRegionInput(raw);
  if (parsed.ok === true) {
    return buildLocationHint({
      kind: 'regionKey',
      matchedText: raw,
      regionKey: parsed.regionKey,
      state: parsed.state,
      city: parsed.city,
      cityKey: normalizeCityKey(parsed.city),
      source: 'explicit_region_input'
    });
  }

  const normalized = raw.toLowerCase();
  for (const row of CITY_ALIAS_ROWS) {
    const matchedAlias = row.aliases.find((alias) => {
      const token = String(alias || '').toLowerCase();
      if (!token) return false;
      if (/^[a-z0-9 -]+$/.test(token)) {
        return new RegExp(`(^|[^a-z])${token.replace(/\s+/g, '[\\s-]+')}($|[^a-z])`, 'i').test(normalized);
      }
      return normalized.includes(token);
    });
    if (matchedAlias) {
      return buildLocationHint({
        kind: 'city',
        matchedText: matchedAlias,
        regionKey: buildRegionKey(row.state, row.cityKey) || `${row.state}::${row.cityKey}`,
        state: row.state,
        city: row.cityKey,
        cityKey: row.cityKey,
        source: 'natural_language_city'
      });
    }
  }

  for (const [alias, stateCode] of STATE_ALIASES.entries()) {
    const token = alias.toLowerCase();
    if (token.length < 2) continue;
    if (/[a-z]/.test(token) && token.length <= 3) {
      if (!hasLooseStateToken(normalized, stateCode)) continue;
    } else if (!normalized.includes(token)) {
      continue;
    }
    return buildLocationHint({
      kind: 'state',
      matchedText: alias,
      regionKey: stateCode,
      state: stateCode,
      source: 'natural_language_state'
    });
  }

  return buildLocationHint({});
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
  normalizeCityKey,
  buildRegionKey,
  parseRegionInput,
  buildLocationHintFromRegionKey,
  extractLocationHintFromText,
  normalizeRegionKeyParts,
  slugify
};
