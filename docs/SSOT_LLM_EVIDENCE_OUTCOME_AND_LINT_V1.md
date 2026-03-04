# SSOT_LLM_EVIDENCE_OUTCOME_AND_LINT_V1

## Scope
- add-only 仕様。
- 既存の URL 表示契約 `(source: domain/path)` を維持。

## Confidence Rule
- `intentConfidence < 0.60` または `contextConfidence < 0.55` の場合:
  - 会話状態を `CLARIFY` に強制
  - 確認質問は最大1つ

## EvidenceNeed / EvidenceOutcome
- `Mode A -> evidenceNeed=none`
- `Mode B -> evidenceNeed=required`
- `Mode C -> evidenceNeed=optional`

`evidenceOutcome`:
- `SUPPORTED`: 許可ランクURLを脚注表示可
- `INSUFFICIENT`: 根拠不足。URL非表示 + 公式確認誘導
- `BLOCKED`: 注入/検索失敗/拒否理由。URL非表示 + 短い理由

## Post-render Safety Lint (必須)
レンダリング後に必ず実行:
- `http(s)://` / `www.` を除去
- URL上限超過を切詰め
- 断定語を弱化（例: 必ず/絶対/100%）
- 高リスク領域の断言を注意表現へ置換
- 変更結果は `postRenderLint{ findings[], modified }` として監査に残す

## URL Guard Continuity
- 表示は `(source: domain/path)` のみ。
- フルURLは本文に表示しない。
- mode/tier/rank 制約を満たさないURLは表示しない。
