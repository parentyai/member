# PHASE36_39_PLAN

## 対象フェーズ
- Phase36
- Phase37
- Phase38
- Phase39

## 目的
Ops運用を高速化しつつ安全性を保つため、判断の時系列・通知起点の追跡・LLM補助の入口・安全ガードを一本線で固定する。

## 原則
- LLMは判断しない（補助のみ）
- 既存仕様は変更しない（additive only）
- 推定はしない（繋がらない場合は UNKNOWN/NULL）

## Phase36: Decision Timeline
- decision_timeline を append-only で記録
- opsDecision / execution / postCheck は必ず記録（失敗も含む）

## Phase37: Notification Traceability
- notificationSummary に decisionTrace を追加
- 通知→decision→execution が繋がった場合のみ埋める（推定禁止）

## Phase38: LLM Assist Context
- getOpsAssistContext を追加
- LLM呼び出しは禁止（read-only payloadのみ）

## Phase39: Ops Safety Guard
- readiness NOT_READY の禁止は既存ルールを維持
- decision source mismatch / stale console / stale execution を FAIL として拒否
- ガード結果は decision_timeline に残す

## Tasks
- T01: decision_timeline repo + append hooks
- T02: decisionTrace 追加（notification read model）
- T03: getOpsAssistContext 追加
- T04: safety guard 追加
- T05: tests + docs

## Done定義（全てYESでCLOSE）
- decision timeline が append-only で動作
- notification→decision→execution が追跡可能
- LLM用payloadが生成できる
- safety guard がテストで固定
- main CI success
- CLOSE docs が main に存在

## Rollback
- revert PR
