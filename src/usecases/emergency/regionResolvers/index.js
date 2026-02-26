'use strict';

const { normalizeState, normalizeCity, buildRegionKey } = require('../../../domain/regionNormalization');
const { STATE_BY_FIPS } = require('./stateFips');

function normalizeStates(states) {
  if (!Array.isArray(states)) return [];
  const normalized = states
    .map((state) => normalizeState(state))
    .filter(Boolean);
  return Array.from(new Set(normalized)).sort();
}

function normalizeCities(cities) {
  if (!Array.isArray(cities)) return [];
  const normalized = cities
    .map((city) => normalizeCity(city))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function resolveStatesFromFips(fipsCodes) {
  if (!Array.isArray(fipsCodes)) return [];
  const states = fipsCodes
    .map((item) => {
      if (typeof item !== 'string') return null;
      const digits = item.trim().replace(/[^0-9]/g, '');
      if (digits.length < 2) return null;
      return STATE_BY_FIPS[digits.slice(0, 2)] || null;
    })
    .filter(Boolean);
  return Array.from(new Set(states)).sort();
}

function resolveRegionKeys(event) {
  const payload = event && typeof event === 'object' ? event : {};
  const hints = payload.regionHints && typeof payload.regionHints === 'object' ? payload.regionHints : {};

  const states = normalizeStates(hints.states).concat(resolveStatesFromFips(hints.fips));
  const uniqueStates = Array.from(new Set(states)).sort();
  const cities = normalizeCities(hints.cities);

  const regionKeys = [];
  if (uniqueStates.length && cities.length) {
    uniqueStates.forEach((state) => {
      cities.forEach((city) => {
        const regionKey = buildRegionKey(state, city);
        if (regionKey) regionKeys.push(regionKey);
      });
    });
  }

  if (!regionKeys.length && uniqueStates.length) {
    uniqueStates.forEach((state) => {
      regionKeys.push(`${state}::statewide`);
    });
  }

  const normalized = Array.from(new Set(regionKeys));
  if (!normalized.length) {
    return {
      ok: false,
      regionKeys: [],
      reason: 'region_unresolved',
      details: {
        states: uniqueStates,
        cities,
        hasCoordinates: Array.isArray(hints.coordinates) && hints.coordinates.length >= 2
      }
    };
  }

  return {
    ok: true,
    regionKeys: normalized,
    reason: null,
    details: {
      states: uniqueStates,
      cities
    }
  };
}

module.exports = {
  resolveRegionKeys,
  resolveStatesFromFips
};
