'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function slugify(value, fallback) {
  const normalized = normalizeText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
  return (normalized || fallback || 'task').slice(0, 64);
}

function toIsoDatetime(value) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function resolveDueClass(payload) {
  if (normalizeText(payload.dueClass)) return normalizeText(payload.dueClass).toLowerCase();
  if (Array.isArray(payload.dueNotes) && payload.dueNotes.length > 0) return 'due_soon';
  const dueAt = normalizeText(payload.dueAt);
  if (!dueAt) return 'none';
  const parsed = Date.parse(dueAt);
  if (!Number.isFinite(parsed)) return 'scheduled';
  const diff = parsed - Date.now();
  if (diff < 0) return 'overdue';
  if (diff <= 7 * 24 * 60 * 60 * 1000) return 'due_soon';
  return 'scheduled';
}

function resolveBlockerState(payload) {
  if (normalizeText(payload.blockerState)) return normalizeText(payload.blockerState).toLowerCase();
  if (Array.isArray(payload.blockerNotes) && payload.blockerNotes.length > 0) return 'locked';
  return 'clear';
}

function isRegionalTopic(topic) {
  const normalized = normalizeText(topic).toLowerCase();
  return ['school', 'housing', 'driving', 'utilities', 'regional', 'local_procedures'].includes(normalized);
}

function resolveMenuBucket(payload) {
  const preferred = normalizeText(payload.menuBucketPreferred).toLowerCase();
  if (preferred) return preferred;
  const resolutionState = normalizeText(payload.resolutionState).toLowerCase();
  const dueClass = resolveDueClass(payload);
  const blockerState = resolveBlockerState(payload);
  const jurisdiction = normalizeText(payload.jurisdiction).toLowerCase();
  const topic = normalizeText(payload.topic).toLowerCase();
  const lane = normalizeText(payload.lane).toLowerCase();
  const taskable = payload.taskable === true || Boolean(normalizeText(payload.nextBestAction));

  if (resolutionState === 'refuse' || blockerState === 'locked') return 'support_guide';
  if (dueClass === 'due_soon' || dueClass === 'overdue') return 'due_soon_tasks';
  if (lane === 'welcome') return 'todo_list';
  if (jurisdiction && jurisdiction !== 'nationwide') return 'regional_procedures';
  if (isRegionalTopic(topic)) return 'regional_procedures';
  if (taskable) return 'next_tasks';
  return null;
}

function buildMenuHint(payload) {
  const bucket = resolveMenuBucket(payload);
  if (!bucket) return null;
  const map = {
    next_tasks: { label: '今やる', payload: '今やる' },
    due_soon_tasks: { label: '今週の期限', payload: '今週の期限' },
    regional_procedures: { label: '地域手続き', payload: '地域手続き' },
    todo_list: { label: 'TODO一覧', payload: 'TODO一覧' },
    delivery_history: { label: '通知履歴', payload: '通知履歴' },
    support_guide: { label: '相談', payload: '相談' }
  };
  const selected = map[bucket];
  if (!selected) return null;
  return {
    label: selected.label,
    payload: selected.payload,
    action_type: 'message',
    menu_bucket: bucket
  };
}

function buildTaskMenuHints(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nextBestAction = normalizeText(payload.nextBestAction);
  const dueClass = resolveDueClass(payload);
  const blockerState = resolveBlockerState(payload);
  const taskTitle = normalizeText(payload.taskTitle || payload.nextBestAction);
  const taskable = payload.taskable === true || Boolean(taskTitle);
  const menuHint = buildMenuHint(Object.assign({}, payload, { nextBestAction, taskable }));
  const taskHint = taskable
    ? {
        task_id: normalizeText(payload.taskId) || slugify(taskTitle, 'task'),
        task_title: taskTitle,
        status: normalizeText(payload.taskStatus) || (blockerState === 'locked' ? 'blocked' : 'suggested'),
        due_class: dueClass,
        blocker_state: blockerState,
        next_best_action: nextBestAction || taskTitle
      }
    : null;

  const semanticTasks = taskHint
    ? [{
        task_id: taskHint.task_id,
        title: taskHint.task_title,
        status: taskHint.status,
        priority: dueClass === 'due_soon' || dueClass === 'overdue' ? 'high' : 'medium',
        due_at: toIsoDatetime(payload.dueAt),
        required_docs: Array.isArray(payload.requiredDocs) ? payload.requiredDocs.slice(0, 5) : [],
        blockers: Array.isArray(payload.blockerNotes) ? payload.blockerNotes.slice(0, 5) : []
      }]
    : [];

  const quickReplies = menuHint ? [{
    label: menuHint.label,
    text: menuHint.payload
  }] : [];

  return {
    taskHint,
    menuHint,
    semanticTasks,
    quickReplies,
    serviceSurface: quickReplies.length > 0 ? 'quick_reply' : 'text'
  };
}

module.exports = {
  buildTaskMenuHints
};
