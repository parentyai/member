# PHASE45_49_PLAN

## Purpose
Ops Assist（LLM提案）→ Ops Console（閲覧/判断）→ Automation（dry-run/execute）→ 監査/履歴を最小変更で接続し、運用で回せる最小完成形をSSOT化する。

## Scope In
- Phase45: LLM提案の入力整形・テンプレ固定（promptPayload）と fallback 提案の固定。
- Phase46: Ops Console向け LLM提案取得（cache含む）と ops_readonly での表示。
- Phase47: Automation 二段階（dry-run → execute）の最小API追加。
- Phase48: automation_config の運用SSOT化（read-only取得）。
- Phase49: 1本の統合E2Eテストでフロー固定。

## Scope Out
- LINEアプリ案（LIFF/ミニアプリ/画面遷移前提）。
- 自動判断・自動送信（LLMは助言のみ）。
- UIデザイン改善/フロントFW導入。
- 既存APIの意味変更・削除。

## APIs
- `GET /api/phase42/ops-console/view?lineUserId=...&includeAssist=1`
  - cache付きのLLM提案を含むread-only view。
- `POST /api/phase47/automation/dry-run`
  - 書き込み無しで実行可否を評価。
- `GET /api/phase48/automation/config`
  - automation_config の最新スナップショット取得。

## Firestore (append-only)
- `ops_assist_cache`
  - fields: `lineUserId`, `suggestion`, `reason`, `model`, `snapshot`, `sourceDecisionLogId`, `ttlSec`, `createdAt`
- `automation_config`
  - fields: `enabled`, `allowScenarios`, `allowSteps`, `allowNextActions`, `updatedAt`, `createdAt`

## Prompt (Phase45)
System:
- You are an ops assistant.
- Return a short, readable suggestion for human operators.
- Rules:
- Never propose actions outside allowedNextActions.
- If readiness is NOT_READY, propose only STOP_AND_ESCALATE.
- Provide a short reason (<= 1 sentence).
- Advisory only. Do not execute actions.

## Tasks
- T01: buildOpsAssistPrompt + fallback suggestion.
- T02: ops_assist_cache + Ops Console view includeAssist.
- T03: automation dry-run endpoint + guard.
- T04: automation_config read-only SSOT.
- T05: full ops flow E2E test.

## Done Definition
- promptPayload が固定され、fallback で nextAction が必ず返る。
- Ops Console detail で LLM提案が表示できる（read-only）。
- dry-run → execute の二段階がAPIで固定される。
- automation_config が read-only で取得できる（default disabled）。
- phase49 full ops flow test が PASS。

## Rollback
- revert implementation PR
- revert CLOSE docs PR
