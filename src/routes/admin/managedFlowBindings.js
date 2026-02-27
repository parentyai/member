'use strict';

const MANAGED_FLOW_BINDINGS = Object.freeze([
  {
    actionKey: 'notifications.approve',
    method: 'POST',
    pathPattern: '/api/admin/os/notifications/approve',
    pathRegex: /^\/api\/admin\/os\/notifications\/approve\/?$/,
    handlerFile: 'src/routes/admin/osNotifications.js'
  },
  {
    actionKey: 'notifications.send.plan',
    method: 'POST',
    pathPattern: '/api/admin/os/notifications/send/plan',
    pathRegex: /^\/api\/admin\/os\/notifications\/send\/plan\/?$/,
    handlerFile: 'src/routes/admin/osNotifications.js'
  },
  {
    actionKey: 'notifications.send.execute',
    method: 'POST',
    pathPattern: '/api/admin/os/notifications/send/execute',
    pathRegex: /^\/api\/admin\/os\/notifications\/send\/execute\/?$/,
    handlerFile: 'src/routes/admin/osNotifications.js'
  },
  {
    actionKey: 'city_pack.bulletin.create',
    method: 'POST',
    pathPattern: '/api/admin/city-pack-bulletins',
    pathRegex: /^\/api\/admin\/city-pack-bulletins\/?$/,
    handlerFile: 'src/routes/admin/cityPackBulletins.js'
  },
  {
    actionKey: 'city_pack.bulletin.approve',
    method: 'POST',
    pathPattern: '/api/admin/city-pack-bulletins/:bulletinId/approve',
    pathRegex: /^\/api\/admin\/city-pack-bulletins\/[^/]+\/approve\/?$/,
    handlerFile: 'src/routes/admin/cityPackBulletins.js'
  },
  {
    actionKey: 'city_pack.bulletin.reject',
    method: 'POST',
    pathPattern: '/api/admin/city-pack-bulletins/:bulletinId/reject',
    pathRegex: /^\/api\/admin\/city-pack-bulletins\/[^/]+\/reject\/?$/,
    handlerFile: 'src/routes/admin/cityPackBulletins.js'
  },
  {
    actionKey: 'city_pack.bulletin.send',
    method: 'POST',
    pathPattern: '/api/admin/city-pack-bulletins/:bulletinId/send',
    pathRegex: /^\/api\/admin\/city-pack-bulletins\/[^/]+\/send\/?$/,
    handlerFile: 'src/routes/admin/cityPackBulletins.js'
  },
  {
    actionKey: 'city_pack.request.approve',
    method: 'POST',
    pathPattern: '/api/admin/city-pack-requests/:requestId/approve',
    pathRegex: /^\/api\/admin\/city-pack-requests\/[^/]+\/approve\/?$/,
    handlerFile: 'src/routes/admin/cityPackRequests.js'
  },
  {
    actionKey: 'city_pack.request.reject',
    method: 'POST',
    pathPattern: '/api/admin/city-pack-requests/:requestId/reject',
    pathRegex: /^\/api\/admin\/city-pack-requests\/[^/]+\/reject\/?$/,
    handlerFile: 'src/routes/admin/cityPackRequests.js'
  },
  {
    actionKey: 'city_pack.request.request_changes',
    method: 'POST',
    pathPattern: '/api/admin/city-pack-requests/:requestId/request-changes',
    pathRegex: /^\/api\/admin\/city-pack-requests\/[^/]+\/request-changes\/?$/,
    handlerFile: 'src/routes/admin/cityPackRequests.js'
  },
  {
    actionKey: 'city_pack.request.retry_job',
    method: 'POST',
    pathPattern: '/api/admin/city-pack-requests/:requestId/retry-job',
    pathRegex: /^\/api\/admin\/city-pack-requests\/[^/]+\/retry-job\/?$/,
    handlerFile: 'src/routes/admin/cityPackRequests.js'
  },
  {
    actionKey: 'city_pack.request.activate',
    method: 'POST',
    pathPattern: '/api/admin/city-pack-requests/:requestId/activate',
    pathRegex: /^\/api\/admin\/city-pack-requests\/[^/]+\/activate\/?$/,
    handlerFile: 'src/routes/admin/cityPackRequests.js'
  },
  {
    actionKey: 'vendors.edit',
    method: 'POST',
    pathPattern: '/api/admin/vendors/:linkId/edit',
    pathRegex: /^\/api\/admin\/vendors\/[^/]+\/edit\/?$/,
    handlerFile: 'src/routes/admin/vendors.js'
  },
  {
    actionKey: 'vendors.activate',
    method: 'POST',
    pathPattern: '/api/admin/vendors/:linkId/activate',
    pathRegex: /^\/api\/admin\/vendors\/[^/]+\/activate\/?$/,
    handlerFile: 'src/routes/admin/vendors.js'
  },
  {
    actionKey: 'vendors.disable',
    method: 'POST',
    pathPattern: '/api/admin/vendors/:linkId/disable',
    pathRegex: /^\/api\/admin\/vendors\/[^/]+\/disable\/?$/,
    handlerFile: 'src/routes/admin/vendors.js'
  },
  {
    actionKey: 'emergency.provider.update',
    method: 'POST',
    pathPattern: '/api/admin/emergency/providers/:providerKey',
    pathRegex: /^\/api\/admin\/emergency\/providers\/[^/]+\/?$/,
    handlerFile: 'src/routes/admin/emergencyLayer.js'
  },
  {
    actionKey: 'emergency.provider.force_refresh',
    method: 'POST',
    pathPattern: '/api/admin/emergency/providers/:providerKey/force-refresh',
    pathRegex: /^\/api\/admin\/emergency\/providers\/[^/]+\/force-refresh\/?$/,
    handlerFile: 'src/routes/admin/emergencyLayer.js'
  },
  {
    actionKey: 'emergency.bulletin.approve',
    method: 'POST',
    pathPattern: '/api/admin/emergency/bulletins/:bulletinId/approve',
    pathRegex: /^\/api\/admin\/emergency\/bulletins\/[^/]+\/approve\/?$/,
    handlerFile: 'src/routes/admin/emergencyLayer.js'
  },
  {
    actionKey: 'emergency.bulletin.reject',
    method: 'POST',
    pathPattern: '/api/admin/emergency/bulletins/:bulletinId/reject',
    pathRegex: /^\/api\/admin\/emergency\/bulletins\/[^/]+\/reject\/?$/,
    handlerFile: 'src/routes/admin/emergencyLayer.js'
  }
]);

function normalizeMethod(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizePathname(value) {
  const raw = String(value || '').trim();
  if (!raw) return '/';
  return raw.endsWith('/') && raw !== '/' ? raw.slice(0, -1) : raw;
}

function resolveActionByMethodAndPath(method, pathname) {
  const normalizedMethod = normalizeMethod(method);
  const normalizedPath = normalizePathname(pathname);
  return MANAGED_FLOW_BINDINGS.find((binding) => {
    return normalizeMethod(binding.method) === normalizedMethod && binding.pathRegex.test(normalizedPath);
  }) || null;
}

function getManagedFlowBindings() {
  return MANAGED_FLOW_BINDINGS;
}

module.exports = {
  MANAGED_FLOW_BINDINGS,
  resolveActionByMethodAndPath,
  getManagedFlowBindings
};
