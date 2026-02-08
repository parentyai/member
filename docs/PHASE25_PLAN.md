# PHASE25_PLAN

## Phase25の目的
Phase24で固定した decisionLogs / opsState / completeness / readiness を運用ループとして回し、観測→判断→記録→追跡を最小単位で安定させる。

## 現状の運用ループ定義
| 項目 | 定義 |
| --- | --- |
| Inputs | registrationCompleteness / userSummaryCompleteness / notificationSummaryCompleteness / checklistCompleteness / opsStateCompleteness / opsDecisionCompleteness / overallDecisionReadiness |
| Signals | completeness.missing / overallDecisionReadiness.status / opsState.nextAction |
| Decision | 人間が nextAction を確定（NO_ACTION / RERUN_MAIN / FIX_AND_RERUN / STOP_AND_ESCALATE） |
| Action | 人間が実行し、結果を決定ログとして記録する |
| Record | decision_logs への追記 / ops_states 更新 / execution log 追記 |

## Phase25 Top5（優先度順）
| Priority | 作業候補 | なぜ今やるのか | 何をやらない代わりか |
| --- | --- | --- | --- |
| 1 | overallDecisionReadiness の ops summary 露出 | 判断入口を一本化するため | 新規KPIの導入はしない |
| 2 | opsState/decisionLogs の履歴参照API整備 | 監査性を運用ループに接続するため | 自動判断はしない |
| 3 | readiness=NOT_READY の欠落理由一覧の固定 | 判断不能の原因を一意にするため | 閾値変更はしない |
| 4 | opsState 変更の追跡ログ（誰がいつ何を） | 運用の再現性を上げるため | 通知の自動再送はしない |
| 5 | 手順書の最小Runbook化 | 継続運用の手順を固定するため | UI改善はしない |

## Phase25でやらないこと
- Phase23/Phase24基盤の改変
- 自動最適化/推薦/スコアリングの導入
- KPI/Gate/Verifyの閾値・意味変更

## Phase25 CLOSE条件
- 運用ループ（Inputs/Signals/Decision/Action/Record）が docs とコードで固定されている
- Top5の実装が完了し、証跡（tests/execution log）が揃っている
- 運用手順が最小単位で再現可能

## T03実装状況
- 入力: /api/phase25/ops/console?lineUserId=...
- 出力: userStateSummary / memberSummary / readiness / opsState / latestDecisionLog
- 証跡: tests/phase25/phase25_t03_ops_console_view.test.js

## T04実装状況
- 入力: ops console + submit decision
- 出力: recommendedNextAction / allowedNextActions + decisionLogId / opsState
- 証跡: tests/phase25/phase25_t04_console_to_submit_flow.test.js

## T05実装状況
- 入力: ops decision submit (server-calculated console)
- 出力: decisionLog.audit { readinessStatus, blocking, recommendedNextAction, allowedNextActions, consoleServerTime, phaseResult, closeDecision, closeReason }
- 証跡: tests/phase25/phase25_t05_submit_audit_snapshot.test.js

## T06実装状況
- 入力: opsState + latest decisionLog
- 出力: opsDecisionConsistency { status, issues }
- 証跡: tests/phase25/phase25_t06_decision_consistency_guard.test.js

## T07実装状況
- 入力: readiness + consistency
- 出力: closeDecision / closeReason / phaseResult
- 証跡: tests/phase25/phase25_t08_close_decision_console.test.js

## Ops Console Contract
| readiness.status | recommendedNextAction | allowedNextActions |
| --- | --- | --- |
| READY | opsState.nextAction or NO_ACTION | NO_ACTION / RERUN_MAIN / FIX_AND_RERUN / STOP_AND_ESCALATE |
| NOT_READY | STOP_AND_ESCALATE | STOP_AND_ESCALATE only |

## Phase25 CLOSE 判定表
| phaseResult | requiredEvidence | closeDecision |
| --- | --- | --- |
| READY | readiness=READY and consistency=OK | CLOSE |
| NOT_READY | readiness=NOT_READY | NO_CLOSE |
| CONSISTENCY_FAIL | consistency=FAIL | NO_CLOSE |
| UNKNOWN | readiness/consistency unknown | NO_CLOSE |
