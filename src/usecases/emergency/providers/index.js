'use strict';

const crypto = require('crypto');
const { PROVIDER_KEYS, PROVIDER_CATEGORIES } = require('../constants');

function normalizeSeverityFromText(value) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!raw) return 'WARN';
  if (raw.includes('EXTREME') || raw.includes('SEVERE') || raw.includes('CLASS I') || raw.includes('CLASS 1')) return 'CRITICAL';
  if (raw.includes('MODERATE') || raw.includes('CLASS II') || raw.includes('CLASS 2') || raw.includes('WATCH')) return 'WARN';
  return 'INFO';
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeHeadline(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text) return text.slice(0, 280);
  const backup = typeof fallback === 'string' ? fallback.trim() : '';
  return backup ? backup.slice(0, 280) : 'Emergency update';
}

function stableFallbackEventKey(prefix, parts) {
  const raw = Array.isArray(parts)
    ? parts.map((value) => (value == null ? '' : String(value))).join('::')
    : '';
  const digest = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 24);
  return `${prefix}_${digest}`;
}

function parseNwsStates(properties) {
  const geocode = properties && typeof properties === 'object' ? properties.geocode : null;
  const ugc = geocode && Array.isArray(geocode.UGC) ? geocode.UGC : [];
  const states = ugc
    .map((code) => (typeof code === 'string' ? code.trim().slice(0, 2).toUpperCase() : ''))
    .filter((code) => /^[A-Z]{2}$/.test(code));
  return Array.from(new Set(states));
}

function parseNws(payload) {
  const features = normalizeArray(payload && payload.features);
  return features.map((feature) => {
    const properties = feature && typeof feature === 'object' ? feature.properties || {} : {};
    const eventKey = String(properties.id || feature.id || '').trim();
    const headline = normalizeHeadline(properties.headline || properties.event, 'NWS alert');
    return {
      eventKey: eventKey || stableFallbackEventKey('nws', [
        headline,
        properties.onset || '',
        properties.expires || '',
        properties.event || ''
      ]),
      severity: normalizeSeverityFromText(properties.severity || properties.certainty),
      category: PROVIDER_CATEGORIES[PROVIDER_KEYS.NWS_ALERTS],
      headline,
      startsAt: properties.onset || properties.sent || null,
      endsAt: properties.expires || null,
      externalUrl: typeof properties.uri === 'string' ? properties.uri : null,
      regionHints: {
        states: parseNwsStates(properties),
        cities: [],
        fips: Array.isArray(properties && properties.geocode && properties.geocode.SAME)
          ? properties.geocode.SAME
          : [],
        coordinates: []
      },
      rawMeta: {
        status: properties.status || null,
        event: properties.event || null,
        certainty: properties.certainty || null,
        urgency: properties.urgency || null
      }
    };
  });
}

function parseUsgsState(place) {
  if (typeof place !== 'string') return null;
  const trimmed = place.trim();
  if (!trimmed) return null;
  const abbr = trimmed.match(/,\s*([A-Z]{2})$/);
  if (abbr) return abbr[1];
  const name = trimmed.split(',').pop();
  return typeof name === 'string' ? name.trim() : null;
}

function parseUsgs(payload) {
  const features = normalizeArray(payload && payload.features);
  return features.map((feature) => {
    const props = feature && typeof feature === 'object' ? feature.properties || {} : {};
    const geom = feature && typeof feature === 'object' ? feature.geometry || {} : {};
    const mag = Number(props.mag);
    const severity = Number.isFinite(mag) && mag >= 5.5 ? 'CRITICAL' : Number.isFinite(mag) && mag >= 4 ? 'WARN' : 'INFO';
    const stateGuess = parseUsgsState(props.place);
    return {
      eventKey: String(feature.id || props.code || '').trim() || stableFallbackEventKey('usgs', [
        props.place || '',
        props.time || '',
        props.updated || ''
      ]),
      severity,
      category: PROVIDER_CATEGORIES[PROVIDER_KEYS.USGS_EARTHQUAKES],
      headline: normalizeHeadline(props.title || props.place, 'USGS earthquake'),
      startsAt: props.time ? new Date(Number(props.time)).toISOString() : null,
      endsAt: null,
      externalUrl: typeof props.url === 'string' ? props.url : null,
      regionHints: {
        states: stateGuess ? [stateGuess] : [],
        cities: [],
        fips: [],
        coordinates: Array.isArray(geom.coordinates) ? geom.coordinates.slice(0, 2) : []
      },
      rawMeta: {
        mag: Number.isFinite(mag) ? mag : null,
        place: props.place || null
      }
    };
  });
}

