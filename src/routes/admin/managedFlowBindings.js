'use strict';

const { getManagedFlowRegistry } = require('../../domain/managedFlowRegistry');

let cachedVersion = null;
let cachedBindings = Object.freeze([]);

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeMethod(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizePathname(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return '/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function toPathRegex(pathPattern) {
  const normalized = normalizePathname(pathPattern);
  if (normalized === '/') return /^\/$/;
  const parts = normalized.split('/').filter(Boolean).map((part) => {
    if (part.startsWith(':')) return '[^/]+';
    return escapeRegex(part);
  });
  return new RegExp(`^/${parts.join('/')}/?$`);
}

function buildBindingsFromRegistry() {
  const registry = getManagedFlowRegistry();
  if (cachedBindings.length > 0 && cachedVersion === registry.version) {
    return cachedBindings;
  }

  const out = [];
  registry.flows.forEach((flow) => {
    (flow.writeActions || []).forEach((action) => {
      out.push(Object.freeze({
        flowId: flow.flowId,
        actionKey: action.actionKey,
        method: normalizeMethod(action.method),
        pathPattern: action.pathPattern,
        pathRegex: toPathRegex(action.pathPattern),
        handlerFile: action.handlerFile
      }));
    });
  });

  cachedVersion = registry.version;
  cachedBindings = Object.freeze(out);
  return cachedBindings;
}

function resolveActionByMethodAndPath(method, pathname) {
  const normalizedMethod = normalizeMethod(method);
  const normalizedPath = normalizePathname(pathname);
  const bindings = buildBindingsFromRegistry();
  return bindings.find((binding) => {
    return binding.method === normalizedMethod && binding.pathRegex.test(normalizedPath);
  }) || null;
}

function getManagedFlowBindings() {
  return buildBindingsFromRegistry();
}

module.exports = {
  get MANAGED_FLOW_BINDINGS() {
    return buildBindingsFromRegistry();
  },
  resolveActionByMethodAndPath,
  getManagedFlowBindings
};

