# PHASE34_PLAN

## 対象フェーズ
- Phase34

## Phase34の目的
「提案された判断」「人間が選んだ判断」「実際に起きた結果」のズレを検知し、
理由付きで固定証跡として残す。修正は行わない（検知・記録のみ）。

## Decision Drift 定義
| 種別 | 条件 |
| --- | --- |
| SUGGESTION_DRIFT | LLM suggested ≠ Ops selected |
| EXECUTION_DRIFT | Ops selected ≠ Executed result |
| OUTCOME_DRIFT | Executed result ≠ Expected sideEffects |
| POLICY_DRIFT | readiness / allowedNextActions を逸脱 |

## 検知のみで修正しない理由
判断を自動修正すると運用の責任分界が曖昧になるため。
Phase34は「事実を固定し、後続Phaseで使えるSSOTを作る」ことに集中する。

## Phase35以降の利用前提
Decision Drift を KPI/監査/レビュー基準として利用する（自動修正はしない）。

## Scope In
- usecase: `src/usecases/phase34/detectDecisionDrift.js`
- Firestore collection: `decision_drifts`（append-only）
- Phase33 executeOpsNextAction に drift 検知 hook 追加
- getOpsConsole に decisionDrift サマリ追加（API露出のみ）
- tests 追加（unit + integration）
- docs: PHASE34_PLAN / PHASE34_EXECUTION_LOG

## Scope Out
- Phase32/33 API/schema/tests/docs の変更（破壊的変更なし）
- drift による自動修正・自動エスカレーション
- UI追加

## Done定義（全てYESでCLOSE）
- drift 検知が deterministic に再現できる
- decision_drifts に append される
- getOpsConsole から drift 状態が取得できる
- tests追加 & npm test PASS
- main CI success
- docs append-only

## Rollback
- revert PR
