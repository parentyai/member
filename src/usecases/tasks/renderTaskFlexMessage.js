'use strict';

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function renderTimeLabel(taskContent) {
  const row = taskContent && typeof taskContent === 'object' ? taskContent : {};
  const min = Number(row.timeMin);
  const max = Number(row.timeMax);
  if (Number.isFinite(min) && Number.isFinite(max)) return `${min}〜${max}分`;
  if (Number.isFinite(min)) return `${min}分`;
  if (Number.isFinite(max)) return `〜${max}分`;
  return null;
}

function buildChecklistLines(taskContent) {
  const row = taskContent && typeof taskContent === 'object' ? taskContent : {};
  const items = Array.isArray(row.checklistItems) && row.checklistItems.length
    ? row.checklistItems
      .filter((item) => item && item.enabled !== false && typeof item.text === 'string' && item.text.trim())
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map((item) => item.text.trim())
    : (Array.isArray(row.checklist) ? row.checklist.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []);
  return items.slice(0, 8);
}

function buildPostbackData(todoKey, section) {
  const safeTodoKey = encodeURIComponent(String(todoKey || '').trim());
  const safeSection = encodeURIComponent(String(section || '').trim());
  return `action=todo_detail_section&todoKey=${safeTodoKey}&section=${safeSection}`;
}

function buildActionButtons(todoKey, resolvedLinks) {
  const links = resolvedLinks && typeof resolvedLinks === 'object' ? resolvedLinks : {};
  const buttons = [
    {
      type: 'button',
      style: 'secondary',
      color: '#4C6FFF',
      action: {
        type: 'postback',
        label: '📖 手順マニュアル',
        data: buildPostbackData(todoKey, 'manual')
      },
      margin: 'md'
    }
  ];

  if (links.video && links.video.url) {
    buttons.push({
      type: 'button',
      style: 'secondary',
      action: {
        type: 'uri',
        label: '🎥 動画',
        uri: links.video.url
      },
      margin: 'sm'
    });
  }

  buttons.push({
    type: 'button',
    style: 'secondary',
    action: {
      type: 'postback',
      label: '⚠ よくある失敗',
      data: buildPostbackData(todoKey, 'failure')
    },
    margin: 'sm'
  });

  if (links.action && links.action.url) {
    const label = normalizeText(links.action.label || links.action.title, '詳しく見る');
    buttons.push({
      type: 'button',
      style: 'primary',
      color: '#1DB446',
      action: {
        type: 'uri',
        label: `→ ${label}`.slice(0, 20),
        uri: links.action.url
      },
      margin: 'md'
    });
  }

  return buttons.slice(0, 4);
}

function renderTaskDetailText(todoKey, taskContent, resolvedLinks) {
  const row = taskContent && typeof taskContent === 'object' ? taskContent : {};
  const title = normalizeText(row.title, todoKey || 'タスク詳細');
  const lines = [`【${title}】`];
  const timeLabel = renderTimeLabel(row);
  if (timeLabel) lines.push(`必要時間: ${timeLabel}`);
  const checklist = buildChecklistLines(row);
  if (checklist.length) {
    lines.push('やること:');
    checklist.forEach((item) => lines.push(`□ ${item}`));
  }
  lines.push('理解する:');
  lines.push(`- 手順マニュアル: TODO詳細続き:${todoKey}:manual:1`);
  if (resolvedLinks && resolvedLinks.video && resolvedLinks.video.url) {
    lines.push(`- 動画: ${resolvedLinks.video.url}`);
  }
  lines.push(`- よくある失敗: TODO詳細続き:${todoKey}:failure:1`);
  if (resolvedLinks && resolvedLinks.action && resolvedLinks.action.url) {
    lines.push(`- CTA: ${resolvedLinks.action.url}`);
  }
  return lines.join('\n');
}

function renderTaskFlexMessage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const todoKey = normalizeText(payload.todoKey, '');
  const taskContent = payload.taskContent && typeof payload.taskContent === 'object'
    ? payload.taskContent
    : {};
  const resolvedLinks = payload.resolvedLinks && typeof payload.resolvedLinks === 'object'
    ? payload.resolvedLinks
    : {};

  const title = normalizeText(taskContent.title, todoKey || 'タスク詳細');
  const timeLabel = renderTimeLabel(taskContent);
  const checklist = buildChecklistLines(taskContent);

  const bodyContents = [
    {
      type: 'text',
      text: title,
      weight: 'bold',
      size: 'lg',
      wrap: true
    }
  ];

  if (timeLabel) {
    bodyContents.push({
      type: 'text',
      text: `必要時間: ${timeLabel}`,
      size: 'sm',
      color: '#666666',
      margin: 'md'
    });
  }

  if (checklist.length) {
    bodyContents.push({
      type: 'text',
      text: 'やること',
      weight: 'bold',
      margin: 'md'
    });
    checklist.forEach((item) => {
      bodyContents.push({
        type: 'text',
        text: `□ ${item}`,
        size: 'sm',
        wrap: true,
        margin: 'sm'
      });
    });
  }

  bodyContents.push({
    type: 'text',
    text: '理解する',
    weight: 'bold',
    margin: 'md'
  });

  return {
    type: 'flex',
    altText: `タスク詳細: ${title}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: buildActionButtons(todoKey, resolvedLinks)
      }
    },
    fallbackText: renderTaskDetailText(todoKey, taskContent, resolvedLinks)
  };
}

module.exports = {
  renderTaskFlexMessage,
  renderTaskDetailText
};
