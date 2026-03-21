'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isBroadQuestion(text) {
  const normalized = normalizeText(text).replace(/[?？!！。]+$/g, '');
  if (!normalized) return true;
  if (normalized.length <= 8) return true;
  return /(どうすれば|どうしたら|何から|何をすれば|相談したい|困ってる|進めたい)/.test(normalized);
}

function hasPattern(text, pattern) {
  return Boolean(text && pattern && pattern.test(text));
}

function isHighRiskDomainIntent(intent) {
  return intent === 'ssn' || intent === 'banking';
}

function detectStrategySignals(messageText) {
  const normalized = normalizeText(messageText);
  return {
    directQuestion: hasPattern(normalized, /[?？]|(どうする|どうしたら|何から|何を|どう進める|見るべき|教えて|知りたい|どこから|どのタイミング)/i),
    costQuestion: hasPattern(normalized, /(いくら|どのくらい.*(お金|費用|コスト)|費用|初期費用|生活費|家賃相場|予算|相場)/i),
    timelineQuestion: hasPattern(normalized, /(いつ|どのタイミング|タイミング|いつまで|期限|スケジュール|timeline|何日前|到着後|出国前)/i),
    checklistQuestion: hasPattern(normalized, /(何から|まず何|最初に|準備|チェックリスト|段取り|流れ|手順|どう進める)/i),
    relocationQuestion: hasPattern(normalized, /(引っ越し|引越し|転居|移住|赴任先|生活立ち上げ|住みやすさ|家賃|初期費用|生活で最初に困る|暮らし|生活費)/i),
    cityQuestion: hasPattern(normalized, /(ニューヨーク|new york|ロサンゼルス|los angeles|サンフランシスコ|san francisco|シアトル|seattle|ボストン|boston|シカゴ|chicago|オースティン|austin|サンディエゴ|san diego|ワシントン|washington|都市|city|州|エリア)/i),
    servicePlanQuestion: hasPattern(normalized, /(無料プラン|有料プラン|プランの違い|プラン.*違い|料金.*違い|プラン比較|subscription|plan)/i),
    generalContinuationQuestion: hasPattern(normalized, /(最初の5分|今日.*今週.*今月|今週.*今月|止めること.*進めること|進めること.*止めること|どう言い換える|言い換える|短く並べて|3つまで|優先すべき|優先順位)/i),
    generalSetupQuestion: hasPattern(normalized, /(赴任|引っ越し|引越し|移住|生活セットアップ|生活立ち上げ).*(何から始め|最初にやるべき|最初に何|順番|ざっくり)/i),
    utilityTransformQuestion: hasPattern(normalized, /(家族に送れる一文|家族に送れる|一文にして|今日やること.*1行|今日やること.*一行|1行にして|一行にして|不安が強い前提|不安が強い.*1つだけ|不安が強い.*一つだけ|公式情報を確認すべき場面|判断基準だけ|失礼なく聞く短文|短文を1つ作って|断定せずに提案|相手に送る文面だけ|文面だけ|断定しすぎない|言い方に直して|人に話す感じ|2文にして|二文にして|事務的すぎない|何を確認すべきかだけ|地域によって違う)/i),
    mixedHousingSchoolQuestion: hasPattern(normalized, /(引っ越し|引越し|住まい|住宅|部屋探し|賃貸)/i)
      && hasPattern(normalized, /(学校|学区|入学|転校)/i),
    mixedSsnBankingQuestion: hasPattern(normalized, /((ssn).*(銀行|口座)|(銀行|口座).*(ssn))/i)
      && hasPattern(normalized, /(先に|どっち|どちら|優先|理由)/i)
  };
}

function buildStrategyTelemetry(strategy, candidateSet, reason, fallbackPriorityReason, options) {
  return {
    strategy,
    candidateSet,
    strategyReason: reason,
    fallbackPriorityReason,
    strategyPriorityVersion: 'v2',
    strategyAlternativeSet: Array.isArray(options && options.strategyAlternativeSet)
      ? options.strategyAlternativeSet
      : []
  };
}

