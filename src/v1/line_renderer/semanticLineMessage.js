'use strict';

const { sanitizeSemanticResponseObject, toResponseMarkdown } = require('../semantic/semanticResponseObject');
const { resolveLineSurfacePlan } = require('../line_surface_policy/lineInteractionPolicy');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildQuickReplyObject(items) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return null;
  return {
    items: rows.map((row) => {
      const action = {
        type: 'message',
        label: row.label,
        text: row.text
      };
      if (row.data) action.data = row.data;
      return {
        type: 'action',
        action
      };
    })
  };
}

function buildTemplateActions(items) {
  return (Array.isArray(items) ? items : []).slice(0, 4).map((row) => {
    if (row && row.type === 'uri') {
      return {
        type: 'uri',
        label: row.label,
        uri: row.uri
      };
    }
    return {
      type: 'message',
      label: row.label,
      text: row.text
    };
  });
}

function buildSemanticFlexMessage(semantic, text) {
  const tasks = Array.isArray(semantic.tasks) ? semantic.tasks : [];
  const warnings = Array.isArray(semantic.warnings) ? semantic.warnings : [];
  const bodyContents = [
    {
      type: 'text',
      text: normalizeText(text).slice(0, 1200) || '回答を準備しています。',
      wrap: true,
      size: 'sm',
      color: '#111111'
    }
  ];

  tasks.slice(0, 3).forEach((task, index) => {
    bodyContents.push({
      type: 'text',
      text: `${index + 1}. ${normalizeText(task && task.title).slice(0, 120)}`,
      wrap: true,
      size: 'sm',
      margin: 'md',
      color: '#1F2937'
    });
  });

  if (warnings.length > 0) {
    bodyContents.push({
      type: 'separator',
      margin: 'lg'
    });
    bodyContents.push({
      type: 'text',
      text: `注意: ${normalizeText(warnings[0]).slice(0, 120)}`,
      wrap: true,
      size: 'xs',
      margin: 'md',
      color: '#B45309'
    });
  }

  return {
    type: 'flex',
    altText: normalizeText(semantic.response_contract && semantic.response_contract.summary).slice(0, 120)
      || normalizeText(text).slice(0, 120)
      || '回答を表示します。',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: bodyContents
      }
    }
  };
}

function buildSemanticTemplateMessage(semantic, text, actions) {
  const templateActions = buildTemplateActions(actions);
  if (templateActions.length === 0) return null;
  return {
    type: 'template',
    altText: normalizeText(semantic.response_contract && semantic.response_contract.summary).slice(0, 120)
      || normalizeText(text).slice(0, 120)
      || '回答を表示します。',
    template: {
      type: 'buttons',
      title: normalizeText(semantic.intent).slice(0, 40) || 'ご案内',
      text: normalizeText(text).slice(0, 160) || '回答を表示します。',
      actions: templateActions
    }
  };
}

function buildSemanticLineMessage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const semantic = sanitizeSemanticResponseObject(payload.semanticResponseObject || payload.semantic_response_object || payload);
  const responseMarkdown = normalizeText(semantic.response_markdown) || toResponseMarkdown(semantic);
  const surfacePlan = resolveLineSurfacePlan({
    requestedSurface: semantic.service_surface,
    text: responseMarkdown,
    quickReplies: semantic.quick_replies,
    templateActions: payload.templateActions,
    handoffRequired: ['OFFERED', 'REQUIRED', 'IN_PROGRESS'].includes(semantic.handoff_state),
    miniAppUrl: payload.miniAppUrl,
    liffUrl: payload.liffUrl
  });
  const quickReply = buildQuickReplyObject(surfacePlan.quickReplies);

  if (surfacePlan.surface === 'flex') {
    return {
      message: buildSemanticFlexMessage(semantic, responseMarkdown),
      surfacePlan
    };
  }

  if (surfacePlan.surface === 'template') {
    const templateMessage = buildSemanticTemplateMessage(semantic, responseMarkdown, surfacePlan.templateActions);
    if (templateMessage) {
      return {
        message: templateMessage,
        surfacePlan
      };
    }
  }

  const textMessage = {
    type: 'text',
    text: responseMarkdown || '回答を準備しています。'
  };
  if (surfacePlan.surface === 'quick_reply' && quickReply) {
    textMessage.quickReply = quickReply;
  }

  return {
    message: textMessage,
    surfacePlan
  };
}

module.exports = {
  buildSemanticLineMessage
};
