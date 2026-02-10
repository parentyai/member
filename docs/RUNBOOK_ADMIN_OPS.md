# RUNBOOK_ADMIN_OPS

管理UI（運用OS）で日次運用・事故対応・証跡確定を自走するための runbook。

## Preconditions
- 主チャネル: LINE公式アカウントのみ
- kill switch は「送信副作用の最終停止装置」
- traceId は監査の主キー（Trace Search で追えること）

## Daily Ops (ServicePhase1 / 運用OS v1)
推奨順序（迷わないための一本道）。

1) `/admin/ops`
   - Ops Console list → detail
   - risk / lastReactionAt / blockingReasons を確認
2) `/admin/monitor`
   - 通知単位の reactionSummary / health / CTR を確認
3) `/admin/errors`
   - retry queue / link WARN / guard拒否 を確認
4) `/admin/trace-search`（= `/admin/ops` 内 Trace Search）
   - traceId で view → decision → execute が追えるか確認

## Composer Flow (通知作成 → 承認 → 送信)
1) `/admin/composer`
   - draft 作成（title/body/cta/linkRegistryId/target/scenario/step）
   - preview で本文とリンクを確認
   - approve（active化）
   - plan → confirm token を取得
   - execute（confirm token 必須）
2) Monitor で反応/CTR を確認

## Incident Response (事故時)
1) kill switch ON（Operations）
2) traceId を取得（Ops/Composer/Monitor/Error Console）
3) `/api/admin/trace?traceId=...` で audits/decisions/timeline を確認
4) 原因分類（例）
   - kill switch on（意図した停止）
   - guard拒否（confirm token mismatch / plan mismatch）
   - link WARN
   - send failure → retry queue
5) Mitigation（人間判断）
   - 再送/停止/テンプレ差し替え/リンク差し替え
6) Rollback
   - 実装PR を revert（必要なら）

## Evidence (監査証跡)
最低限、以下が traceId から取得できること。

- audits: view / plan / execute / kill switch set
- decisions: submit / execute（該当する場合）
- timeline: DECIDE / EXECUTE（該当する場合）

