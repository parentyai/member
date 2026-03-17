'use strict';

const { isTaskMicroLearningEnabled } = require('../../domain/tasks/featureFlags');
const { generateTaskSummary } = require('./generateTaskSummary');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function buildTimeLabel(timeMin, timeMax) {
  const min = (timeMin === null || timeMin === undefined || timeMin === '')
    ? null
    : (Number.isFinite(Number(timeMin)) ? Math.floor(Number(timeMin)) : null);
  const max = (timeMax === null || timeMax === undefined || timeMax === '')
    ? null
    : (Number.isFinite(Number(timeMax)) ? Math.floor(Number(timeMax)) : null);
  if (Number.isInteger(min) && Number.isInteger(max)) return `${min}〜${max}分`;
  if (Number.isInteger(min)) return `${min}分`;
  if (Number.isInteger(max)) return `${max}分`;
  return '未登録';
}

function resolveTitle(task, taskContent) {
  const taskRow = task && typeof task === 'object' ? task : {};
  const meaning = taskRow.meaning && typeof taskRow.meaning === 'object' ? taskRow.meaning : {};
  return normalizeText(
    taskContent && taskContent.title,
    normalizeText(meaning.title, normalizeText(taskRow.ruleId, normalizeText(taskRow.taskId, 'タスク詳細')))
  );
}

function resolveWhyNow(task, taskContent) {
  const taskRow = task && typeof task === 'object' ? task : {};
  const meaning = taskRow.meaning && typeof taskRow.meaning === 'object' ? taskRow.meaning : {};
  const direct = normalizeText(
    taskContent && taskContent.whyNow,
    normalizeText(meaning.whyNow, normalizeText(taskRow.whyNow, null))
  );
  if (direct) return direct;
  const dueAt = normalizeText(taskRow.dueAt, null);
  if (dueAt) return '期限遅延を防ぐため、先に着手しておくと安全です。';
  return '今のステージで前提条件を満たす優先タスクです。';
}

function buildPostbackData(action, todoKey, sectionOrParams) {
  const params = new URLSearchParams();
  params.set('action', action);
  params.set('todoKey', todoKey || '');
  if (typeof sectionOrParams === 'string') {
    params.set('section', sectionOrParams);
  } else if (sectionOrParams && typeof sectionOrParams === 'object') {
    Object.entries(sectionOrParams).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      params.set(key, String(value));
    });
  }
  return params.toString();
}

function buildChecklistTexts(taskContent) {
  const source = Array.isArray(taskContent && taskContent.checklistItems) ? taskContent.checklistItems : [];
  const enabled = source.filter((item) => item && item.enabled !== false);
  const visible = enabled.slice(0, 5);
  const lines = visible.map((item) => `□ ${item.text}`);
  if (enabled.length > visible.length) lines.push(`…ほか${enabled.length - visible.length}件`);
  return lines;
}

function buildUnderstandingButtons(todoKey, linkRefs) {
  const refs = linkRefs && typeof linkRefs === 'object' ? linkRefs : {};
  const rows = [
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: '📖 手順マニュアル',
        data: buildPostbackData('todo_detail_section', todoKey, 'manual'),
        displayText: `TODO詳細:${todoKey}`
      }
    }
  ];
  if (refs.video && refs.video.ok && refs.video.link && refs.video.link.url) {
    rows.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'uri',
        label: '🎥 3分動画',
        uri: refs.video.link.url
      }
    });
  }
  rows.push({
    type: 'button',
    style: 'secondary',
    height: 'sm',
    action: {
      type: 'postback',
      label: '⚠ よくある失敗',
      data: buildPostbackData('todo_detail_section', todoKey, 'failure'),
      displayText: `TODO詳細:${todoKey}`
    }
  });
  return rows;
}

function buildTaskStatusActionButtons(todoKey) {
  const key = todoKey || '';
  return [
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: `TODO完了:${key}`,
        data: buildPostbackData('todo_complete', key),
        displayText: `TODO完了:${key}`
      }
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: `TODO進行中:${key}`,
        data: buildPostbackData('todo_in_progress', key),
        displayText: `TODO進行中:${key}`
      }
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'postback',
        label: `TODOスヌーズ:${key}:3`,
        data: buildPostbackData('todo_snooze', key, { days: 3 }),
        displayText: `TODOスヌーズ:${key}:3`
      }
    }
  ];
}

