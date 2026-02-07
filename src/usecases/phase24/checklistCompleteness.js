'use strict';

const SEVERITY_ORDER = {
  INFO: 0,
  WARN: 1,
  BLOCK: 2
};

const MISSING_SEVERITY = {
  progress_without_definition: 'BLOCK',
  missing_required_item: 'BLOCK',
  completed_but_incomplete: 'BLOCK',
  unknown_item_progress: 'WARN'
};

function maxSeverity(current, next) {
  if (SEVERITY_ORDER[next] > SEVERITY_ORDER[current]) return next;
  return current;
}

function countDefinitionItems(definition) {
  if (!definition) return 0;
  if (Array.isArray(definition.items)) return definition.items.length;
  if (Array.isArray(definition.itemIds)) return definition.itemIds.length;
  if (typeof definition.totalItems === 'number') return definition.totalItems;
  return 0;
}

function countRequiredItems(definition) {
  if (!definition) return 0;
  if (Array.isArray(definition.requiredItemIds)) return definition.requiredItemIds.length;
  if (Array.isArray(definition.items)) {
    const required = definition.items.filter((item) => item && item.required === true).length;
    if (required > 0) return required;
    return definition.items.length;
  }
  const total = countDefinitionItems(definition);
  return total;
}

function countCompletedItems(progress) {
  if (!progress) return 0;
  if (Array.isArray(progress.completedItemIds)) return progress.completedItemIds.length;
  if (typeof progress.completedCount === 'number') return progress.completedCount;
  return 0;
}

function evaluateChecklistCompleteness(definition, progress) {
  const definitionCount = countDefinitionItems(definition);
  const requiredCount = countRequiredItems(definition);
  const completedCount = countCompletedItems(progress);
  const isMarkedComplete = Boolean(progress && progress.completed === true);

  const missing = [];

  if (definitionCount === 0 && completedCount > 0) {
    missing.push('progress_without_definition');
  }

  if (definitionCount > 0 && completedCount < requiredCount) {
    missing.push('missing_required_item');
    if (isMarkedComplete) missing.push('completed_but_incomplete');
  }

  if (definitionCount > 0 && completedCount > definitionCount) {
    missing.push('unknown_item_progress');
  }

  let severity = 'INFO';
  let hasBlock = false;
  missing.forEach((code) => {
    const next = MISSING_SEVERITY[code] || 'WARN';
    severity = maxSeverity(severity, next);
    if (next === 'BLOCK') hasBlock = true;
  });

  const ok = !hasBlock;
  const needsAttention = missing.length > 0;
  const isComplete = definitionCount > 0 && completedCount >= requiredCount;

  return {
    completeness: {
      ok,
      missing,
      needsAttention,
      severity
    },
    completion: {
      isComplete,
      completeRule: 'ALL_ITEMS'
    }
  };
}

module.exports = {
  evaluateChecklistCompleteness
};
