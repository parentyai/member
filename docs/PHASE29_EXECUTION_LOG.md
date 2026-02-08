UTC: 2026-02-08T04:07:56Z
main SHA: ca17b0df6742ffdd64743393badaaa963c93b994
Action: "Phase29 START (ops-console list: UI統一 + optional cursor署名)"
Notes:
- Scope IN: A) `nextPageToken` を次回 `cursor` に渡す運用のSSOT化（docs + tests）
- Scope IN: B) optional cursor署名（HMAC）を後方互換で追加（secret未設定時は従来通り）
- Scope OUT: コスト最適化（Firestore read削減）、UI改修、フィルタ追加、署名強制（デフォルト）
Rollback: revert this PR
