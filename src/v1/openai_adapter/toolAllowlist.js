'use strict';

const TOOL_ALLOWLIST = new Set([
  'lookup',
  'draft',
  'assist',
  'handoff_to_human'
]);

function sanitizeTools(tools) {
  if (!Array.isArray(tools)) return [];
  return tools
    .filter((tool) => tool && typeof tool === 'object')
    .map((tool) => {
      const fn = tool.function && typeof tool.function === 'object' ? tool.function : null;
      const name = fn && typeof fn.name === 'string' ? fn.name.trim() : '';
      if (!name || !TOOL_ALLOWLIST.has(name)) return null;
      return {
        type: 'function',
        function: {
          name,
          description: typeof fn.description === 'string' ? fn.description : '',
          strict: true,
          parameters: fn.parameters && typeof fn.parameters === 'object' ? fn.parameters : { type: 'object', properties: {}, additionalProperties: false }
        }
      };
    })
    .filter(Boolean);
}

module.exports = {
  TOOL_ALLOWLIST,
  sanitizeTools
};