function renderTaskFlexMessage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const task = payload.task && typeof payload.task === 'object' ? payload.task : {};
  const taskContent = payload.taskContent && typeof payload.taskContent === 'object' ? payload.taskContent : {};
  const linkRefs = payload.linkRefs && typeof payload.linkRefs === 'object' ? payload.linkRefs : {};
  const todoKey = normalizeText(payload.todoKey, normalizeText(task.ruleId, normalizeText(task.taskId, 'task')));
  const title = resolveTitle(task, taskContent);
  const whyNow = resolveWhyNow(task, taskContent);
  const timeLabel = buildTimeLabel(taskContent.timeMin, taskContent.timeMax);
  const checklistLines = buildChecklistTexts(taskContent);
  const microLearning = isTaskMicroLearningEnabled()
    ? generateTaskSummary({ taskContent, task })
    : { summaryShort: [], topMistakes: [], contextTips: [] };

  const bodyContents = [
    {
      type: 'text',
      text: 'いまやる理由',
      size: 'sm',
      color: '#777777'
    },
    {
      type: 'text',
      text: whyNow,
      size: 'sm',
      wrap: true,
      margin: 'sm'
    },
    {
      type: 'separator',
      margin: 'md'
    },
    {
      type: 'text',
      text: '必要時間',
      size: 'sm',
      color: '#777777'
    },
    {
      type: 'text',
      text: timeLabel,
      size: 'md',
      weight: 'bold',
      wrap: true
    }
  ];

  if (checklistLines.length > 0) {
    bodyContents.push({
      type: 'separator',
      margin: 'md'
    });
    bodyContents.push({
      type: 'text',
      text: 'やること',
      size: 'sm',
      color: '#777777',
      margin: 'md'
    });
    checklistLines.forEach((line) => {
      bodyContents.push({
        type: 'text',
        text: line,
        size: 'sm',
        wrap: true,
        margin: 'sm'
      });
    });
  }

  if (isTaskMicroLearningEnabled()) {
    if (Array.isArray(microLearning.summaryShort) && microLearning.summaryShort.length) {
      bodyContents.push({
        type: 'separator',
        margin: 'md'
      });
      bodyContents.push({
        type: 'text',
        text: '概要',
        size: 'sm',
        color: '#777777',
        margin: 'md'
      });
      microLearning.summaryShort.forEach((line) => {
        bodyContents.push({
          type: 'text',
          text: `・${line}`,
          size: 'sm',
          wrap: true,
          margin: 'sm'
        });
      });
    }

    if (Array.isArray(microLearning.topMistakes) && microLearning.topMistakes.length) {
      bodyContents.push({
        type: 'separator',
        margin: 'md'
      });
      bodyContents.push({
        type: 'text',
        text: 'よくある失敗',
        size: 'sm',
        color: '#777777',
        margin: 'md'
      });
      microLearning.topMistakes.forEach((line) => {
        bodyContents.push({
          type: 'text',
          text: `・${line}`,
          size: 'sm',
          wrap: true,
          margin: 'sm'
        });
      });
    }

    if (Array.isArray(microLearning.contextTips) && microLearning.contextTips.length) {
      bodyContents.push({
        type: 'separator',
        margin: 'md'
      });
      bodyContents.push({
        type: 'text',
        text: 'あなたの状況の注意',
        size: 'sm',
        color: '#777777',
        margin: 'md'
      });
      microLearning.contextTips.forEach((line) => {
        bodyContents.push({
          type: 'text',
          text: `・${line}`,
          size: 'sm',
          wrap: true,
          margin: 'sm'
        });
      });
    }
  }

  bodyContents.push({
    type: 'separator',
    margin: 'md'
  });
  bodyContents.push({
    type: 'text',
    text: '理解する',
    size: 'sm',
    color: '#777777',
    margin: 'md'
  });
  bodyContents.push({
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    margin: 'sm',
    contents: buildUnderstandingButtons(todoKey, linkRefs)
  });
  bodyContents.push({
    type: 'separator',
    margin: 'md'
  });
  bodyContents.push({
    type: 'text',
    text: '状態更新',
    size: 'sm',
    color: '#777777',
    margin: 'md'
  });
  bodyContents.push({
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    margin: 'sm',
    contents: buildTaskStatusActionButtons(todoKey)
  });

  const footerContents = [];
  if (linkRefs.action && linkRefs.action.ok && linkRefs.action.link && linkRefs.action.link.url) {
    footerContents.push({
      type: 'button',
      style: 'primary',
      action: {
        type: 'uri',
        label: `→ ${normalizeText(linkRefs.action.link.title || linkRefs.action.link.label, '外部リンクを開く')}`,
        uri: linkRefs.action.link.url
      }
    });
  }

  const flex = {
    type: 'flex',
    altText: `${title} のタスク詳細`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `【${title}】`,
            weight: 'bold',
            size: 'lg',
            wrap: true
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: bodyContents
      }
    }
  };

  if (footerContents.length > 0) {
    flex.contents.footer = {
      type: 'box',
      layout: 'vertical',
      contents: footerContents
    };
  }
  return flex;
}

module.exports = {
  renderTaskFlexMessage,
  buildTimeLabel
};
