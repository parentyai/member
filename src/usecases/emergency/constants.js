'use strict';

const PROVIDER_KEYS = Object.freeze({
  NWS_ALERTS: 'nws_alerts',
  USGS_EARTHQUAKES: 'usgs_earthquakes',
  FEMA_IPAWS: 'fema_ipaws',
  OPENFEMA_DECLARATIONS: 'openfema_declarations',
  OPENFDA_RECALLS: 'openfda_recalls',
  AIRNOW_AQI: 'airnow_aqi'
});

const PROVIDER_CATEGORIES = Object.freeze({
  [PROVIDER_KEYS.NWS_ALERTS]: 'weather',
  [PROVIDER_KEYS.USGS_EARTHQUAKES]: 'earthquake',
  [PROVIDER_KEYS.FEMA_IPAWS]: 'alert',
  [PROVIDER_KEYS.OPENFEMA_DECLARATIONS]: 'alert',
  [PROVIDER_KEYS.OPENFDA_RECALLS]: 'recall',
  [PROVIDER_KEYS.AIRNOW_AQI]: 'air'
});

const DEFAULT_PROVIDER_SETTINGS = Object.freeze([
  {
    providerKey: PROVIDER_KEYS.NWS_ALERTS,
    status: 'enabled',
    scheduleMinutes: 10,
    officialLinkRegistryIdEnv: 'EMERGENCY_LINK_NWS_ALERTS'
  },
  {
    providerKey: PROVIDER_KEYS.USGS_EARTHQUAKES,
    status: 'enabled',
    scheduleMinutes: 10,
    officialLinkRegistryIdEnv: 'EMERGENCY_LINK_USGS_EARTHQUAKES'
  },
  {
    providerKey: PROVIDER_KEYS.FEMA_IPAWS,
    status: 'enabled',
    scheduleMinutes: 15,
    officialLinkRegistryIdEnv: 'EMERGENCY_LINK_FEMA_IPAWS'
  },
  {
    providerKey: PROVIDER_KEYS.OPENFEMA_DECLARATIONS,
    status: 'enabled',
    scheduleMinutes: 60,
    officialLinkRegistryIdEnv: 'EMERGENCY_LINK_OPENFEMA_DECLARATIONS'
  },
  {
    providerKey: PROVIDER_KEYS.OPENFDA_RECALLS,
    status: 'enabled',
    scheduleMinutes: 360,
    officialLinkRegistryIdEnv: 'EMERGENCY_LINK_OPENFDA_RECALLS'
  },
  {
    providerKey: PROVIDER_KEYS.AIRNOW_AQI,
    status: 'disabled',
    scheduleMinutes: 60,
    officialLinkRegistryIdEnv: 'EMERGENCY_LINK_AIRNOW_AQI'
  }
]);

const SEVERITY_VALUES = Object.freeze(['INFO', 'WARN', 'CRITICAL']);
const DIFF_TYPES = Object.freeze(['new', 'update', 'resolve']);
const BULLETIN_STATUS = Object.freeze(['draft', 'approved', 'sent', 'rejected']);

const FANOUT_SCENARIOS = Object.freeze(['A', 'B', 'C', 'D']);
const FANOUT_STEPS = Object.freeze(['3mo', '1mo', 'week', 'after1w']);

function resolveOfficialLinkRegistryIdFromEnv(envName) {
  const key = typeof envName === 'string' ? envName.trim() : '';
  if (!key) return null;
  const raw = process.env[key];
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim();
  return normalized.length ? normalized : null;
}

function resolveDefaultProviders() {
  return DEFAULT_PROVIDER_SETTINGS.map((item) => ({
    providerKey: item.providerKey,
    status: item.status,
    scheduleMinutes: item.scheduleMinutes,
    officialLinkRegistryId: resolveOfficialLinkRegistryIdFromEnv(item.officialLinkRegistryIdEnv)
  }));
}

module.exports = {
  PROVIDER_KEYS,
  PROVIDER_CATEGORIES,
  DEFAULT_PROVIDER_SETTINGS,
  SEVERITY_VALUES,
  DIFF_TYPES,
  BULLETIN_STATUS,
  FANOUT_SCENARIOS,
  FANOUT_STEPS,
  resolveDefaultProviders
};
