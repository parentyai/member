'use strict';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clip(value, maxLength) {
  const raw = typeof value === 'string' ? value : '';
  if (!Number.isFinite(maxLength) || maxLength <= 0) return raw;
  if (raw.length <= maxLength) return raw;
  return raw.slice(0, maxLength);
}

function normalizeBody(notification) {
  const body = normalizeText(notification && notification.body);
  if (body) return body;
  const title = normalizeText(notification && notification.title);
  if (title) return title;
  return '-';
}

function normalizeAltText(notification, body) {
  const title = normalizeText(notification && notification.title);
  const source = title
    ? `${title} ${body}`.trim()
    : body;
  const clipped = clip(source, 400);
  return clipped || 'notification';
}

function buildSingleTextMessage(body, cta) {
  if (!cta || !cta.url) {
    return { type: 'text', text: body };
  }
  const originalUrl = normalizeText(cta.originalUrl);
  const finalUrl = normalizeText(cta.url);
  if (originalUrl && body.includes(originalUrl)) {
    return { type: 'text', text: body.split(originalUrl).join(finalUrl) };
  }
  return { type: 'text', text: `${body}\n\n${finalUrl}` };
}

function buildMultiTextMessage(body, ctas) {
  const lines = [body];
  ctas.forEach((cta) => {
    const label = normalizeText(cta && cta.ctaText);
    const url = normalizeText(cta && cta.url);
    if (!url) return;
    if (label) lines.push(`${label}: ${url}`);
    else lines.push(url);
  });
  return { type: 'text', text: lines.filter((line) => line && line.length > 0).join('\n\n') };
}

function canUseTemplateButtons(body, ctas) {
  if (!body || body.length > 160) return false;
  if (!Array.isArray(ctas) || ctas.length < 1 || ctas.length > 3) return false;
  return ctas.every((cta) => {
    const label = normalizeText(cta && cta.ctaText);
    const url = normalizeText(cta && cta.url);
    if (!label || !url) return false;
    if (label.length > 20) return false;
    if (/[\r\n]/.test(label)) return false;
    return true;
  });
}

function buildTemplateButtonsMessage(notification, body, ctas) {
  const altText = normalizeAltText(notification, body);
  return {
    type: 'template',
    altText,
    template: {
      type: 'buttons',
      text: body,
      actions: ctas.map((cta) => ({
        type: 'uri',
        label: clip(normalizeText(cta.ctaText), 20),
        uri: normalizeText(cta.url)
      }))
    }
  };
}

function buildLineNotificationMessage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const notification = payload.notification && typeof payload.notification === 'object' ? payload.notification : {};
  const ctas = Array.isArray(payload.ctas) ? payload.ctas.filter((cta) => cta && typeof cta === 'object') : [];
  const preferTemplateButtons = payload.preferTemplateButtons === true;
  const body = normalizeBody(notification);

  if (preferTemplateButtons && canUseTemplateButtons(body, ctas)) {
    return {
      message: buildTemplateButtonsMessage(notification, body, ctas),
      lineMessageType: 'template_buttons',
      fallbackReason: null
    };
  }

  const message = ctas.length <= 1
    ? buildSingleTextMessage(body, ctas[0] || null)
    : buildMultiTextMessage(body, ctas);

  return {
    message,
    lineMessageType: 'text',
    fallbackReason: preferTemplateButtons ? 'template_buttons_unavailable' : 'template_buttons_disabled'
  };
}

module.exports = {
  buildLineNotificationMessage
};
