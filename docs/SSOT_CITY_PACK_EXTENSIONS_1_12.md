# SSOT City Pack Extensions 1-12

## Purpose
- City Pack拡張1〜12を、既存実装を壊さずに add-only で段階導入するための契約を固定する。
- 勝ち条件は「全部実装」ではなく「運用が迷わない」「fail-closed」「traceId監査可能」。

## Fixed constraints
- SSOTは add-only。
- 既存通知API/既存 route の互換維持。
- LLMは提案/要約のみ（採用決定・延長決定・配信可否決定は禁止）。
- source有効期限は120日固定。
- `/admin/*` `/api/admin/*` `/internal/*` は既存保護を維持。
- すべての操作は `traceId` を `audit_logs` と紐付ける。

## Extension blocks
### B1: 構造固定・スケール
1. targeting宣言化（Rule Pack）
2. slot固定（Slot-based Pack）
8. base→override継承（1段制限）
12. import/export + テンプレライブラリ化

### B2: 監査・安全
3. source種類/必須度モデル化
4. fallback CTA
6. 監査二段階（軽→重）
7. 信頼度スコア

### B3: 運用省力
5. Change Bulletinドラフト
9. ユーザー誤り報告導線（feedback）
11. 更新提案（計画自動、適用は人間）

### B4: 計測・効果
10. 効果測定（最小安全）

### B5: 公立学校リンク運用（add-only）
13. `link_registry` 教育メタ拡張（`domainClass/schoolType/eduScope/regionKey/tags`）
14. `city_pack` school slot の `schoolType=public` fail-closed 検証
15. `municipality_schools` / `school_calendar_links` の追加
16. 120日監査 + `diff_detected -> city_pack_bulletins(draft)` 自動作成（送信は人間承認のみ）

## Dependency
```text
B1 -> B2 -> B3
B1 + B2 -> B4
B3 -> B4
B2 -> B5
B5 -> B3
```

## PR sequence contract
- PR0: docs導線固定（この文書 + phase計画）
- PR1: targeting/slots
- PR2: sourceType/required + fallback CTA
- PR3: 二段監査 + 信頼度スコア + Inbox優先度
- PR4: base→override（1段）
- PR5: feedback導線
- PR6: Change Bulletin + 更新提案（人間承認必須）
- PR7: 最小効果測定
- PR8: import/export + template library

## Audit contract
- action命名規約: `city_pack.<block>.<verb>`
- 最低記録項目:
  - `traceId`
  - `requestId`（存在時）
  - `actor`
  - `entityType`/`entityId`
  - `payloadSummary`（機微情報を含めない）

## Prohibited
- 自動公開、自動延長、自動配信可否決定
- direct URL の許可
- 既存validators/既存SOURCE_*のバイパス
