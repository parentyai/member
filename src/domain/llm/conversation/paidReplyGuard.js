'use strict';

const LEGACY_TEMPLATE_PATTERN = /(FAQ候補|CityPack候補|根拠キー|根拠\s*[:：]|score=|-\s*\[\]|関連情報です)/gi;
const DEFAULT_SITUATION_LINE = '状況を整理しながら進めましょう。';
const DEFAULT_QUESTION_LINE = 'まず最優先で進めたい手続きを1つ教えてください。';
const PITFALL_PATTERN = /(詰まりやすい|注意|リスク|気をつけ|ボトルネック)/;
const {
  buildReplyTemplateFingerprint,
  classifyReplyTemplateKind
} = require('./replyTemplateTelemetry');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function sanitizeLine(value) {
  return normalizeText(value)
    .replace(LEGACY_TEMPLATE_PATTERN, '')
    .replace(/。{2,}/g, '。')
    .replace(/？{2,}/g, '？')
    .replace(/！{2,}/g, '！')
    .replace(/。([？！])/g, '$1')
    .replace(/([？！])。/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeLines(rows, limit) {
  const list = Array.isArray(rows) ? rows : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 3;
  const out = [];
  list.forEach((item) => {
    if (out.length >= max) return;
    const normalized = sanitizeLine(item);
    if (!normalized) return;
    if (out.includes(normalized)) return;
    out.push(normalized);
  });
  return out;
}

function parseReplyLines(text) {
  const normalized = normalizeText(text)
    .replace(LEGACY_TEMPLATE_PATTERN, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return [];
  return normalized
    .split('\n')
    .map((line) => sanitizeLine(line))
    .filter(Boolean)
    .filter((line) => !/^\d+[.)．、]\s*(状況整理|抜け漏れ|リスク|nextaction|根拠参照キー|注意事項)/i.test(line));
}

function stripActionPrefix(line) {
  return sanitizeLine(line.replace(/^[\-・*\d０-９0-9.\)\(]+\s*/, ''));
}

function ensureSentence(line) {
  const normalized = sanitizeLine(line);
  if (!normalized) return '';
  if (/[。！？!?]$/.test(normalized)) return normalized;
  return `${normalized}。`;
}

function isQuestionLikeLine(line) {
  const normalized = sanitizeLine(line);
  if (!normalized) return false;
  if (/[?？]$/.test(normalized)) return true;
  return /(教えてください|教えてもらえますか|教えてもらえますでしょうか|決めましょうか|分かりますか|できますか|でしょうか|ますか|ませんか|ですか|いただけますか)/.test(normalized);
}

function looksLikeStatusLine(line) {
  const normalized = sanitizeLine(line);
  if (!normalized) return false;
  return /^(了解です|承知しました|わかりました|分かりました|大丈夫です|ありがとうございます|ありがとう|そうですね|そうですか|状況を整理しながら進めます|整理しながら進めます)/.test(normalized)
    || /ながら進めます/.test(normalized);
}

function toConciseActionLine(action) {
  const normalized = sanitizeLine(action);
  if (!normalized) return '';
  if (/^(次|まず|先に)/.test(normalized)) return ensureSentence(normalized);
  return ensureSentence(`次は${normalized}`);
}

function looksLikeActionLine(line) {
  if (!line) return false;
  if (isQuestionLikeLine(line) || looksLikeStatusLine(line)) return false;
  if (/^[\-・*\d０-９0-9.\)\(]/.test(line)) return true;
  return /(確認|整理|決める|準備|申請|提出|連絡|予約|確定|進める|絞る)/.test(line);
}

function pickSituationLine(lines, fallback) {
  const list = Array.isArray(lines) ? lines : [];
  const picked = list.find((line) => line && !looksLikeActionLine(line) && !isQuestionLikeLine(line));
  return picked || sanitizeLine(fallback) || DEFAULT_SITUATION_LINE;
}

function pickPitfallLine(lines, fallback) {
  const list = Array.isArray(lines) ? lines : [];
  const pitfall = list.find((line) => PITFALL_PATTERN.test(line));
  const normalized = sanitizeLine(pitfall || fallback);
  if (!normalized) return null;
  if (/^多くの人が詰まりやすいのは/.test(normalized)) return normalized;
  return `多くの人が詰まりやすいのは ${normalized}`;
}

function pickQuestionLine(lines, fallback) {
  const list = Array.isArray(lines) ? lines : [];
  const question = list.find((line) => isQuestionLikeLine(line));
  const normalized = sanitizeLine(question || fallback);
  if (!normalized) return null;
  if (isQuestionLikeLine(normalized)) return normalized;
  return `${normalized}。`;
}

function isRepeatedQuestionLine(line, hints) {
  const normalized = sanitizeLine(line);
  const rows = Array.isArray(hints) ? hints : [];
  if (!normalized || !rows.length) return false;
  return rows.some((item) => {
    const hint = sanitizeLine(item);
    if (!hint) return false;
    return hint === normalized;
  });
}

function extractActionLines(lines, fallbackActions, maxActions) {
  const sourceLines = Array.isArray(lines) ? lines : [];
  const parsed = sourceLines
    .filter((line) => looksLikeActionLine(line) && !PITFALL_PATTERN.test(line) && !isQuestionLikeLine(line))
    .map((line) => stripActionPrefix(line));
  return dedupeLines(parsed.concat(Array.isArray(fallbackActions) ? fallbackActions : []), maxActions);
}

function containsLegacyTemplateTerms(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return /(FAQ候補|CityPack候補|根拠キー|根拠\s*[:：]|score=|-\s*\[\]|関連情報です)/i.test(normalized);
}

function shouldPreserveStructuredConciergeReply(lines) {
  const parsed = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (parsed.length < 3) return false;
  const joined = parsed.join('\n');
  return /住むエリアと学区/.test(parsed[0])
    && /住所証明/.test(joined)
    && /(住居候補|学校候補|同じエリア軸)/.test(joined);
}

function sanitizePaidMainReply(text, options) {
  const payload = options && typeof options === 'object' ? options : {};
  const raw = normalizeText(text);
  const parsedLines = parseReplyLines(raw);
  const conciseMode = payload.conciseMode === true;
  const recentAssistantCommitments = dedupeLines(payload.recentAssistantCommitments, 8);
  const repetitionPrevented = payload.repetitionPrevented === true;
  const requestContract = payload.requestContract && typeof payload.requestContract === 'object'
    ? payload.requestContract
    : {};
  const requestShape = normalizeText(requestContract.requestShape).toLowerCase();
  const outputForm = normalizeText(requestContract.outputForm).toLowerCase() || 'default';
  const formatLocked = outputForm !== 'default'
    || ['rewrite', 'summarize', 'message_template', 'compare', 'criteria', 'correction', 'followup_continue'].includes(requestShape);
  if (conciseMode && shouldPreserveStructuredConciergeReply(parsedLines)) {
    const preservedText = parsedLines
      .slice(0, 3)
      .map((line) => sanitizeLine(line))
      .filter(Boolean)
      .join('\n')
      .trim();
    return {
      text: preservedText || DEFAULT_SITUATION_LINE,
      legacyTemplateHit: containsLegacyTemplateTerms(raw),
      actionCount: 0,
      pitfallIncluded: false,
      followupQuestionIncluded: false,
      insertedNextStepIntro: false,
      templateKind: classifyReplyTemplateKind({
        replyText: preservedText || DEFAULT_SITUATION_LINE,
        conciseModeApplied: true
      }),
      replyTemplateFingerprint: buildReplyTemplateFingerprint(preservedText || DEFAULT_SITUATION_LINE)
    };
  }
  if (formatLocked) {
    const lockedText = parsedLines
      .slice(0, outputForm === 'two_sentences' ? 2 : 3)
      .map((line) => sanitizeLine(line))
      .filter(Boolean)
      .join('\n')
      .trim();
    return {
      text: lockedText || sanitizeLine(payload.situationLine) || DEFAULT_SITUATION_LINE,
      legacyTemplateHit: containsLegacyTemplateTerms(raw),
      actionCount: 0,
      pitfallIncluded: false,
      followupQuestionIncluded: /[?？]/.test(lockedText),
      insertedNextStepIntro: false,
      templateKind: classifyReplyTemplateKind({
        replyText: lockedText || DEFAULT_SITUATION_LINE,
        conciseModeApplied: conciseMode
      }),
      replyTemplateFingerprint: buildReplyTemplateFingerprint(lockedText || DEFAULT_SITUATION_LINE)
    };
  }
  const situationLine = pickSituationLine(parsedLines, payload.situationLine);
  const nextActions = extractActionLines(parsedLines, payload.nextActions, payload.maxActions || 3);
  const pitfallLine = payload.disablePitfall === true
    ? null
    : pickPitfallLine(parsedLines, payload.pitfall);
  let followupQuestion = payload.disableFollowup === true
    ? null
    : pickQuestionLine(parsedLines, payload.followupQuestion);
  if (repetitionPrevented && isRepeatedQuestionLine(followupQuestion, recentAssistantCommitments)) {
    followupQuestion = null;
  }

  if (!followupQuestion && nextActions.length === 0) {
    followupQuestion = sanitizeLine(payload.defaultQuestion || DEFAULT_QUESTION_LINE);
  }

  const normalizedSituationLine = sanitizeLine(situationLine) || DEFAULT_SITUATION_LINE;
  const dedupedActions = nextActions.filter((action) => {
    const normalizedAction = sanitizeLine(action);
    if (!normalizedAction) return false;
    if (normalizedAction === normalizedSituationLine) return false;
    if (normalizedSituationLine.includes(normalizedAction) || normalizedAction.includes(normalizedSituationLine)) return false;
    return true;
  });
  const outputLines = [sanitizeLine(situationLine) || DEFAULT_SITUATION_LINE];
  const insertedNextStepIntro = conciseMode !== true && dedupedActions.length > 0;
  if (conciseMode) {
    if (dedupedActions.length) {
      outputLines.push(toConciseActionLine(dedupedActions[0]));
    }
    if (followupQuestion) {
      outputLines.push(followupQuestion);
    } else if (pitfallLine) {
      outputLines.push(pitfallLine);
    }
  } else {
    if (nextActions.length) {
      outputLines.push('まずは次の一手です。');
      nextActions.slice(0, 3).forEach((action) => {
        outputLines.push(`・${sanitizeLine(action)}`);
      });
    }
    if (pitfallLine) {
      outputLines.push(pitfallLine);
    }
    if (followupQuestion) {
      outputLines.push(followupQuestion);
    }
  }

  const sanitizedText = outputLines
    .filter(Boolean)
    .slice(0, conciseMode ? 3 : 6)
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    text: sanitizedText || DEFAULT_SITUATION_LINE,
    legacyTemplateHit: containsLegacyTemplateTerms(raw),
    actionCount: dedupedActions.length,
    pitfallIncluded: Boolean(pitfallLine),
    followupQuestionIncluded: Boolean(followupQuestion),
    insertedNextStepIntro,
    templateKind: classifyReplyTemplateKind({
      replyText: sanitizedText || DEFAULT_SITUATION_LINE,
      conciseModeApplied: conciseMode
    }),
    replyTemplateFingerprint: buildReplyTemplateFingerprint(sanitizedText || DEFAULT_SITUATION_LINE)
  };
}

module.exports = {
  sanitizePaidMainReply,
  containsLegacyTemplateTerms,
  LEGACY_TEMPLATE_PATTERN
};