function extractXmlTag(block, tagName) {
  if (typeof block !== 'string') return null;
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(pattern);
  if (!match) return null;
  return String(match[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim() || null;
}

function extractXmlEntries(xmlText) {
  if (typeof xmlText !== 'string') return [];
  const matches = xmlText.match(/<entry[\s\S]*?<\/entry>/gi);
  return matches || [];
}

function extractXmlLinkHref(entryBlock) {
  if (typeof entryBlock !== 'string') return null;
  const match = entryBlock.match(/<link[^>]*href=\"([^\"]+)\"[^>]*>/i);
  return match && match[1] ? String(match[1]).trim() : null;
}

function parseFemaIpaws(payload) {
  const xmlText = typeof payload === 'string'
    ? payload
    : (payload && typeof payload.text === 'string' ? payload.text : '');
  const entries = extractXmlEntries(xmlText);
  return entries.map((entry) => {
    const severityText = extractXmlTag(entry, 'cap:severity') || extractXmlTag(entry, 'severity');
    const areaDesc = extractXmlTag(entry, 'cap:areaDesc') || '';
    const geocodeValue = extractXmlTag(entry, 'value');
    const states = areaDesc
      .split(/[,;\/]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return {
      eventKey: extractXmlTag(entry, 'id') || stableFallbackEventKey('ipaws', [
        extractXmlTag(entry, 'title') || '',
        extractXmlTag(entry, 'updated') || '',
        areaDesc
      ]),
      severity: normalizeSeverityFromText(severityText),
      category: PROVIDER_CATEGORIES[PROVIDER_KEYS.FEMA_IPAWS],
      headline: normalizeHeadline(extractXmlTag(entry, 'title'), 'FEMA IPAWS alert'),
      startsAt: extractXmlTag(entry, 'updated') || extractXmlTag(entry, 'published'),
      endsAt: extractXmlTag(entry, 'cap:expires') || null,
      externalUrl: extractXmlLinkHref(entry),
      regionHints: {
        states,
        cities: [],
        fips: geocodeValue ? [geocodeValue] : [],
        coordinates: []
      },
      rawMeta: {
        areaDesc: areaDesc || null
      }
    };
  });
}

function parseOpenFema(payload) {
  const rows = normalizeArray(payload && (payload.DisasterDeclarationsSummaries || payload.disasterDeclarationsSummaries || payload.items));
  return rows.map((row) => {
    const declarationType = String(row && row.declarationType || '').trim();
    const isMajor = /major/i.test(declarationType) || /major/i.test(String(row && row.incidentType || ''));
    return {
      eventKey: String(row && (row.disasterNumber || row.id) || '').trim() || stableFallbackEventKey('openfema', [
        row && row.declarationDate || '',
        row && row.state || '',
        row && row.incidentType || ''
      ]),
      severity: isMajor ? 'CRITICAL' : 'WARN',
      category: PROVIDER_CATEGORIES[PROVIDER_KEYS.OPENFEMA_DECLARATIONS],
      headline: normalizeHeadline(row && (row.declarationTitle || row.incidentType), 'FEMA declaration'),
      startsAt: row && (row.incidentBeginDate || row.declarationDate) || null,
      endsAt: row && row.incidentEndDate || null,
      externalUrl: null,
      regionHints: {
        states: row && row.state ? [row.state] : [],
        cities: row && row.designatedArea ? [row.designatedArea] : [],
        fips: row && row.fipsStateCode ? [String(row.fipsStateCode)] : [],
        coordinates: []
      },
      rawMeta: {
        declarationType: declarationType || null,
        incidentType: row && row.incidentType || null
      }
    };
  });
}

function parseOpenFda(payload) {
  const rows = normalizeArray(payload && payload.results);
  return rows.map((row) => {
    const classification = String(row && row.classification || '').trim();
    return {
      eventKey: String(row && (row.recall_number || row.event_id) || '').trim() || stableFallbackEventKey('openfda', [
        row && row.report_date || '',
        row && row.recalling_firm || '',
        row && row.product_description || ''
      ]),
      severity: normalizeSeverityFromText(classification),
      category: PROVIDER_CATEGORIES[PROVIDER_KEYS.OPENFDA_RECALLS],
      headline: normalizeHeadline(row && (row.reason_for_recall || row.product_description), 'FDA recall'),
      startsAt: row && (row.report_date || row.recall_initiation_date) || null,
      endsAt: row && row.termination_date || null,
      externalUrl: null,
      regionHints: {
        states: row && row.state ? [row.state] : [],
        cities: row && row.city ? [row.city] : [],
        fips: [],
        coordinates: []
      },
      rawMeta: {
        classification: classification || null,
        recallingFirm: row && row.recalling_firm || null
      }
    };
  });
}

function parseAirnow(payload) {
  const rows = normalizeArray(payload && (payload.records || payload.data || payload));
  return rows.map((row) => {
    const aqi = Number(row && (row.AQI || row.aqi));
    const severity = Number.isFinite(aqi) && aqi >= 200
      ? 'CRITICAL'
      : Number.isFinite(aqi) && aqi >= 101
        ? 'WARN'
        : 'INFO';
    const dateObserved = row && (row.DateObserved || row.dateObserved || row.date) || null;
    const hourObserved = row && (row.HourObserved || row.hourObserved || row.hour) || null;
    return {
      eventKey: `${String(row && (row.StateCode || row.stateCode || 'NA')).trim()}_${String(row && (row.ReportingArea || row.reportingArea || 'area')).trim()}_${dateObserved || 'date'}_${hourObserved || 'hour'}`,
      severity,
      category: PROVIDER_CATEGORIES[PROVIDER_KEYS.AIRNOW_AQI],
      headline: normalizeHeadline(
        row && `${row.ReportingArea || row.reportingArea || 'Area'} AQI ${Number.isFinite(aqi) ? aqi : '-'}`,
        'Air quality update'
      ),
      startsAt: dateObserved ? `${dateObserved}T00:00:00.000Z` : null,
      endsAt: null,
      externalUrl: null,
      regionHints: {
        states: row && (row.StateCode || row.stateCode) ? [row.StateCode || row.stateCode] : [],
        cities: row && (row.ReportingArea || row.reportingArea) ? [row.ReportingArea || row.reportingArea] : [],
        fips: [],
        coordinates: []
      },
      rawMeta: {
        parameter: row && (row.ParameterName || row.parameterName) || null,
        aqi: Number.isFinite(aqi) ? aqi : null
      }
    };
  });
}

const PROVIDER_DEFINITIONS = Object.freeze({
  [PROVIDER_KEYS.NWS_ALERTS]: {
    providerKey: PROVIDER_KEYS.NWS_ALERTS,
    endpoint: () => process.env.EMERGENCY_NWS_ALERTS_URL || 'https://api.weather.gov/alerts/active',
    method: 'GET',
    headers: () => ({
      accept: 'application/geo+json,application/json',
      'user-agent': process.env.EMERGENCY_HTTP_USER_AGENT || 'Member-EmergencyLayer/1.0'
    }),
    parsePayload: (payload) => parseNws(payload)
  },
  [PROVIDER_KEYS.USGS_EARTHQUAKES]: {
    providerKey: PROVIDER_KEYS.USGS_EARTHQUAKES,
    endpoint: () => process.env.EMERGENCY_USGS_EARTHQUAKES_URL
      || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    method: 'GET',
    headers: () => ({
      accept: 'application/geo+json,application/json',
      'user-agent': process.env.EMERGENCY_HTTP_USER_AGENT || 'Member-EmergencyLayer/1.0'
    }),
    parsePayload: (payload) => parseUsgs(payload)
  },
  [PROVIDER_KEYS.FEMA_IPAWS]: {
    providerKey: PROVIDER_KEYS.FEMA_IPAWS,
    endpoint: () => process.env.EMERGENCY_FEMA_IPAWS_URL || 'https://apps.fema.gov/ipaws/alerts.atom',
    method: 'GET',
    headers: () => ({
      accept: 'application/atom+xml,text/xml,application/xml',
      'user-agent': process.env.EMERGENCY_HTTP_USER_AGENT || 'Member-EmergencyLayer/1.0'
    }),
    parsePayload: (payload, context) => parseFemaIpaws({ text: context && context.payloadText ? context.payloadText : payload })
  },
  [PROVIDER_KEYS.OPENFEMA_DECLARATIONS]: {
    providerKey: PROVIDER_KEYS.OPENFEMA_DECLARATIONS,
    endpoint: () => process.env.EMERGENCY_OPENFEMA_DECLARATIONS_URL
      || 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=200&$orderby=declarationDate%20desc',
    method: 'GET',
    headers: () => ({
      accept: 'application/json',
      'user-agent': process.env.EMERGENCY_HTTP_USER_AGENT || 'Member-EmergencyLayer/1.0'
    }),
    parsePayload: (payload) => parseOpenFema(payload)
  },
  [PROVIDER_KEYS.OPENFDA_RECALLS]: {
    providerKey: PROVIDER_KEYS.OPENFDA_RECALLS,
    endpoint: () => process.env.EMERGENCY_OPENFDA_RECALLS_URL || 'https://api.fda.gov/food/enforcement.json?limit=100',
    method: 'GET',
    headers: () => ({
      accept: 'application/json',
      'user-agent': process.env.EMERGENCY_HTTP_USER_AGENT || 'Member-EmergencyLayer/1.0'
    }),
    parsePayload: (payload) => parseOpenFda(payload)
  },
  [PROVIDER_KEYS.AIRNOW_AQI]: {
    providerKey: PROVIDER_KEYS.AIRNOW_AQI,
    endpoint: () => process.env.EMERGENCY_AIRNOW_AQI_URL || '',
    method: 'GET',
    headers: () => ({
      accept: 'application/json',
      'user-agent': process.env.EMERGENCY_HTTP_USER_AGENT || 'Member-EmergencyLayer/1.0'
    }),
    parsePayload: (payload) => parseAirnow(payload)
  }
});

function listProviderDefinitions() {
  return Object.values(PROVIDER_DEFINITIONS);
}

function getProviderDefinition(providerKey) {
  const key = typeof providerKey === 'string' ? providerKey.trim().toLowerCase() : '';
  const definition = PROVIDER_DEFINITIONS[key] || null;
  if (!definition) throw new Error(`unknown providerKey: ${providerKey}`);
  return definition;
}

module.exports = {
  normalizeSeverityFromText,
  listProviderDefinitions,
  getProviderDefinition
};
