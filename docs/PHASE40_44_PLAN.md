# PHASE40_44_PLAN

## 対象フェーズ
- Phase40
- Phase41
- Phase42
- Phase43
- Phase44

## 原則
- LLMは助言のみ（実行しない）
- 人間が唯一の実行主体
- automationはopt-in（enabled=falseがデフォルト）
- 既存仕様は変更しない（additive only）

## Phase40: LLM Assist Suggestion
- getOpsAssistSuggestion を追加
- nextActionは返さない（助言のみ）
- disclaimerを必ず含める

## Phase41: LLM Assist Audit
- decision_timeline に source=llm_assist / action=SUGGEST をappend

## Phase42: Ops UI Read Model
- GET /api/phase42/ops-console/view を追加（read-only）
- 表示専用・submitは既存API

## Phase43: Human-in-the-loop Automation
- automation_config をappend-onlyで記録
- enabled=falseがデフォルト
- confirmation必須

## Phase44: Final Safety Net
- automation実行前に再検証（readiness/opsState/consistency）
- FAIL時はSTOP_AND_ESCALATEを自動実行しtimelineに記録

## Done定義（全てYESでCLOSE）
- LLM assist が助言のみ
- audit trail 完全（decision_timeline追加）
- UI read-only
- automation OFF by default
- main CI success
- CLOSE docsがmainに存在

## Rollback
- revert PR