function buildStrategyPlan(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const routerMode = normalizeText(payload.routerMode || 'casual').toLowerCase();
  const normalizedIntent = normalizeText(payload.normalizedConversationIntent || 'general').toLowerCase();
  const followupIntent = normalizeText(payload.followupIntent || '').toLowerCase();
  const followupIntentReason = normalizeText(payload.followupIntentReason || '').toLowerCase();
  const followupCarryFromHistory = payload.followupCarryFromHistory === true || followupIntentReason === 'history_followup_carry';
  const hasFollowupIntent = followupIntent === 'docs_required' || followupIntent === 'appointment_needed' || followupIntent === 'next_step';
  const directAnswerHint = hasFollowupIntent || payload.contextResume === true || payload.lowInformationMessage === true || followupCarryFromHistory;
  const recoverySignal = payload.recoverySignal === true;
  const intentReason = payload.intentDecision && typeof payload.intentDecision === 'object'
    ? normalizeText(payload.intentDecision.reason).toLowerCase()
    : '';
  const llmConciergeEnabled = payload.llmFlags && payload.llmFlags.llmConciergeEnabled === true;
  const opportunityDecision = payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
    ? payload.opportunityDecision
    : null;
  const messageText = normalizeText(payload.messageText);
  const priorContextUsed = payload.priorContextUsed === true || payload.contextResume === true || followupCarryFromHistory;
  const strategySignals = detectStrategySignals(messageText);
  const highRiskIntent = isHighRiskDomainIntent(normalizedIntent);
  const broadGroundingEligible = isBroadQuestion(messageText)
    && (
      priorContextUsed
      || normalizedIntent !== 'general'
      || strategySignals.costQuestion
      || strategySignals.timelineQuestion
      || strategySignals.checklistQuestion
      || strategySignals.relocationQuestion
      || strategySignals.cityQuestion
    );
  const domainGroundingPreferred = (normalizedIntent === 'housing' || normalizedIntent === 'school')
    && (
      routerMode === 'question'
      || strategySignals.directQuestion
      || priorContextUsed
      || strategySignals.costQuestion
      || strategySignals.timelineQuestion
      || strategySignals.checklistQuestion
      || strategySignals.relocationQuestion
      || strategySignals.cityQuestion
    );
  const continuationGroundingPreferred = priorContextUsed
    && normalizedIntent !== 'general'
    && highRiskIntent !== true
    && (hasFollowupIntent || followupCarryFromHistory || payload.contextResume === true);
  const utilityTransformDirectAnswerPreferred = strategySignals.utilityTransformQuestion
    && (priorContextUsed || normalizedIntent !== 'general' || normalizedIntent === 'general');
  const generalDirectAnswerPreferred = normalizedIntent === 'general'
    && (
      strategySignals.servicePlanQuestion
      || strategySignals.generalContinuationQuestion
      || strategySignals.generalSetupQuestion
      || strategySignals.utilityTransformQuestion
      || ((hasFollowupIntent || followupCarryFromHistory) && priorContextUsed)
    );
  const groundedFirstCandidateSet = ['grounded_candidate', 'structured_answer_candidate', 'domain_concierge_candidate', 'clarify_candidate'];
  const continuationFirstCandidateSet = ['continuation_candidate', 'grounded_candidate', 'structured_answer_candidate', 'domain_concierge_candidate', 'clarify_candidate'];

  if (routerMode === 'greeting' || routerMode === 'casual') {
    if (strategySignals.mixedHousingSchoolQuestion || strategySignals.mixedSsnBankingQuestion) {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'mixed_domain_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'mixed_domain_direct_answer',
        'preserve_mixed_domain_direct_answer',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    if (recoverySignal && normalizedIntent !== 'general') {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'recovery_domain_resume',
        directAnswerFirst: true,
        clarifySuppressed: false
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'recovery_signal_domain_resume',
        'preserve_domain_concierge_during_recovery',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    if (continuationGroundingPreferred) {
      return Object.assign({
        strategy: 'grounded_answer',
        conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
        retrieveNeeded: true,
        verifyNeeded: true,
        candidateSet: continuationFirstCandidateSet,
        fallbackType: 'followup_grounding_probe',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'grounded_answer',
        continuationFirstCandidateSet,
        'followup_grounding_first',
        'continuation_before_domain_concierge',
        { strategyAlternativeSet: ['continuation', 'grounded_answer', 'domain_concierge', 'clarify'] }
      ));
    }
    if (utilityTransformDirectAnswerPreferred) {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'utility_transform_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        'utility_transform_direct_answer',
        'preserve_utility_transform_direct_answer',
        { strategyAlternativeSet: ['continuation', 'domain_concierge', 'clarify'] }
      ));
    }
    if (generalDirectAnswerPreferred) {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: strategySignals.servicePlanQuestion ? 'service_plan_direct_answer' : 'general_followup_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        strategySignals.servicePlanQuestion ? 'service_plan_direct_answer' : 'general_followup_direct_answer',
        strategySignals.servicePlanQuestion ? 'preserve_service_plan_direct_answer' : 'preserve_general_followup_direct_answer',
        { strategyAlternativeSet: ['continuation', 'domain_concierge', 'clarify'] }
      ));
    }
    if (hasFollowupIntent && normalizedIntent !== 'general') {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'followup_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'followup_intent_domain_resume',
        highRiskIntent ? 'preserve_high_risk_domain_concierge' : 'preserve_direct_domain_followup',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    if (followupCarryFromHistory && normalizedIntent !== 'general') {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'history_followup_carry',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'history_followup_carry',
        highRiskIntent ? 'preserve_high_risk_domain_concierge' : 'preserve_history_domain_followup',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    if (payload.contextResume === true && normalizedIntent !== 'general') {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'contextual_domain_resume',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'contextual_domain_resume',
        highRiskIntent ? 'preserve_high_risk_domain_concierge' : 'preserve_contextual_domain_resume',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    const isGreetingOrSmalltalk = intentReason === 'greeting_detected' || intentReason === 'smalltalk_detected';
    if (payload.lowInformationMessage === true && !isGreetingOrSmalltalk) {
      return Object.assign({
        strategy: 'clarify',
        conversationMode: 'casual',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['clarify_candidate', 'conversation_candidate'],
        fallbackType: 'low_information_clarify',
        directAnswerFirst: false,
        clarifySuppressed: false
      }, buildStrategyTelemetry(
        'clarify',
        ['clarify_candidate', 'conversation_candidate'],
        'low_information_clarify',
        'clarify_after_low_information',
        { strategyAlternativeSet: ['clarify', 'conversation'] }
      ));
    }
    return Object.assign({
      strategy: 'casual',
      conversationMode: 'casual',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['conversation_candidate'],
      fallbackType: null,
      directAnswerFirst: false,
      clarifySuppressed: false
    }, buildStrategyTelemetry(
      'casual',
      ['conversation_candidate'],
      'casual_default',
      'casual_first',
      { strategyAlternativeSet: ['casual'] }
    ));
  }

  if (normalizedIntent !== 'general') {
    if (strategySignals.mixedHousingSchoolQuestion || strategySignals.mixedSsnBankingQuestion) {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'mixed_domain_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'mixed_domain_direct_answer',
        'preserve_mixed_domain_direct_answer',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    if (recoverySignal) {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'recovery_domain_resume',
        directAnswerFirst: true,
        clarifySuppressed: false
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'recovery_signal_domain_resume',
        'preserve_domain_concierge_during_recovery',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    if (utilityTransformDirectAnswerPreferred) {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'utility_transform_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        'utility_transform_direct_answer',
        'preserve_utility_transform_direct_answer',
        { strategyAlternativeSet: ['continuation', 'domain_concierge', 'clarify'] }
      ));
    }
    if (continuationGroundingPreferred) {
      return Object.assign({
        strategy: 'grounded_answer',
        conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
        retrieveNeeded: true,
        verifyNeeded: true,
        candidateSet: continuationFirstCandidateSet,
        fallbackType: 'followup_grounding_probe',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'grounded_answer',
        continuationFirstCandidateSet,
        'followup_grounding_first',
        'continuation_before_domain_concierge',
        { strategyAlternativeSet: ['continuation', 'grounded_answer', 'domain_concierge', 'clarify'] }
      ));
    }
    if (domainGroundingPreferred && highRiskIntent !== true) {
      return Object.assign({
        strategy: 'grounded_answer',
        conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
        retrieveNeeded: true,
        verifyNeeded: true,
        candidateSet: groundedFirstCandidateSet,
        fallbackType: null,
        directAnswerFirst: false,
        clarifySuppressed: false
      }, buildStrategyTelemetry(
        'grounded_answer',
        groundedFirstCandidateSet,
        'explicit_domain_grounded_answer',
        'grounded_before_domain_concierge',
        { strategyAlternativeSet: ['grounded_answer', 'domain_concierge', 'clarify'] }
      ));
    }
    return Object.assign({
      strategy: 'domain_concierge',
      conversationMode: 'concierge',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
      fallbackType: null,
      directAnswerFirst: directAnswerHint,
      clarifySuppressed: directAnswerHint
    }, buildStrategyTelemetry(
      'domain_concierge',
      ['domain_concierge_candidate', 'clarify_candidate'],
      'explicit_domain_intent',
      highRiskIntent ? 'preserve_high_risk_domain_concierge' : 'domain_concierge_after_grounding_not_preferred',
      { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
    ));
  }

  if (routerMode === 'problem') {
    return Object.assign({
      strategy: 'concierge',
      conversationMode: 'concierge',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
      fallbackType: null,
      directAnswerFirst: false,
      clarifySuppressed: false
    }, buildStrategyTelemetry(
      'concierge',
      ['domain_concierge_candidate', 'clarify_candidate'],
      'router_problem_concierge',
      'preserve_problem_concierge',
      { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
    ));
  }

  if (routerMode === 'activity') {
    return Object.assign({
      strategy: 'recommendation',
      conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
      retrieveNeeded: true,
      verifyNeeded: true,
      candidateSet: ['grounded_candidate', 'conversation_candidate', 'clarify_candidate'],
      fallbackType: null,
      directAnswerFirst: false,
      clarifySuppressed: false
    }, buildStrategyTelemetry(
      'recommendation',
      ['grounded_candidate', 'conversation_candidate', 'clarify_candidate'],
      'router_activity_recommendation',
      'recommendation_before_clarify',
      { strategyAlternativeSet: ['recommendation', 'clarify'] }
    ));
  }

  if (routerMode === 'question') {
    if (recoverySignal && normalizedIntent !== 'general') {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'recovery_domain_resume',
        directAnswerFirst: true,
        clarifySuppressed: false
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'recovery_signal_domain_resume',
        'preserve_domain_concierge_during_recovery',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    if (continuationGroundingPreferred) {
      return Object.assign({
        strategy: 'grounded_answer',
        conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
        retrieveNeeded: true,
        verifyNeeded: true,
        candidateSet: continuationFirstCandidateSet,
        fallbackType: 'followup_grounding_probe',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'grounded_answer',
        continuationFirstCandidateSet,
        'followup_grounding_first',
        'continuation_before_domain_concierge',
        { strategyAlternativeSet: ['continuation', 'grounded_answer', 'domain_concierge', 'clarify'] }
      ));
    }
    if (utilityTransformDirectAnswerPreferred) {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'utility_transform_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        'utility_transform_direct_answer',
        'preserve_utility_transform_direct_answer',
        { strategyAlternativeSet: ['continuation', 'domain_concierge', 'clarify'] }
      ));
    }
    if (generalDirectAnswerPreferred) {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: strategySignals.servicePlanQuestion ? 'service_plan_direct_answer' : 'general_followup_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['continuation_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        strategySignals.servicePlanQuestion ? 'service_plan_direct_answer' : 'general_followup_direct_answer',
        strategySignals.servicePlanQuestion ? 'preserve_service_plan_direct_answer' : 'preserve_general_followup_direct_answer',
        { strategyAlternativeSet: ['continuation', 'domain_concierge', 'clarify'] }
      ));
    }
    if (hasFollowupIntent && normalizedIntent !== 'general') {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'followup_direct_answer',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'followup_intent_domain_resume',
        highRiskIntent ? 'preserve_high_risk_domain_concierge' : 'preserve_direct_domain_followup',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    if (followupCarryFromHistory && normalizedIntent !== 'general') {
      return Object.assign({
        strategy: 'domain_concierge',
        conversationMode: 'concierge',
        retrieveNeeded: false,
        verifyNeeded: false,
        candidateSet: ['domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: 'history_followup_carry',
        directAnswerFirst: true,
        clarifySuppressed: true
      }, buildStrategyTelemetry(
        'domain_concierge',
        ['domain_concierge_candidate', 'clarify_candidate'],
        'history_followup_carry',
        highRiskIntent ? 'preserve_high_risk_domain_concierge' : 'preserve_history_domain_followup',
        { strategyAlternativeSet: ['domain_concierge', 'clarify'] }
      ));
    }
    const clarifyFirst = isBroadQuestion(messageText)
      && (!opportunityDecision || opportunityDecision.conversationMode !== 'concierge')
      && directAnswerHint !== true
      && broadGroundingEligible !== true;
    if (broadGroundingEligible) {
      return Object.assign({
        strategy: 'grounded_answer',
        conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
        retrieveNeeded: true,
        verifyNeeded: true,
        candidateSet: ['structured_answer_candidate', 'grounded_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        fallbackType: null,
        directAnswerFirst: false,
        clarifySuppressed: false
      }, buildStrategyTelemetry(
        'grounded_answer',
        ['structured_answer_candidate', 'grounded_candidate', 'domain_concierge_candidate', 'clarify_candidate'],
        'broad_question_grounding_probe',
        'structured_before_clarify',
        { strategyAlternativeSet: ['grounded_answer', 'structured_answer', 'domain_concierge', 'clarify'] }
      ));
    }
    return Object.assign({
      strategy: clarifyFirst ? 'clarify' : 'grounded_answer',
      conversationMode: clarifyFirst ? 'casual' : (llmConciergeEnabled ? 'concierge' : 'casual'),
      retrieveNeeded: clarifyFirst ? false : true,
      verifyNeeded: clarifyFirst ? false : true,
      candidateSet: clarifyFirst
        ? ['clarify_candidate', 'conversation_candidate']
        : ['grounded_candidate', 'composed_concierge_candidate', 'clarify_candidate'],
      fallbackType: clarifyFirst ? 'low_specificity_clarify' : null,
      directAnswerFirst: !clarifyFirst,
      clarifySuppressed: false
    }, buildStrategyTelemetry(
      clarifyFirst ? 'clarify' : 'grounded_answer',
      clarifyFirst
        ? ['clarify_candidate', 'conversation_candidate']
        : ['grounded_candidate', 'composed_concierge_candidate', 'clarify_candidate'],
      clarifyFirst ? 'broad_question_clarify' : 'question_grounded_answer',
      clarifyFirst ? 'clarify_after_no_grounding_footing' : 'grounded_before_clarify',
      { strategyAlternativeSet: clarifyFirst ? ['clarify', 'conversation'] : ['grounded_answer', 'clarify'] }
    ));
  }

  if (recoverySignal) {
    return Object.assign({
      strategy: 'clarify',
      conversationMode: 'casual',
      retrieveNeeded: false,
      verifyNeeded: false,
      candidateSet: ['clarify_candidate', 'conversation_candidate'],
      fallbackType: 'recovery_clarify',
      directAnswerFirst: false,
      clarifySuppressed: false
    }, buildStrategyTelemetry(
      'clarify',
      ['clarify_candidate', 'conversation_candidate'],
      'recovery_clarify',
      'clarify_after_recovery_without_domain',
      { strategyAlternativeSet: ['clarify', 'conversation'] }
    ));
  }

  return Object.assign({
    strategy: 'grounded_answer',
    conversationMode: llmConciergeEnabled ? 'concierge' : 'casual',
    retrieveNeeded: true,
    verifyNeeded: true,
    candidateSet: ['grounded_candidate', 'clarify_candidate'],
    fallbackType: null,
    directAnswerFirst: false,
    clarifySuppressed: false
  }, buildStrategyTelemetry(
    'grounded_answer',
    ['grounded_candidate', 'clarify_candidate'],
    'default_grounded_answer',
    'grounded_before_clarify',
    { strategyAlternativeSet: ['grounded_answer', 'clarify'] }
  ));
}

module.exports = {
  buildStrategyPlan,
  isBroadQuestion
};
