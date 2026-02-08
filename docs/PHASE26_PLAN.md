# PHASE26_PLAN

## Phase26の目的
Ops運用導線（console → submit → 監査 → 再表示）を一本道でSSOT化し、運用判断と監査の齟齬をなくす。

## Phase26のスコープ
- T01: Ops Console 一覧エンドポイント（要対応ユーザーの入口）
- T02: submitOpsDecision の postCheck 追加（submit後の整合検証）
- T03: Phase26 PLAN/EXECUTION_LOG をSSOTとして追加

## Phase26でやらないこと
- Phase23基盤（Runbook/CI/判定ロジック）の変更
- 既存APIの意味変更（破壊的変更）
- 自動判断/最適化/推薦の導入

## Phase26 Top候補（優先度順）
| Priority | 作業候補 | なぜ今やるのか | 何をやらない代わりか |
| --- | --- | --- | --- |
| 1 | Ops Console 一覧エンドポイント追加 | console入口を固定し、lineUserIdなしでも運用開始できるようにするため | 新規UI導入はしない |
| 2 | submitOpsDecision の postCheck 追加 | submit後の監査整合を自動検証し、運用の再表示に繋げるため | 自動修復はしない |
| 3 | Phase26 PLAN/EXECUTION_LOG のSSOT化 | 実装証跡を一本道で固定するため | Phase23/24/25の改変はしない |

## Phase26 CLOSE条件
- Ops運用導線（console → submit → 監査 → 再表示）がAPI/テストで固定されている
- T01〜T03の入力/出力/証跡が揃っている
- Phase23基盤に変更がない
